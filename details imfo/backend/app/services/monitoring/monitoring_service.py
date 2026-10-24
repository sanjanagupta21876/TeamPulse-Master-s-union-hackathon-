import asyncio
from datetime import datetime, timezone
import json
import time
from typing import Dict, List, Optional, Set
import uuid

from app.schemas.bug_report import Finding, RepositoryAnalysisResponse
from app.schemas.monitoring import (
    AnalysisJobRecord,
    FindingComparisonSummary,
    JobRetryResponse,
    RepositoryMonitoringSettings,
    WebhookEventRecord,
    WebhookResponse,
)
from app.services.analysis_engine import AnalysisEngine
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.github_service import GitHubService, GitHubServiceError
from app.services.monitoring.comparator import FindingComparator
from app.services.monitoring.storage import MonitoringStorage, monitoring_storage
from app.services.monitoring.webhook_verifier import WebhookVerifier
from app.utils.file_filters import should_skip_file


class WebhookVerificationError(Exception):
    def __init__(self, message: str = "Invalid GitHub webhook signature"):
        self.message = message
        super().__init__(message)


class MonitoringService:
    """
    Core service orchestrating live GitHub webhook monitoring, changed-file detection,
    asynchronous background analysis, finding diff comparisons, and job lifecycle management.
    """

    def __init__(
        self,
        verifier: Optional[WebhookVerifier] = None,
        storage: Optional[MonitoringStorage] = None,
        analysis_engine: Optional[AnalysisEngine] = None,
        github_service: Optional[GitHubService] = None,
        comparator: Optional[FindingComparator] = None,
    ):
        self.verifier = verifier or WebhookVerifier()
        self.storage = storage or monitoring_storage
        self.github_service = github_service or GitHubService()
        self.analysis_engine = analysis_engine or AnalysisEngine(github_service=self.github_service)
        self.comparator = comparator or FindingComparator()

    async def handle_webhook(
        self,
        raw_payload: bytes,
        signature_header: Optional[str],
        event_type: str,
        delivery_id: str,
    ) -> WebhookResponse:
        """
        Processes an incoming GitHub webhook.
        Validates HMAC signature, checks idempotency, parses payload, and queues analysis if needed.
        """
        # 1. Cryptographic signature verification
        if not self.verifier.verify_signature(raw_payload, signature_header):
            raise WebhookVerificationError("Webhook signature verification failed or signature header missing.")

        # 2. Idempotency check via X-GitHub-Delivery
        if self.storage.has_delivery(delivery_id):
            return WebhookResponse(
                status="ignored",
                event=event_type,
                delivery_id=delivery_id,
                message="Duplicate webhook delivery already processed.",
            )

        # 3. Parse JSON payload
        try:
            payload = json.loads(raw_payload.decode("utf-8"))
        except Exception:
            raise ValueError("Malformed JSON payload in webhook body.")

        # 4. Handle Ping Event
        if event_type == "ping":
            repo_name = payload.get("repository", {}).get("full_name", "unknown/repo")
            self.storage.update_settings(
                repository=repo_name,
                webhook_configured=True,
                last_webhook_event_at=datetime.now(timezone.utc).isoformat(),
            )
            event_record = WebhookEventRecord(
                delivery_id=delivery_id,
                event_type="ping",
                repository=repo_name,
                sender=payload.get("sender", {}).get("login"),
                status="processed",
            )
            self.storage.save_event(event_record)
            return WebhookResponse(
                status="ok",
                event="ping",
                delivery_id=delivery_id,
                message="Webhook ping acknowledged successfully; monitoring is configured.",
            )

        # 5. Handle Push Event
        if event_type == "push":
            return await self._handle_push_event(payload, delivery_id)

        # 6. Handle Pull Request Event
        if event_type == "pull_request":
            return await self._handle_pull_request_event(payload, delivery_id)

        # Other events are ignored gracefully
        repo_name = payload.get("repository", {}).get("full_name", "unknown/repo")
        self.storage.save_event(
            WebhookEventRecord(
                delivery_id=delivery_id,
                event_type=event_type,
                repository=repo_name,
                status="skipped",
                error_message=f"Event type '{event_type}' is not monitored.",
            )
        )
        return WebhookResponse(
            status="ignored",
            event=event_type,
            delivery_id=delivery_id,
            message=f"Event type '{event_type}' ignored.",
        )

    async def _handle_push_event(self, payload: dict, delivery_id: str) -> WebhookResponse:
        repo_data = payload.get("repository", {})
        repo_name = repo_data.get("full_name", "")
        ref = payload.get("ref", "")
        branch = ref.split("refs/heads/")[-1] if "refs/heads/" in ref else ref
        before_sha = payload.get("before", "")
        after_sha = payload.get("after", "")
        is_deleted = payload.get("deleted", False) or after_sha == "0000000000000000000000000000000000000000"
        is_forced = payload.get("forced", False)
        sender = payload.get("sender", {}).get("login")

        # Collect changed files across commits in push
        added: List[str] = []
        modified: List[str] = []
        removed: List[str] = []
        commits = payload.get("commits", [])
        for commit in commits:
            added.extend(commit.get("added", []))
            modified.extend(commit.get("modified", []))
            removed.extend(commit.get("removed", []))

        # Filter duplicates while preserving order
        added = list(dict.fromkeys(added))
        modified = list(dict.fromkeys(modified))
        removed = list(dict.fromkeys(removed))

        event_record = WebhookEventRecord(
            delivery_id=delivery_id,
            event_type="push",
            repository=repo_name,
            sender=sender,
            ref=ref,
            branch=branch,
            before_sha=before_sha,
            after_sha=after_sha,
            commits_count=len(commits),
            added_files=added,
            modified_files=modified,
            removed_files=removed,
            is_forced=is_forced,
            is_deleted=is_deleted,
            status="received",
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        self.storage.update_settings(
            repository=repo_name,
            last_webhook_event_at=now_iso,
            webhook_configured=True,
        )

        # Handle branch deletion edge case safely
        if is_deleted:
            event_record.status = "processed"
            event_record.error_message = "Branch was deleted; analysis skipped."
            self.storage.save_event(event_record)
            return WebhookResponse(
                status="ok",
                event="push",
                delivery_id=delivery_id,
                message="Branch deletion detected; no analysis required.",
            )

        # Check repository monitoring settings
        settings = self.storage.get_or_create_settings(repo_name)
        if not settings.is_active:
            event_record.status = "skipped"
            event_record.error_message = "Repository monitoring is currently disabled."
            self.storage.save_event(event_record)
            return WebhookResponse(
                status="skipped",
                event="push",
                delivery_id=delivery_id,
                message="Automatic monitoring is disabled for this repository.",
            )

        # Branch filtering
        if not settings.analyze_all_branches and branch not in settings.monitored_branches:
            event_record.status = "skipped"
            event_record.error_message = f"Branch '{branch}' is not in monitored branches list."
            self.storage.save_event(event_record)
            return WebhookResponse(
                status="skipped",
                event="push",
                delivery_id=delivery_id,
                message=f"Branch '{branch}' is not monitored.",
            )

        # Prevent duplicate jobs for same repository and commit SHA
        if not self.storage.can_enqueue_job(repo_name, after_sha):
            event_record.status = "skipped"
            event_record.error_message = f"Analysis job already active for commit {after_sha}."
            self.storage.save_event(event_record)
            return WebhookResponse(
                status="skipped",
                event="push",
                delivery_id=delivery_id,
                message=f"Analysis job already active for commit {after_sha[:8]}.",
            )

        # Create and queue analysis job
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        job = AnalysisJobRecord(
            job_id=job_id,
            repository=repo_name,
            branch=branch,
            commit_sha=after_sha,
            trigger="webhook_push",
            status="queued",
        )
        self.storage.save_job(job)

        event_record.status = "queued"
        self.storage.save_event(event_record)

        self.storage.update_settings(
            repository=repo_name,
            latest_job_id=job_id,
            latest_job_status="queued",
        )

        # Launch background processing asynchronously
        asyncio.create_task(self.run_analysis_job(job_id, changed_files=added + modified))

        return WebhookResponse(
            status="queued",
            event="push",
            delivery_id=delivery_id,
            job_id=job_id,
            message=f"Analysis job {job_id} queued for branch '{branch}' at commit {after_sha[:8]}.",
        )

    async def _handle_pull_request_event(self, payload: dict, delivery_id: str) -> WebhookResponse:
        action = payload.get("action", "")
        repo_data = payload.get("repository", {})
        repo_name = repo_data.get("full_name", "")
        pr_data = payload.get("pull_request", {})
        head = pr_data.get("head", {})
        head_sha = head.get("sha", "")
        branch = head.get("ref", "")
        sender = payload.get("sender", {}).get("login")

        event_record = WebhookEventRecord(
            delivery_id=delivery_id,
            event_type="pull_request",
            repository=repo_name,
            sender=sender,
            branch=branch,
            after_sha=head_sha,
            status="received",
        )

        self.storage.update_settings(
            repository=repo_name,
            last_webhook_event_at=datetime.now(timezone.utc).isoformat(),
            webhook_configured=True,
        )

        if action in ("opened", "synchronize", "reopened"):
            settings = self.storage.get_or_create_settings(repo_name)
            if settings.is_active and (settings.analyze_all_branches or branch in settings.monitored_branches):
                if self.storage.can_enqueue_job(repo_name, head_sha):
                    job_id = f"job_{uuid.uuid4().hex[:12]}"
                    job = AnalysisJobRecord(
                        job_id=job_id,
                        repository=repo_name,
                        branch=branch,
                        commit_sha=head_sha,
                        trigger="webhook_pr",
                        status="queued",
                    )
                    self.storage.save_job(job)
                    event_record.status = "queued"
                    self.storage.save_event(event_record)
                    asyncio.create_task(self.run_analysis_job(job_id))
                    return WebhookResponse(
                        status="queued",
                        event="pull_request",
                        delivery_id=delivery_id,
                        job_id=job_id,
                        message=f"Pull request analysis job {job_id} queued for PR #{pr_data.get('number')}.",
                    )

        event_record.status = "processed"
        self.storage.save_event(event_record)
        return WebhookResponse(
            status="ok",
            event="pull_request",
            delivery_id=delivery_id,
            message=f"Pull request action '{action}' recorded.",
        )

    async def run_analysis_job(
        self,
        job_id: str,
        changed_files: Optional[List[str]] = None,
    ) -> Optional[AnalysisJobRecord]:
        """
        Executes the static-analysis pipeline for an analysis job in the background.
        Computes findings diff against prior scan, updates repository metrics, and marks job status.
        """
        job = self.storage.get_job(job_id)
        if not job:
            return None

        start_time = time.time()
        start_iso = datetime.now(timezone.utc).isoformat()
        self.storage.update_job_status(job_id, status="running", started_at=start_iso)
        self.storage.update_settings(job.repository, latest_job_status="running")

        try:
            repo_url = f"https://github.com/{job.repository}"
            analysis_result: RepositoryAnalysisResponse = await self.analysis_engine.analyze_repository(
                repository_url=repo_url,
                branch=job.branch,
            )

            execution_time = round(time.time() - start_time, 2)
            completion_iso = datetime.now(timezone.utc).isoformat()

            # Retrieve prior scan records for this repository to perform comparative analysis
            owner, repo_name = job.repository.split("/")
            existing_scans = diagnosis_storage.list_scans_for_repo(owner, repo_name)
            # Find the most recent scan before the current one
            prior_scans = [s for s in existing_scans if s.scan_id != analysis_result.scan_id]
            prior_scans.sort(key=lambda s: s.created_at, reverse=True)
            previous_scan = prior_scans[0] if prior_scans else None

            # Determine analyzed files for comparison
            analyzed_files: Set[str] = set()
            if changed_files:
                analyzed_files.update(changed_files)
            for finding in analysis_result.findings:
                analyzed_files.add(finding.file_path)

            comparison = None
            if previous_scan:
                comparison = self.comparator.compare(
                    previous_findings=previous_scan.findings,
                    current_findings=analysis_result.findings,
                    analyzed_files=analyzed_files,
                    previous_commit_sha=previous_scan.commit_sha,
                    new_commit_sha=job.commit_sha,
                    is_full_scan=True,
                )
            else:
                # First analysis: all findings are newly discovered
                comparison = FindingComparisonSummary(
                    new_findings_count=len(analysis_result.findings),
                    resolved_findings_count=0,
                    persistent_findings_count=0,
                    new_finding_ids=[f.id for f in analysis_result.findings],
                    resolved_finding_ids=[],
                    persistent_finding_ids=[],
                    previous_commit_sha=None,
                    new_commit_sha=job.commit_sha,
                )

            final_status = "partial" if analysis_result.analysis.analyzers_failed else "completed"

            updated_job = self.storage.update_job_status(
                job_id=job_id,
                status=final_status,
                completed_at=completion_iso,
                execution_time_seconds=execution_time,
                scan_id=analysis_result.scan_id,
                comparison=comparison,
                findings_count=len(analysis_result.findings),
            )

            self.storage.update_settings(
                repository=job.repository,
                last_analyzed_at=completion_iso,
                latest_commit_sha=job.commit_sha,
                latest_job_id=job_id,
                latest_job_status=final_status,
            )

            return updated_job

        except Exception as exc:
            execution_time = round(time.time() - start_time, 2)
            completion_iso = datetime.now(timezone.utc).isoformat()
            updated_job = self.storage.update_job_status(
                job_id=job_id,
                status="failed",
                completed_at=completion_iso,
                execution_time_seconds=execution_time,
                error=str(exc),
            )
            self.storage.update_settings(
                repository=job.repository,
                latest_job_id=job_id,
                latest_job_status="failed",
            )
            return updated_job

    async def retry_job(self, job_id: str) -> JobRetryResponse:
        """
        Retries an analysis job that failed or needs re-running.
        """
        job = self.storage.get_job(job_id)
        if not job:
            raise ValueError(f"Analysis job '{job_id}' not found.")

        job.retry_count += 1
        job.status = "queued"
        job.error = None
        self.storage.save_job(job)

        self.storage.update_settings(
            repository=job.repository,
            latest_job_id=job_id,
            latest_job_status="queued",
        )

        asyncio.create_task(self.run_analysis_job(job_id))

        return JobRetryResponse(
            job_id=job_id,
            status="queued",
            message=f"Job {job_id} successfully re-queued for analysis.",
        )

    async def trigger_manual_analysis(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
    ) -> AnalysisJobRecord:
        """
        Manually triggers an analysis job for the latest commit on the repository/branch.
        """
        repo_full_name = f"{owner}/{repo}"
        repo_url = f"https://github.com/{repo_full_name}"

        # Resolve latest commit SHA
        inspection = await self.github_service.inspect_repository(
            repository_url=repo_url,
            branch=branch,
        )

        target_branch = branch or inspection.repository.default_branch
        latest_sha = inspection.repository.latest_commit_sha

        job_id = f"job_{uuid.uuid4().hex[:12]}"
        job = AnalysisJobRecord(
            job_id=job_id,
            repository=repo_full_name,
            branch=target_branch,
            commit_sha=latest_sha,
            trigger="manual",
            status="queued",
        )
        self.storage.save_job(job)

        self.storage.update_settings(
            repository=repo_full_name,
            latest_job_id=job_id,
            latest_job_status="queued",
        )

        asyncio.create_task(self.run_analysis_job(job_id))
        return job


# Global monitoring service singleton
monitoring_service = MonitoringService()

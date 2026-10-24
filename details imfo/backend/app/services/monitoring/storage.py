from datetime import datetime, timezone
import threading
from typing import Dict, List, Optional, Set
from app.schemas.monitoring import (
    AnalysisJobRecord,
    RepositoryMonitoringSettings,
    WebhookEventRecord,
)


class MonitoringStorage:
    """
    Thread-safe repository monitoring, webhook event, and background job storage.
    Enforces idempotency using delivery IDs and prevents concurrent duplicate jobs.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._settings: Dict[str, RepositoryMonitoringSettings] = {}
        self._processed_deliveries: Set[str] = set()
        self._events: Dict[str, WebhookEventRecord] = {}
        self._jobs: Dict[str, AnalysisJobRecord] = {}
        self._active_commit_jobs: Set[str] = set()  # "repo:commit_sha"

    def get_or_create_settings(self, repository: str) -> RepositoryMonitoringSettings:
        repo_key = repository.lower()
        with self._lock:
            if repo_key not in self._settings:
                self._settings[repo_key] = RepositoryMonitoringSettings(
                    repository=repository
                )
            return self._settings[repo_key]

    def update_settings(
        self,
        repository: str,
        is_active: Optional[bool] = None,
        monitored_branches: Optional[List[str]] = None,
        analyze_all_branches: Optional[bool] = None,
        auto_diagnose_high_priority: Optional[bool] = None,
        webhook_configured: Optional[bool] = None,
        last_webhook_event_at: Optional[str] = None,
        last_analyzed_at: Optional[str] = None,
        latest_commit_sha: Optional[str] = None,
        latest_job_id: Optional[str] = None,
        latest_job_status: Optional[str] = None,
    ) -> RepositoryMonitoringSettings:
        repo_key = repository.lower()
        with self._lock:
            if repo_key not in self._settings:
                self._settings[repo_key] = RepositoryMonitoringSettings(
                    repository=repository
                )
            settings = self._settings[repo_key]
            if is_active is not None:
                settings.is_active = is_active
            if monitored_branches is not None:
                settings.monitored_branches = monitored_branches
            if analyze_all_branches is not None:
                settings.analyze_all_branches = analyze_all_branches
            if auto_diagnose_high_priority is not None:
                settings.auto_diagnose_high_priority = auto_diagnose_high_priority
            if webhook_configured is not None:
                settings.webhook_configured = webhook_configured
            if last_webhook_event_at is not None:
                settings.last_webhook_event_at = last_webhook_event_at
            if last_analyzed_at is not None:
                settings.last_analyzed_at = last_analyzed_at
            if latest_commit_sha is not None:
                settings.latest_commit_sha = latest_commit_sha
            if latest_job_id is not None:
                settings.latest_job_id = latest_job_id
            if latest_job_status is not None:
                settings.latest_job_status = latest_job_status
            return settings

    def has_delivery(self, delivery_id: str) -> bool:
        with self._lock:
            return delivery_id in self._processed_deliveries

    def record_delivery(self, delivery_id: str):
        with self._lock:
            self._processed_deliveries.add(delivery_id)

    def save_event(self, event: WebhookEventRecord) -> WebhookEventRecord:
        with self._lock:
            self._events[event.delivery_id] = event
            self._processed_deliveries.add(event.delivery_id)
            return event

    def get_event(self, delivery_id: str) -> Optional[WebhookEventRecord]:
        with self._lock:
            return self._events.get(delivery_id)

    def list_events_for_repo(self, repository: str) -> List[WebhookEventRecord]:
        repo_key = repository.lower()
        with self._lock:
            events = [e for e in self._events.values() if e.repository.lower() == repo_key]
            events.sort(key=lambda x: x.received_at, reverse=True)
            return events

    def can_enqueue_job(self, repository: str, commit_sha: str) -> bool:
        key = f"{repository.lower()}:{commit_sha}"
        with self._lock:
            return key not in self._active_commit_jobs

    def save_job(self, job: AnalysisJobRecord) -> AnalysisJobRecord:
        with self._lock:
            self._jobs[job.job_id] = job
            if job.status in ("queued", "running"):
                self._active_commit_jobs.add(f"{job.repository.lower()}:{job.commit_sha}")
            elif job.status in ("completed", "partial", "failed"):
                self._active_commit_jobs.discard(f"{job.repository.lower()}:{job.commit_sha}")
            return job

    def get_job(self, job_id: str) -> Optional[AnalysisJobRecord]:
        with self._lock:
            return self._jobs.get(job_id)

    def update_job_status(
        self,
        job_id: str,
        status: str,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
        execution_time_seconds: Optional[float] = None,
        scan_id: Optional[str] = None,
        error: Optional[str] = None,
        comparison=None,
        findings_count: Optional[int] = None,
    ) -> Optional[AnalysisJobRecord]:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            job.status = status
            if started_at:
                job.started_at = started_at
            if completed_at:
                job.completed_at = completed_at
            if execution_time_seconds is not None:
                job.execution_time_seconds = execution_time_seconds
            if scan_id:
                job.scan_id = scan_id
            if error is not None:
                job.error = error
            if comparison is not None:
                job.comparison = comparison
            if findings_count is not None:
                job.findings_count = findings_count

            if status in ("completed", "partial", "failed"):
                self._active_commit_jobs.discard(f"{job.repository.lower()}:{job.commit_sha}")
            elif status in ("queued", "running"):
                self._active_commit_jobs.add(f"{job.repository.lower()}:{job.commit_sha}")

            return job

    def list_jobs_for_repo(self, repository: str) -> List[AnalysisJobRecord]:
        repo_key = repository.lower()
        with self._lock:
            jobs = [j for j in self._jobs.values() if j.repository.lower() == repo_key]
            jobs.sort(key=lambda x: x.queued_at, reverse=True)
            return jobs

    def clear(self):
        with self._lock:
            self._settings.clear()
            self._processed_deliveries.clear()
            self._events.clear()
            self._jobs.clear()
            self._active_commit_jobs.clear()


# Global monitoring storage instance
monitoring_storage = MonitoringStorage()

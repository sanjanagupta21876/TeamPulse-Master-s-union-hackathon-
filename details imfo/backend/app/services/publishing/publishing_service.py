import re
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
import httpx

from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal
from app.schemas.publishing import (
    GitHubAuthStatus,
    PublishBranchRequest,
    PublishBranchResponse,
    CreatePullRequestRequest,
    PullRequestRecord,
    PublishEligibilityCheck,
    PublishStatusResponse,
)
from app.schemas.verification import VerificationRecord
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.fixes.storage import fix_storage, FixStorage
from app.services.publishing.github_client import (
    BranchConflictError,
    BranchDivergedError,
    GitHubAuthError,
    GitHubClientError,
    GitHubPublisherClient,
)
from app.services.publishing.pr_description_builder import PRDescriptionBuilder
from app.services.publishing.storage import publishing_storage, PublishingStorage
from app.services.verification.storage import verification_storage, VerificationStorage


class PublishingError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class PublishingService:
    """
    Coordinates GitHub branch publishing, isolated patch commits, and pull request creation.
    Enforces approval and verification prerequisites, protects default branches,
    and prevents accidental branch overwrites or secret leaks.
    """

    def __init__(
        self,
        github_client: Optional[GitHubPublisherClient] = None,
        pr_builder: Optional[PRDescriptionBuilder] = None,
        storage_instance: Optional[PublishingStorage] = None,
        fix_storage_instance: Optional[FixStorage] = None,
        verification_storage_instance: Optional[VerificationStorage] = None,
    ):
        self.client = github_client or GitHubPublisherClient()
        self.pr_builder = pr_builder or PRDescriptionBuilder()
        self.storage = storage_instance or publishing_storage
        self.fix_storage = fix_storage_instance or fix_storage
        self.verification_storage = verification_storage_instance or verification_storage

    async def get_auth_status(self, http_client: Optional[httpx.AsyncClient] = None) -> GitHubAuthStatus:
        return await self.client.get_auth_status(client=http_client)

    async def check_eligibility(
        self,
        fix_id: str,
        target_branch: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> PublishEligibilityCheck:
        """
        Validates whether a fix proposal satisfies all preconditions for publishing.
        """
        reasons: List[str] = []
        proposal = self.fix_storage.get_fix(fix_id)

        if not proposal:
            raise PublishingError(
                code="FIX_NOT_FOUND",
                message=f"Fix proposal '{fix_id}' was not found.",
                status_code=404,
            )

        is_approved = proposal.status == "approved"
        if not is_approved:
            reasons.append(f"Proposal status is '{proposal.status}'. Must be explicitly 'approved' by developer.")

        # Check verification records
        verifications = self.verification_storage.list_for_fix(fix_id)
        is_verified = False
        if verifications:
            latest_v = verifications[0]
            if latest_v.patch_application_status == "applied" and latest_v.static_checks_status == "passed":
                is_verified = True
            else:
                reasons.append(f"Verification checks not fully passed (static: {latest_v.static_checks_status}).")
        else:
            reasons.append("Fix proposal has not yet undergone isolated workspace verification.")

        # Resolve target branch
        owner, repo = self._parse_repo_id(proposal.repository_id)
        effective_branch = target_branch or "main"
        branch_head_matches = True
        current_head = None

        # Check branch head on GitHub if token is active
        auth = await self.get_auth_status(http_client=http_client)
        if auth.connected and auth.can_publish:
            try:
                head_sha, _ = await self.client.get_branch_head(owner, repo, effective_branch, client=http_client)
                current_head = head_sha
                if head_sha != proposal.commit_sha:
                    branch_head_matches = False
                    reasons.append(
                        f"Target branch '{effective_branch}' has advanced (HEAD: {head_sha[:7]}) from the commit analyzed ({proposal.commit_sha[:7]})."
                    )
            except GitHubClientError as g_err:
                reasons.append(f"Unable to verify target branch '{effective_branch}': {g_err.message}")

        eligible = is_approved and is_verified

        return PublishEligibilityCheck(
            eligible=eligible,
            proposal_id=proposal.id,
            repository=proposal.repository_id,
            target_branch=effective_branch,
            source_commit_sha=proposal.commit_sha,
            is_approved=is_approved,
            is_verified=is_verified,
            branch_head_matches=branch_head_matches,
            current_branch_head_sha=current_head,
            reasons=reasons,
        )

    async def publish_branch(
        self,
        fix_id: str,
        request: PublishBranchRequest,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> PublishBranchResponse:
        """
        Publishes the approved patch to a dedicated GitHub branch.
        Never commits directly to default or base branch.
        """
        # 1. Verify eligibility
        proposal = self.fix_storage.get_fix(fix_id)
        if not proposal:
            raise PublishingError(
                code="FIX_NOT_FOUND",
                message=f"Fix proposal '{fix_id}' was not found.",
                status_code=404,
            )

        if proposal.status != "approved":
            raise PublishingError(
                code="PROPOSAL_NOT_APPROVED",
                message=f"Proposal '{fix_id}' is in status '{proposal.status}'. Only approved proposals can be published.",
                status_code=400,
            )

        verifications = self.verification_storage.list_for_fix(fix_id)
        if not verifications or verifications[0].patch_application_status != "applied":
            raise PublishingError(
                code="PROPOSAL_NOT_VERIFIED",
                message="Proposal must pass isolated workspace verification before publishing to a branch.",
                status_code=400,
            )

        # 2. Check GitHub credentials
        auth = await self.get_auth_status(http_client=http_client)
        if not auth.connected:
            raise GitHubAuthError("Cannot publish branch: GitHub authentication credentials are not configured.")

        owner, repo = self._parse_repo_id(proposal.repository_id)
        base_branch = request.target_branch or "main"

        # 3. Generate safe branch name (prevent default branch overwrite)
        finding = self._find_finding(proposal.finding_id)
        branch_name = self._generate_branch_name(
            finding=finding,
            proposal=proposal,
            custom_name=request.custom_branch_name,
        )

        if (
            request.custom_branch_name
            and request.custom_branch_name.strip().lower() in ("main", "master", "develop", "release", base_branch.lower())
        ) or branch_name.lower() in ("main", "master", "develop", "release", base_branch.lower()):
            raise PublishingError(
                code="DISALLOWED_BRANCH_NAME",
                message=f"Directly publishing to or mirroring protected base branch '{base_branch}' is strictly prohibited.",
                status_code=400,
            )

        # 4. Check if branch already exists
        exists = await self.client.check_branch_exists(owner, repo, branch_name, client=http_client)
        if exists:
            if request.custom_branch_name:
                raise PublishingError(
                    code="BRANCH_ALREADY_EXISTS",
                    message=f"Branch '{branch_name}' already exists in '{owner}/{repo}'. Please choose a different branch name.",
                    status_code=409,
                )
            # Append unique suffix to prevent accidental overwrite
            branch_name = f"{branch_name}-{uuid.uuid4().hex[:6]}"

        # 5. Create new branch pointing to original commit SHA
        try:
            await self.client.create_branch(
                owner=owner,
                repo=repo,
                new_branch=branch_name,
                source_sha=proposal.commit_sha,
                client=http_client,
            )
        except BranchConflictError as c_err:
            raise PublishingError(code="BRANCH_ALREADY_EXISTS", message=str(c_err), status_code=409)

        # 6. Commit the approved change to the new branch
        commit_msg = f"fix: resolve {finding.title if finding else proposal.file_path} [CodeLens AI]"
        commit_sha, commit_url = await self.client.commit_file_change(
            owner=owner,
            repo=repo,
            branch=branch_name,
            file_path=proposal.file_path,
            content=proposal.proposed_content,
            commit_message=commit_msg,
            client=http_client,
        )

        # 7. Record and store response
        now_iso = datetime.now(timezone.utc).isoformat()
        publish_id = f"pub_{uuid.uuid4().hex[:12]}"
        record = PublishBranchResponse(
            publish_id=publish_id,
            fix_id=proposal.id,
            repository=proposal.repository_id,
            target_branch=base_branch,
            created_branch=branch_name,
            source_commit_sha=proposal.commit_sha,
            published_commit_sha=commit_sha or proposal.commit_sha,
            status="commit_created",
            commit_message=commit_msg,
            files_changed=[proposal.file_path],
            html_url=commit_url,
            created_at=now_iso,
        )

        return self.storage.save_publish_record(record)

    async def create_pull_request(
        self,
        fix_id: str,
        request: CreatePullRequestRequest,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> PullRequestRecord:
        """
        Creates a pull request on GitHub for an existing published fix branch.
        """
        proposal = self.fix_storage.get_fix(fix_id)
        if not proposal:
            raise PublishingError(
                code="FIX_NOT_FOUND",
                message=f"Fix proposal '{fix_id}' was not found.",
                status_code=404,
            )

        publish_record = self.storage.get_publish_for_fix(fix_id)
        if not publish_record:
            raise PublishingError(
                code="BRANCH_NOT_PUBLISHED",
                message="Cannot open pull request: A dedicated fix branch must be published first.",
                status_code=400,
            )

        # Check if PR was already created
        existing_pr = self.storage.get_pull_request_for_fix(fix_id)
        if existing_pr:
            return existing_pr

        owner, repo = self._parse_repo_id(proposal.repository_id)
        finding = self._find_finding(proposal.finding_id)
        verifications = self.verification_storage.list_for_fix(fix_id)
        latest_verification = verifications[0] if verifications else None

        title = request.title or self.pr_builder.build_pr_title(finding, proposal)
        body = request.body or self.pr_builder.build_pr_body(finding, proposal, latest_verification)

        pr_data = await self.client.create_pull_request(
            owner=owner,
            repo=repo,
            title=title,
            head_branch=publish_record.created_branch,
            base_branch=publish_record.target_branch,
            body=body,
            draft=request.draft,
            client=http_client,
        )

        pr_record = PullRequestRecord(
            pull_request_id=f"pr_{uuid.uuid4().hex[:12]}",
            fix_id=fix_id,
            publish_id=publish_record.publish_id,
            repository=proposal.repository_id,
            pr_number=pr_data.get("number", 0),
            title=pr_data.get("title", title),
            html_url=pr_data.get("html_url", ""),
            head_branch=publish_record.created_branch,
            base_branch=publish_record.target_branch,
            status=pr_data.get("state", "open"),
            summary=title,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        return self.storage.save_pull_request(pr_record)

    def get_publish_status(self, fix_id: str) -> PublishStatusResponse:
        proposal = self.fix_storage.get_fix(fix_id)
        if not proposal:
            raise PublishingError(
                code="FIX_NOT_FOUND",
                message=f"Fix proposal '{fix_id}' was not found.",
                status_code=404,
            )

        verifications = self.verification_storage.list_for_fix(fix_id)
        v_status = verifications[0].status if verifications else "unverified"
        publish_record = self.storage.get_publish_for_fix(fix_id)
        pr_record = self.storage.get_pull_request_for_fix(fix_id)

        return PublishStatusResponse(
            fix_id=fix_id,
            proposal_status=proposal.status,
            verification_status=v_status,
            publish_record=publish_record,
            pull_request=pr_record,
        )

    def get_pull_request(self, pr_id: str) -> Optional[PullRequestRecord]:
        return self.storage.get_pull_request(pr_id)

    def list_pull_requests_for_repo(self, owner: str, repo: str) -> List[PullRequestRecord]:
        target = f"{owner}/{repo}"
        return self.storage.list_pull_requests_for_repo(target)

    def _parse_repo_id(self, repo_id: str) -> Tuple[str, str]:
        parts = repo_id.strip().split("/")
        if len(parts) == 2:
            return parts[0], parts[1]
        return "owner", "repo"

    def _find_finding(self, finding_id: str) -> Optional[Finding]:
        for scan in diagnosis_storage._scans.values():
            for f in scan.findings:
                if f.id == finding_id:
                    return f
        return None

    def _generate_branch_name(
        self,
        finding: Optional[Finding],
        proposal: FixProposal,
        custom_name: Optional[str] = None,
    ) -> str:
        if custom_name:
            slug = re.sub(r"[^a-zA-Z0-9_-]", "-", custom_name.strip()).strip("-")
            return f"codelens/{slug}"

        short_id = proposal.finding_id.replace("fnd_", "")[:8]
        slug = "remediation"
        if finding and finding.title:
            slug = re.sub(r"[^a-zA-Z0-9]+", "-", finding.title.lower()).strip("-")[:25]
        return f"codelens/fix-{short_id}-{slug}"


publishing_service = PublishingService()

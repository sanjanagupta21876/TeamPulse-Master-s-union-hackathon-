import hashlib
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal
from app.schemas.verification import (
    VerificationRecord,
    VerificationRequest,
)
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.fixes.storage import fix_storage, FixStorage
from app.services.verification.patch_applier import PatchApplier
from app.services.verification.result_comparator import ResultComparator
from app.services.verification.storage import verification_storage, VerificationStorage
from app.services.verification.verification_policy import VerificationPolicy
from app.services.verification.verification_runner import VerificationRunner
from app.services.verification.workspace_manager import WorkspaceManager


class VerificationServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ProposalNotApprovedError(VerificationServiceError):
    def __init__(self, message: str):
        super().__init__(code="PROPOSAL_NOT_APPROVED", message=message, status_code=400)


class ProposalNotFoundError(VerificationServiceError):
    def __init__(self, message: str):
        super().__init__(code="PROPOSAL_NOT_FOUND", message=message, status_code=404)


class SourceHashMismatchError(VerificationServiceError):
    def __init__(self, message: str):
        super().__init__(code="SOURCE_HASH_MISMATCH", message=message, status_code=400)


class VerificationService:
    """
    Coordinates isolated patch application, static and syntax verification,
    controlled test execution, result comparison, and verification record auditing.
    """

    def __init__(
        self,
        workspace_manager: Optional[WorkspaceManager] = None,
        patch_applier: Optional[PatchApplier] = None,
        verification_runner: Optional[VerificationRunner] = None,
        result_comparator: Optional[ResultComparator] = None,
        verification_storage_instance: Optional[VerificationStorage] = None,
        fix_storage_instance: Optional[FixStorage] = None,
    ):
        self.workspace_manager = workspace_manager or WorkspaceManager()
        self.patch_applier = patch_applier or PatchApplier(self.workspace_manager)
        self.runner = verification_runner or VerificationRunner()
        self.comparator = result_comparator or ResultComparator()
        self.storage = verification_storage_instance or verification_storage
        self.fix_storage = fix_storage_instance or fix_storage

    async def verify_fix(
        self,
        fix_id: str,
        request: VerificationRequest,
    ) -> VerificationRecord:
        start_time = time.time()
        created_at_iso = datetime.now(timezone.utc).isoformat()
        verification_id = f"ver_{uuid.uuid4().hex[:12]}"

        # 1. Load and validate fix proposal
        proposal = self.fix_storage.get_fix(fix_id)
        if not proposal:
            raise ProposalNotFoundError(f"Fix proposal with id '{fix_id}' was not found.")

        # 2. Verify that proposal has been approved
        if proposal.status != "approved":
            raise ProposalNotApprovedError(
                f"Fix proposal '{fix_id}' is in status '{proposal.status}'. "
                "Only proposals approved by a developer may be verified in an isolated workspace."
            )

        # 3. Locate source commit and scan records
        scan = diagnosis_storage.get_scan(proposal.scan_id)
        if not scan:
            # Fallback scan lookup across stored records
            for s in diagnosis_storage._scans.values():
                if s.commit_sha == proposal.commit_sha:
                    scan = s
                    break

        if not scan:
            raise VerificationServiceError(
                code="SCAN_NOT_FOUND",
                message=f"Original scan record for commit '{proposal.commit_sha}' was not found.",
                status_code=404,
            )

        # 4. Verify original source hash matches recorded proposal
        original_source = scan.files.get(proposal.file_path)
        if not original_source:
            raise VerificationServiceError(
                code="SOURCE_UNAVAILABLE",
                message=f"File '{proposal.file_path}' was not found at commit {proposal.commit_sha}.",
                status_code=400,
            )

        current_hash = hashlib.sha256(original_source.encode("utf-8")).hexdigest()
        if current_hash != proposal.original_sha256:
            raise SourceHashMismatchError(
                f"Original source hash mismatch for '{proposal.file_path}': "
                f"expected {proposal.original_sha256[:10]}, found {current_hash[:10]}."
            )

        # Retrieve original findings on this target file
        original_file_findings = [
            f for f in scan.findings if f.file_path == proposal.file_path
        ]

        # 5. Create isolated temporary workspace
        workspace_path = None
        warnings: List[str] = []
        limitations: List[str] = []
        tools_executed: List[str] = []
        patch_applied = False
        patch_hash = None
        static_status = "not_requested"
        tests_status = "not_requested"
        patched_findings: List[Finding] = []

        try:
            workspace_path = self.workspace_manager.create_workspace(
                job_id=verification_id,
                files=scan.files,
                target_file_path=proposal.file_path,
            )

            # 6. Apply approved patch to isolated workspace
            (
                patch_applied,
                patch_msg,
                patch_hash,
            ) = self.patch_applier.apply_patch(workspace_path, proposal)

            if not patch_applied:
                warnings.append(patch_msg)
            else:
                # 7. Run static and syntax checks if requested
                if request.run_static_checks:
                    (
                        static_status,
                        patched_findings,
                        tools,
                        static_warns,
                    ) = await self.runner.run_static_checks(
                        workspace_path=workspace_path,
                        target_file=proposal.file_path,
                        repo=proposal.repository_id,
                        commit_sha=proposal.commit_sha,
                    )
                    tools_executed.extend(tools)
                    warnings.extend(static_warns)

                # 8. Run optional tests if requested
                (
                    tests_status,
                    test_warns,
                    test_limits,
                ) = await self.runner.run_tests(
                    workspace_path=workspace_path,
                    target_file=proposal.file_path,
                    repo=proposal.repository_id,
                    run_tests_requested=request.run_tests,
                )
                warnings.extend(test_warns)
                limitations.extend(test_limits)

        except Exception as err:
            warnings.append(f"Workspace execution error: {str(err)}")
            patch_applied = False
        finally:
            # 9. Ensure temporary workspace is completely cleaned up
            if workspace_path:
                self.workspace_manager.clean_workspace(workspace_path)

        # 10. Compare results against original commit findings
        (
            resolved_findings,
            remaining_findings,
            newly_introduced,
            assessment,
        ) = self.comparator.compare_results(
            target_finding_id=proposal.finding_id,
            original_file_findings=original_file_findings,
            patched_findings=patched_findings,
            patch_applied=patch_applied,
            static_status=static_status,
            tests_status=tests_status,
        )

        duration = round(time.time() - start_time, 3)
        completed_at_iso = datetime.now(timezone.utc).isoformat()

        # Determine overall verification job status
        if not patch_applied or static_status == "failed" or tests_status == "failed":
            overall_status = "failed"
        elif newly_introduced:
            overall_status = "partial"
        else:
            overall_status = "completed"

        record = VerificationRecord(
            verification_id=verification_id,
            fix_id=proposal.id,
            repository_id=proposal.repository_id,
            scan_id=proposal.scan_id,
            original_commit_sha=proposal.commit_sha,
            patch_hash=patch_hash,
            status=overall_status,
            workspace_status="cleaned_up",
            patch_application_status="applied" if patch_applied else "failed",
            static_checks_status=static_status,
            tests_status=tests_status,
            original_findings=original_file_findings,
            remaining_findings=remaining_findings,
            resolved_findings=resolved_findings,
            newly_introduced_findings=newly_introduced,
            execution_duration=duration,
            warnings=warnings,
            limitations=limitations,
            assessment=assessment,
            tools_executed=tools_executed,
            created_at=created_at_iso,
            completed_at=completed_at_iso,
        )

        return self.storage.save_verification(record)

    def get_verification(self, verification_id: str) -> Optional[VerificationRecord]:
        return self.storage.get_verification(verification_id)

    def list_verifications_for_fix(self, fix_id: str) -> List[VerificationRecord]:
        return self.storage.list_for_fix(fix_id)

    def cancel_verification(self, verification_id: str) -> Optional[VerificationRecord]:
        return self.storage.cancel_verification(verification_id)


verification_service = VerificationService()

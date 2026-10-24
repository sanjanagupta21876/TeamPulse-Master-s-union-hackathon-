import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from app.schemas.bug_report import Finding
from app.schemas.diagnosis import DiagnosisReport
from app.schemas.fix import DiffResult, FixProposal, PatchValidationResult
from app.services.diagnosis.storage import storage as diagnosis_storage, ScanRecord
from app.services.fixes.diff_service import DiffService
from app.services.fixes.patch_generator import PatchGenerator
from app.services.fixes.patch_validator import PatchValidator
from app.services.fixes.storage import fix_storage, FixStorage


class FixServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class FindingNotFoundError(FixServiceError):
    def __init__(self, message: str):
        super().__init__(code="FINDING_NOT_FOUND", message=message, status_code=404)


class FixNotFoundError(FixServiceError):
    def __init__(self, message: str):
        super().__init__(code="FIX_NOT_FOUND", message=message, status_code=404)


class SourceUnavailableError(FixServiceError):
    def __init__(self, message: str):
        super().__init__(code="SOURCE_UNAVAILABLE", message=message, status_code=400)


class FixService:
    """
    Orchestrates AI-assisted code fix proposal generation, patch validation,
    diff calculation, and the developer approval workflow.
    Ensures original repositories remain strictly unmodified.
    """

    def __init__(
        self,
        patch_generator: Optional[PatchGenerator] = None,
        patch_validator: Optional[PatchValidator] = None,
        diff_service: Optional[DiffService] = None,
        storage_instance: Optional[FixStorage] = None,
    ):
        self.generator = patch_generator or PatchGenerator()
        self.validator = patch_validator or PatchValidator()
        self.diff_service = diff_service or DiffService()
        self.storage = storage_instance or fix_storage

    async def generate_fix(
        self,
        finding_id: str,
        diagnosis_id: Optional[str] = None,
        instructions: Optional[str] = None,
    ) -> FixProposal:
        # 1. Locate finding and its parent scan
        scan, finding = self._find_scan_and_finding(finding_id)
        if not scan or not finding:
            raise FindingNotFoundError(
                f"Finding with id '{finding_id}' was not found in scanned repository records."
            )

        # 2. Retrieve original source code content
        original_content = scan.files.get(finding.file_path)
        if original_content is None:
            raise SourceUnavailableError(
                f"Original source content for '{finding.file_path}' at commit {scan.commit_sha} was unavailable."
            )

        original_sha256 = hashlib.sha256(original_content.encode("utf-8")).hexdigest()

        # 3. Load optional diagnosis
        diagnosis = None
        if diagnosis_id:
            diagnosis = diagnosis_storage.get_diagnosis(diagnosis_id)

        # 4. Generate proposed patch
        llm_fix = await self.generator.generate_patch(
            finding=finding,
            original_content=original_content,
            diagnosis=diagnosis,
            instructions=instructions,
        )

        # 5. Validate patch integrity, path traversal safety, and syntax
        validation = self.validator.validate_patch(
            file_path=finding.file_path,
            original_content=original_content,
            expected_sha256=original_sha256,
            proposed_content=llm_fix.proposed_content,
        )

        # 6. Calculate unified diff and structured line hunks
        diff = self.diff_service.calculate_diff(
            file_path=finding.file_path,
            original_content=original_content,
            proposed_content=llm_fix.proposed_content,
        )

        # 7. Assemble FixProposal
        fix_id = f"fix_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        status = "proposed" if validation.patch_integrity == "valid" else "invalid"

        proposal = FixProposal(
            id=fix_id,
            finding_id=finding.id,
            scan_id=scan.scan_id,
            repository_id=scan.repository,
            commit_sha=scan.commit_sha,
            file_path=finding.file_path,
            status=status,
            original_sha256=original_sha256,
            original_content=original_content,
            proposed_content=llm_fix.proposed_content,
            diff=diff,
            explanation=llm_fix.explanation,
            assumptions=llm_fix.assumptions,
            potential_regressions=llm_fix.potential_regressions,
            recommended_tests=llm_fix.recommended_tests,
            validation=validation,
            created_at=now_iso,
            updated_at=now_iso,
        )

        return self.storage.save_fix(proposal)

    def get_fix(self, fix_id: str) -> FixProposal:
        proposal = self.storage.get_fix(fix_id)
        if not proposal:
            raise FixNotFoundError(f"Fix proposal with id '{fix_id}' was not found.")
        return proposal

    def get_fix_diff(self, fix_id: str) -> DiffResult:
        proposal = self.get_fix(fix_id)
        if proposal.diff:
            return proposal.diff
        return self.diff_service.calculate_diff(
            file_path=proposal.file_path,
            original_content=proposal.original_content,
            proposed_content=proposal.proposed_content,
        )

    def list_fixes_for_finding(self, finding_id: str) -> List[FixProposal]:
        return self.storage.list_fixes_for_finding(finding_id)

    def approve_proposal(self, fix_id: str) -> FixProposal:
        proposal = self.get_fix(fix_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        proposal.status = "approved"
        proposal.approved_at = now_iso
        proposal.updated_at = now_iso
        return self.storage.save_fix(proposal)

    def reject_proposal(self, fix_id: str) -> FixProposal:
        proposal = self.get_fix(fix_id)
        now_iso = datetime.now(timezone.utc).isoformat()
        proposal.status = "rejected"
        proposal.rejected_at = now_iso
        proposal.updated_at = now_iso
        return self.storage.save_fix(proposal)

    async def regenerate_proposal(
        self,
        fix_id: str,
        instructions: Optional[str] = None,
    ) -> FixProposal:
        existing = self.get_fix(fix_id)
        # Create a new proposal while preserving the existing proposal in history
        new_proposal = await self.generate_fix(
            finding_id=existing.finding_id,
            diagnosis_id=None,
            instructions=instructions or f"Regenerated alternative fix for {existing.finding_id}",
        )
        return new_proposal

    def _find_scan_and_finding(
        self, finding_id: str
    ) -> Tuple[Optional[ScanRecord], Optional[Finding]]:
        for scan in diagnosis_storage._scans.values():
            for finding in scan.findings:
                if finding.id == finding_id:
                    return scan, finding
        return None, None

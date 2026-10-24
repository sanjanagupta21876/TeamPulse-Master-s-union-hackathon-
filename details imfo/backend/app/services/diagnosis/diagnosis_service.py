import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.schemas.bug_report import Finding
from app.schemas.diagnosis import DiagnosisReport
from app.services.diagnosis.context_builder import ContextBuilder
from app.services.diagnosis.cross_layer_analyzer import CrossLayerAnalyzer
from app.services.diagnosis.llm_provider import LLMProvider
from app.services.diagnosis.remediation_planner import RemediationPlanner
from app.services.diagnosis.root_cause_analyzer import RootCauseAnalyzer
from app.services.diagnosis.storage import storage, DiagnosisStorage

MAX_FINDINGS_PER_DIAGNOSIS = 10


class DiagnosisServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class ScanNotFoundError(DiagnosisServiceError):
    def __init__(self, message: str):
        super().__init__(code="SCAN_NOT_FOUND", message=message, status_code=404)


class ScanRepositoryMismatchError(DiagnosisServiceError):
    def __init__(self, message: str):
        super().__init__(code="SCAN_REPOSITORY_MISMATCH", message=message, status_code=400)


class InvalidFindingIdsError(DiagnosisServiceError):
    def __init__(self, message: str):
        super().__init__(code="INVALID_FINDING_IDS", message=message, status_code=400)


class DiagnosisService:
    """
    Orchestrates AI-assisted root-cause diagnosis, cross-layer relationship analysis,
    and remediation planning for scanned repositories.
    """

    def __init__(
        self,
        storage_instance: Optional[DiagnosisStorage] = None,
        llm_provider: Optional[LLMProvider] = None,
    ):
        self.storage = storage_instance or storage
        self.llm_provider = llm_provider or LLMProvider()
        self.context_builder = ContextBuilder()
        self.cross_layer_analyzer = CrossLayerAnalyzer()
        self.remediation_planner = RemediationPlanner()
        self.root_cause_analyzer = RootCauseAnalyzer(llm_provider=self.llm_provider)

    async def diagnose_scan(
        self,
        owner: str,
        repo: str,
        scan_id: str,
        finding_ids: Optional[List[str]] = None,
    ) -> DiagnosisReport:
        target_repo = f"{owner.lower()}/{repo.lower()}"

        # 1. Lookup Scan
        scan = self.storage.get_scan(scan_id)
        if not scan:
            raise ScanNotFoundError(
                f"Scan with id '{scan_id}' was not found. Please run repository static analysis first."
            )

        # 2. Validate repository ownership
        if scan.repository.lower() != target_repo:
            raise ScanRepositoryMismatchError(
                f"Scan '{scan_id}' belongs to '{scan.repository}', not '{target_repo}'."
            )

        # 3. Validate finding IDs
        scan_finding_map = {f.id: f for f in scan.findings}
        if finding_ids:
            missing_ids = [fid for fid in finding_ids if fid not in scan_finding_map]
            if missing_ids:
                raise InvalidFindingIdsError(
                    f"Requested finding IDs do not belong to scan '{scan_id}': {missing_ids}"
                )
            target_findings = [scan_finding_map[fid] for fid in finding_ids]
        else:
            # Select bounded subset of top findings
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4}
            sorted_findings = sorted(
                scan.findings,
                key=lambda f: severity_order.get(f.severity.lower(), 5),
            )
            target_findings = sorted_findings[:MAX_FINDINGS_PER_DIAGNOSIS]

        diagnosis_id = f"diag_{uuid.uuid4().hex[:12]}"
        created_at = datetime.now(timezone.utc).isoformat()

        if not target_findings:
            # No findings in scan
            report = DiagnosisReport(
                diagnosis_id=diagnosis_id,
                repository=scan.repository,
                commit_sha=scan.commit_sha,
                scan_id=scan.scan_id,
                status="completed",
                summary="No static analysis findings were detected in this scan to diagnose.",
                root_causes=[],
                relationships=[],
                remediation_order=[],
                limitations=["No issues detected in scanned files."],
                model=self.llm_provider.model,
                created_at=created_at,
            )
            return self.storage.save_diagnosis(report)

        # 4. Build Context
        context = self.context_builder.build_context(
            repository=scan.repository,
            commit_sha=scan.commit_sha,
            findings=target_findings,
            files=scan.files,
        )

        # 5. Cross-Layer Analysis
        relationships = self.cross_layer_analyzer.analyze_cross_layer(
            files=scan.files,
            findings=target_findings,
        )

        # 6. Root-Cause Analysis
        summary, root_causes, limitations = await self.root_cause_analyzer.analyze_root_causes(
            findings=target_findings,
            context=context,
            relationships=relationships,
        )

        # 7. Remediation Planning
        remediation_order = self.remediation_planner.plan_remediation(
            findings=target_findings,
            root_causes=root_causes,
            relationships=relationships,
        )

        # Determine overall diagnosis status
        status = "completed"
        if all(rc.confidence == "inconclusive" for rc in root_causes) and root_causes:
            status = "inconclusive"

        report = DiagnosisReport(
            diagnosis_id=diagnosis_id,
            repository=scan.repository,
            commit_sha=scan.commit_sha,
            scan_id=scan.scan_id,
            status=status,
            summary=summary,
            root_causes=root_causes,
            relationships=relationships,
            remediation_order=remediation_order,
            limitations=limitations,
            model=self.llm_provider.model,
            created_at=created_at,
        )

        return self.storage.save_diagnosis(report)

    async def diagnose_cross_layer(
        self,
        owner: str,
        repo: str,
        scan_id: str,
    ) -> DiagnosisReport:
        """Specifically focuses on identifying and diagnosing frontend-backend relationship mismatches."""
        target_repo = f"{owner.lower()}/{repo.lower()}"

        scan = self.storage.get_scan(scan_id)
        if not scan:
            raise ScanNotFoundError(f"Scan with id '{scan_id}' not found.")

        if scan.repository.lower() != target_repo:
            raise ScanRepositoryMismatchError(
                f"Scan '{scan_id}' belongs to '{scan.repository}', not '{target_repo}'."
            )

        diagnosis_id = f"diag_cl_{uuid.uuid4().hex[:12]}"
        created_at = datetime.now(timezone.utc).isoformat()

        # Run cross layer inspection across all cached scan files
        relationships = self.cross_layer_analyzer.analyze_cross_layer(
            files=scan.files,
            findings=scan.findings,
        )

        mismatches = [r for r in relationships if "mismatch" in r.evidence.lower()]
        summary = (
            f"Analyzed {len(relationships)} cross-layer API interface(s). "
            f"Found {len(mismatches)} contract discrepancy(ies) requiring resolution."
        )

        context = self.context_builder.build_context(
            repository=scan.repository,
            commit_sha=scan.commit_sha,
            findings=scan.findings[:5],
            files=scan.files,
        )

        summary_rc, root_causes, limitations = await self.root_cause_analyzer.analyze_root_causes(
            findings=scan.findings[:5],
            context=context,
            relationships=relationships,
        )

        remediation_order = self.remediation_planner.plan_remediation(
            findings=scan.findings[:5],
            root_causes=root_causes,
            relationships=relationships,
        )

        report = DiagnosisReport(
            diagnosis_id=diagnosis_id,
            repository=scan.repository,
            commit_sha=scan.commit_sha,
            scan_id=scan.scan_id,
            status="completed",
            summary=summary,
            root_causes=root_causes,
            relationships=relationships,
            remediation_order=remediation_order,
            limitations=limitations,
            model=self.llm_provider.model,
            created_at=created_at,
        )

        return self.storage.save_diagnosis(report)

    def get_diagnosis(self, diagnosis_id: str) -> Optional[DiagnosisReport]:
        return self.storage.get_diagnosis(diagnosis_id)

    def list_diagnoses(self, owner: str, repo: str) -> List[DiagnosisReport]:
        return self.storage.list_diagnoses_for_repo(owner, repo)

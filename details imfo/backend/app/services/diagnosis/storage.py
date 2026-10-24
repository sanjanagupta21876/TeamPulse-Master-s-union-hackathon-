from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.bug_report import Finding
from app.schemas.diagnosis import DiagnosisReport


class ScanRecord(BaseModel):
    scan_id: str
    repository: str  # owner/repo
    branch: str
    commit_sha: str
    findings: List[Finding]
    files: Dict[str, str] = Field(default_factory=dict)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class DiagnosisStorage:
    """
    In-memory and thread-safe persistence store for repository scans and diagnosis reports.
    Provides fast lookup by ID and filtering by repository.
    """

    def __init__(self):
        self._scans: Dict[str, ScanRecord] = {}
        self._diagnoses: Dict[str, DiagnosisReport] = {}

    def save_scan(
        self,
        scan_id: str,
        repository: str,
        branch: str,
        commit_sha: str,
        findings: List[Finding],
        files: Optional[Dict[str, str]] = None,
    ) -> ScanRecord:
        record = ScanRecord(
            scan_id=scan_id,
            repository=repository.lower(),
            branch=branch,
            commit_sha=commit_sha,
            findings=findings,
            files=files or {},
        )
        self._scans[scan_id] = record
        return record

    def get_scan(self, scan_id: str) -> Optional[ScanRecord]:
        return self._scans.get(scan_id)

    def list_scans_for_repo(self, owner: str, repo: str) -> List[ScanRecord]:
        target = f"{owner.lower()}/{repo.lower()}"
        return [s for s in self._scans.values() if s.repository == target]

    def save_diagnosis(self, report: DiagnosisReport) -> DiagnosisReport:
        self._diagnoses[report.diagnosis_id] = report
        return report

    def get_diagnosis(self, diagnosis_id: str) -> Optional[DiagnosisReport]:
        return self._diagnoses.get(diagnosis_id)

    def list_diagnoses_for_repo(self, owner: str, repo: str) -> List[DiagnosisReport]:
        target = f"{owner.lower()}/{repo.lower()}"
        return [
            d for d in self._diagnoses.values()
            if d.repository.lower() == target
        ]

    def clear(self):
        """Utility for test suites."""
        self._scans.clear()
        self._diagnoses.clear()


# Global storage instance
storage = DiagnosisStorage()

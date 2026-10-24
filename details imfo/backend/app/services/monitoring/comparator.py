from typing import List, Optional, Set
from app.schemas.bug_report import Finding
from app.schemas.monitoring import FindingComparisonSummary


class FindingComparator:
    """
    Compares static-analysis findings across commits.
    Distinguishes newly introduced issues, genuinely resolved defects, and persistent bugs.
    Ensures an issue is not falsely marked resolved merely due to omitted files in a partial scan.
    """

    @staticmethod
    def _make_key(finding: Finding) -> str:
        """
        Generates a stable identifier for a finding based on rule_id, file_path, and category.
        Allows for minor line number drift while maintaining semantic identity.
        """
        return f"{finding.rule_id}::{finding.file_path}::{finding.category}"

    def compare(
        self,
        previous_findings: List[Finding],
        current_findings: List[Finding],
        analyzed_files: Set[str],
        previous_commit_sha: Optional[str],
        new_commit_sha: str,
        is_full_scan: bool = False,
    ) -> FindingComparisonSummary:
        """
        Performs comparative diff between two analysis runs.
        """
        prev_map = {self._make_key(f): f for f in previous_findings}
        curr_map = {self._make_key(f): f for f in current_findings}

        prev_keys = set(prev_map.keys())
        curr_keys = set(curr_map.keys())

        # Persistent: present in both runs
        persistent_keys = prev_keys.intersection(curr_keys)
        persistent_finding_ids = [curr_map[k].id for k in persistent_keys]

        # New: present in current run, but not in previous run
        new_keys = curr_keys - prev_keys
        new_finding_ids = [curr_map[k].id for k in new_keys]

        # Resolved: present in previous run, absent in current run,
        # AND the file was actually analyzed in the current run (or removed)
        resolved_finding_ids: List[str] = []
        for k in (prev_keys - curr_keys):
            prev_f = prev_map[k]
            # Only consider resolved if the file was actually analyzed in this run or if it was a full scan
            if is_full_scan or prev_f.file_path in analyzed_files:
                resolved_finding_ids.append(prev_f.id)

        return FindingComparisonSummary(
            new_findings_count=len(new_finding_ids),
            resolved_findings_count=len(resolved_finding_ids),
            persistent_findings_count=len(persistent_finding_ids),
            new_finding_ids=new_finding_ids,
            resolved_finding_ids=resolved_finding_ids,
            persistent_finding_ids=persistent_finding_ids,
            previous_commit_sha=previous_commit_sha,
            new_commit_sha=new_commit_sha,
        )

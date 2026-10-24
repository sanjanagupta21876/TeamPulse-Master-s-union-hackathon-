from typing import List, Tuple
from app.schemas.bug_report import Finding


class ResultComparator:
    """
    Compares static-analysis findings before and after patch application
    to distinguish resolved defects, remaining issues, and potential regressions.
    """

    def compare_results(
        self,
        target_finding_id: str,
        original_file_findings: List[Finding],
        patched_findings: List[Finding],
        patch_applied: bool,
        static_status: str,
        tests_status: str,
    ) -> Tuple[List[Finding], List[Finding], List[Finding], str]:
        """
        Returns:
            (resolved_findings, remaining_findings, newly_introduced_findings, overall_assessment)
        """
        if not patch_applied:
            return (
                [],
                original_file_findings,
                [],
                "Patch application failed. Source code could not be modified cleanly.",
            )

        if static_status == "failed":
            # Syntax failure or critical static check failure
            return (
                [],
                original_file_findings,
                patched_findings,
                "Verification failed: Patched source code failed static or syntax checks.",
            )

        # Identify which original findings are still present vs resolved
        remaining: List[Finding] = []
        resolved: List[Finding] = []
        newly_introduced: List[Finding] = []

        # Map of original findings by rule_id and category
        orig_signatures = {(f.rule_id, f.category) for f in original_file_findings}
        patched_signatures = {(f.rule_id, f.category) for f in patched_findings}

        for orig in original_file_findings:
            if (orig.rule_id, orig.category) in patched_signatures:
                remaining.append(orig)
            else:
                resolved.append(orig)

        for patched in patched_findings:
            if (patched.rule_id, patched.category) not in orig_signatures:
                newly_introduced.append(patched)

        # Check if the specific target finding addressed by the fix is resolved
        target_resolved = any(r.id == target_finding_id for r in resolved) or (
            target_finding_id not in [rem.id for rem in remaining]
        )

        # Build human-readable assessment
        assessment_parts = []
        if newly_introduced:
            assessment_parts.append(
                f"Regression detected: {len(newly_introduced)} new static-analysis finding(s) introduced."
            )
        elif target_resolved:
            assessment_parts.append(
                "Potentially resolved under the checks that were run. Target finding is no longer reported."
            )
            if resolved:
                assessment_parts.append(f"({len(resolved)} finding(s) resolved in file).")
        else:
            assessment_parts.append("Finding remains reported by static analysis after patch application.")

        if tests_status == "not_requested":
            assessment_parts.append("Automated test verification was not requested; runtime verification is incomplete.")
        elif tests_status == "unavailable":
            assessment_parts.append("Automated test execution was unavailable; runtime verification is incomplete.")
        elif tests_status == "passed":
            assessment_parts.append("Restricted test suite passed.")
        elif tests_status == "failed":
            assessment_parts.append("Test execution reported failures.")

        assessment = " ".join(assessment_parts)
        return resolved, remaining, newly_introduced, assessment

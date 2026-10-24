from typing import Optional
from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal
from app.schemas.verification import VerificationRecord


class PRDescriptionBuilder:
    """
    Constructs clean, comprehensive Markdown pull request bodies detailing the defect,
    root-cause analysis, proposed remediation, and isolated verification outcomes.
    """

    def build_pr_title(self, finding: Optional[Finding], proposal: FixProposal) -> str:
        if finding and finding.title:
            # Clean title
            clean_title = finding.title.strip()
            if not clean_title.lower().startswith("fix:"):
                return f"fix: {clean_title} [CodeLens AI]"
            return f"{clean_title} [CodeLens AI]"
        return f"fix: resolve {proposal.file_path} issue [CodeLens AI]"

    def build_pr_body(
        self,
        finding: Optional[Finding],
        proposal: FixProposal,
        verification: Optional[VerificationRecord] = None,
        custom_instructions: Optional[str] = None,
    ) -> str:
        lines = []

        lines.append("## 🔍 CodeLens AI Automated Fix Summary")
        lines.append("")
        if finding:
            lines.append(f"**Defect Identified:** {finding.title}")
            lines.append(f"**Severity:** `{finding.severity.upper()}` | **Category:** `{finding.category}` | **Rule ID:** `{finding.rule_id}`")
            lines.append(f"**Target Location:** `{finding.file_path}` (Line {finding.start_line})")
        else:
            lines.append(f"**Target Location:** `{proposal.file_path}`")
        lines.append("")

        lines.append("### 🧠 Root-Cause Diagnosis & Explanation")
        lines.append(f"{proposal.explanation}")
        lines.append("")

        if proposal.assumptions:
            lines.append("**Assumptions:**")
            for assumption in proposal.assumptions:
                lines.append(f"- {assumption}")
            lines.append("")

        lines.append("### 🛠️ Changes Implemented")
        lines.append(f"- Modified `{proposal.file_path}` with verified remediation.")
        if proposal.diff:
            lines.append(f"- Diff stats: `+{proposal.diff.additions} / -{proposal.diff.deletions}` lines changed.")
        lines.append("")

        lines.append("### 🧪 Isolated Workspace Verification Results (Step 7)")
        if verification:
            lines.append(f"- **Verification Assessment:** {verification.assessment}")
            lines.append(f"- **Workspace Sandbox:** `{verification.workspace_status}` (Ephemeral container/directory destroyed)")
            lines.append(f"- **Patch Application Status:** `{verification.patch_application_status.upper()}`")
            lines.append(f"- **Static & Syntax Validation:** `{verification.static_checks_status.upper()}`")
            lines.append(f"- **Automated Tests Status:** `{verification.tests_status.upper()}`")
            lines.append(f"- **Resolved Defects:** {len(verification.resolved_findings)} confirmed resolved")
            lines.append(f"- **Detected Regressions:** {len(verification.newly_introduced_findings)} new issues")
            if verification.tools_executed:
                lines.append(f"- **Analyzers Executed:** {', '.join(f'`{t}`' for t in verification.tools_executed)}")
        else:
            lines.append("- *Automated isolated verification was not executed prior to PR preparation.*")
        lines.append("")

        if proposal.potential_regressions:
            lines.append("### ⚠️ Potential Regressions & Review Notes")
            for reg in proposal.potential_regressions:
                lines.append(f"- {reg}")
            lines.append("")

        if proposal.recommended_tests:
            lines.append("### ✅ Recommended Regression Tests")
            for test in proposal.recommended_tests:
                lines.append(f"- {test}")
            lines.append("")

        lines.append("---")
        lines.append("### 🔐 Security & Lineage References")
        lines.append(f"- **Analyzed Source Commit:** `{proposal.commit_sha}`")
        lines.append(f"- **Original Source Hash:** `{proposal.original_sha256[:16]}...`")
        lines.append(f"- **Fix Proposal ID:** `{proposal.id}`")
        if verification:
            lines.append(f"- **Verification Job ID:** `{verification.verification_id}`")
        lines.append("")
        lines.append("> *Notice: This pull request was prepared by CodeLens AI following developer review and patch validation. Please review and run CI before merging. CodeLens AI will never automatically merge pull requests.*")

        return "\n".join(lines)

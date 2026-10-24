from typing import List, Optional
from app.schemas.bug_report import Finding
from app.schemas.diagnosis import RemediationStep, Relationship, RootCause


class RemediationPlanner:
    """
    Ranks findings and diagnostic insights into a logical investigation and remediation sequence.
    Elevates foundational root causes, high-severity security vulnerabilities, and contract mismatches
    over downstream symptoms and style nitpicks.
    """

    def plan_remediation(
        self,
        findings: List[Finding],
        root_causes: Optional[List[RootCause]] = None,
        relationships: Optional[List[Relationship]] = None,
    ) -> List[RemediationStep]:
        steps: List[RemediationStep] = []
        root_causes = root_causes or []
        relationships = relationships or []

        # Find any cross-layer mismatches first (contract breaks usually cause cascading errors)
        contract_mismatches = [
            r for r in relationships
            if any(term in r.evidence.lower() for term in ["mismatch", "missing", "405", "422", "401"])
        ]

        assigned_finding_ids = set()
        order = 1

        # 1. First priority: Structural API contract mismatches across layers
        for rel in contract_mismatches:
            related_ids = [
                f.id for f in findings
                if f.file_path in [rel.source_file, rel.target_file]
                and f.category != "security"
            ]
            assigned_finding_ids.update(related_ids)
            steps.append(
                RemediationStep(
                    order=order,
                    priority_label="Investigate first",
                    title=f"Resolve Cross-Layer API Contract Mismatch: {rel.source_file} ↔ {rel.target_file or 'API'}",
                    target_file=rel.target_file or rel.source_file,
                    related_finding_ids=related_ids,
                    reason=(
                        f"{rel.evidence} Fixing backend schemas or HTTP methods will immediately resolve "
                        f"downstream runtime failures and unhandled network errors."
                    ),
                )
            )
            order += 1

        # 2. Second priority: Critical or High security vulnerabilities
        security_findings = [
            f for f in findings
            if f.category == "security" and f.severity in ["critical", "high"] and f.id not in assigned_finding_ids
        ]
        for sf in security_findings:
            assigned_finding_ids.add(sf.id)
            label = "Investigate first" if sf.severity == "critical" else "High priority"
            steps.append(
                RemediationStep(
                    order=order,
                    priority_label=label,
                    title=f"Remediate Security Vulnerability: {sf.title}",
                    target_file=sf.file_path,
                    related_finding_ids=[sf.id],
                    reason=(
                        f"Rule {sf.rule_id} flags potential exploitation or credential leakage. "
                        f"Direct security risks must be mitigated before architectural refactoring."
                    ),
                )
            )
            order += 1

        # 3. Third priority: High severity correctness and reliability bugs (Syntax errors, shell=True, unhandled exceptions)
        reliability_findings = [
            f for f in findings
            if f.category in ["correctness", "reliability"] and f.severity in ["critical", "high"] and f.id not in assigned_finding_ids
        ]
        for rf in reliability_findings:
            assigned_finding_ids.add(rf.id)
            steps.append(
                RemediationStep(
                    order=order,
                    priority_label="High priority",
                    title=f"Address Core Execution Fault: {rf.title}",
                    target_file=rf.file_path,
                    related_finding_ids=[rf.id],
                    reason=f"Analyzer reported {rf.description}. This issue directly interrupts execution or causes unhandled crashes.",
                )
            )
            order += 1

        # 4. Fourth priority: Root causes identified by AI or heuristics
        for rc in root_causes:
            unhandled_rc_findings = [
                fid for fid in rc.related_finding_ids
                if fid not in assigned_finding_ids
            ]
            if unhandled_rc_findings or rc.confidence == "high":
                assigned_finding_ids.update(unhandled_rc_findings)
                label = "High priority" if rc.confidence == "high" else "Normal priority"
                if rc.confidence in ["low", "inconclusive"]:
                    label = "Needs more evidence"

                primary_file = rc.evidence[0].file_path if rc.evidence else None
                steps.append(
                    RemediationStep(
                        order=order,
                        priority_label=label,
                        title=f"Investigate Root Cause: {rc.title}",
                        target_file=primary_file,
                        related_finding_ids=unhandled_rc_findings,
                        reason=rc.explanation[:200] + ("..." if len(rc.explanation) > 200 else ""),
                    )
                )
                order += 1

        # 5. Remaining findings: Medium / Low / Informational
        remaining = [f for f in findings if f.id not in assigned_finding_ids]
        for rem in remaining:
            label = "Normal priority"
            if rem.severity in ["low", "informational"]:
                label = "Normal priority" if rem.confidence == "confirmed" else "Needs more evidence"

            steps.append(
                RemediationStep(
                    order=order,
                    priority_label=label,
                    title=f"Inspect Code Quality Finding: {rem.title}",
                    target_file=rem.file_path,
                    related_finding_ids=[rem.id],
                    reason=f"{rem.analyzer} flagged {rem.rule_id} ({rem.severity}). {rem.description}",
                )
            )
            order += 1

        return steps

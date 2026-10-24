from typing import List, Optional
from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    file_path: str = Field(..., description="Path to the source file relative to repository root")
    start_line: int = Field(..., description="1-based starting line number")
    end_line: Optional[int] = Field(None, description="1-based ending line number")
    description: str = Field(..., description="Explanation of what this source code evidence demonstrates")
    snippet: Optional[str] = Field(None, description="Short, safe code excerpt with secrets redacted")


class RootCause(BaseModel):
    title: str = Field(..., description="Concise title of the diagnosed root cause")
    explanation: str = Field(..., description="Detailed technical explanation based on source evidence")
    confidence: str = Field(
        ...,
        description="Confidence level: high, medium, low, inconclusive",
    )
    evidence: List[EvidenceItem] = Field(
        default_factory=list,
        description="Verifiable source code locations supporting this diagnosis",
    )
    related_finding_ids: List[str] = Field(
        default_factory=list,
        description="Analyzer finding IDs associated with or explained by this root cause",
    )
    assumptions: List[str] = Field(
        default_factory=list,
        description="Assumptions or unverified conditions remaining in this hypothesis",
    )
    recommended_actions: List[str] = Field(
        default_factory=list,
        description="Specific, actionable steps developers should take to remediate the issue",
    )


class Relationship(BaseModel):
    source_file: str = Field(..., description="Frontend or upstream source file path")
    source_location: str = Field(..., description="Line number, function, or component name")
    target_file: Optional[str] = Field(None, description="Backend or downstream source file path")
    target_location: Optional[str] = Field(None, description="Route, controller, or handler location")
    relationship_type: str = Field(
        ...,
        description="Type: imports, calls, sends_request_to, handles_request_from, expects_response_from, validates_with, reads_from, writes_to, potentially_causes, related_to, covered_by_test",
    )
    evidence: str = Field(..., description="Supporting technical evidence (e.g. endpoint path, method, payload)")
    confidence: str = Field(..., description="Confidence level: high, medium, low")
    potential_impact: str = Field(..., description="Anticipated runtime impact of this relationship or mismatch")


class RemediationStep(BaseModel):
    order: int = Field(..., description="1-based recommended execution sequence")
    priority_label: str = Field(
        ...,
        description="Priority label: Investigate first, High priority, Normal priority, Needs more evidence",
    )
    title: str = Field(..., description="Actionable title of the recommended remediation step")
    target_file: Optional[str] = Field(None, description="Primary source file to inspect or modify")
    related_finding_ids: List[str] = Field(
        default_factory=list,
        description="Finding IDs resolved or impacted by this step",
    )
    reason: str = Field(..., description="Technical rationale for prioritizing this step in this order")


class DiagnosisReport(BaseModel):
    diagnosis_id: str = Field(..., description="Unique deterministic diagnosis identifier")
    repository: str = Field(..., description="Full repository name (owner/repo)")
    commit_sha: str = Field(..., description="Target Git commit SHA analyzed")
    scan_id: str = Field(..., description="Identifier of the scan providing findings and source context")
    status: str = Field(
        default="completed",
        description="Diagnosis status: completed, inconclusive, failed",
    )
    summary: str = Field(..., description="High-level evidence-based diagnosis overview")
    root_causes: List[RootCause] = Field(
        default_factory=list,
        description="Diagnosed root causes with source evidence and confidence",
    )
    relationships: List[Relationship] = Field(
        default_factory=list,
        description="Frontend-to-backend relationships and contract correlations",
    )
    remediation_order: List[RemediationStep] = Field(
        default_factory=list,
        description="Recommended investigation and fix priority order",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Identified limitations, uninspected files, or external boundaries",
    )
    model: str = Field(default="gpt-4o-mini", description="AI model or engine used for diagnosis")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")


class DiagnosisRequest(BaseModel):
    scan_id: str = Field(..., description="Existing scan ID belonging to this repository")
    finding_ids: Optional[List[str]] = Field(
        default_factory=list,
        description="Optional subset of finding IDs to diagnose; if empty, top relevant findings are selected",
    )


class CrossLayerDiagnosisRequest(BaseModel):
    scan_id: str = Field(..., description="Existing scan ID belonging to this repository")


class DiagnosisListResponse(BaseModel):
    repository: str = Field(..., description="Full repository name (owner/repo)")
    diagnoses: List[DiagnosisReport] = Field(
        default_factory=list,
        description="List of stored diagnosis reports for this repository",
    )

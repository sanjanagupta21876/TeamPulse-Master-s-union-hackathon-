from typing import List, Literal, Optional
from pydantic import BaseModel, Field

from app.schemas.bug_report import Finding


VerificationStatus = Literal[
    "queued",
    "running",
    "completed",
    "partial",
    "failed",
    "cancelled",
]

PatchApplicationStatus = Literal[
    "pending",
    "applied",
    "failed",
]

CheckStatus = Literal[
    "not_requested",
    "passed",
    "failed",
    "unavailable",
    "timed_out",
    "inconclusive",
]


class VerificationRequest(BaseModel):
    run_tests: bool = Field(
        default=False,
        description="Whether to run automated tests in a restricted container sandbox",
    )
    run_static_checks: bool = Field(
        default=True,
        description="Whether to run safe static analysis and syntax validation",
    )


class VerificationRecord(BaseModel):
    verification_id: str = Field(
        ..., description="Unique identifier for the verification job"
    )
    fix_id: str = Field(
        ..., description="ID of the approved fix proposal being verified"
    )
    repository_id: str = Field(
        ..., description="Repository full name (owner/repo)"
    )
    scan_id: str = Field(
        ..., description="Scan identifier linked to the finding and commit"
    )
    original_commit_sha: str = Field(
        ..., description="Exact commit SHA against which the patch was created"
    )
    patch_hash: Optional[str] = Field(
        default=None,
        description="SHA256 hash of the modified file content after patch application",
    )
    status: str = Field(
        default="completed",
        description="Overall job status: queued, running, completed, partial, failed, cancelled",
    )
    workspace_status: str = Field(
        default="cleaned_up",
        description="Status of the isolated temporary workspace",
    )
    patch_application_status: str = Field(
        default="applied",
        description="Patch application status: pending, applied, failed",
    )
    static_checks_status: str = Field(
        default="passed",
        description="Static and syntax validation status: not_requested, passed, failed, unavailable, timed_out, inconclusive",
    )
    tests_status: str = Field(
        default="not_requested",
        description="Test execution status: not_requested, passed, failed, unavailable, timed_out, inconclusive",
    )
    original_findings: List[Finding] = Field(
        default_factory=list,
        description="Findings present on the target file before the patch was applied",
    )
    remaining_findings: List[Finding] = Field(
        default_factory=list,
        description="Findings still present on the target file after patch application",
    )
    resolved_findings: List[Finding] = Field(
        default_factory=list,
        description="Findings successfully resolved by the patch",
    )
    newly_introduced_findings: List[Finding] = Field(
        default_factory=list,
        description="New findings or regressions introduced by the patch",
    )
    execution_duration: float = Field(
        default=0.0,
        description="Execution duration in seconds",
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Warnings encountered during isolated verification",
    )
    limitations: List[str] = Field(
        default_factory=list,
        description="Operational or security limitations applicable to this verification run",
    )
    assessment: str = Field(
        default="",
        description="Human-readable assessment summarizing verification outcome",
    )
    tools_executed: List[str] = Field(
        default_factory=list,
        description="List of analyzer tools and checkers that were executed",
    )
    created_at: str = Field(
        ..., description="ISO 8601 timestamp when verification was requested"
    )
    completed_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp when verification concluded",
    )


class VerificationListResponse(BaseModel):
    fix_id: str
    verifications: List[VerificationRecord]


class VerificationActionResponse(BaseModel):
    message: str
    verification: VerificationRecord

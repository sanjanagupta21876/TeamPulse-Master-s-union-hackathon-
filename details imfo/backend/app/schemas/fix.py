from typing import List, Optional
from pydantic import BaseModel, Field


class PatchValidationResult(BaseModel):
    syntax_check: str = Field(
        default="not_run",
        description="Syntax check status: passed, failed, not_run, inconclusive",
    )
    patch_integrity: str = Field(
        default="pending",
        description="Patch integrity status: valid, invalid, pending",
    )
    source_hash_match: bool = Field(
        default=True,
        description="Whether original_sha256 matches the scanned source code hash",
    )
    path_traversal_safe: bool = Field(
        default=True,
        description="Whether target file path is safe from traversal attacks",
    )
    within_size_limits: bool = Field(
        default=True,
        description="Whether proposed content respects maximum size constraints",
    )
    details: List[str] = Field(
        default_factory=list,
        description="Diagnostic messages or errors encountered during validation",
    )


class DiffHunk(BaseModel):
    old_start: int
    old_lines: int
    new_start: int
    new_lines: int
    lines: List[str] = Field(default_factory=list)


class DiffResult(BaseModel):
    file_path: str
    unified_diff: str
    additions: int = 0
    deletions: int = 0
    hunks: List[DiffHunk] = Field(default_factory=list)


class FixProposal(BaseModel):
    id: str = Field(..., description="Unique deterministic identifier for fix proposal")
    finding_id: str = Field(..., description="ID of the finding this fix addresses")
    scan_id: str = Field(..., description="ID of the scan associated with the finding")
    repository_id: str = Field(..., description="Full repository name (owner/repo)")
    commit_sha: str = Field(..., description="Commit SHA of the original source")
    file_path: str = Field(..., description="Path to the file relative to repository root")
    status: str = Field(
        default="proposed",
        description="Proposal status: generating, proposed, approved, rejected, failed, invalid",
    )
    original_sha256: str = Field(..., description="SHA256 hash of original file content")
    original_content: str = Field(..., description="Original file content at scanned commit")
    proposed_content: str = Field(..., description="Complete proposed corrected file content")
    diff: Optional[DiffResult] = Field(None, description="Computed source code diff")
    explanation: str = Field(..., description="Evidence-backed explanation of why the change is recommended")
    assumptions: List[str] = Field(default_factory=list, description="Assumptions made by the fix")
    potential_regressions: List[str] = Field(
        default_factory=list, description="Possible regressions or side effects to watch for"
    )
    recommended_tests: List[str] = Field(
        default_factory=list, description="Recommended tests to verify the fix and prevent regressions"
    )
    validation: PatchValidationResult = Field(
        default_factory=PatchValidationResult,
        description="Automated patch validation results",
    )
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 last update timestamp")
    approved_at: Optional[str] = Field(None, description="ISO 8601 approval timestamp if approved")
    rejected_at: Optional[str] = Field(None, description="ISO 8601 rejection timestamp if rejected")


class GenerateFixRequest(BaseModel):
    diagnosis_id: Optional[str] = Field(
        default=None,
        description="Optional diagnosis ID to provide root-cause context for fix generation",
    )
    instructions: Optional[str] = Field(
        default=None,
        description="Optional developer guidance (e.g. 'keep change minimal', 'preserve existing API')",
        max_length=500,
    )


class FixListResponse(BaseModel):
    finding_id: str
    fixes: List[FixProposal] = Field(default_factory=list)


class FixActionResponse(BaseModel):
    message: str
    fix: FixProposal

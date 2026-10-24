from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RepositoryScanRequest(BaseModel):
    repository_url: str = Field(
        ...,
        description="Public GitHub repository URL (e.g. https://github.com/psf/requests)",
        max_length=500,
    )
    branch: Optional[str] = Field(
        default=None,
        description="Optional Git branch name to scan (defaults to repository default branch)",
        max_length=255,
    )


class DiscoveredFile(BaseModel):
    path: str = Field(..., description="Relative file path within repository")
    extension: str = Field(..., description="File extension with leading dot, or empty string")
    classification: str = Field(
        ...,
        description="Preliminary classification: frontend, backend, test, database, configuration, documentation, or other",
    )
    size: Optional[int] = Field(None, description="File size in bytes if available from Git tree")
    is_candidate: bool = Field(..., description="Whether this file qualifies as candidate source for scanning")
    skip_reason: Optional[str] = Field(None, description="Reason if excluded from candidate list")


class RepositoryScanResponse(BaseModel):
    repository_name: str = Field(..., description="Repository name")
    owner: str = Field(..., description="GitHub organization or user account name")
    selected_branch: str = Field(..., description="Inspected branch name")
    commit_sha: str = Field(..., description="Resolved Git commit SHA")
    discovered_file_paths: List[str] = Field(
        ..., description="List of discovered file paths (candidate or inventory)"
    )
    file_extensions: List[str] = Field(
        ..., description="Unique file extensions discovered in candidate source files"
    )
    preliminary_classifications: Dict[str, int] = Field(
        ..., description="Breakdown count of candidate files by classification category"
    )
    total_files_discovered: int = Field(..., description="Total files discovered in the Git tree")
    candidate_source_files: int = Field(
        ..., description="Number of candidate source files meeting scan criteria"
    )
    scan_warnings: List[str] = Field(
        default_factory=list, description="Warnings encountered during tree inspection or limits"
    )
    tree_truncated: bool = Field(
        default=False, description="Whether GitHub truncated the Git tree response (>100,000 items or >7MB)"
    )
    files: List[DiscoveredFile] = Field(
        default_factory=list, description="List of discovered file records (capped for compactness)"
    )
    inventory_truncated: bool = Field(
        default=False, description="Whether the returned file inventory in the response was capped"
    )

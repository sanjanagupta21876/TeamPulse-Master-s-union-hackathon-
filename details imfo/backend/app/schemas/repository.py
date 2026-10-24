from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class RepositoryInspectionRequest(BaseModel):
    repository_url: str = Field(
        ...,
        description="Public GitHub repository URL (e.g. https://github.com/facebook/react)",
        max_length=500,
    )
    branch: Optional[str] = Field(
        default=None,
        description="Optional Git branch name to inspect",
        max_length=255,
    )


class RepositoryMetadata(BaseModel):
    owner: str = Field(..., description="GitHub organization or user account name")
    name: str = Field(..., description="Repository name")
    full_name: str = Field(..., description="Full repository name: owner/name")
    description: Optional[str] = Field(None, description="Repository description from GitHub")
    html_url: str = Field(..., description="Web URL to repository")
    default_branch: str = Field(..., description="Default branch on GitHub")
    selected_branch: Optional[str] = Field(None, description="Inspected branch name")
    stars: int = Field(default=0, description="Stargazer count")
    language: Optional[str] = Field(None, description="Primary programming language")
    visibility: str = Field(default="public", description="Repository visibility")
    latest_commit_sha: str = Field(..., description="Latest commit SHA for the inspected branch")


class InspectionSummary(BaseModel):
    status: str = Field(default="completed", description="Status of inspection")
    source: str = Field(default="github_api", description="Source provider")
    files_analyzed: int = Field(default=0, description="Files analyzed for bugs (0 in metadata stage)")
    bugs_detected: int = Field(default=0, description="Bugs detected (0 in metadata stage)")
    message: str = Field(
        default="Repository metadata retrieved successfully. Source-code bug analysis has not been implemented yet.",
        description="Informational status message",
    )


class RepositoryInspectionResponse(BaseModel):
    repository: RepositoryMetadata
    inspection: InspectionSummary


class APIErrorDetail(BaseModel):
    code: str = Field(..., description="Standardized error code")
    message: str = Field(..., description="Human-readable error explanation")


class APIErrorResponse(BaseModel):
    error: APIErrorDetail

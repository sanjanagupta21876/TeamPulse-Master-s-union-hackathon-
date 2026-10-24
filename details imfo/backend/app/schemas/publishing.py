from typing import List, Optional
from pydantic import BaseModel, Field


class GitHubAuthStatus(BaseModel):
    connected: bool = Field(..., description="Whether GitHub token or app credentials are configured")
    user: Optional[str] = Field(None, description="Authenticated GitHub username if available")
    scopes: List[str] = Field(default_factory=list, description="OAuth scopes granted to current credentials")
    auth_type: str = Field(default="unauthenticated", description="Authentication mechanism: token, app, unauthenticated")
    can_publish: bool = Field(default=False, description="Whether token has permissions to write branches and create PRs")
    rate_limit_remaining: Optional[int] = Field(None, description="Remaining GitHub API rate limit calls")
    error_message: Optional[str] = Field(None, description="Diagnostic error if connection failed")


class PublishEligibilityCheck(BaseModel):
    eligible: bool = Field(..., description="Whether this fix proposal is currently eligible to be published")
    proposal_id: str
    repository: str
    target_branch: str
    source_commit_sha: str
    is_approved: bool
    is_verified: bool
    branch_head_matches: bool
    current_branch_head_sha: Optional[str] = None
    reasons: List[str] = Field(default_factory=list, description="Eligibility status explanations or blocking reasons")


class PublishBranchRequest(BaseModel):
    target_branch: Optional[str] = Field(
        None, description="Base branch to branch off from (defaults to the scanned branch)"
    )
    custom_branch_name: Optional[str] = Field(
        None, description="Optional custom branch name (will be sanitized and prefixed)"
    )


class PublishBranchResponse(BaseModel):
    publish_id: str = Field(..., description="Unique publish event identifier")
    fix_id: str
    repository: str
    target_branch: str
    created_branch: str
    source_commit_sha: str
    published_commit_sha: str
    status: str = Field(default="commit_created", description="Publish status: branch_created, commit_created, failed")
    commit_message: str
    files_changed: List[str] = Field(default_factory=list)
    html_url: Optional[str] = Field(None, description="Web URL to the commit on GitHub")
    created_at: str


class CreatePullRequestRequest(BaseModel):
    title: Optional[str] = Field(None, description="Pull request title (defaults to fix title)")
    body: Optional[str] = Field(None, description="Optional custom PR description")
    draft: bool = Field(default=False, description="Whether to open the PR in draft mode")
    confirm_creation: bool = Field(default=True, description="Explicit user confirmation required before opening PR")


class PullRequestRecord(BaseModel):
    pull_request_id: str = Field(..., description="Internal pull request tracking ID")
    fix_id: str
    publish_id: str
    repository: str
    pr_number: int
    title: str
    html_url: str
    head_branch: str
    base_branch: str
    status: str = Field(default="open", description="PR state: open, draft, merged, closed")
    summary: str
    created_at: str


class PullRequestListResponse(BaseModel):
    repository: str
    total: int = 0
    pull_requests: List[PullRequestRecord]


class PublishStatusResponse(BaseModel):
    fix_id: str
    proposal_status: str
    verification_status: str
    publish_record: Optional[PublishBranchResponse] = None
    pull_request: Optional[PullRequestRecord] = None

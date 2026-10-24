"""FastAPI router for GitHub branch publishing and pull request preparation (Step 8)."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas.publishing import (
    GitHubAuthStatus,
    PublishEligibilityCheck,
    PublishBranchRequest,
    PublishBranchResponse,
    CreatePullRequestRequest,
    PullRequestRecord,
    PullRequestListResponse,
    PublishStatusResponse,
)
from app.services.publishing.publishing_service import (
    publishing_service,
    PublishingError,
)
from app.services.publishing.github_client import (
    GitHubClientError,
    GitHubAuthError,
    BranchConflictError,
    BranchDivergedError,
)

router = APIRouter(tags=["GitHub Publishing & Pull Requests"])


@router.get("/api/github/auth-status", response_model=GitHubAuthStatus)
async def get_github_auth_status() -> GitHubAuthStatus:
    """Return backend GitHub authorization connection status (safe, no secrets exposed)."""
    return await publishing_service.get_auth_status()


@router.get(
    "/api/fixes/{fix_id}/publish-eligibility",
    response_model=PublishEligibilityCheck,
)
async def check_publish_eligibility(
    fix_id: str,
    target_branch: Optional[str] = Query(None, description="Optional target base branch"),
) -> PublishEligibilityCheck:
    """Check prerequisites before allowing branch creation and fix publishing."""
    try:
        return await publishing_service.check_eligibility(fix_id, target_branch=target_branch)
    except PublishingError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )


@router.post(
    "/api/fixes/{fix_id}/publish-branch",
    response_model=PublishBranchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def publish_fix_branch(
    fix_id: str,
    request: Optional[PublishBranchRequest] = None,
) -> PublishBranchResponse:
    """Create dedicated isolated branch and commit approved patch to GitHub."""
    req = request or PublishBranchRequest()
    try:
        return await publishing_service.publish_branch(fix_id, req)
    except PublishingError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )
    except BranchConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        )
    except BranchDivergedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        )
    except GitHubAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"GitHub authorization error: {exc.message}",
        )
    except GitHubClientError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish branch: {str(exc)}",
        )


@router.get(
    "/api/fixes/{fix_id}/publish-status",
    response_model=PublishStatusResponse,
)
def get_publish_status(fix_id: str) -> PublishStatusResponse:
    """Get the current publishing and PR status for a fix proposal."""
    try:
        return publishing_service.get_publish_status(fix_id)
    except PublishingError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )


@router.post(
    "/api/fixes/{fix_id}/create-pull-request",
    response_model=PullRequestRecord,
    status_code=status.HTTP_201_CREATED,
)
async def create_pull_request(
    fix_id: str,
    request: CreatePullRequestRequest,
) -> PullRequestRecord:
    """Open a GitHub pull request for an already published fix branch."""
    if not request.confirm_creation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit user confirmation (confirm_creation=True) is required to open a pull request.",
        )

    if not request.title and request.title == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PR title cannot be empty.",
        )

    try:
        return await publishing_service.create_pull_request(fix_id, request)
    except PublishingError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )
    except GitHubAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"GitHub authorization error: {exc.message}",
        )
    except GitHubClientError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pull request: {str(exc)}",
        )


@router.get(
    "/api/pull-requests/{pull_request_id}",
    response_model=PullRequestRecord,
)
def get_pull_request(pull_request_id: str) -> PullRequestRecord:
    """Retrieve details of a pull request created via CodeLens AI."""
    pr = publishing_service.get_pull_request(pull_request_id)
    if not pr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pull request record '{pull_request_id}' not found.",
        )
    return pr


@router.get(
    "/api/repositories/{owner}/{repo}/pull-requests",
    response_model=PullRequestListResponse,
)
def list_repository_pull_requests(owner: str, repo: str) -> PullRequestListResponse:
    """List all pull requests created via CodeLens AI for a given repository."""
    prs = publishing_service.list_pull_requests_for_repo(owner, repo)
    return PullRequestListResponse(
        repository=f"{owner}/{repo}",
        total=len(prs),
        pull_requests=prs,
    )

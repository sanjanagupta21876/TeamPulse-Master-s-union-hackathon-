from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas.repository import (
    RepositoryInspectionRequest,
    RepositoryInspectionResponse,
    APIErrorResponse,
)
from app.schemas.scan import (
    RepositoryScanRequest,
    RepositoryScanResponse,
)
from app.schemas.bug_report import (
    RepositoryAnalysisRequest,
    RepositoryAnalysisResponse,
)
from app.services.github_service import GitHubService, GitHubServiceError
from app.services.repository_scanner import RepositoryScanner
from app.services.analysis_engine import AnalysisEngine

router = APIRouter(prefix="/api/repositories", tags=["Repositories"])
github_service = GitHubService()
repository_scanner = RepositoryScanner(github_service=github_service)
analysis_engine = AnalysisEngine(github_service=github_service, scanner=repository_scanner)


@router.post(
    "/inspect",
    response_model=RepositoryInspectionResponse,
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid URL or malformed request parameters"},
        403: {"model": APIErrorResponse, "description": "Repository is private or forbidden"},
        404: {"model": APIErrorResponse, "description": "Repository or branch not found"},
        429: {"model": APIErrorResponse, "description": "GitHub API rate limit reached"},
        502: {"model": APIErrorResponse, "description": "GitHub API unavailable or unexpected response"},
        504: {"model": APIErrorResponse, "description": "GitHub API request timed out"},
    },
    summary="Inspect public GitHub repository metadata",
    description="Validates a public GitHub repository URL, extracts owner and repository name, and returns verified metadata including the latest commit SHA.",
)
async def inspect_repository(payload: RepositoryInspectionRequest):
    try:
        result = await github_service.inspect_repository(
            repository_url=payload.repository_url,
            branch=payload.branch,
        )
        return result
    except GitHubServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )
    except Exception as exc:
        # Prevent exposing raw internal exceptions to clients
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred while processing the repository inspection.",
                }
            },
        )


@router.post(
    "/scan",
    response_model=RepositoryScanResponse,
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid URL or malformed request parameters"},
        403: {"model": APIErrorResponse, "description": "Repository is private or forbidden"},
        404: {"model": APIErrorResponse, "description": "Repository, branch, or Git tree not found"},
        429: {"model": APIErrorResponse, "description": "GitHub API rate limit reached"},
        502: {"model": APIErrorResponse, "description": "GitHub API unavailable or unexpected response"},
        504: {"model": APIErrorResponse, "description": "GitHub API request timed out"},
    },
    summary="Scan public GitHub repository files",
    description="Discovers and classifies files in a public GitHub repository at the resolved commit SHA using the Git Trees API.",
)
async def scan_repository(payload: RepositoryScanRequest):
    try:
        result = await repository_scanner.scan_repository(
            repository_url=payload.repository_url,
            branch=payload.branch,
        )
        return result
    except GitHubServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred while processing the repository scan.",
                }
            },
        )


@router.post(
    "/analyze",
    response_model=RepositoryAnalysisResponse,
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid URL or malformed request parameters"},
        403: {"model": APIErrorResponse, "description": "Repository is private or forbidden"},
        404: {"model": APIErrorResponse, "description": "Repository, branch, or Git tree not found"},
        429: {"model": APIErrorResponse, "description": "GitHub API rate limit reached"},
        502: {"model": APIErrorResponse, "description": "GitHub API unavailable or unexpected response"},
        504: {"model": APIErrorResponse, "description": "GitHub API request timed out"},
    },
    summary="Analyze public GitHub repository for bugs and security vulnerabilities",
    description="Discovers candidate files, retrieves source code safely, executes multi-language static analysis tools (AST, Ruff, Bandit, ESLint, Secrets), deduplicates findings, and returns normalized bug report.",
)
async def analyze_repository(payload: RepositoryAnalysisRequest):
    try:
        result = await analysis_engine.analyze_repository(
            repository_url=payload.repository_url,
            branch=payload.branch,
        )
        return result
    except GitHubServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": f"An unexpected server error occurred while analyzing the repository: {str(exc)}",
                }
            },
        )



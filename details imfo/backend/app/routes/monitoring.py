from typing import List, Optional
from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from app.schemas.monitoring import (
    AnalysisJobRecord,
    JobRetryResponse,
    RepositoryMonitoringSettings,
    UpdateMonitoringSettingsRequest,
    WebhookEventRecord,
    WebhookResponse,
)
from app.schemas.repository import APIErrorResponse
from app.services.github_service import GitHubServiceError
from app.services.monitoring import (
    MonitoringService,
    WebhookVerificationError,
    monitoring_service,
    monitoring_storage,
)

router = APIRouter(tags=["Monitoring"])


# 1. GitHub Webhook Endpoint
@router.post(
    "/api/webhooks/github",
    response_model=WebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="GitHub Webhook Receiver",
    description="Receives and securely verifies GitHub push, pull_request, and ping webhook deliveries via HMAC-SHA256 signature.",
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid payload or missing headers"},
        401: {"model": APIErrorResponse, "description": "Invalid or missing webhook signature"},
    },
)
async def github_webhook_endpoint(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_github_delivery: Optional[str] = Header(None, alias="X-GitHub-Delivery"),
):
    if not x_github_event:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "MISSING_EVENT_HEADER",
                    "message": "Missing required X-GitHub-Event header.",
                }
            },
        )

    if not x_github_delivery:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "MISSING_DELIVERY_HEADER",
                    "message": "Missing required X-GitHub-Delivery header.",
                }
            },
        )

    raw_body = await request.body()

    try:
        response = await monitoring_service.handle_webhook(
            raw_payload=raw_body,
            signature_header=x_hub_signature_256,
            event_type=x_github_event,
            delivery_id=x_github_delivery,
        )
        # Return 202 if an analysis job was queued, 200 otherwise
        status_code = status.HTTP_202_ACCEPTED if response.status == "queued" else status.HTTP_200_OK
        return JSONResponse(status_code=status_code, content=response.model_dump())
    except WebhookVerificationError as err:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": {
                    "code": "INVALID_SIGNATURE",
                    "message": err.message,
                }
            },
        )
    except ValueError as err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "MALFORMED_PAYLOAD",
                    "message": str(err),
                }
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "WEBHOOK_PROCESSING_ERROR",
                    "message": f"Error processing webhook event: {str(exc)}",
                }
            },
        )


# 2. Monitoring Settings Endpoints
@router.get(
    "/api/repositories/{owner}/{repo}/monitoring",
    response_model=RepositoryMonitoringSettings,
    summary="Get repository monitoring settings",
)
async def get_monitoring_settings(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    settings = monitoring_storage.get_or_create_settings(full_name)
    return settings


@router.patch(
    "/api/repositories/{owner}/{repo}/monitoring",
    response_model=RepositoryMonitoringSettings,
    summary="Update repository monitoring settings",
)
async def update_monitoring_settings(
    owner: str,
    repo: str,
    payload: UpdateMonitoringSettingsRequest,
):
    full_name = f"{owner}/{repo}"
    updated = monitoring_storage.update_settings(
        repository=full_name,
        is_active=payload.is_active,
        monitored_branches=payload.monitored_branches,
        analyze_all_branches=payload.analyze_all_branches,
        auto_diagnose_high_priority=payload.auto_diagnose_high_priority,
    )
    return updated


@router.post(
    "/api/repositories/{owner}/{repo}/monitoring/enable",
    response_model=RepositoryMonitoringSettings,
    summary="Enable automatic monitoring for repository",
)
async def enable_monitoring(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    updated = monitoring_storage.update_settings(
        repository=full_name,
        is_active=True,
    )
    return updated


@router.post(
    "/api/repositories/{owner}/{repo}/monitoring/disable",
    response_model=RepositoryMonitoringSettings,
    summary="Disable automatic monitoring for repository",
)
async def disable_monitoring(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    updated = monitoring_storage.update_settings(
        repository=full_name,
        is_active=False,
    )
    return updated


# 3. Manual Analysis Trigger
@router.post(
    "/api/repositories/{owner}/{repo}/analyze-latest",
    response_model=AnalysisJobRecord,
    summary="Trigger analysis for the latest repository commit",
)
async def analyze_latest(
    owner: str,
    repo: str,
    branch: Optional[str] = Query(None, description="Optional branch name; defaults to repo default branch"),
):
    try:
        job = await monitoring_service.trigger_manual_analysis(owner, repo, branch=branch)
        return job
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
                    "code": "ANALYSIS_TRIGGER_FAILED",
                    "message": f"Failed to trigger analysis: {str(exc)}",
                }
            },
        )


# 4. Events & Jobs
@router.get(
    "/api/repositories/{owner}/{repo}/events",
    response_model=List[WebhookEventRecord],
    summary="List recent webhook events for repository",
)
async def list_repository_events(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    return monitoring_storage.list_events_for_repo(full_name)


@router.get(
    "/api/repositories/{owner}/{repo}/analysis-jobs",
    response_model=List[AnalysisJobRecord],
    summary="List analysis jobs for repository",
)
async def list_repository_analysis_jobs(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    return monitoring_storage.list_jobs_for_repo(full_name)


@router.get(
    "/api/analysis-jobs/{job_id}",
    response_model=AnalysisJobRecord,
    summary="Get analysis job details by ID",
)
async def get_analysis_job(job_id: str):
    job = monitoring_storage.get_job(job_id)
    if not job:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "JOB_NOT_FOUND",
                    "message": f"Analysis job '{job_id}' was not found.",
                }
            },
        )
    return job


@router.post(
    "/api/analysis-jobs/{job_id}/retry",
    response_model=JobRetryResponse,
    summary="Retry a failed or stalled analysis job",
)
async def retry_analysis_job(job_id: str):
    try:
        result = await monitoring_service.retry_job(job_id)
        return result
    except ValueError as err:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "JOB_NOT_FOUND",
                    "message": str(err),
                }
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "RETRY_FAILED",
                    "message": f"Failed to retry job: {str(exc)}",
                }
            },
        )

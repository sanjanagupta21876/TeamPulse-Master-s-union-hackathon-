from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.diagnosis import (
    DiagnosisReport,
    DiagnosisRequest,
    CrossLayerDiagnosisRequest,
    DiagnosisListResponse,
)
from app.schemas.repository import APIErrorResponse
from app.services.diagnosis import (
    DiagnosisService,
    DiagnosisServiceError,
    ScanNotFoundError,
    ScanRepositoryMismatchError,
    InvalidFindingIdsError,
)

router = APIRouter(tags=["Diagnosis"])
diagnosis_service = DiagnosisService()


@router.post(
    "/api/repositories/{owner}/{repo}/diagnose",
    response_model=DiagnosisReport,
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid scan ID or finding IDs"},
        404: {"model": APIErrorResponse, "description": "Scan not found"},
        500: {"model": APIErrorResponse, "description": "Diagnosis execution failure"},
    },
    summary="Diagnose root causes for repository findings",
    description="Analyzes selected or top findings using source code context and LLM inference to identify likely root causes versus symptoms.",
)
async def diagnose_repository_findings(
    owner: str,
    repo: str,
    payload: DiagnosisRequest,
):
    try:
        report = await diagnosis_service.diagnose_scan(
            owner=owner,
            repo=repo,
            scan_id=payload.scan_id,
            finding_ids=payload.finding_ids,
        )
        return report
    except DiagnosisServiceError as err:
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
                    "message": f"An unexpected error occurred during diagnosis: {str(exc)}",
                }
            },
        )


@router.post(
    "/api/repositories/{owner}/{repo}/diagnose/cross-layer",
    response_model=DiagnosisReport,
    responses={
        400: {"model": APIErrorResponse, "description": "Invalid scan ID"},
        404: {"model": APIErrorResponse, "description": "Scan not found"},
        500: {"model": APIErrorResponse, "description": "Cross-layer analysis execution failure"},
    },
    summary="Analyze frontend-backend relationships and API contract mismatches",
    description="Inspects frontend API client calls and backend route definitions to discover mismatches in HTTP methods, payloads, and authentication.",
)
async def diagnose_cross_layer_relationships(
    owner: str,
    repo: str,
    payload: CrossLayerDiagnosisRequest,
):
    try:
        report = await diagnosis_service.diagnose_cross_layer(
            owner=owner,
            repo=repo,
            scan_id=payload.scan_id,
        )
        return report
    except DiagnosisServiceError as err:
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
                    "message": f"An unexpected error occurred during cross-layer analysis: {str(exc)}",
                }
            },
        )


@router.get(
    "/api/repositories/{owner}/{repo}/diagnoses",
    response_model=DiagnosisListResponse,
    summary="List stored diagnoses for a repository",
    description="Returns all stored diagnosis reports associated with the specified repository.",
)
async def list_repository_diagnoses(
    owner: str,
    repo: str,
):
    diagnoses = diagnosis_service.list_diagnoses(owner=owner, repo=repo)
    return DiagnosisListResponse(
        repository=f"{owner}/{repo}",
        diagnoses=diagnoses,
    )


@router.get(
    "/api/diagnoses/{diagnosis_id}",
    response_model=DiagnosisReport,
    responses={
        404: {"model": APIErrorResponse, "description": "Diagnosis report not found"},
    },
    summary="Get specific diagnosis report by ID",
    description="Retrieves a complete structured diagnosis report by its unique identifier.",
)
async def get_diagnosis_report(diagnosis_id: str):
    report = diagnosis_service.get_diagnosis(diagnosis_id)
    if not report:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "DIAGNOSIS_NOT_FOUND",
                    "message": f"Diagnosis report with id '{diagnosis_id}' was not found.",
                }
            },
        )
    return report

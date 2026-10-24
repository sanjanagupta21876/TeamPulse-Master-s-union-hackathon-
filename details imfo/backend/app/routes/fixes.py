from typing import Optional
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.fix import (
    DiffResult,
    FixActionResponse,
    FixListResponse,
    FixProposal,
    GenerateFixRequest,
)
from app.schemas.repository import APIErrorResponse
from app.services.fixes import (
    FixService,
    FixServiceError,
    FindingNotFoundError,
    FixNotFoundError,
)

router = APIRouter(tags=["Fixes"])
fix_service = FixService()


@router.post(
    "/api/findings/{finding_id}/fixes",
    response_model=FixProposal,
    responses={
        400: {"model": APIErrorResponse, "description": "Fix generation error or source unavailable"},
        404: {"model": APIErrorResponse, "description": "Finding not found"},
        500: {"model": APIErrorResponse, "description": "Internal server error"},
    },
    summary="Generate AI-powered code fix proposal for a finding",
    description="Loads the finding and source content from the exact scanned commit, applies safe context and AI reasoning, validates the patch, and returns the proposed code and diff.",
)
async def generate_fix_for_finding(
    finding_id: str,
    payload: Optional[GenerateFixRequest] = None,
):
    try:
        diagnosis_id = payload.diagnosis_id if payload else None
        instructions = payload.instructions if payload else None
        proposal = await fix_service.generate_fix(
            finding_id=finding_id,
            diagnosis_id=diagnosis_id,
            instructions=instructions,
        )
        return proposal
    except FixServiceError as err:
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
                    "message": f"An unexpected error occurred during fix generation: {str(exc)}",
                }
            },
        )


@router.get(
    "/api/findings/{finding_id}/fixes",
    response_model=FixListResponse,
    summary="List all fix proposals for a finding",
    description="Retrieves proposal audit history associated with a specific static analysis finding.",
)
async def list_fixes_for_finding(finding_id: str):
    fixes = fix_service.list_fixes_for_finding(finding_id)
    return FixListResponse(finding_id=finding_id, fixes=fixes)


@router.get(
    "/api/fixes/{fix_id}",
    response_model=FixProposal,
    responses={
        404: {"model": APIErrorResponse, "description": "Fix proposal not found"},
    },
    summary="Get specific fix proposal by ID",
    description="Returns the complete fix proposal, original code, proposed content, and validation results.",
)
async def get_fix_proposal(fix_id: str):
    try:
        return fix_service.get_fix(fix_id)
    except FixServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )


@router.get(
    "/api/fixes/{fix_id}/diff",
    response_model=DiffResult,
    responses={
        404: {"model": APIErrorResponse, "description": "Fix proposal not found"},
    },
    summary="Get calculated diff for a fix proposal",
    description="Returns unified diff and structured line change hunks comparing original and proposed code.",
)
async def get_fix_diff(fix_id: str):
    try:
        return fix_service.get_fix_diff(fix_id)
    except FixServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )


@router.post(
    "/api/fixes/{fix_id}/approve",
    response_model=FixActionResponse,
    responses={
        404: {"model": APIErrorResponse, "description": "Fix proposal not found"},
    },
    summary="Approve a fix proposal",
    description="Records developer approval of the proposed fix. Does NOT modify the original repository or push commits.",
)
async def approve_fix_proposal(fix_id: str):
    try:
        updated = fix_service.approve_proposal(fix_id)
        return FixActionResponse(
            message="Fix proposal approved successfully. Original repository remains unchanged until explicitly applied.",
            fix=updated,
        )
    except FixServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )


@router.post(
    "/api/fixes/{fix_id}/reject",
    response_model=FixActionResponse,
    responses={
        404: {"model": APIErrorResponse, "description": "Fix proposal not found"},
    },
    summary="Reject a fix proposal",
    description="Marks the fix proposal as rejected while preserving the audit record in history.",
)
async def reject_fix_proposal(fix_id: str):
    try:
        updated = fix_service.reject_proposal(fix_id)
        return FixActionResponse(
            message="Fix proposal marked as rejected.",
            fix=updated,
        )
    except FixServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={
                "error": {
                    "code": err.code,
                    "message": err.message,
                }
            },
        )


@router.post(
    "/api/fixes/{fix_id}/regenerate",
    response_model=FixProposal,
    responses={
        404: {"model": APIErrorResponse, "description": "Fix proposal not found"},
        500: {"model": APIErrorResponse, "description": "Fix regeneration failed"},
    },
    summary="Regenerate a fix proposal",
    description="Generates a new alternative proposal for the same finding and source version while preserving the previous proposal in history.",
)
async def regenerate_fix_proposal(
    fix_id: str,
    payload: Optional[GenerateFixRequest] = None,
):
    try:
        instructions = payload.instructions if payload else None
        new_proposal = await fix_service.regenerate_proposal(
            fix_id=fix_id,
            instructions=instructions,
        )
        return new_proposal
    except FixServiceError as err:
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
                    "message": f"An unexpected error occurred during fix regeneration: {str(exc)}",
                }
            },
        )

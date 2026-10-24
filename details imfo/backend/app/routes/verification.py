from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.schemas.verification import (
    VerificationActionResponse,
    VerificationListResponse,
    VerificationRecord,
    VerificationRequest,
)
from app.services.verification import (
    ProposalNotApprovedError,
    ProposalNotFoundError,
    SourceHashMismatchError,
    VerificationServiceError,
    verification_service,
)

router = APIRouter(prefix="/api", tags=["Verification"])


@router.post(
    "/fixes/{fix_id}/verify",
    response_model=VerificationRecord,
    summary="Verify an approved fix proposal in an isolated workspace",
    description="Applies the approved fix patch inside a sandboxed workspace, executes safe static and syntax checks, and reports result comparisons.",
)
async def verify_fix(
    fix_id: str,
    request: VerificationRequest = VerificationRequest(),
):
    try:
        record = await verification_service.verify_fix(fix_id=fix_id, request=request)
        return record
    except ProposalNotFoundError as err:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": {"code": err.code, "message": err.message}},
        )
    except ProposalNotApprovedError as err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": err.code, "message": err.message}},
        )
    except SourceHashMismatchError as err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": err.code, "message": err.message}},
        )
    except VerificationServiceError as err:
        return JSONResponse(
            status_code=err.status_code,
            content={"error": {"code": err.code, "message": err.message}},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "VERIFICATION_FAILED",
                    "message": f"An unexpected error occurred during verification: {str(exc)}",
                }
            },
        )


@router.get(
    "/verifications/{verification_id}",
    response_model=VerificationRecord,
    summary="Retrieve verification job status and results",
)
async def get_verification(verification_id: str):
    record = verification_service.get_verification(verification_id)
    if not record:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "VERIFICATION_NOT_FOUND",
                    "message": f"Verification record with ID '{verification_id}' was not found.",
                }
            },
        )
    return record


@router.get(
    "/fixes/{fix_id}/verifications",
    response_model=VerificationListResponse,
    summary="List verification attempts for a fix proposal",
)
async def list_verifications_for_fix(fix_id: str):
    records = verification_service.list_verifications_for_fix(fix_id)
    return VerificationListResponse(fix_id=fix_id, verifications=records)


@router.post(
    "/verifications/{verification_id}/cancel",
    response_model=VerificationActionResponse,
    summary="Cancel a verification job",
)
async def cancel_verification(verification_id: str):
    record = verification_service.cancel_verification(verification_id)
    if not record:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "error": {
                    "code": "VERIFICATION_NOT_FOUND",
                    "message": f"Verification record with ID '{verification_id}' was not found.",
                }
            },
        )
    return VerificationActionResponse(
        message=f"Verification job '{verification_id}' marked as cancelled.",
        verification=record,
    )

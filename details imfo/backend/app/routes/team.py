from typing import Callable, Optional, TypeVar

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.team import (
    AnswerCheckInRequest,
    CheckInView,
    CreateCheckInRequest,
    MissionControlView,
    MissionUpdateRequest,
    ProjectListResponse,
    SimulateUpdateRequest,
)
from app.services import team as team_service
from app.services.team import TeamServiceError

router = APIRouter(prefix="/api/team", tags=["Mission Control"])

T = TypeVar("T")


def _error(err: TeamServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=err.status_code,
        content={"error": {"code": err.code, "message": err.message}},
    )


def _run(fn: Callable[[], T]):
    try:
        return fn()
    except TeamServiceError as err:
        return _error(err)


@router.get("/projects", response_model=ProjectListResponse, summary="List team projects")
async def list_projects():
    return ProjectListResponse(projects=team_service.list_projects())


@router.get(
    "/projects/{project_id}/mission-control",
    response_model=MissionControlView,
    summary="Mission Control snapshot: risk, dependency chain, active recovery action and timeline",
)
async def get_mission_control(project_id: str):
    return _run(lambda: team_service.mission_control(project_id))


@router.post(
    "/projects/{project_id}/analyze",
    response_model=MissionControlView,
    summary="Run Detect -> Diagnose -> Intervene and propose a recovery action for Captain approval",
)
async def analyze_project(project_id: str):
    try:
        return await team_service.analyze(project_id)
    except TeamServiceError as err:
        return _error(err)


@router.post("/interventions/{intervention_id}/approve", response_model=MissionControlView, summary="Captain approves a recovery action")
async def approve_intervention(intervention_id: str):
    return _run(lambda: team_service.approve(intervention_id))


@router.post(
    "/interventions/{intervention_id}/reject",
    response_model=MissionControlView,
    summary="Captain rejects a recovery action; the next playbook action is proposed",
)
async def reject_intervention(intervention_id: str):
    return _run(lambda: team_service.reject(intervention_id))


@router.post("/missions/{mission_id}/checkins", response_model=CheckInView, summary="Send a private check-in to the mission owner")
async def create_checkin(mission_id: str, payload: Optional[CreateCheckInRequest] = None):
    return _run(lambda: team_service.create_checkin(mission_id, payload.question if payload else None))


@router.post("/checkins/{checkin_id}/answer", response_model=CheckInView, summary="Mission owner answers a private check-in")
async def answer_checkin(checkin_id: str, payload: AnswerCheckInRequest):
    return _run(lambda: team_service.answer_checkin(checkin_id, payload.answer))


@router.post(
    "/missions/{mission_id}/updates",
    response_model=MissionControlView,
    summary="Post a mission update; verifies any approved recovery action",
)
async def post_update(mission_id: str, payload: MissionUpdateRequest):
    return _run(lambda: team_service.record_update(mission_id, payload.text, payload.progress, payload.status))


@router.post(
    "/missions/{mission_id}/simulate-update",
    response_model=MissionControlView,
    summary="Demo only: post a simulated next update with a chosen outcome",
)
async def simulate_update(mission_id: str, payload: SimulateUpdateRequest):
    return _run(lambda: team_service.simulate_update(mission_id, payload.outcome))


@router.post("/demo/reset", response_model=MissionControlView, summary="Reload the demo scenario")
async def reset_demo():
    project_id = team_service.reset_demo()
    return team_service.mission_control(project_id)

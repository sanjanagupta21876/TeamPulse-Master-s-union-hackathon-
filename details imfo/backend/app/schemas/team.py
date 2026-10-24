"""Pydantic schemas for Mission Control / Ship Intelligence (team recovery agent)."""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field

MissionStatus = Literal["todo", "in_progress", "blocked", "done"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
InterventionStatus = Literal["proposed", "approved", "rejected", "resolved", "failed", "escalated"]
LoopStage = Literal["detect", "diagnose", "intervene", "verify", "adapt", "recovered"]


class CrewMember(BaseModel):
    id: str
    call_sign: str
    role: str


class RiskSignal(BaseModel):
    code: str
    message: str


class MissionView(BaseModel):
    id: str
    title: str
    owner_id: Optional[str] = None
    owner_call_sign: Optional[str] = None
    status: MissionStatus
    progress: int
    estimate_hours: float
    remaining_hours: float
    due_at: str
    last_update_at: Optional[str] = None
    depends_on: List[str] = Field(default_factory=list)
    risk_level: RiskLevel
    signals: List[RiskSignal] = Field(default_factory=list)
    downstream: List[str] = Field(default_factory=list, description="Unfinished missions waiting on this one")
    is_root_bottleneck: bool = False


class MissionUpdateView(BaseModel):
    id: str
    mission_id: str
    crew_call_sign: Optional[str] = None
    text: str
    progress: int
    status: MissionStatus
    simulated: bool
    created_at: str


class CheckInView(BaseModel):
    id: str
    mission_id: str
    crew_call_sign: Optional[str] = None
    question: str
    answer: Optional[str] = None
    created_at: str
    answered_at: Optional[str] = None


class InterventionView(BaseModel):
    id: str
    mission_id: str
    mission_title: str
    cause: str
    cause_label: str
    confidence: str
    diagnosis_source: Literal["rules", "llm"]
    explanation: str
    evidence: List[str]
    action_code: str
    action_title: str
    action_summary: str
    steps: List[str]
    message_draft: str
    success_criteria: str
    status: InterventionStatus
    attempt_no: int
    previous_intervention_id: Optional[str] = None
    verification_note: Optional[str] = None
    created_at: str
    decided_at: Optional[str] = None
    verified_at: Optional[str] = None


class TimelineEvent(BaseModel):
    id: str
    kind: str
    actor: str = Field(..., description='"agent", "captain", "system" or "crew:<call sign>"')
    message: str
    meta: Optional[str] = None
    mission_id: Optional[str] = None
    intervention_id: Optional[str] = None
    simulated: bool
    created_at: str


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    deadline_at: str


class MissionControlView(BaseModel):
    project: ProjectSummary
    now: str
    hours_to_deadline: float
    risk_level: RiskLevel
    emergency_mode: bool
    root_bottleneck_id: Optional[str] = None
    loop_stage: LoopStage
    crew: List[CrewMember]
    missions: List[MissionView]
    active_intervention: Optional[InterventionView] = None
    interventions: List[InterventionView]
    checkins: List[CheckInView]
    updates: List[MissionUpdateView]
    timeline: List[TimelineEvent]
    llm_enabled: bool


class ProjectListResponse(BaseModel):
    projects: List[ProjectSummary]


class CreateCheckInRequest(BaseModel):
    question: Optional[str] = Field(default=None, max_length=500)


class AnswerCheckInRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=2000)


class MissionUpdateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    progress: int = Field(..., ge=0, le=100)
    status: MissionStatus


class SimulateUpdateRequest(BaseModel):
    outcome: Literal["resolved", "still_blocked"]

import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from app.schemas.team import (
    CheckInView,
    CrewMember,
    InterventionView,
    MissionControlView,
    MissionUpdateView,
    MissionView,
    ProjectSummary,
    RiskSignal,
    TimelineEvent,
)
from app.services.diagnosis.llm_provider import LLMProvider
from app.services.team import playbook
from app.services.team.db import from_iso, get_conn, new_id, to_iso, utcnow
from app.services.team.dependency_graph import downstream_of, find_root_bottleneck
from app.services.team.diagnosis import Diagnosis, diagnose
from app.services.team.risk_engine import MissionState, ProjectRisk, assess

ACTIVE_STATUSES = ("proposed", "approved", "escalated")
DEFAULT_CHECKIN_QUESTION = (
    "Quick private check-in: what is the main thing stopping {mission} from moving right now? "
    "There is no wrong answer; this only helps us pick the right kind of help."
)
MIN_PROGRESS_GAIN = 10
AGENT, CAPTAIN, SYSTEM = "agent", "captain", "system"


class TeamServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _get_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise TeamServiceError("PROJECT_NOT_FOUND", f"Project '{project_id}' was not found.", 404)
    return row


def _get_mission_row(conn: sqlite3.Connection, mission_id: str) -> sqlite3.Row:
    row = conn.execute(
        """SELECT m.*, c.call_sign AS owner_call_sign FROM missions m
           LEFT JOIN crew c ON c.id = m.owner_id WHERE m.id = ?""",
        (mission_id,),
    ).fetchone()
    if not row:
        raise TeamServiceError("MISSION_NOT_FOUND", f"Mission '{mission_id}' was not found.", 404)
    return row


def _load_missions(conn: sqlite3.Connection, project_id: str) -> List[MissionState]:
    rows = conn.execute(
        """SELECT m.*, c.call_sign AS owner_call_sign FROM missions m
           LEFT JOIN crew c ON c.id = m.owner_id
           WHERE m.project_id = ? ORDER BY m.position""",
        (project_id,),
    ).fetchall()
    deps: Dict[str, List[str]] = {}
    for d in conn.execute(
        """SELECT d.mission_id, d.depends_on_id FROM mission_dependencies d
           JOIN missions m ON m.id = d.mission_id WHERE m.project_id = ?""",
        (project_id,),
    ):
        deps.setdefault(d["mission_id"], []).append(d["depends_on_id"])

    return [
        MissionState(
            id=r["id"],
            title=r["title"],
            owner_id=r["owner_id"],
            owner_call_sign=r["owner_call_sign"],
            status=r["status"],
            progress=r["progress"],
            estimate_hours=r["estimate_hours"],
            due_at=from_iso(r["due_at"]),
            last_update_at=from_iso(r["last_update_at"]),
            depends_on=deps.get(r["id"], []),
        )
        for r in rows
    ]


def _assess(conn: sqlite3.Connection, project_id: str, now: datetime) -> Tuple[sqlite3.Row, List[MissionState], ProjectRisk, Optional[str]]:
    project = _get_project(conn, project_id)
    missions = _load_missions(conn, project_id)
    risk = assess(missions, from_iso(project["deadline_at"]), now)
    return project, missions, risk, find_root_bottleneck(missions, risk)


def _log(
    conn: sqlite3.Connection,
    project_id: str,
    kind: str,
    message: str,
    mission_id: Optional[str] = None,
    intervention_id: Optional[str] = None,
    simulated: bool = False,
    actor: str = AGENT,
    meta: Optional[str] = None,
) -> None:
    """Room activity. `actor` is "agent", "captain", "system" or "crew:<call sign>"."""
    conn.execute(
        """INSERT INTO events (id, project_id, kind, actor, message, meta, mission_id, intervention_id, simulated, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            new_id("evt"), project_id, kind, actor, message, meta, mission_id, intervention_id,
            int(simulated), to_iso(utcnow()),
        ),
    )


def _crew_actor(call_sign: Optional[str]) -> str:
    return f"crew:{call_sign}" if call_sign else SYSTEM


def _intervention_view(row: sqlite3.Row, mission_title: str) -> InterventionView:
    return InterventionView(
        id=row["id"],
        mission_id=row["mission_id"],
        mission_title=mission_title,
        cause=row["cause"],
        cause_label=row["cause_label"],
        confidence=row["confidence"],
        diagnosis_source=row["diagnosis_source"],
        explanation=row["explanation"],
        evidence=json.loads(row["evidence"]),
        action_code=row["action_code"],
        action_title=row["action_title"],
        action_summary=row["action_summary"],
        steps=json.loads(row["steps"]),
        message_draft=row["message_draft"],
        success_criteria=row["success_criteria"],
        status=row["status"],
        attempt_no=row["attempt_no"],
        previous_intervention_id=row["previous_intervention_id"],
        verification_note=row["verification_note"],
        created_at=row["created_at"],
        decided_at=row["decided_at"],
        verified_at=row["verified_at"],
    )


def _active_intervention(conn: sqlite3.Connection, project_id: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        f"""SELECT * FROM interventions WHERE project_id = ? AND status IN ({','.join('?' * len(ACTIVE_STATUSES))})
            ORDER BY created_at DESC, attempt_no DESC LIMIT 1""",
        (project_id, *ACTIVE_STATUSES),
    ).fetchone()


# ---------------------------------------------------------------------------
# Read model
# ---------------------------------------------------------------------------

def _loop_stage(conn: sqlite3.Connection, project_id: str, root_id: Optional[str]) -> str:
    active = _active_intervention(conn, project_id)
    if active:
        if active["status"] == "approved":
            return "verify"
        if active["status"] == "escalated" or active["attempt_no"] > 1:
            return "adapt"
        return "intervene"
    latest = conn.execute(
        "SELECT status FROM interventions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (project_id,),
    ).fetchone()
    if root_id is None and latest and latest["status"] == "resolved":
        return "recovered"
    return "detect"


def mission_control(project_id: str) -> MissionControlView:
    now = utcnow()
    with get_conn() as conn:
        project, missions, risk, root_id = _assess(conn, project_id, now)
        titles = {m.id: m.title for m in missions}

        mission_views = [
            MissionView(
                id=m.id,
                title=m.title,
                owner_id=m.owner_id,
                owner_call_sign=m.owner_call_sign,
                status=m.status,
                progress=m.progress,
                estimate_hours=m.estimate_hours,
                remaining_hours=m.remaining_hours,
                due_at=to_iso(m.due_at),
                last_update_at=to_iso(m.last_update_at) if m.last_update_at else None,
                depends_on=m.depends_on,
                risk_level=risk.missions[m.id].level,
                signals=[RiskSignal(code=s.code, message=s.message) for s in risk.missions[m.id].signals],
                downstream=downstream_of(m.id, missions),
                is_root_bottleneck=m.id == root_id,
            )
            for m in missions
        ]

        intervention_rows = conn.execute(
            "SELECT * FROM interventions WHERE project_id = ? ORDER BY created_at DESC, attempt_no DESC",
            (project_id,),
        ).fetchall()
        interventions = [_intervention_view(r, titles.get(r["mission_id"], "")) for r in intervention_rows]
        active_row = _active_intervention(conn, project_id)
        active = next((i for i in interventions if active_row and i.id == active_row["id"]), None)

        crew_rows = conn.execute("SELECT * FROM crew WHERE project_id = ? ORDER BY call_sign", (project_id,)).fetchall()
        call_signs = {c["id"]: c["call_sign"] for c in crew_rows}

        checkins = [
            CheckInView(
                id=c["id"],
                mission_id=c["mission_id"],
                crew_call_sign=call_signs.get(c["crew_id"]),
                question=c["question"],
                answer=c["answer"],
                created_at=c["created_at"],
                answered_at=c["answered_at"],
            )
            for c in conn.execute(
                """SELECT c.* FROM checkins c JOIN missions m ON m.id = c.mission_id
                   WHERE m.project_id = ? ORDER BY c.created_at DESC""",
                (project_id,),
            )
        ]
        updates = [
            MissionUpdateView(
                id=u["id"],
                mission_id=u["mission_id"],
                crew_call_sign=call_signs.get(u["crew_id"]),
                text=u["text"],
                progress=u["progress"],
                status=u["status"],
                simulated=bool(u["simulated"]),
                created_at=u["created_at"],
            )
            for u in conn.execute(
                """SELECT u.* FROM updates u JOIN missions m ON m.id = u.mission_id
                   WHERE m.project_id = ? ORDER BY u.created_at DESC LIMIT 30""",
                (project_id,),
            )
        ]
        timeline = [
            TimelineEvent(
                id=e["id"],
                kind=e["kind"],
                actor=e["actor"],
                message=e["message"],
                meta=e["meta"],
                mission_id=e["mission_id"],
                intervention_id=e["intervention_id"],
                simulated=bool(e["simulated"]),
                created_at=e["created_at"],
            )
            for e in conn.execute(
                "SELECT * FROM events WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50",
                (project_id,),
            )
        ]

        return MissionControlView(
            project=ProjectSummary(
                id=project["id"],
                name=project["name"],
                description=project["description"],
                deadline_at=project["deadline_at"],
            ),
            now=to_iso(now),
            hours_to_deadline=risk.hours_to_deadline,
            risk_level=risk.level,
            emergency_mode=risk.emergency_mode,
            root_bottleneck_id=root_id,
            loop_stage=_loop_stage(conn, project_id, root_id),
            crew=[CrewMember(id=c["id"], call_sign=c["call_sign"], role=c["role"]) for c in crew_rows],
            missions=mission_views,
            active_intervention=active,
            interventions=interventions,
            checkins=checkins,
            updates=updates,
            timeline=timeline,
            llm_enabled=LLMProvider().is_configured,
        )


def list_projects() -> List[ProjectSummary]:
    with get_conn() as conn:
        return [
            ProjectSummary(id=p["id"], name=p["name"], description=p["description"], deadline_at=p["deadline_at"])
            for p in conn.execute("SELECT * FROM projects ORDER BY created_at")
        ]


# ---------------------------------------------------------------------------
# Detect -> Diagnose -> Intervene
# ---------------------------------------------------------------------------

def _tried_actions(conn: sqlite3.Connection, mission_id: str) -> List[str]:
    return [r["action_code"] for r in conn.execute("SELECT action_code FROM interventions WHERE mission_id = ?", (mission_id,))]


def _insert_intervention(
    conn: sqlite3.Connection,
    project_id: str,
    mission: sqlite3.Row,
    diagnosis: Diagnosis,
    action: playbook.RecoveryAction,
    status: str,
    attempt_no: int,
    previous_id: Optional[str],
) -> str:
    rendered = playbook.render(action, mission["owner_call_sign"] or "team", mission["title"])
    intervention_id = new_id("int")
    conn.execute(
        """INSERT INTO interventions (
               id, project_id, mission_id, cause, cause_label, confidence, diagnosis_source, explanation, evidence,
               action_code, action_title, action_summary, steps, message_draft, success_criteria, status,
               attempt_no, previous_intervention_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            intervention_id, project_id, mission["id"], diagnosis.cause, diagnosis.cause_label,
            diagnosis.confidence, diagnosis.source, diagnosis.explanation, json.dumps(diagnosis.evidence),
            action.code, rendered["title"], rendered["summary"], json.dumps(rendered["steps"]),
            rendered["message"], playbook.SUCCESS_CRITERIA, status, attempt_no, previous_id, to_iso(utcnow()),
        ),
    )
    return intervention_id


def _diagnosis_from_row(row: sqlite3.Row) -> Diagnosis:
    return Diagnosis(
        cause=row["cause"],
        cause_label=row["cause_label"],
        confidence=row["confidence"],
        source=row["diagnosis_source"],
        explanation=row["explanation"],
        evidence=json.loads(row["evidence"]),
    )


def _propose_next(conn: sqlite3.Connection, previous: sqlite3.Row, reason: str, simulated: bool = False) -> str:
    """Adapt step: pick a different action for the same cause; escalate to the Captain when none are left."""
    mission = _get_mission_row(conn, previous["mission_id"])
    action = playbook.next_action(previous["cause"], _tried_actions(conn, mission["id"]))
    diagnosis = _diagnosis_from_row(previous)
    if action:
        new_id_ = _insert_intervention(
            conn, previous["project_id"], mission, diagnosis, action, "proposed", previous["attempt_no"] + 1, previous["id"]
        )
        _log(
            conn, previous["project_id"], "adapt",
            f"Trying something different: {action.title}.",
            mission["id"], new_id_, simulated, meta=reason,
        )
        return new_id_

    action = playbook.ACTIONS[playbook.ESCALATION_ACTION]
    new_id_ = _insert_intervention(
        conn, previous["project_id"], mission, diagnosis, action, "escalated", previous["attempt_no"] + 1, previous["id"]
    )
    _log(
        conn, previous["project_id"], "escalate",
        f"Every planned action for {mission['title']} has been tried. This needs a Captain decision.",
        mission["id"], new_id_, simulated, meta=reason,
    )
    return new_id_


async def analyze(project_id: str, llm_provider: Optional[LLMProvider] = None) -> MissionControlView:
    now = utcnow()
    with get_conn() as conn:
        project, missions, risk, root_id = _assess(conn, project_id, now)
        if _active_intervention(conn, project_id):
            raise TeamServiceError(
                "INTERVENTION_ACTIVE",
                "A recovery action is already in progress. Approve, reject or verify it before running a new analysis.",
                409,
            )

        if root_id is None:
            _log(conn, project_id, "detect", "No mission is at high risk right now. Nothing to recover.")

    if root_id is None:
        return mission_control(project_id)

    with get_conn() as conn:
        root = next(m for m in missions if m.id == root_id)
        downstream_titles = [next(m.title for m in missions if m.id == d) for d in downstream_of(root_id, missions)]
        waiting = f" {len(downstream_titles)} missions are waiting behind it." if downstream_titles else ""
        _log(
            conn, project_id, "detect",
            f"{root.title} looks like the root bottleneck.{waiting}",
            root_id,
            meta=f"Project risk {risk.level.lower()}",
        )
        answer_row = conn.execute(
            """SELECT answer FROM checkins WHERE mission_id = ? AND answer IS NOT NULL
               ORDER BY answered_at DESC LIMIT 1""",
            (root_id,),
        ).fetchone()
        recent = [
            r["text"] for r in conn.execute(
                "SELECT text FROM updates WHERE mission_id = ? ORDER BY created_at DESC LIMIT 3", (root_id,)
            )
        ]

    # LLM call happens outside the DB transaction
    diagnosis = await diagnose(
        root, risk.missions[root_id], downstream_titles, answer_row["answer"] if answer_row else None, recent, llm_provider
    )

    with get_conn() as conn:
        mission_row = _get_mission_row(conn, root_id)
        action = playbook.next_action(diagnosis.cause, _tried_actions(conn, root_id))
        status = "proposed"
        if action is None:
            action, status = playbook.ACTIONS[playbook.ESCALATION_ACTION], "escalated"
        prior = conn.execute("SELECT COUNT(*) FROM interventions WHERE mission_id = ?", (root_id,)).fetchone()[0]
        intervention_id = _insert_intervention(conn, project_id, mission_row, diagnosis, action, status, prior + 1, None)
        _log(
            conn, project_id, "diagnose",
            f"Likely root cause: {diagnosis.cause_label}.",
            root_id, intervention_id,
            meta=f"{diagnosis.confidence.capitalize()} confidence, {'AI-assisted' if diagnosis.source == 'llm' else 'rule-based'}",
        )
        _log(
            conn, project_id, "intervene",
            f"Recommending: {action.title}.",
            root_id, intervention_id,
            meta="Waiting for the Captain to approve",
        )
    return mission_control(project_id)


def _get_intervention(conn: sqlite3.Connection, intervention_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM interventions WHERE id = ?", (intervention_id,)).fetchone()
    if not row:
        raise TeamServiceError("INTERVENTION_NOT_FOUND", f"Intervention '{intervention_id}' was not found.", 404)
    return row


def approve(intervention_id: str) -> MissionControlView:
    with get_conn() as conn:
        row = _get_intervention(conn, intervention_id)
        if row["status"] not in ("proposed", "escalated"):
            raise TeamServiceError("INVALID_STATE", f"Only proposed actions can be approved (current: {row['status']}).", 409)
        mission = _get_mission_row(conn, row["mission_id"])
        conn.execute(
            "UPDATE interventions SET status = 'approved', decided_at = ?, baseline_progress = ? WHERE id = ?",
            (to_iso(utcnow()), mission["progress"], intervention_id),
        )
        _log(
            conn, row["project_id"], "approve",
            f"Approved: {row['action_title']}.",
            mission["id"], intervention_id,
            actor=CAPTAIN, meta=f"Ship Intelligence checks the next update on {mission['title']}",
        )
        project_id = row["project_id"]
    return mission_control(project_id)


def reject(intervention_id: str) -> MissionControlView:
    with get_conn() as conn:
        row = _get_intervention(conn, intervention_id)
        if row["status"] != "proposed":
            raise TeamServiceError("INVALID_STATE", f"Only proposed actions can be rejected (current: {row['status']}).", 409)
        conn.execute(
            "UPDATE interventions SET status = 'rejected', decided_at = ? WHERE id = ?",
            (to_iso(utcnow()), intervention_id),
        )
        _log(
            conn, row["project_id"], "reject", f"Rejected: {row['action_title']}.", row["mission_id"], intervention_id,
            actor=CAPTAIN,
        )
        _propose_next(conn, row, "Captain rejected the previous recommendation.")
        project_id = row["project_id"]
    return mission_control(project_id)


# ---------------------------------------------------------------------------
# Check-ins
# ---------------------------------------------------------------------------

def create_checkin(mission_id: str, question: Optional[str] = None) -> CheckInView:
    with get_conn() as conn:
        mission = _get_mission_row(conn, mission_id)
        checkin_id = new_id("chk")
        created = to_iso(utcnow())
        text = (question or "").strip() or DEFAULT_CHECKIN_QUESTION.format(mission=mission["title"])
        conn.execute(
            "INSERT INTO checkins (id, mission_id, crew_id, question, created_at) VALUES (?, ?, ?, ?, ?)",
            (checkin_id, mission_id, mission["owner_id"], text, created),
        )
        _log(
            conn, mission["project_id"], "checkin",
            f"Sent {mission['owner_call_sign'] or 'the owner'} a private check-in about {mission['title']}.",
            mission_id,
            actor=CAPTAIN,
        )
        return CheckInView(
            id=checkin_id, mission_id=mission_id, crew_call_sign=mission["owner_call_sign"],
            question=text, created_at=created,
        )


def answer_checkin(checkin_id: str, answer: str) -> CheckInView:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM checkins WHERE id = ?", (checkin_id,)).fetchone()
        if not row:
            raise TeamServiceError("CHECKIN_NOT_FOUND", f"Check-in '{checkin_id}' was not found.", 404)
        mission = _get_mission_row(conn, row["mission_id"])
        answered = to_iso(utcnow())
        conn.execute("UPDATE checkins SET answer = ?, answered_at = ? WHERE id = ?", (answer.strip(), answered, checkin_id))
        _log(
            conn, mission["project_id"], "checkin",
            f"Answered the private check-in about {mission['title']}.",
            mission["id"],
            actor=_crew_actor(mission["owner_call_sign"]), meta="Only the Captain sees the answer",
        )
        return CheckInView(
            id=checkin_id, mission_id=row["mission_id"], crew_call_sign=mission["owner_call_sign"],
            question=row["question"], answer=answer.strip(), created_at=row["created_at"], answered_at=answered,
        )


# ---------------------------------------------------------------------------
# Updates -> Verify -> Adapt
# ---------------------------------------------------------------------------

def record_update(mission_id: str, text: str, progress: int, status: str, simulated: bool = False) -> MissionControlView:
    with get_conn() as conn:
        mission = _get_mission_row(conn, mission_id)
        now_iso = to_iso(utcnow())
        conn.execute(
            """INSERT INTO updates (id, mission_id, crew_id, text, progress, status, simulated, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_id("upd"), mission_id, mission["owner_id"], text, progress, status, int(simulated), now_iso),
        )
        conn.execute(
            "UPDATE missions SET progress = ?, status = ?, last_update_at = ? WHERE id = ?",
            (progress, status, now_iso, mission_id),
        )
        _log(
            conn, mission["project_id"], "update",
            text,
            mission_id, simulated=simulated,
            actor=_crew_actor(mission["owner_call_sign"]),
            meta=f"{mission['title']}: {status.replace('_', ' ')}, {progress}%",
        )

        pending = conn.execute(
            "SELECT * FROM interventions WHERE mission_id = ? AND status = 'approved' ORDER BY created_at DESC",
            (mission_id,),
        ).fetchall()
        for intervention in pending:
            baseline = intervention["baseline_progress"] or 0
            resolved = status == "done" or (status != "blocked" and progress - baseline >= MIN_PROGRESS_GAIN)
            if resolved:
                note = (
                    f"Verified: {mission['title']} is no longer blocked and progress moved from "
                    f"{baseline}% to {progress}%."
                )
                conn.execute(
                    "UPDATE interventions SET status = 'resolved', verification_note = ?, verified_at = ? WHERE id = ?",
                    (note, now_iso, intervention["id"]),
                )
                _log(
                    conn, mission["project_id"], "verify",
                    f"{mission['title']} is moving again, so the blocker is cleared.",
                    mission_id, intervention["id"], simulated,
                    meta=f"Progress {baseline}% to {progress}% after: {intervention['action_title']}",
                )
            else:
                note = (
                    f"Not resolved: {mission['title']} is {status.replace('_', ' ')} at {progress}% "
                    f"(was {baseline}% when the action was approved)."
                )
                conn.execute(
                    "UPDATE interventions SET status = 'failed', verification_note = ?, verified_at = ? WHERE id = ?",
                    (note, now_iso, intervention["id"]),
                )
                _log(
                    conn, mission["project_id"], "verify",
                    f"{mission['title']} is still {status.replace('_', ' ')} at {progress}%. That action didn't clear the blocker.",
                    mission_id, intervention["id"], simulated,
                    meta=f"Checked against: {intervention['action_title']}",
                )
                _propose_next(conn, intervention, f"\"{intervention['action_title']}\" did not clear the blocker.", simulated)
        project_id = mission["project_id"]
    return mission_control(project_id)

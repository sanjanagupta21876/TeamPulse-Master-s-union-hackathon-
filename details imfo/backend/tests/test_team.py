from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.diagnosis.llm_provider import LLMExecutionError
from app.services.team import DEMO_PROJECT_ID
from app.services.team.diagnosis import LLMTeamDiagnosis, diagnose, diagnose_with_rules
from app.services.team.risk_engine import MissionState, assess
from app.services.team.db import utcnow

client = TestClient(app)

DEMO_ANSWER = (
    "I can't finish the endpoints because we never agreed on the API contract. "
    "I don't know what fields the frontend needs."
)


def _mc():
    res = client.get(f"/api/team/projects/{DEMO_PROJECT_ID}/mission-control")
    assert res.status_code == 200
    return res.json()


def _mission(view, mission_id):
    return next(m for m in view["missions"] if m["id"] == mission_id)


def _checkin_and_answer(mission_id="m_backend", answer=DEMO_ANSWER):
    chk = client.post(f"/api/team/missions/{mission_id}/checkins", json={})
    assert chk.status_code == 200
    ans = client.post(f"/api/team/checkins/{chk.json()['id']}/answer", json={"answer": answer})
    assert ans.status_code == 200
    return ans.json()


def _analyze():
    res = client.post(f"/api/team/projects/{DEMO_PROJECT_ID}/analyze")
    assert res.status_code == 200, res.text
    return res.json()


def _approve(intervention_id):
    res = client.post(f"/api/team/interventions/{intervention_id}/approve")
    assert res.status_code == 200, res.text
    return res.json()


def _simulate(outcome, mission_id="m_backend"):
    res = client.post(f"/api/team/missions/{mission_id}/simulate-update", json={"outcome": outcome})
    assert res.status_code == 200, res.text
    return res.json()


# ---------------------------------------------------------------------------
# Detect
# ---------------------------------------------------------------------------

def test_seeded_scenario_detects_high_risk_and_root_bottleneck():
    view = _mc()
    assert view["risk_level"] == "HIGH"
    assert view["emergency_mode"] is True
    assert 35 <= view["hours_to_deadline"] <= 36
    assert view["root_bottleneck_id"] == "m_backend"
    assert view["loop_stage"] == "detect"

    backend = _mission(view, "m_backend")
    assert backend["is_root_bottleneck"] is True
    assert {s["code"] for s in backend["signals"]} >= {"blocked", "stale"}
    assert backend["downstream"] == ["m_frontend", "m_testing", "m_deploy"]

    frontend = _mission(view, "m_frontend")
    assert frontend["risk_level"] == "HIGH"
    assert "upstream_blocked" in {s["code"] for s in frontend["signals"]}
    assert _mission(view, "m_design")["signals"] == []


def test_risk_engine_overdue_and_deadline_signals():
    now = utcnow()
    missions = [
        MissionState("a", "Overdue", "c1", "A", "in_progress", 50, 4, now - timedelta(hours=2), now),
        MissionState("b", "Tight", "c2", "B", "in_progress", 0, 10, now + timedelta(hours=3), now),
    ]
    risk = assess(missions, now + timedelta(hours=100), now)
    assert "overdue" in {s.code for s in risk.missions["a"].signals}
    assert "deadline_at_risk" in {s.code for s in risk.missions["b"].signals}
    assert risk.emergency_mode is False  # deadline is more than 48h away


# ---------------------------------------------------------------------------
# Diagnose
# ---------------------------------------------------------------------------

def _backend_state():
    now = utcnow()
    mission = MissionState("m", "Backend API", "c", "Orion", "blocked", 35, 14, now + timedelta(hours=12), now - timedelta(hours=20))
    return mission, assess([mission], now + timedelta(hours=36), now).missions["m"]


def test_rules_diagnose_contract_from_checkin():
    mission, risk = _backend_state()
    result = diagnose_with_rules(mission, risk, ["Frontend Integration"], DEMO_ANSWER)
    assert result.cause == "unclear_contract"
    assert result.confidence == "high"
    assert result.source == "rules"
    assert any("Private check-in answer" in e for e in result.evidence)
    assert any("Frontend Integration" in e for e in result.evidence)


def test_rules_diagnose_without_checkin_uses_signals():
    mission, risk = _backend_state()
    result = diagnose_with_rules(mission, risk, [], None)
    assert result.cause == "unresponsive"
    assert "check-in" in result.explanation


@pytest.mark.asyncio
async def test_llm_diagnosis_used_when_configured():
    mission, risk = _backend_state()
    llm = AsyncMock()
    llm.is_configured = True
    llm.generate_structured.return_value = LLMTeamDiagnosis(
        cause="technical_blocker", confidence="medium", explanation="Likely a setup problem."
    )
    result = await diagnose(mission, risk, [], "my local db won't start", [], llm)
    assert result.source == "llm"
    assert result.cause == "technical_blocker"


@pytest.mark.asyncio
async def test_llm_failure_falls_back_to_rules():
    mission, risk = _backend_state()
    llm = AsyncMock()
    llm.is_configured = True
    llm.generate_structured.side_effect = LLMExecutionError("boom")
    result = await diagnose(mission, risk, [], DEMO_ANSWER, [], llm)
    assert result.source == "rules"
    assert result.cause == "unclear_contract"


# ---------------------------------------------------------------------------
# Intervene -> Verify -> Adapt
# ---------------------------------------------------------------------------

def test_full_loop_failed_then_adapt_then_resolved():
    _checkin_and_answer()
    view = _analyze()
    first = view["active_intervention"]
    assert view["loop_stage"] == "intervene"
    assert first["cause"] == "unclear_contract"
    assert first["action_code"] == "minimal_contract_with_mocks"
    assert first["status"] == "proposed"

    view = _approve(first["id"])
    assert view["loop_stage"] == "verify"

    # Next update: still blocked -> verification fails -> a different action is proposed
    view = _simulate("still_blocked")
    statuses = {i["id"]: i["status"] for i in view["interventions"]}
    assert statuses[first["id"]] == "failed"
    second = view["active_intervention"]
    assert second["action_code"] == "pairing_session"
    assert second["attempt_no"] == 2
    assert second["previous_intervention_id"] == first["id"]
    assert view["loop_stage"] == "adapt"

    view = _approve(second["id"])
    view = _simulate("resolved")
    resolved = next(i for i in view["interventions"] if i["id"] == second["id"])
    assert resolved["status"] == "resolved"
    assert "no longer blocked" in resolved["verification_note"]
    assert view["active_intervention"] is None
    assert view["loop_stage"] == "recovered"
    assert view["emergency_mode"] is False
    assert _mission(view, "m_backend")["status"] == "in_progress"
    assert "upstream_blocked" not in {s["code"] for s in _mission(view, "m_frontend")["signals"]}

    simulated = [u for u in view["updates"] if u["simulated"]]
    assert len(simulated) == 2
    assert all(e["simulated"] for e in view["timeline"] if e["kind"] == "verify")


def test_actions_never_repeat_and_escalate_when_exhausted():
    _checkin_and_answer()
    seen = []
    view = _analyze()
    for _ in range(3):
        active = view["active_intervention"]
        assert active["action_code"] not in seen
        seen.append(active["action_code"])
        _approve(active["id"])
        view = _simulate("still_blocked")
    assert seen == ["minimal_contract_with_mocks", "pairing_session", "reduce_scope"]
    assert view["active_intervention"]["status"] == "escalated"
    assert view["active_intervention"]["action_code"] == "captain_decision"


def test_reject_proposes_next_action():
    _checkin_and_answer()
    first = _analyze()["active_intervention"]
    res = client.post(f"/api/team/interventions/{first['id']}/reject")
    assert res.status_code == 200
    view = res.json()
    assert next(i for i in view["interventions"] if i["id"] == first["id"])["status"] == "rejected"
    assert view["active_intervention"]["action_code"] == "pairing_session"


def test_analyze_conflicts_while_action_active_and_bad_transitions():
    first = _analyze()["active_intervention"]
    assert client.post(f"/api/team/projects/{DEMO_PROJECT_ID}/analyze").status_code == 409
    _approve(first["id"])
    res = client.post(f"/api/team/interventions/{first['id']}/approve")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "INVALID_STATE"


def test_real_update_without_progress_fails_verification():
    _checkin_and_answer()
    first = _analyze()["active_intervention"]
    _approve(first["id"])
    res = client.post(
        "/api/team/missions/m_backend/updates",
        json={"text": "Unblocked but only small progress.", "progress": 38, "status": "in_progress"},
    )
    view = res.json()
    assert next(i for i in view["interventions"] if i["id"] == first["id"])["status"] == "failed"
    assert not view["updates"][0]["simulated"]


def test_reset_restores_scenario_and_unknown_ids_404():
    _analyze()
    view = client.post("/api/team/demo/reset").json()
    assert view["interventions"] == []
    assert view["root_bottleneck_id"] == "m_backend"
    assert client.get("/api/team/projects/nope/mission-control").status_code == 404
    assert client.post("/api/team/interventions/nope/approve").status_code == 404
    assert client.post("/api/team/missions/nope/checkins", json={}).status_code == 404


def test_llm_disabled_flag_and_project_list():
    with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
        assert _mc()["llm_enabled"] is False
    projects = client.get("/api/team/projects").json()["projects"]
    assert [p["id"] for p in projects] == [DEMO_PROJECT_ID]


def test_room_activity_records_who_acted():
    seeded = _mc()["timeline"]
    assert {e["actor"] for e in seeded} == {"system", "crew:Orion", "crew:Vega", "crew:Lyra", "crew:Nova"}

    _checkin_and_answer()
    first = _analyze()["active_intervention"]
    _approve(first["id"])
    view = _simulate("still_blocked")
    by_kind = {}
    for e in view["timeline"]:
        by_kind.setdefault(e["kind"], set()).add(e["actor"])
    assert by_kind["approve"] == {"captain"}
    assert by_kind["diagnose"] == {"agent"}
    assert by_kind["checkin"] == {"captain", "crew:Orion"}
    latest_update = next(e for e in view["timeline"] if e["kind"] == "update")
    assert latest_update["actor"] == "crew:Orion" and latest_update["simulated"] is True
    assert latest_update["meta"] == "Backend API: blocked, 35%"


def test_existing_database_gains_new_event_columns(tmp_path, monkeypatch):
    import sqlite3

    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL,
           message TEXT NOT NULL, mission_id TEXT, intervention_id TEXT,
           simulated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"""
    )
    conn.commit()
    conn.close()
    monkeypatch.setenv("TEAMPULSE_DB_PATH", str(path))
    view = _mc()
    assert view["timeline"] and all("actor" in e for e in view["timeline"])

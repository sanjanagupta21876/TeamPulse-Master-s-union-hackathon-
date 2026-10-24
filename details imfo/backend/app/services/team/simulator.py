from app.schemas.team import MissionControlView
from app.services.team.db import get_conn
from app.services.team.recovery_service import _get_mission_row, record_update

RESOLVED_GAIN = 35


def simulate_update(mission_id: str, outcome: str) -> MissionControlView:
    """
    Demo helper: posts the mission owner's *next* update with a chosen outcome so the
    Verify / Adapt steps can be shown live. Every update created here is flagged as simulated.
    """
    with get_conn() as conn:
        mission = _get_mission_row(conn, mission_id)
        progress = mission["progress"]

    if outcome == "resolved":
        new_progress = min(100, progress + RESOLVED_GAIN)
        return record_update(
            mission_id,
            text="Blocker cleared after the agreed action. Moving again and sharing progress with the team.",
            progress=new_progress,
            status="done" if new_progress >= 100 else "in_progress",
            simulated=True,
        )

    return record_update(
        mission_id,
        text="Tried the suggested step, but still stuck on the same problem.",
        progress=progress,
        status="blocked",
        simulated=True,
    )

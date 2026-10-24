import sqlite3
from datetime import datetime, timedelta
from typing import Optional

from app.services.team.db import get_conn, new_id, to_iso, utcnow

DEMO_PROJECT_ID = "proj_campus_events"


def _insert_event(
    conn: sqlite3.Connection,
    project_id: str,
    kind: str,
    message: str,
    at: datetime,
    actor: str = "system",
    meta: Optional[str] = None,
    mission_id: Optional[str] = None,
) -> None:
    conn.execute(
        """INSERT INTO events (id, project_id, kind, actor, message, meta, mission_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (new_id("evt"), project_id, kind, actor, message, meta, mission_id, to_iso(at)),
    )


def seed_demo_project(conn: sqlite3.Connection, now: Optional[datetime] = None) -> str:
    """
    Seeds the pitch scenario: 36 hours before the deadline, the Backend API mission has been
    blocked and silent for 20 hours while Frontend and Testing wait behind it.
    All timestamps are relative to `now` so the demo always looks current.
    """
    now = now or utcnow()
    pid = DEMO_PROJECT_ID
    conn.execute("DELETE FROM projects WHERE id = ?", (pid,))

    conn.execute(
        "INSERT INTO projects (id, name, description, deadline_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            pid,
            "Campus Events App",
            "Semester project: event discovery app with a FastAPI backend and React frontend.",
            to_iso(now + timedelta(hours=36)),
            to_iso(now - timedelta(days=12)),
        ),
    )

    crew = [
        ("crew_orion", "Orion", "Backend"),
        ("crew_vega", "Vega", "Frontend"),
        ("crew_lyra", "Lyra", "Testing"),
        ("crew_nova", "Nova", "Design & Deploy"),
    ]
    conn.executemany(
        "INSERT INTO crew (id, project_id, call_sign, role) VALUES (?, ?, ?, ?)",
        [(cid, pid, sign, role) for cid, sign, role in crew],
    )

    # (id, title, owner, status, progress, estimate_hours, due offset h, last update offset h)
    missions = [
        ("m_design", "UI Design & Wireframes", "crew_nova", "done", 100, 6, -24, -30),
        ("m_backend", "Backend API", "crew_orion", "blocked", 35, 14, 12, -20),
        ("m_frontend", "Frontend Integration", "crew_vega", "in_progress", 20, 10, 24, -3),
        ("m_testing", "End-to-End Testing", "crew_lyra", "todo", 0, 6, 32, -8),
        ("m_deploy", "Deploy & Demo Prep", "crew_nova", "todo", 0, 3, 35, -6),
    ]
    for position, (mid, title, owner, status, progress, est, due_h, upd_h) in enumerate(missions):
        conn.execute(
            """INSERT INTO missions (id, project_id, title, owner_id, status, progress, estimate_hours,
                                     due_at, last_update_at, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                mid, pid, title, owner, status, progress, est,
                to_iso(now + timedelta(hours=due_h)), to_iso(now + timedelta(hours=upd_h)), position,
            ),
        )

    conn.executemany(
        "INSERT INTO mission_dependencies (mission_id, depends_on_id) VALUES (?, ?)",
        [
            ("m_backend", "m_design"),
            ("m_frontend", "m_backend"),
            ("m_testing", "m_frontend"),
            ("m_deploy", "m_testing"),
        ],
    )

    updates = [
        ("m_design", "crew_nova", "Wireframes and component specs are final.", 100, "done", -30),
        ("m_backend", "crew_orion", "Started on the event endpoints.", 35, "blocked", -20),
        ("m_testing", "crew_lyra", "Test plan drafted; waiting for a frontend build to run it against.", 0, "todo", -8),
        ("m_frontend", "crew_vega", "Screens built with placeholder data. Need the real API to wire them up.", 20, "in_progress", -3),
    ]
    titles = {m[0]: m[1] for m in missions}
    call_signs = {cid: sign for cid, sign, _ in crew}
    for mid, cid, text, progress, status, at_h in sorted(updates, key=lambda u: u[5]):
        at = now + timedelta(hours=at_h)
        conn.execute(
            """INSERT INTO updates (id, mission_id, crew_id, text, progress, status, simulated, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?)""",
            (new_id("upd"), mid, cid, text, progress, status, to_iso(at)),
        )
        _insert_event(
            conn, pid, "update", text, at,
            actor=f"crew:{call_signs[cid]}",
            meta=f"{titles[mid]}: {status.replace('_', ' ')}, {progress}%",
            mission_id=mid,
        )

    _insert_event(conn, pid, "reset", "Demo loaded: 36 hours to the deadline.", now)
    return pid


def ensure_seeded() -> None:
    """Opening a connection creates the schema and seeds the demo project when the database is empty."""
    with get_conn():
        pass


def reset_demo() -> str:
    with get_conn() as conn:
        return seed_demo_project(conn)

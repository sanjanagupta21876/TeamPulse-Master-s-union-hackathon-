import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "teampulse.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    deadline_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crew (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    call_sign TEXT NOT NULL,
    role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    owner_id TEXT REFERENCES crew(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    estimate_hours REAL NOT NULL DEFAULT 4,
    due_at TEXT NOT NULL,
    last_update_at TEXT,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mission_dependencies (
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    depends_on_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    PRIMARY KEY (mission_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS updates (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    crew_id TEXT,
    text TEXT NOT NULL,
    progress INTEGER NOT NULL,
    status TEXT NOT NULL,
    simulated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    crew_id TEXT,
    question TEXT NOT NULL,
    answer TEXT,
    created_at TEXT NOT NULL,
    answered_at TEXT
);

CREATE TABLE IF NOT EXISTS interventions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    cause TEXT NOT NULL,
    cause_label TEXT NOT NULL,
    confidence TEXT NOT NULL,
    diagnosis_source TEXT NOT NULL,
    explanation TEXT NOT NULL,
    evidence TEXT NOT NULL,
    action_code TEXT NOT NULL,
    action_title TEXT NOT NULL,
    action_summary TEXT NOT NULL,
    steps TEXT NOT NULL,
    message_draft TEXT NOT NULL,
    success_criteria TEXT NOT NULL,
    status TEXT NOT NULL,
    attempt_no INTEGER NOT NULL,
    previous_intervention_id TEXT,
    baseline_progress INTEGER,
    verification_note TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    verified_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'system',
    message TEXT NOT NULL,
    meta TEXT,
    mission_id TEXT,
    intervention_id TEXT,
    simulated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
"""

# Columns added after the first release; ALTER TABLE keeps existing demo databases working
MIGRATIONS = {
    "events": {"actor": "TEXT NOT NULL DEFAULT 'system'", "meta": "TEXT"},
}


def _migrate(conn: sqlite3.Connection) -> None:
    for table, columns in MIGRATIONS.items():
        existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        for column, definition in columns.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def db_path() -> str:
    """Resolved on every call so tests can point TEAMPULSE_DB_PATH at a temporary file."""
    return os.getenv("TEAMPULSE_DB_PATH") or str(DEFAULT_DB_PATH)


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        if conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0] == 0:
            # Imported here because seed.py depends on this module
            from app.services.team.seed import seed_demo_project

            seed_demo_project(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def from_iso(value: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(value) if value else None


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

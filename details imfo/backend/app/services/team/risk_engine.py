from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

STALE_AFTER_HOURS = 12
EMERGENCY_WINDOW_HOURS = 48
# Assume a student can put roughly half of the remaining wall-clock time into project work
AVAILABLE_TIME_RATIO = 0.5

RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

SIGNAL_WEIGHTS = {
    "blocked": 3,
    "overdue": 3,
    "deadline_at_risk": 2,
    "stale": 2,
    "upstream_blocked": 2,
    "waiting_on_dependency": 1,
    "workload_exceeds_time": 1,
}


@dataclass
class MissionState:
    id: str
    title: str
    owner_id: Optional[str]
    owner_call_sign: Optional[str]
    status: str
    progress: int
    estimate_hours: float
    due_at: datetime
    last_update_at: Optional[datetime]
    depends_on: List[str] = field(default_factory=list)

    @property
    def is_done(self) -> bool:
        return self.status == "done"

    @property
    def remaining_hours(self) -> float:
        return round(self.estimate_hours * (1 - self.progress / 100), 1)


@dataclass
class Signal:
    code: str
    message: str


@dataclass
class MissionRisk:
    mission_id: str
    level: str
    score: int
    signals: List[Signal]


@dataclass
class ProjectRisk:
    level: str
    emergency_mode: bool
    hours_to_deadline: float
    missions: Dict[str, MissionRisk]


def _level_for_score(score: int) -> str:
    if score >= 6:
        return "CRITICAL"
    if score >= 3:
        return "HIGH"
    if score >= 2:
        return "MEDIUM"
    return "LOW"


def _hours_between(later: datetime, earlier: datetime) -> float:
    return (later - earlier).total_seconds() / 3600


def _has_blocked_ancestor(mission_id: str, by_id: Dict[str, MissionState], seen: Optional[set] = None) -> bool:
    seen = seen if seen is not None else set()
    for dep_id in by_id[mission_id].depends_on:
        if dep_id in seen or dep_id not in by_id:
            continue
        seen.add(dep_id)
        dep = by_id[dep_id]
        if dep.status == "blocked" or _has_blocked_ancestor(dep_id, by_id, seen):
            return True
    return False


def assess(missions: List[MissionState], deadline_at: datetime, now: datetime) -> ProjectRisk:
    """
    Detect step: deterministic risk signals per mission. Signals describe the work
    (deadlines, dependencies, missing updates), never rank or score people.
    """
    by_id = {m.id: m for m in missions}
    hours_to_deadline = _hours_between(deadline_at, now)
    available_hours = max(hours_to_deadline, 0) * AVAILABLE_TIME_RATIO

    remaining_by_owner: Dict[str, float] = {}
    for m in missions:
        if not m.is_done and m.owner_id:
            remaining_by_owner[m.owner_id] = remaining_by_owner.get(m.owner_id, 0) + m.remaining_hours

    results: Dict[str, MissionRisk] = {}
    for m in missions:
        if m.is_done:
            results[m.id] = MissionRisk(m.id, "LOW", 0, [])
            continue

        signals: List[Signal] = []
        hours_to_due = _hours_between(m.due_at, now)

        if m.status == "blocked":
            signals.append(Signal("blocked", "Marked as blocked in the latest update."))
        if hours_to_due < 0:
            signals.append(Signal("overdue", f"Overdue by {abs(hours_to_due):.0f}h."))
        elif m.remaining_hours > hours_to_due:
            signals.append(
                Signal(
                    "deadline_at_risk",
                    f"About {m.remaining_hours:.0f}h of work left but only {hours_to_due:.0f}h until it is due.",
                )
            )

        if m.last_update_at is None:
            signals.append(Signal("stale", "No updates posted yet."))
        else:
            silent_hours = _hours_between(now, m.last_update_at)
            if silent_hours > STALE_AFTER_HOURS:
                signals.append(Signal("stale", f"No update for {silent_hours:.0f}h."))

        open_deps = [by_id[d] for d in m.depends_on if d in by_id and not by_id[d].is_done]
        if _has_blocked_ancestor(m.id, by_id):
            signals.append(Signal("upstream_blocked", "An upstream mission it depends on is blocked."))
        if open_deps:
            names = ", ".join(d.title for d in open_deps)
            signals.append(Signal("waiting_on_dependency", f"Waiting on: {names}."))

        if m.owner_id and remaining_by_owner.get(m.owner_id, 0) > available_hours:
            signals.append(
                Signal(
                    "workload_exceeds_time",
                    "Remaining work assigned to this owner exceeds the realistic time left before the deadline.",
                )
            )

        score = sum(SIGNAL_WEIGHTS[s.code] for s in signals)
        results[m.id] = MissionRisk(m.id, _level_for_score(score), score, signals)

    open_levels = [r.level for r in results.values()]
    project_level = max(open_levels, key=RISK_LEVELS.index) if open_levels else "LOW"
    emergency = hours_to_deadline <= EMERGENCY_WINDOW_HOURS and RISK_LEVELS.index(project_level) >= RISK_LEVELS.index("HIGH")

    return ProjectRisk(
        level=project_level,
        emergency_mode=emergency,
        hours_to_deadline=round(hours_to_deadline, 1),
        missions=results,
    )

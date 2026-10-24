from collections import deque
from typing import Dict, List, Optional

from app.services.team.risk_engine import RISK_LEVELS, MissionState, ProjectRisk


def downstream_of(mission_id: str, missions: List[MissionState]) -> List[str]:
    """Unfinished missions that directly or transitively depend on `mission_id`, in walk order."""
    dependents: Dict[str, List[str]] = {m.id: [] for m in missions}
    for m in missions:
        for dep in m.depends_on:
            if dep in dependents:
                dependents[dep].append(m.id)

    by_id = {m.id: m for m in missions}
    seen = {mission_id}
    order: List[str] = []
    queue = deque(dependents.get(mission_id, []))
    while queue:
        current = queue.popleft()
        if current in seen:
            continue
        seen.add(current)
        if not by_id[current].is_done:
            order.append(current)
        queue.extend(dependents.get(current, []))
    return order


def find_root_bottleneck(missions: List[MissionState], risk: ProjectRisk) -> Optional[str]:
    """
    The at-risk mission whose own dependencies are finished (so the problem starts there)
    and which holds back the most unfinished work downstream.
    """
    by_id = {m.id: m for m in missions}
    high = RISK_LEVELS.index("HIGH")
    candidates = [
        m for m in missions
        if not m.is_done and RISK_LEVELS.index(risk.missions[m.id].level) >= high
    ]
    if not candidates:
        return None

    roots = [
        m for m in candidates
        if all(by_id[d].is_done for d in m.depends_on if d in by_id) or m.status == "blocked"
    ] or candidates

    roots.sort(
        key=lambda m: (len(downstream_of(m.id, missions)), risk.missions[m.id].score),
        reverse=True,
    )
    return roots[0].id

from typing import Dict, List, Optional
from app.schemas.fix import FixProposal


class FixStorage:
    """
    In-memory persistence store for AI-generated fix proposals.
    Provides fast lookup by fix ID and history tracking per finding ID.
    """

    def __init__(self):
        self._fixes: Dict[str, FixProposal] = {}

    def save_fix(self, proposal: FixProposal) -> FixProposal:
        self._fixes[proposal.id] = proposal
        return proposal

    def get_fix(self, fix_id: str) -> Optional[FixProposal]:
        return self._fixes.get(fix_id)

    def list_fixes_for_finding(self, finding_id: str) -> List[FixProposal]:
        return [
            f for f in self._fixes.values()
            if f.finding_id == finding_id
        ]

    def list_all_fixes(self) -> List[FixProposal]:
        return list(self._fixes.values())

    def clear(self):
        self._fixes.clear()


fix_storage = FixStorage()

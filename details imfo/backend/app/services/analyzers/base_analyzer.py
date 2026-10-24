from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Set
from app.schemas.bug_report import Finding


class BaseAnalyzer(ABC):
    """
    Abstract base class for all static code analyzers.
    Subclasses wrap real static-analysis tools (Ruff, Bandit, ESLint)
    or deterministic rule engines.
    """

    name: str = "base"
    supported_extensions: Set[str] = set()

    @abstractmethod
    def is_available(self) -> bool:
        """Determines whether the tool or execution environment is available."""
        pass

    @abstractmethod
    async def analyze(
        self,
        files: Dict[str, str],
        repo: str,
        branch: str,
        commit_sha: str,
        work_dir: Optional[str] = None,
    ) -> List[Finding]:
        """
        Executes static analysis over the provided files.
        Must return normalized Finding objects with exact source locations.
        """
        pass

from typing import Dict, List, Optional, Set
from app.schemas.bug_report import Finding
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.services.rules.security_rules import scan_security_rules


class SecurityAnalyzer(BaseAnalyzer):
    """
    Analyzes all candidate source and configuration files for exposed secrets,
    private cryptographic keys, API tokens, and webhook URLs with automatic redaction.
    """

    name: str = "security_scanner"
    # Runs across all text/source extensions
    supported_extensions: Set[str] = {"*"}

    def is_available(self) -> bool:
        return True

    async def analyze(
        self,
        files: Dict[str, str],
        repo: str,
        branch: str,
        commit_sha: str,
        work_dir: Optional[str] = None,
    ) -> List[Finding]:
        findings: List[Finding] = []
        for file_path, content in files.items():
            file_findings = scan_security_rules(
                file_path=file_path,
                content=content,
                repo=repo,
                branch=branch,
                commit_sha=commit_sha,
            )
            findings.extend(file_findings)
        return findings

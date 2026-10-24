import asyncio
import os
import tempfile
import uuid
from typing import Dict, List, Optional, Set, Tuple
import httpx

from app.services.diagnosis.storage import storage

from app.schemas.bug_report import (
    AnalysisMetadata,
    AnalysisSummary,
    Finding,
    RepositoryAnalysisResponse,
    RepositoryInfo,
)
from app.services.analyzers import (
    BanditAnalyzer,
    BaseAnalyzer,
    ESLintAnalyzer,
    JavaScriptRuleAnalyzer,
    PythonAstAnalyzer,
    RuffAnalyzer,
    SecurityAnalyzer,
)
from app.services.github_service import (
    GitHubService,
    GitHubServiceError,
    parse_and_validate_github_url,
    validate_branch_name,
)
from app.services.repository_scanner import RepositoryScanner
from app.utils.file_filters import (
    DEFAULT_MAX_CANDIDATE_FILES,
    DEFAULT_MAX_CONCURRENCY,
    DEFAULT_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_TOTAL_BYTES,
)


class AnalysisEngine:
    """
    Central orchestration engine for static code analysis.
    Retrieves source content for candidate files, runs safe language-specific analyzers,
    normalizes findings, deduplicates overlapping reports, and computes severity metrics.
    """

    def __init__(
        self,
        github_service: Optional[GitHubService] = None,
        scanner: Optional[RepositoryScanner] = None,
        max_candidate_files: int = DEFAULT_MAX_CANDIDATE_FILES,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
        max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES,
        max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
    ):
        self.github_service = github_service or GitHubService()
        self.scanner = scanner or RepositoryScanner(github_service=self.github_service)
        self.max_candidate_files = max_candidate_files
        self.max_file_size_bytes = max_file_size_bytes
        self.max_total_bytes = max_total_bytes
        self.max_concurrency = max_concurrency

        # Register modular analyzers
        self.analyzers: List[BaseAnalyzer] = [
            SecurityAnalyzer(),
            PythonAstAnalyzer(),
            RuffAnalyzer(),
            BanditAnalyzer(),
            JavaScriptRuleAnalyzer(),
            ESLintAnalyzer(),
        ]

    async def analyze_repository(
        self,
        repository_url: str,
        branch: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> RepositoryAnalysisResponse:
        """
        Executes real static code analysis on a public GitHub repository.
        1. Validates repository URL and branch.
        2. Resolves branch commit SHA and discovers files via RepositoryScanner.
        3. Retrieves eligible candidate source files under strict safety limits.
        4. Writes source files to an isolated temporary sandbox.
        5. Executes active analyzers against the codebase.
        6. Deduplicates findings and generates the final structured report.
        """
        # 1. URL & Branch validation
        owner, repo = parse_and_validate_github_url(repository_url)
        clean_branch = validate_branch_name(branch)

        # 2. Resolve commit SHA and metadata
        repo_data, target_branch, commit_sha = (
            await self.github_service.resolve_repository_and_commit(
                owner=owner,
                repo=repo,
                branch=clean_branch,
                client=client,
            )
        )
        resolved_owner = repo_data.get("owner", {}).get("login", owner)
        resolved_repo = repo_data.get("name", repo)
        full_name = f"{resolved_owner}/{resolved_repo}"

        # 3. Discover repository files using Git tree scanner
        scan_result = await self.scanner.scan_repository(
            repository_url=repository_url,
            branch=target_branch,
            client=client,
        )

        candidate_records = [f for f in scan_result.files if f.is_candidate]
        total_discovered = scan_result.total_files_discovered
        warnings: List[str] = list(scan_result.scan_warnings)

        # 4. Concurrently retrieve candidate source files
        files_dict: Dict[str, str] = {}
        files_skipped = 0
        total_retrieved_bytes = 0
        semaphore = asyncio.Semaphore(self.max_concurrency)

        async def fetch_single(path: str, expected_size: Optional[int]):
            nonlocal total_retrieved_bytes, files_skipped
            # Check content limits
            if expected_size and (total_retrieved_bytes + expected_size > self.max_total_bytes):
                files_skipped += 1
                return

            async with semaphore:
                try:
                    content = await self.github_service.fetch_file_content(
                        owner=resolved_owner,
                        repo=resolved_repo,
                        commit_sha=commit_sha,
                        path=path,
                        client=client,
                    )
                    content_bytes = len(content.encode("utf-8"))
                    if total_retrieved_bytes + content_bytes > self.max_total_bytes:
                        files_skipped += 1
                        return
                    total_retrieved_bytes += content_bytes
                    files_dict[path] = content
                except Exception as err:
                    files_skipped += 1
                    # Avoid duplicate warning spam
                    if len(warnings) < 15:
                        warnings.append(f"Skipped file '{path}': {str(err)}")

        fetch_tasks = [
            fetch_single(f.path, f.size) for f in candidate_records[: self.max_candidate_files]
        ]
        if fetch_tasks:
            await asyncio.gather(*fetch_tasks)

        if total_retrieved_bytes >= self.max_total_bytes:
            warnings.append(
                f"Source content limit reached ({self.max_total_bytes // (1024*1024)} MB). "
                "Additional files were skipped to preserve memory."
            )

        # 5. Populate temporary directory for external CLI tool analysis
        with tempfile.TemporaryDirectory() as temp_dir:
            for rel_path, content in files_dict.items():
                safe_full_path = os.path.join(temp_dir, rel_path.replace("/", os.sep))
                os.makedirs(os.path.dirname(safe_full_path), exist_ok=True)
                with open(safe_full_path, "w", encoding="utf-8", errors="replace") as f:
                    f.write(content)

            # 6. Execute analyzers
            all_raw_findings: List[Finding] = []
            analyzers_completed: List[str] = []
            analyzers_failed: List[str] = []

            # Determine relevant file extensions present in the repository
            discovered_extensions = {
                os.path.splitext(p)[1].lower() for p in files_dict.keys()
            }

            for analyzer in self.analyzers:
                # Check if analyzer supports any of the discovered file types
                has_matching_files = (
                    "*" in analyzer.supported_extensions
                    or bool(discovered_extensions.intersection(analyzer.supported_extensions))
                )
                if not has_matching_files:
                    continue

                if not analyzer.is_available():
                    analyzers_failed.append(analyzer.name)
                    warnings.append(
                        f"Analyzer '{analyzer.name}' is not installed or available in the environment. "
                        "Skipping tool-specific checks."
                    )
                    continue

                try:
                    tool_findings = await analyzer.analyze(
                        files=files_dict,
                        repo=full_name,
                        branch=target_branch,
                        commit_sha=commit_sha,
                        work_dir=temp_dir,
                    )
                    all_raw_findings.extend(tool_findings)
                    analyzers_completed.append(analyzer.name)
                except Exception as exc:
                    analyzers_failed.append(analyzer.name)
                    warnings.append(f"Analyzer '{analyzer.name}' encountered an error: {str(exc)}")

            # 7. Deduplicate findings
            deduplicated_findings = self._deduplicate_findings(all_raw_findings)

            # 8. Compute summary counts
            summary = AnalysisSummary(
                critical=sum(1 for f in deduplicated_findings if f.severity == "critical"),
                high=sum(1 for f in deduplicated_findings if f.severity == "high"),
                medium=sum(1 for f in deduplicated_findings if f.severity == "medium"),
                low=sum(1 for f in deduplicated_findings if f.severity == "low"),
                informational=sum(1 for f in deduplicated_findings if f.severity == "informational"),
            )

            # 9. Determine overall analysis status
            status = "completed"
            if analyzers_failed or files_skipped > 0 or scan_result.tree_truncated:
                status = "partial"
            if not files_dict and total_discovered > 0:
                status = "failed"

            if not deduplicated_findings and status == "completed":
                warnings.append(
                    "No findings were identified by the configured analyzers. "
                    "Note: Static analysis covers specific rules and does not guarantee the absence of bugs."
                )

            metadata = AnalysisMetadata(
                status=status,
                files_discovered=total_discovered,
                files_analyzed=len(files_dict),
                files_skipped=files_skipped,
                findings_count=len(deduplicated_findings),
                analyzers_completed=analyzers_completed,
                analyzers_failed=analyzers_failed,
                warnings=warnings,
            )

            repo_info = RepositoryInfo(
                full_name=full_name,
                branch=target_branch,
                commit_sha=commit_sha,
            )

            scan_id = f"scan_{uuid.uuid4().hex[:12]}"
            storage.save_scan(
                scan_id=scan_id,
                repository=full_name,
                branch=target_branch,
                commit_sha=commit_sha,
                findings=deduplicated_findings,
                files=files_dict,
            )

            return RepositoryAnalysisResponse(
                repository=repo_info,
                analysis=metadata,
                summary=summary,
                findings=deduplicated_findings,
                scan_id=scan_id,
            )

    def _deduplicate_findings(self, raw_findings: List[Finding]) -> List[Finding]:
        """
        Deduplicates overlapping findings reported by multiple tools for the same underlying problem.
        Preserves distinct findings occurring on the same line while merging equivalent tool rules.
        """
        equivalent_clusters = {
            "shell_injection": {"PY-SEC-001", "B602", "B603", "S602", "S603"},
            "eval_exec": {"PY-SEC-002", "B307", "S307"},
            "bare_except": {"PY-ERR-001", "E722", "B001"},
            "empty_pass": {"PY-ERR-002", "B012"},
            "sql_injection": {"PY-SEC-003", "B608", "S608"},
            "inner_html_xss": {"JS-SEC-001"},
            "secret_private_key": {"SEC-KEY-001"},
            "secret_aws_key": {"SEC-AWS-001"},
            "secret_gh_token": {"SEC-GH-001"},
        }

        def get_cluster(rule_id: str) -> str:
            for cluster_name, rules in equivalent_clusters.items():
                if rule_id in rules or any(r in rule_id for r in rules):
                    return cluster_name
            return rule_id

        unique_findings: Dict[Tuple[str, int, str], Finding] = {}
        severity_rank = {"critical": 5, "high": 4, "medium": 3, "low": 2, "informational": 1}

        for finding in raw_findings:
            cluster = get_cluster(finding.rule_id)
            key = (finding.file_path, finding.start_line, cluster)

            if key not in unique_findings:
                unique_findings[key] = finding
            else:
                existing = unique_findings[key]
                existing_score = severity_rank.get(existing.severity, 0)
                new_score = severity_rank.get(finding.severity, 0)
                if new_score > existing_score:
                    unique_findings[key] = finding

        return list(unique_findings.values())


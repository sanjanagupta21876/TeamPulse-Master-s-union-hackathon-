import os
from typing import Dict, List, Optional, Tuple
import httpx

from app.schemas.scan import DiscoveredFile, RepositoryScanResponse
from app.services.github_service import (
    GitHubService,
    GitHubServiceError,
    parse_and_validate_github_url,
    validate_branch_name,
)
from app.utils.file_filters import (
    classify_file,
    should_skip_file,
    DEFAULT_MAX_CANDIDATE_FILES,
    DEFAULT_MAX_CONCURRENCY,
    DEFAULT_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_TOTAL_BYTES,
)

# Maximum file items included in the response inventory to keep payloads compact and fast
DEFAULT_MAX_INVENTORY_RESPONSE = 500


class RepositoryScanner:
    """
    Service responsible for discovering, filtering, and preliminarily classifying
    files in a public GitHub repository using the Git Trees API at a resolved commit SHA.
    Enforces candidate file limits, file size limits, and security constraints.
    """

    def __init__(
        self,
        github_service: Optional[GitHubService] = None,
        max_candidate_files: int = DEFAULT_MAX_CANDIDATE_FILES,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
        max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES,
        max_concurrency: int = DEFAULT_MAX_CONCURRENCY,
        max_inventory_response: int = DEFAULT_MAX_INVENTORY_RESPONSE,
    ):
        self.github_service = github_service or GitHubService()
        self.max_candidate_files = max_candidate_files
        self.max_file_size_bytes = max_file_size_bytes
        self.max_total_bytes = max_total_bytes
        self.max_concurrency = max_concurrency
        self.max_inventory_response = max_inventory_response

    async def scan_repository(
        self,
        repository_url: str,
        branch: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> RepositoryScanResponse:
        """
        Executes file discovery and classification for a repository.
        1. Validates repository URL and branch name.
        2. Resolves repository metadata and verified commit SHA.
        3. Retrieves recursive Git Tree for that commit.
        4. Filters excluded directories, secrets, binary files, and large files.
        5. Performs preliminary classification (frontend, backend, test, database, configuration, documentation).
        6. Enforces configurable safeguards and returns compact scan report.
        """
        # 1. URL and branch validation (reusing established security validations)
        owner, repo = parse_and_validate_github_url(repository_url)
        clean_branch = validate_branch_name(branch)

        # 2. Resolve repository metadata, branch, and commit SHA
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

        # 3. Retrieve recursive Git Tree from GitHub API
        tree_entries, tree_truncated = await self.github_service.get_git_tree(
            owner=resolved_owner,
            repo=resolved_repo,
            commit_sha=commit_sha,
            client=client,
        )

        # 4. Process tree items and discover files
        total_files_discovered = 0
        candidate_files: List[DiscoveredFile] = []
        all_discovered_files: List[DiscoveredFile] = []
        extensions_set = set()
        classifications_count: Dict[str, int] = {
            "frontend": 0,
            "backend": 0,
            "test": 0,
            "database": 0,
            "configuration": 0,
            "documentation": 0,
            "other": 0,
        }
        warnings: List[str] = []

        if tree_truncated:
            warnings.append(
                "The repository Git tree was truncated by GitHub API (>100,000 files or >7 MB payload). "
                "Some files may not have been discovered."
            )

        candidate_limit_reached = False

        for entry in tree_entries:
            # Git tree items can be 'blob' (file), 'tree' (directory), or 'commit' (submodule)
            if entry.get("type") != "blob":
                continue

            total_files_discovered += 1
            path = entry.get("path", "")
            file_size = entry.get("size")

            # Evaluate skip criteria using centralized file filter logic
            should_skip, skip_reason = should_skip_file(
                path=path,
                file_size=file_size,
                max_file_size_bytes=self.max_file_size_bytes,
            )

            _, ext = os.path.splitext(path.lower())
            classification = classify_file(path)

            if not should_skip:
                if len(candidate_files) < self.max_candidate_files:
                    is_candidate = True
                    candidate_reason = None
                else:
                    is_candidate = False
                    candidate_reason = f"exceeds_candidate_limit:{self.max_candidate_files}"
                    if not candidate_limit_reached:
                        candidate_limit_reached = True
                        warnings.append(
                            f"Configurable candidate source file limit reached ({self.max_candidate_files} files). "
                            "Remaining files were not marked as candidates."
                        )
            else:
                is_candidate = False
                candidate_reason = skip_reason

            discovered_file = DiscoveredFile(
                path=path,
                extension=ext,
                classification=classification,
                size=file_size,
                is_candidate=is_candidate,
                skip_reason=candidate_reason,
            )

            if is_candidate:
                candidate_files.append(discovered_file)
                if ext:
                    extensions_set.add(ext)
                classifications_count[classification] = (
                    classifications_count.get(classification, 0) + 1
                )

            all_discovered_files.append(discovered_file)

        # 5. Compact file inventory for response
        # Prioritize candidate files in the returned inventory
        if len(candidate_files) > self.max_inventory_response:
            returned_files = candidate_files[: self.max_inventory_response]
            inventory_truncated = True
            warnings.append(
                f"Returned file inventory was capped at {self.max_inventory_response} candidate files "
                f"for compact response delivery. Total discovered: {total_files_discovered}, "
                f"total candidates: {len(candidate_files)}."
            )
        else:
            returned_files = candidate_files
            inventory_truncated = False

        # Extract discovered paths from returned files
        discovered_paths = [f.path for f in returned_files]
        sorted_extensions = sorted(list(extensions_set))

        # Filter classifications count to non-zero values for cleaner output
        active_classifications = {
            k: v for k, v in classifications_count.items() if v > 0
        }

        return RepositoryScanResponse(
            repository_name=resolved_repo,
            owner=resolved_owner,
            selected_branch=target_branch,
            commit_sha=commit_sha,
            discovered_file_paths=discovered_paths,
            file_extensions=sorted_extensions,
            preliminary_classifications=active_classifications,
            total_files_discovered=total_files_discovered,
            candidate_source_files=len(candidate_files),
            scan_warnings=warnings,
            tree_truncated=tree_truncated,
            files=returned_files,
            inventory_truncated=inventory_truncated,
        )

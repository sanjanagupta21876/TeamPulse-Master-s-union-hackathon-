import os
import re
import urllib.parse
from typing import Optional, Tuple, List
import httpx

from app.schemas.repository import RepositoryMetadata, InspectionSummary, RepositoryInspectionResponse


class GitHubServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


# Allowed GitHub username/org and repo regex
# Usernames: alphanumeric and hyphens, not starting or ending with hyphen
# Repos: alphanumeric, hyphens, underscores, dots
OWNER_REGEX = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,38})$")
REPO_REGEX = re.compile(r"^[a-zA-Z0-9_.-]{1,100}$")

# Disallowed owner names (GitHub reserved routes)
RESERVED_GITHUB_ROUTES = {
    "about", "features", "explore", "topics", "collections", "trending",
    "login", "join", "security", "customer-stories", "pricing", "team",
    "enterprise", "nonprofit", "readme", "settings", "notifications",
    "marketplace", "sponsors", "search", "pulls", "issues",
}


def parse_and_validate_github_url(raw_url: str) -> Tuple[str, str]:
    """
    Strictly validates and extracts (owner, repo) from a GitHub repository URL.
    Rejects malformed URLs, credentials, queries, fragments, and non-github domains.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise GitHubServiceError(
            code="INVALID_URL",
            message="Repository URL must be a non-empty string.",
            status_code=400,
        )

    clean_url = raw_url.strip()

    # Parse URL
    try:
        parsed = urllib.parse.urlsplit(clean_url)
    except Exception:
        raise GitHubServiceError(
            code="INVALID_URL",
            message="Malformed URL format.",
            status_code=400,
        )

    # 1. Reject credentials (username/password in URL)
    if parsed.username or parsed.password:
        raise GitHubServiceError(
            code="INVALID_URL",
            message="Repository URL must not contain embedded user credentials.",
            status_code=400,
        )

    # 2. Reject query strings and fragments
    if parsed.query:
        raise GitHubServiceError(
            code="INVALID_URL",
            message="Repository URL must not include query parameters.",
            status_code=400,
        )
    if parsed.fragment:
        raise GitHubServiceError(
            code="INVALID_URL",
            message="Repository URL must not include URL fragments.",
            status_code=400,
        )

    # 3. Validate scheme (only https, or http for local tests)
    if parsed.scheme not in ("https", "http"):
        raise GitHubServiceError(
            code="INVALID_URL",
            message="URL scheme must be HTTPS.",
            status_code=400,
        )

    # 4. Validate hostname (only github.com or www.github.com)
    hostname = (parsed.hostname or "").lower()
    if hostname not in ("github.com", "www.github.com"):
        raise GitHubServiceError(
            code="UNSUPPORTED_DOMAIN",
            message="Only public repositories on github.com are currently supported.",
            status_code=400,
        )

    # 5. Validate path: must be /{owner}/{repo}
    # Strip leading/trailing slashes
    path = parsed.path.strip("/")
    parts = [p for p in path.split("/") if p]

    if len(parts) != 2:
        raise GitHubServiceError(
            code="INVALID_URL_STRUCTURE",
            message="URL must follow the format 'https://github.com/owner/repository'.",
            status_code=400,
        )

    owner, repo = parts[0], parts[1]

    # Remove optional trailing .git extension
    if repo.endswith(".git"):
        repo = repo[:-4]

    # Check for empty components or dot segments
    if not owner or not repo or owner in (".", "..") or repo in (".", ".."):
        raise GitHubServiceError(
            code="INVALID_IDENTIFIERS",
            message="Owner or repository name cannot be empty or relative paths.",
            status_code=400,
        )

    # Reject reserved routes
    if owner.lower() in RESERVED_GITHUB_ROUTES:
        raise GitHubServiceError(
            code="INVALID_REPOSITORY_PATH",
            message=f"'{owner}' is a reserved GitHub system path, not a repository owner.",
            status_code=400,
        )

    # Validate characters against GitHub rules
    if not OWNER_REGEX.match(owner):
        raise GitHubServiceError(
            code="INVALID_OWNER_NAME",
            message=f"Owner name '{owner}' contains invalid characters.",
            status_code=400,
        )

    if not REPO_REGEX.match(repo):
        raise GitHubServiceError(
            code="INVALID_REPO_NAME",
            message=f"Repository name '{repo}' contains invalid characters.",
            status_code=400,
        )

    return owner, repo


def validate_branch_name(branch: Optional[str]) -> Optional[str]:
    """Validates that a provided branch name is safe and does not contain path traversals."""
    if not branch:
        return None
    cleaned = branch.strip()
    if not cleaned:
        return None

    if ".." in cleaned or "\x00" in cleaned or "\\" in cleaned:
        raise GitHubServiceError(
            code="INVALID_BRANCH_NAME",
            message="Branch name contains disallowed traversal characters.",
            status_code=400,
        )

    if len(cleaned) > 255:
        raise GitHubServiceError(
            code="INVALID_BRANCH_NAME",
            message="Branch name exceeds maximum length of 255 characters.",
            status_code=400,
        )

    return cleaned


class GitHubService:
    def __init__(self, token: Optional[str] = None, timeout_seconds: float = 12.0):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.timeout = timeout_seconds

    def _get_headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "CodeLensAI-Repository-Inspector/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def inspect_repository(
        self,
        repository_url: str,
        branch: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> RepositoryInspectionResponse:
        # 1. URL parsing & SSRF prevention
        owner, repo = parse_and_validate_github_url(repository_url)
        clean_branch = validate_branch_name(branch)

        headers = self._get_headers()

        # Execute requests with provided or temporary async client
        if client is not None:
            return await self._fetch_metadata(client, owner, repo, clean_branch, headers)

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as http_client:
            return await self._fetch_metadata(http_client, owner, repo, clean_branch, headers)

    async def resolve_repository_and_commit(
        self,
        owner: str,
        repo: str,
        branch: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[dict, str, str]:
        """
        Resolves repository metadata and extracts target branch and commit SHA.
        Returns (repo_data, selected_branch, commit_sha).
        """
        headers = self._get_headers()
        if client is not None:
            return await self._fetch_repo_and_commit(client, owner, repo, branch, headers)

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as http_client:
            return await self._fetch_repo_and_commit(http_client, owner, repo, branch, headers)

    async def _fetch_repo_and_commit(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        branch: Optional[str],
        headers: dict,
    ) -> Tuple[dict, str, str]:
        # 1. Retrieve repository metadata
        repo_api_url = f"https://api.github.com/repos/{owner}/{repo}"

        try:
            repo_res = await client.get(repo_api_url, headers=headers, follow_redirects=True)
        except httpx.TimeoutException:
            raise GitHubServiceError(
                code="NETWORK_TIMEOUT",
                message="Request to GitHub API timed out. Please check your network connection.",
                status_code=504,
            )
        except httpx.RequestError:
            raise GitHubServiceError(
                code="NETWORK_ERROR",
                message="Unable to establish connection to GitHub API.",
                status_code=502,
            )

        if repo_res.status_code == 404:
            raise GitHubServiceError(
                code="REPOSITORY_NOT_FOUND",
                message="The repository could not be found or accessed. Private repository support will be added in a later step.",
                status_code=404,
            )

        if repo_res.status_code in (403, 429):
            rate_limit_remaining = repo_res.headers.get("x-ratelimit-remaining")
            if rate_limit_remaining == "0" or repo_res.status_code == 429:
                raise GitHubServiceError(
                    code="RATE_LIMIT_EXCEEDED",
                    message="GitHub API rate limit exceeded. Please wait a moment before trying again.",
                    status_code=429,
                )
            raise GitHubServiceError(
                code="ACCESS_DENIED",
                message="Repository is inaccessible. Private repository support will be added in a later step.",
                status_code=403,
            )

        if repo_res.status_code >= 500:
            raise GitHubServiceError(
                code="GITHUB_UNAVAILABLE",
                message="GitHub service is temporarily unavailable. Please try again shortly.",
                status_code=502,
            )

        if repo_res.status_code != 200:
            raise GitHubServiceError(
                code="UNEXPECTED_GITHUB_RESPONSE",
                message=f"Received unexpected status {repo_res.status_code} from GitHub API.",
                status_code=502,
            )

        repo_data = repo_res.json()

        if repo_data.get("private", False):
            raise GitHubServiceError(
                code="REPOSITORY_PRIVATE",
                message="This repository is private. Private repository support will be added in a later step.",
                status_code=403,
            )

        default_branch = repo_data.get("default_branch") or "main"
        target_branch = branch if branch else default_branch

        # 2. Retrieve commit SHA for target branch
        resolved_owner = repo_data.get("owner", {}).get("login", owner)
        resolved_name = repo_data.get("name", repo)
        encoded_branch = urllib.parse.quote(target_branch, safe="")
        branch_api_url = f"https://api.github.com/repos/{resolved_owner}/{resolved_name}/branches/{encoded_branch}"

        try:
            branch_res = await client.get(branch_api_url, headers=headers, follow_redirects=True)
        except httpx.TimeoutException:
            raise GitHubServiceError(
                code="NETWORK_TIMEOUT",
                message=f"Request to verify branch '{target_branch}' timed out.",
                status_code=504,
            )
        except httpx.RequestError:
            raise GitHubServiceError(
                code="NETWORK_ERROR",
                message="Unable to communicate with GitHub API to verify branch.",
                status_code=502,
            )

        if branch_res.status_code == 404:
            raise GitHubServiceError(
                code="BRANCH_NOT_FOUND",
                message=f"Branch '{target_branch}' was not found in repository '{owner}/{repo}'.",
                status_code=404,
            )

        if branch_res.status_code in (403, 429):
            raise GitHubServiceError(
                code="RATE_LIMIT_EXCEEDED",
                message="GitHub API rate limit exceeded during branch verification.",
                status_code=429,
            )

        if branch_res.status_code != 200:
            raise GitHubServiceError(
                code="UNEXPECTED_GITHUB_RESPONSE",
                message=f"Could not retrieve commit information for branch '{target_branch}'.",
                status_code=502,
            )

        branch_data = branch_res.json()
        commit_sha = branch_data.get("commit", {}).get("sha", "")

        if not commit_sha:
            raise GitHubServiceError(
                code="COMMIT_SHA_UNAVAILABLE",
                message="Latest commit SHA was not returned by GitHub for this branch.",
                status_code=502,
            )

        return repo_data, target_branch, commit_sha

    async def get_git_tree(
        self,
        owner: str,
        repo: str,
        commit_sha: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[List[dict], bool]:
        """
        Retrieves the recursive Git tree for a specific commit SHA.
        Returns (tree_items, truncated).
        """
        headers = self._get_headers()
        if client is not None:
            return await self._fetch_git_tree(client, owner, repo, commit_sha, headers)

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as http_client:
            return await self._fetch_git_tree(http_client, owner, repo, commit_sha, headers)

    async def _fetch_git_tree(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        commit_sha: str,
        headers: dict,
    ) -> Tuple[List[dict], bool]:
        encoded_sha = urllib.parse.quote(commit_sha, safe="")
        tree_api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{encoded_sha}?recursive=1"

        try:
            res = await client.get(tree_api_url, headers=headers, follow_redirects=True)
        except httpx.TimeoutException:
            raise GitHubServiceError(
                code="NETWORK_TIMEOUT",
                message="Request to GitHub Git Trees API timed out.",
                status_code=504,
            )
        except httpx.RequestError:
            raise GitHubServiceError(
                code="NETWORK_ERROR",
                message="Unable to communicate with GitHub API to discover files.",
                status_code=502,
            )

        if res.status_code == 404:
            raise GitHubServiceError(
                code="REPOSITORY_NOT_FOUND",
                message=f"Git tree for commit '{commit_sha}' was not found in repository '{owner}/{repo}'.",
                status_code=404,
            )

        if res.status_code in (403, 429):
            raise GitHubServiceError(
                code="RATE_LIMIT_EXCEEDED",
                message="GitHub API rate limit exceeded during repository file discovery.",
                status_code=429,
            )

        if res.status_code == 409:
            # Empty repository without commits
            return [], False

        if res.status_code >= 500:
            raise GitHubServiceError(
                code="GITHUB_UNAVAILABLE",
                message="GitHub service is temporarily unavailable.",
                status_code=502,
            )

        if res.status_code != 200:
            raise GitHubServiceError(
                code="UNEXPECTED_GITHUB_RESPONSE",
                message=f"Could not retrieve Git tree from GitHub API (status {res.status_code}).",
                status_code=502,
            )

        tree_data = res.json()
        tree_items = tree_data.get("tree", [])
        truncated = bool(tree_data.get("truncated", False))

        return tree_items, truncated

    async def _fetch_metadata(
        self,
        client: httpx.AsyncClient,
        owner: str,
        repo: str,
        branch: Optional[str],
        headers: dict,
    ) -> RepositoryInspectionResponse:
        repo_data, target_branch, commit_sha = await self._fetch_repo_and_commit(
            client, owner, repo, branch, headers
        )

        metadata = RepositoryMetadata(
            owner=repo_data.get("owner", {}).get("login", owner),
            name=repo_data.get("name", repo),
            full_name=repo_data.get("full_name", f"{owner}/{repo}"),
            description=repo_data.get("description"),
            html_url=repo_data.get("html_url", f"https://github.com/{owner}/{repo}"),
            default_branch=repo_data.get("default_branch") or "main",
            selected_branch=target_branch,
            stars=repo_data.get("stargazers_count", 0),
            language=repo_data.get("language"),
            visibility=repo_data.get("visibility", "public"),
            latest_commit_sha=commit_sha,
        )

        inspection = InspectionSummary(
            status="completed",
            source="github_api",
            files_analyzed=0,
            bugs_detected=0,
            message="Repository metadata retrieved successfully. Source-code bug analysis has not been implemented yet.",
        )

        return RepositoryInspectionResponse(repository=metadata, inspection=inspection)

    async def fetch_file_content(
        self,
        owner: str,
        repo: str,
        commit_sha: str,
        path: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> str:
        """
        Retrieves the raw text content of a repository file at a specific commit SHA.
        Applies safe timeouts and handles missing or binary files.
        """
        headers = self._get_headers()
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/{commit_sha}/{path}"

        if client is not None:
            return await self._get_raw_content(client, url, headers, path)

        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as http_client:
            return await self._get_raw_content(http_client, url, headers, path)

    async def _get_raw_content(
        self,
        client: httpx.AsyncClient,
        url: str,
        headers: dict,
        path: str,
    ) -> str:
        try:
            res = await client.get(url, headers=headers, follow_redirects=True)
        except httpx.TimeoutException:
            raise GitHubServiceError(
                code="NETWORK_TIMEOUT",
                message=f"Request to fetch file '{path}' timed out.",
                status_code=504,
            )
        except httpx.RequestError:
            raise GitHubServiceError(
                code="NETWORK_ERROR",
                message=f"Unable to communicate with GitHub to fetch file '{path}'.",
                status_code=502,
            )

        if res.status_code == 404:
            raise GitHubServiceError(
                code="FILE_NOT_FOUND",
                message=f"File '{path}' was not found at specified commit.",
                status_code=404,
            )

        if res.status_code in (403, 429):
            raise GitHubServiceError(
                code="RATE_LIMIT_EXCEEDED",
                message="GitHub rate limit exceeded while retrieving source file.",
                status_code=429,
            )

        if res.status_code != 200:
            raise GitHubServiceError(
                code="UNEXPECTED_GITHUB_RESPONSE",
                message=f"Failed to retrieve file '{path}' (status {res.status_code}).",
                status_code=502,
            )

        return res.text



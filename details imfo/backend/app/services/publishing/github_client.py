import base64
import os
import urllib.parse
from typing import Dict, List, Optional, Tuple
import httpx

from app.schemas.publishing import GitHubAuthStatus


class GitHubClientError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class GitHubAuthError(GitHubClientError):
    def __init__(self, message: str = "GitHub authentication credentials missing or invalid."):
        super().__init__(code="GITHUB_AUTH_FAILED", message=message, status_code=401)


class BranchConflictError(GitHubClientError):
    def __init__(self, message: str):
        super().__init__(code="BRANCH_ALREADY_EXISTS", message=message, status_code=409)


class BranchDivergedError(GitHubClientError):
    def __init__(self, message: str):
        super().__init__(code="BRANCH_DIVERGED", message=message, status_code=409)


class GitHubPublisherClient:
    """
    Dedicated client for interacting with GitHub REST APIs for branch creation,
    file commits, and pull request generation.
    Enforces minimum privileges and never exposes tokens in output or logs.
    """

    def __init__(self, token: Optional[str] = None, timeout_seconds: float = 15.0):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.timeout = timeout_seconds

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "CodeLensAI-Publisher/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_auth_status(self, client: Optional[httpx.AsyncClient] = None) -> GitHubAuthStatus:
        """
        Validates GitHub credentials, retrieves granted OAuth scopes, and checks rate limits.
        """
        if not self.token:
            return GitHubAuthStatus(
                connected=False,
                user=None,
                scopes=[],
                auth_type="unauthenticated",
                can_publish=False,
                rate_limit_remaining=None,
                error_message="GITHUB_TOKEN environment variable is not configured.",
            )

        headers = self._get_headers()
        url = "https://api.github.com/user"

        try:
            http_client = client or httpx.AsyncClient(timeout=self.timeout)
            try:
                response = await http_client.get(url, headers=headers)
                rate_remaining = response.headers.get("x-ratelimit-remaining")
                remaining_int = int(rate_remaining) if rate_remaining and rate_remaining.isdigit() else None
                scopes_raw = response.headers.get("x-oauth-scopes", "")
                scopes = [s.strip() for s in scopes_raw.split(",") if s.strip()]

                if response.status_code == 200:
                    user_data = response.json()
                    login = user_data.get("login")
                    # Token has write capability if scope includes repo, public_repo, or repo:status
                    has_repo_scope = any(s in ("repo", "public_repo", "write:packages") for s in scopes) or len(scopes) == 0
                    return GitHubAuthStatus(
                        connected=True,
                        user=login,
                        scopes=scopes,
                        auth_type="token",
                        can_publish=True if (has_repo_scope or not scopes) else False,
                        rate_limit_remaining=remaining_int,
                    )
                elif response.status_code in (401, 403):
                    return GitHubAuthStatus(
                        connected=False,
                        user=None,
                        scopes=[],
                        auth_type="token",
                        can_publish=False,
                        rate_limit_remaining=remaining_int,
                        error_message="GitHub token is invalid, expired, or lacking repository access.",
                    )
                else:
                    return GitHubAuthStatus(
                        connected=False,
                        user=None,
                        scopes=[],
                        auth_type="token",
                        can_publish=False,
                        rate_limit_remaining=remaining_int,
                        error_message=f"GitHub API returned status {response.status_code}.",
                    )
            finally:
                if client is None:
                    await http_client.aclose()
        except Exception as err:
            return GitHubAuthStatus(
                connected=False,
                user=None,
                scopes=[],
                auth_type="token",
                can_publish=False,
                rate_limit_remaining=None,
                error_message=f"Network error connecting to GitHub: {str(err)}",
            )

    async def get_branch_head(
        self,
        owner: str,
        repo: str,
        branch: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[str, dict]:
        """
        Retrieves the current HEAD commit SHA of a repository branch.
        """
        headers = self._get_headers()
        clean_branch = urllib.parse.quote(branch, safe="")
        url = f"https://api.github.com/repos/{owner}/{repo}/branches/{clean_branch}"

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.get(url, headers=headers)
            if response.status_code == 404:
                raise GitHubClientError(
                    code="BRANCH_NOT_FOUND",
                    message=f"Target branch '{branch}' was not found in repository '{owner}/{repo}'.",
                    status_code=404,
                )
            if response.status_code != 200:
                raise GitHubClientError(
                    code=f"GITHUB_ERROR_{response.status_code}",
                    message=f"Failed to fetch branch '{branch}' from GitHub: {response.text}",
                    status_code=response.status_code,
                )
            data = response.json()
            commit_sha = data.get("commit", {}).get("sha", "")
            return commit_sha, data
        finally:
            if client is None:
                await http_client.aclose()

    async def check_branch_exists(
        self,
        owner: str,
        repo: str,
        branch: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> bool:
        """
        Checks whether a Git ref for the branch already exists.
        """
        headers = self._get_headers()
        clean_branch = urllib.parse.quote(branch, safe="")
        url = f"https://api.github.com/repos/{owner}/{repo}/git/ref/heads/{clean_branch}"

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.get(url, headers=headers)
            return response.status_code == 200
        finally:
            if client is None:
                await http_client.aclose()

    async def create_branch(
        self,
        owner: str,
        repo: str,
        new_branch: str,
        source_sha: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> dict:
        """
        Creates a new Git reference (branch) pointing to source_sha.
        """
        headers = self._get_headers()
        url = f"https://api.github.com/repos/{owner}/{repo}/git/refs"
        payload = {
            "ref": f"refs/heads/{new_branch}",
            "sha": source_sha,
        }

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.post(url, headers=headers, json=payload)
            if response.status_code == 422:
                raise BranchConflictError(
                    f"Branch '{new_branch}' already exists in '{owner}/{repo}'."
                )
            if response.status_code not in (200, 201):
                raise GitHubClientError(
                    code=f"GITHUB_BRANCH_CREATE_FAILED",
                    message=f"Failed to create branch '{new_branch}' on GitHub: {response.text}",
                    status_code=response.status_code,
                )
            return response.json()
        finally:
            if client is None:
                await http_client.aclose()

    async def get_file_blob_sha(
        self,
        owner: str,
        repo: str,
        file_path: str,
        branch: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Optional[str]:
        """
        Retrieves existing file blob SHA on a branch if the file exists.
        """
        headers = self._get_headers()
        clean_path = file_path.replace("\\", "/").lstrip("/")
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{clean_path}?ref={branch}"

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                return data.get("sha")
            return None
        finally:
            if client is None:
                await http_client.aclose()

    async def commit_file_change(
        self,
        owner: str,
        repo: str,
        branch: str,
        file_path: str,
        content: str,
        commit_message: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Tuple[str, Optional[str]]:
        """
        Creates a Git commit applying content to file_path on branch via GitHub Contents API.
        Returns: (commit_sha, html_url)
        """
        headers = self._get_headers()
        clean_path = file_path.replace("\\", "/").lstrip("/")
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{clean_path}"

        # Fetch existing blob SHA if present
        existing_sha = await self.get_file_blob_sha(owner, repo, clean_path, branch, client=client)

        encoded_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload = {
            "message": commit_message,
            "content": encoded_content,
            "branch": branch,
        }
        if existing_sha:
            payload["sha"] = existing_sha

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.put(url, headers=headers, json=payload)
            if response.status_code not in (200, 201):
                raise GitHubClientError(
                    code="GITHUB_COMMIT_FAILED",
                    message=f"Failed to commit change to GitHub: {response.text}",
                    status_code=response.status_code,
                )
            data = response.json()
            commit_info = data.get("commit", {})
            commit_sha = commit_info.get("sha", "")
            html_url = commit_info.get("html_url")
            return commit_sha, html_url
        finally:
            if client is None:
                await http_client.aclose()

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        head_branch: str,
        base_branch: str,
        body: str,
        draft: bool = False,
        client: Optional[httpx.AsyncClient] = None,
    ) -> dict:
        """
        Opens a pull request on GitHub from head_branch into base_branch.
        """
        headers = self._get_headers()
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
        payload = {
            "title": title,
            "head": head_branch,
            "base": base_branch,
            "body": body,
            "draft": draft,
        }

        http_client = client or httpx.AsyncClient(timeout=self.timeout)
        try:
            response = await http_client.post(url, headers=headers, json=payload)
            if response.status_code not in (200, 201):
                raise GitHubClientError(
                    code="GITHUB_PULL_REQUEST_FAILED",
                    message=f"Failed to create pull request on GitHub: {response.text}",
                    status_code=response.status_code,
                )
            return response.json()
        finally:
            if client is None:
                await http_client.aclose()

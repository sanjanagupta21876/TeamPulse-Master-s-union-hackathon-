import pytest
import respx
import httpx
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    """Verify GET /api/health returns 200 with service name."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "TeamPulse API"


@respx.mock
def test_successful_repository_inspection():
    """Verify successful inspection returns all metadata and latest commit SHA."""
    # Mock GitHub repo response
    respx.get("https://api.github.com/repos/facebook/react").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "react",
                "full_name": "facebook/react",
                "owner": {"login": "facebook"},
                "description": "The library for web and native user interfaces.",
                "html_url": "https://github.com/facebook/react",
                "default_branch": "main",
                "stargazers_count": 230000,
                "language": "JavaScript",
                "visibility": "public",
                "private": False,
            },
        )
    )

    # Mock GitHub branch response
    respx.get("https://api.github.com/repos/facebook/react/branches/main").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "main",
                "commit": {
                    "sha": "7a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
                },
            },
        )
    )

    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/facebook/react"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "repository" in data
    assert "inspection" in data

    repo = data["repository"]
    assert repo["owner"] == "facebook"
    assert repo["name"] == "react"
    assert repo["full_name"] == "facebook/react"
    assert repo["default_branch"] == "main"
    assert repo["selected_branch"] == "main"
    assert repo["stars"] == 230000
    assert repo["language"] == "JavaScript"
    assert repo["latest_commit_sha"] == "7a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b"

    inspection = data["inspection"]
    assert inspection["status"] == "completed"
    assert inspection["files_analyzed"] == 0
    assert inspection["bugs_detected"] == 0


@respx.mock
def test_successful_inspection_with_custom_branch():
    """Verify custom branch parameter is queried correctly."""
    respx.get("https://api.github.com/repos/pallets/flask").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "flask",
                "full_name": "pallets/flask",
                "owner": {"login": "pallets"},
                "description": "The Python micro framework for building web applications.",
                "html_url": "https://github.com/pallets/flask",
                "default_branch": "main",
                "stargazers_count": 68000,
                "language": "Python",
                "visibility": "public",
                "private": False,
            },
        )
    )

    respx.get("https://api.github.com/repos/pallets/flask/branches/3.0.x").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "3.0.x",
                "commit": {
                    "sha": "1234567890abcdef1234567890abcdef12345678",
                },
            },
        )
    )

    response = client.post(
        "/api/repositories/inspect",
        json={
            "repository_url": "https://github.com/pallets/flask",
            "branch": "3.0.x",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["repository"]["selected_branch"] == "3.0.x"
    assert data["repository"]["latest_commit_sha"] == "1234567890abcdef1234567890abcdef12345678"


def test_invalid_url_malformed():
    """Verify rejection of non-URL strings."""
    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "not-a-valid-url"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_URL"


def test_unsupported_domain():
    """Verify rejection of domains other than github.com."""
    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://gitlab.com/owner/repo"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "UNSUPPORTED_DOMAIN"


def test_missing_owner_or_repo():
    """Verify rejection when URL doesn't have both owner and repository."""
    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/facebook"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_URL_STRUCTURE"


def test_url_with_credentials_rejected():
    """Verify rejection of URLs with credentials (SSRF/security check)."""
    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://user:password@github.com/owner/repo"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_URL"


def test_url_with_query_or_fragment_rejected():
    """Verify query strings and fragments are rejected."""
    res1 = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/owner/repo?branch=main"},
    )
    assert res1.status_code == 400
    assert res1.json()["error"]["code"] == "INVALID_URL"

    res2 = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/owner/repo#readme"},
    )
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "INVALID_URL"


@respx.mock
def test_repository_not_found():
    """Verify 404 response when GitHub reports repository not found."""
    respx.get("https://api.github.com/repos/acme/nonexistent-repo").mock(
        return_value=httpx.Response(404, json={"message": "Not Found"})
    )

    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/acme/nonexistent-repo"},
    )

    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "REPOSITORY_NOT_FOUND"


@respx.mock
def test_branch_not_found():
    """Verify 404 response when specified branch does not exist."""
    respx.get("https://api.github.com/repos/facebook/react").mock(
        return_value=httpx.Response(
            200,
            json={
                "name": "react",
                "full_name": "facebook/react",
                "owner": {"login": "facebook"},
                "default_branch": "main",
                "html_url": "https://github.com/facebook/react",
                "private": False,
            },
        )
    )

    respx.get("https://api.github.com/repos/facebook/react/branches/feature-fake").mock(
        return_value=httpx.Response(404, json={"message": "Branch not found"})
    )

    response = client.post(
        "/api/repositories/inspect",
        json={
            "repository_url": "https://github.com/facebook/react",
            "branch": "feature-fake",
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "BRANCH_NOT_FOUND"


@respx.mock
def test_github_rate_limiting():
    """Verify 429 response when GitHub returns rate limit error."""
    respx.get("https://api.github.com/repos/facebook/react").mock(
        return_value=httpx.Response(
            403,
            headers={"x-ratelimit-remaining": "0"},
            json={"message": "API rate limit exceeded"},
        )
    )

    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/facebook/react"},
    )

    assert response.status_code == 429
    data = response.json()
    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@respx.mock
def test_github_timeout():
    """Verify 504 gateway timeout when GitHub request times out."""
    respx.get("https://api.github.com/repos/facebook/react").mock(
        side_effect=httpx.TimeoutException("Connection timed out")
    )

    response = client.post(
        "/api/repositories/inspect",
        json={"repository_url": "https://github.com/facebook/react"},
    )

    assert response.status_code == 504
    data = response.json()
    assert data["error"]["code"] == "NETWORK_TIMEOUT"

import pytest
import respx
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services.repository_scanner import RepositoryScanner
from app.utils.file_filters import classify_file, should_skip_file

client = TestClient(app)


MOCK_REPO_DATA = {
    "name": "requests",
    "full_name": "psf/requests",
    "owner": {"login": "psf"},
    "description": "A simple, yet elegant, HTTP library.",
    "html_url": "https://github.com/psf/requests",
    "default_branch": "main",
    "stargazers_count": 52000,
    "language": "Python",
    "visibility": "public",
    "private": False,
}

MOCK_BRANCH_DATA = {
    "name": "main",
    "commit": {
        "sha": "9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d",
    },
}

MOCK_TREE_ENTRIES = [
    # Candidate source files
    {"path": "src/requests/api.py", "type": "blob", "size": 4200},
    {"path": "src/requests/models.py", "type": "blob", "size": 12500},
    {"path": "src/requests/utils.py", "type": "blob", "size": 8900},
    {"path": "tests/test_requests.py", "type": "blob", "size": 6500},
    {"path": "pyproject.toml", "type": "blob", "size": 1800},
    {"path": "README.md", "type": "blob", "size": 3400},
    {"path": ".env.example", "type": "blob", "size": 250},
    # Excluded directories
    {"path": ".git/config", "type": "blob", "size": 150},
    {"path": "node_modules/axios/index.js", "type": "blob", "size": 2048},
    {"path": ".venv/lib/site.py", "type": "blob", "size": 1024},
    {"path": "venv/bin/activate", "type": "blob", "size": 512},
    {"path": "pycache/cache.pyc", "type": "blob", "size": 4096},
    {"path": "__pycache__/module.cpython-310.pyc", "type": "blob", "size": 4096},
    {"path": "dist/bundle.js", "type": "blob", "size": 95000},
    {"path": "build/main.js", "type": "blob", "size": 95000},
    {"path": "coverage/lcov.info", "type": "blob", "size": 8500},
    {"path": ".next/static/chunk.js", "type": "blob", "size": 5000},
    {"path": "vendor/package/code.php", "type": "blob", "size": 3000},
    # Secrets
    {"path": ".env", "type": "blob", "size": 400},
    {"path": ".env.local", "type": "blob", "size": 400},
    {"path": "id_rsa", "type": "blob", "size": 1700},
    {"path": "certs/server.key", "type": "blob", "size": 1800},
    # Binary
    {"path": "docs/logo.png", "type": "blob", "size": 15000},
    {"path": "bin/tool.exe", "type": "blob", "size": 45000},
    # Large file (> 200 KB)
    {"path": "data/huge_dataset.json", "type": "blob", "size": 250 * 1024},
    # Directory entries (trees)
    {"path": "src", "type": "tree"},
    {"path": "tests", "type": "tree"},
]


@respx.mock
def test_successful_repository_scan():
    """Verify scanning resolves branch, fetches tree, filters excluded files, and classifies candidates."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH_DATA)
    )
    respx.get(
        "https://api.github.com/repos/psf/requests/git/trees/9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d?recursive=1"
    ).mock(
        return_value=httpx.Response(200, json={"tree": MOCK_TREE_ENTRIES, "truncated": False})
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["repository_name"] == "requests"
    assert data["owner"] == "psf"
    assert data["selected_branch"] == "main"
    assert data["commit_sha"] == "9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d"
    assert data["tree_truncated"] is False
    assert len(data["scan_warnings"]) == 0

    # Total discovered blobs is 25 (excluding the 2 'tree' entries)
    assert data["total_files_discovered"] == 25

    # Candidate source files:
    # api.py, models.py, utils.py, test_requests.py, pyproject.toml, README.md, .env.example = 7
    assert data["candidate_source_files"] == 7
    assert len(data["discovered_file_paths"]) == 7

    # Verify preliminary classifications
    classes = data["preliminary_classifications"]
    assert classes["backend"] == 3  # api.py, models.py, utils.py
    assert classes["test"] == 1     # test_requests.py
    assert classes["configuration"] == 2  # pyproject.toml, .env.example
    assert classes["documentation"] == 1  # README.md

    # Verify discovered file extensions
    assert set(data["file_extensions"]) == {".py", ".toml", ".md", ".example"}

    # Verify detailed file records
    candidate_paths = [f["path"] for f in data["files"] if f["is_candidate"]]
    assert "src/requests/api.py" in candidate_paths
    assert ".git/config" not in candidate_paths
    assert "node_modules/axios/index.js" not in candidate_paths
    assert ".env" not in candidate_paths


@respx.mock
def test_scan_with_custom_branch():
    """Verify scanning queries the specified custom branch."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/v2.31.0").mock(
        return_value=httpx.Response(
            200,
            json={"name": "v2.31.0", "commit": {"sha": "custombranchcommitsha12345"}},
        )
    )
    respx.get(
        "https://api.github.com/repos/psf/requests/git/trees/custombranchcommitsha12345?recursive=1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "tree": [{"path": "requests/__init__.py", "type": "blob", "size": 300}],
                "truncated": False,
            },
        )
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests", "branch": "v2.31.0"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["selected_branch"] == "v2.31.0"
    assert data["commit_sha"] == "custombranchcommitsha12345"
    assert data["candidate_source_files"] == 1


@respx.mock
def test_truncated_git_tree_handling():
    """Verify that when GitHub truncates a tree, tree_truncated is true and warning is recorded."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH_DATA)
    )
    respx.get(
        "https://api.github.com/repos/psf/requests/git/trees/9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d?recursive=1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "tree": [{"path": "src/index.js", "type": "blob", "size": 500}],
                "truncated": True,
            },
        )
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["tree_truncated"] is True
    assert any("truncated" in w.lower() for w in data["scan_warnings"])


@respx.mock
def test_candidate_file_limit_enforcement():
    """Verify that candidate file safeguard limit (e.g. 5 files in scanner) is enforced with warning."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH_DATA)
    )

    # 10 candidate source files
    mock_files = [
        {"path": f"src/file_{i}.py", "type": "blob", "size": 100}
        for i in range(10)
    ]
    respx.get(
        "https://api.github.com/repos/psf/requests/git/trees/9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d?recursive=1"
    ).mock(
        return_value=httpx.Response(200, json={"tree": mock_files, "truncated": False})
    )

    # Use scanner directly with custom low max_candidate_files=5
    scanner = RepositoryScanner(max_candidate_files=5)
    import anyio

    async def run_scan():
        return await scanner.scan_repository("https://github.com/psf/requests")

    result = anyio.run(run_scan)

    assert result.total_files_discovered == 10
    assert result.candidate_source_files == 5
    assert any("limit reached" in w.lower() for w in result.scan_warnings)


@respx.mock
def test_compact_response_inventory_capping():
    """Verify that large inventories are capped in response with inventory_truncated flag."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH_DATA)
    )

    mock_files = [
        {"path": f"src/app_{i}.ts", "type": "blob", "size": 200}
        for i in range(8)
    ]
    respx.get(
        "https://api.github.com/repos/psf/requests/git/trees/9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d?recursive=1"
    ).mock(
        return_value=httpx.Response(200, json={"tree": mock_files, "truncated": False})
    )

    scanner = RepositoryScanner(max_candidate_files=100, max_inventory_response=4)
    import anyio

    async def run_scan():
        return await scanner.scan_repository("https://github.com/psf/requests")

    result = anyio.run(run_scan)
    assert result.candidate_source_files == 8
    assert len(result.files) == 4
    assert result.inventory_truncated is True
    assert any("inventory was capped" in w.lower() for w in result.scan_warnings)


@respx.mock
def test_scan_repository_not_found():
    """Verify 404 response when repository does not exist on GitHub."""
    respx.get("https://api.github.com/repos/owner/missing").mock(
        return_value=httpx.Response(404, json={"message": "Not Found"})
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/owner/missing"},
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "REPOSITORY_NOT_FOUND"


@respx.mock
def test_scan_branch_not_found():
    """Verify 404 response when specified branch does not exist."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(200, json=MOCK_REPO_DATA)
    )
    respx.get("https://api.github.com/repos/psf/requests/branches/nonexistent-branch").mock(
        return_value=httpx.Response(404, json={"message": "Branch not found"})
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests", "branch": "nonexistent-branch"},
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "BRANCH_NOT_FOUND"


@respx.mock
def test_scan_rate_limiting():
    """Verify 429 response when GitHub rate limit is exceeded."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        return_value=httpx.Response(
            403,
            headers={"x-ratelimit-remaining": "0"},
            json={"message": "API rate limit exceeded"},
        )
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests"},
    )
    assert response.status_code == 429
    data = response.json()
    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"


@respx.mock
def test_scan_network_timeout():
    """Verify 504 response when GitHub request times out."""
    respx.get("https://api.github.com/repos/psf/requests").mock(
        side_effect=httpx.TimeoutException("Connection timed out")
    )

    response = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://github.com/psf/requests"},
    )
    assert response.status_code == 504
    data = response.json()
    assert data["error"]["code"] == "NETWORK_TIMEOUT"


def test_scan_invalid_url():
    """Verify 400 response for invalid or malicious URLs."""
    res1 = client.post(
        "/api/repositories/scan",
        json={"repository_url": "not-a-url"},
    )
    assert res1.status_code == 400
    assert res1.json()["error"]["code"] == "INVALID_URL"

    res2 = client.post(
        "/api/repositories/scan",
        json={"repository_url": "https://evil.com/owner/repo"},
    )
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "UNSUPPORTED_DOMAIN"


def test_file_filters_and_classification_unit():
    """Unit test for filtering and classification heuristics."""
    # Excluded directories
    assert should_skip_file("node_modules/react/index.js")[0] is True
    assert should_skip_file(".git/HEAD")[0] is True
    assert should_skip_file(".venv/bin/python")[0] is True
    assert should_skip_file("pycache/test.pyc")[0] is True
    assert should_skip_file("__pycache__/test.cpython-310.pyc")[0] is True
    assert should_skip_file("dist/index.html")[0] is True
    assert should_skip_file("coverage/index.html")[0] is True
    assert should_skip_file(".next/cache/test.js")[0] is True
    assert should_skip_file("vendor/autoload.php")[0] is True

    # Secrets
    assert should_skip_file(".env")[0] is True
    assert should_skip_file(".env.production")[0] is True
    assert should_skip_file("id_rsa")[0] is True
    assert should_skip_file(".env.example")[0] is False  # Safe template allowed

    # Binary
    assert should_skip_file("assets/image.png")[0] is True
    assert should_skip_file("bin/app.exe")[0] is True

    # Size limit (> 200 KB)
    assert should_skip_file("large.py", file_size=205 * 1024)[0] is True
    assert should_skip_file("normal.py", file_size=50 * 1024)[0] is False

    # Valid candidates
    assert should_skip_file("src/components/Button.tsx")[0] is False
    assert should_skip_file("backend/app/main.py")[0] is False

    # Classifications
    assert classify_file("src/components/Header.tsx") == "frontend"
    assert classify_file("backend/api/users.py") == "backend"
    assert classify_file("tests/unit/test_auth.py") == "test"
    assert classify_file("src/__tests__/app.test.tsx") == "test"
    assert classify_file("prisma/schema.prisma") == "database"
    assert classify_file("package.json") == "configuration"
    assert classify_file("Dockerfile") == "configuration"
    assert classify_file("README.md") == "documentation"

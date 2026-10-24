"""Tests for GitHub branch creation and pull request preparation (Step 8)."""

import hashlib
import os
from unittest.mock import patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal, DiffResult, PatchValidationResult
from app.schemas.verification import VerificationRecord
from app.schemas.publishing import (
    GitHubAuthStatus,
    PublishBranchRequest,
    CreatePullRequestRequest,
)
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.fixes.storage import fix_storage
from app.services.verification.storage import verification_storage
from app.services.publishing.storage import publishing_storage
from app.services.publishing.github_client import (
    GitHubPublisherClient,
    GitHubAuthError,
    BranchConflictError,
    BranchDivergedError,
)
from app.services.publishing.pr_description_builder import PRDescriptionBuilder


@pytest.fixture(autouse=True)
def clean_storage():
    """Clear in-memory storage before each test."""
    fix_storage.clear()
    verification_storage.clear()
    publishing_storage.clear()
    yield
    fix_storage.clear()
    verification_storage.clear()
    publishing_storage.clear()


def create_sample_finding(
    finding_id: str = "finding-vuln-01",
    repo: str = "test-owner/test-repo",
    commit_sha: str = "abcdef1234567890abcdef1234567890abcdef12",
) -> Finding:
    finding = Finding(
        id=finding_id,
        rule_id="SEC-001",
        title="Hardcoded API Secret in source",
        description="A hardcoded API key was detected in auth module.",
        severity="high",
        category="security",
        file_path="src/auth.ts",
        start_line=1,
        end_line=1,
        code_excerpt="const token = 'hardcoded';",
        analyzer="ast_analyzer",
        remediation="Use environment variables.",
        repository=repo,
        branch="main",
        commit_sha=commit_sha,
    )
    diagnosis_storage.save_scan(
        scan_id="scan-001",
        repository=repo,
        branch="main",
        commit_sha=commit_sha,
        findings=[finding],
        files={"src/auth.ts": "const token = 'hardcoded';\n"},
    )
    return finding


def create_sample_proposal(
    fix_id: str = "fix-step8-test",
    finding_id: str = "finding-vuln-01",
    status: str = "approved",
    repo: str = "test-owner/test-repo",
    commit_sha: str = "abcdef1234567890abcdef1234567890abcdef12",
) -> FixProposal:
    orig = "const token = 'hardcoded';\n"
    prop = "const token = process.env.API_TOKEN;\n"
    proposal = FixProposal(
        id=fix_id,
        finding_id=finding_id,
        scan_id="scan-001",
        repository_id=repo,
        commit_sha=commit_sha,
        file_path="src/auth.ts",
        status=status,
        original_sha256=hashlib.sha256(orig.encode("utf-8")).hexdigest(),
        original_content=orig,
        proposed_content=prop,
        diff=DiffResult(
            file_path="src/auth.ts",
            unified_diff="--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1 +1 @@\n-const token = 'hardcoded';\n+const token = process.env.API_TOKEN;\n",
            additions=1,
            deletions=1,
            hunks=[],
        ),
        explanation="Extract hardcoded token to environment variables to prevent accidental credential leakage.",
        assumptions=["Environment has process.env populated"],
        potential_regressions=["Missing env var may produce undefined at runtime"],
        recommended_tests=["Unit test verifying token is loaded from process.env"],
        validation=PatchValidationResult(
            syntax_check="passed",
            patch_integrity="valid",
            source_hash_match=True,
            path_traversal_safe=True,
            within_size_limits=True,
            details=["Syntax validated successfully"],
        ),
        created_at="2026-10-24T12:00:00Z",
        updated_at="2026-10-24T12:00:00Z",
    )
    fix_storage.save_fix(proposal)
    return proposal


def create_sample_verification(
    fix_id: str = "fix-step8-test",
    overall_status: str = "completed",
    patch_status: str = "applied",
    static_status: str = "passed",
) -> VerificationRecord:
    rec = VerificationRecord(
        verification_id=f"ver-{fix_id}",
        fix_id=fix_id,
        repository_id="test-owner/test-repo",
        scan_id="scan-001",
        original_commit_sha="abcdef1234567890abcdef1234567890abcdef12",
        status=overall_status,
        workspace_status="cleaned_up",
        patch_application_status=patch_status,
        static_checks_status=static_status,
        tests_status="not_requested",
        original_findings=[],
        remaining_findings=[],
        resolved_findings=[],
        newly_introduced_findings=[],
        execution_duration=0.15,
        warnings=[],
        limitations=["Container runtime disabled, executed in isolated workspace"],
        assessment="Patch applied cleanly and passed syntax and static checks.",
        tools_executed=["ast_analyzer", "syntax_validator"],
        created_at="2026-10-24T12:05:00Z",
        completed_at="2026-10-24T12:05:01Z",
    )
    verification_storage.save_verification(rec)
    return rec


# =========================================================================
# 1. GitHub Auth Status Tests
# =========================================================================

@pytest.mark.asyncio
async def test_github_auth_status_no_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "", "GITHUB_ACCESS_TOKEN": ""}, clear=True):
            res = await ac.get("/api/github/auth-status")
            assert res.status_code == 200
            data = res.json()
            assert data["connected"] is False
            assert data["can_publish"] is False
            assert "token" in data["error_message"].lower()


@pytest.mark.asyncio
async def test_github_auth_status_with_valid_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_mocktoken12345"}):
            with patch.object(GitHubPublisherClient, "get_auth_status") as mock_auth:
                mock_auth.return_value = GitHubAuthStatus(
                    connected=True,
                    user="codelens-bot",
                    scopes=["repo", "contents:write", "pull_requests:write"],
                    auth_type="token",
                    can_publish=True,
                    rate_limit_remaining=4990,
                )
                res = await ac.get("/api/github/auth-status")
                assert res.status_code == 200
                data = res.json()
                assert data["connected"] is True
                assert data["user"] == "codelens-bot"
                assert data["can_publish"] is True
                assert "repo" in data["scopes"]


# =========================================================================
# 2. Eligibility Check Tests
# =========================================================================

@pytest.mark.asyncio
async def test_eligibility_fix_not_found():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/fixes/non-existent-fix/publish-eligibility")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_eligibility_fix_unapproved():
    create_sample_finding()
    create_sample_proposal(status="proposed")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/fixes/fix-step8-test/publish-eligibility")
        assert res.status_code == 200
        data = res.json()
        assert data["eligible"] is False
        assert data["is_approved"] is False
        assert any("approved" in r.lower() for r in data["reasons"])


@pytest.mark.asyncio
async def test_eligibility_fix_unverified():
    create_sample_finding()
    create_sample_proposal(status="approved")
    # No verification record

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/fixes/fix-step8-test/publish-eligibility")
        assert res.status_code == 200
        data = res.json()
        assert data["eligible"] is False
        assert data["is_verified"] is False
        assert any("verification" in r.lower() for r in data["reasons"])


@pytest.mark.asyncio
async def test_eligibility_fix_verification_failed():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification(
        overall_status="failed",
        static_status="failed",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/fixes/fix-step8-test/publish-eligibility")
        assert res.status_code == 200
        data = res.json()
        assert data["eligible"] is False
        assert data["is_verified"] is False


@pytest.mark.asyncio
async def test_eligibility_fully_eligible():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                    connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
                )):
                    res = await ac.get("/api/fixes/fix-step8-test/publish-eligibility?target_branch=main")
                    assert res.status_code == 200
                    data = res.json()
                    assert data["eligible"] is True
                    assert data["is_approved"] is True
                    assert data["is_verified"] is True
                    assert data["branch_head_matches"] is True
                    assert len(data["reasons"]) == 0


@pytest.mark.asyncio
async def test_eligibility_branch_head_diverged():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("9999999999999999999999999999999999999999", "commit")):
                with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                    connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
                )):
                    res = await ac.get("/api/fixes/fix-step8-test/publish-eligibility?target_branch=main")
                    assert res.status_code == 200
                    data = res.json()
                    assert data["branch_head_matches"] is False
                    assert any("advanced" in r.lower() for r in data["reasons"])


# =========================================================================
# 3. Branch Creation and Commit Publishing Tests
# =========================================================================

@pytest.mark.asyncio
async def test_publish_branch_without_auth():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": ""}, clear=True):
            res = await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})
            assert res.status_code == 401
            assert "authorization" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_publish_branch_unapproved_rejected():
    create_sample_finding()
    create_sample_proposal(status="proposed")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            res = await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})
            assert res.status_code == 400
            assert "approved" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_publish_branch_cannot_target_default_branch_directly():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                res = await ac.post(
                    "/api/fixes/fix-step8-test/publish-branch",
                    json={"custom_branch_name": "main"},
                )
                assert res.status_code == 400
                assert "base branch" in res.json()["detail"].lower() or "protected" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_publish_branch_conflict():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                    with patch.object(GitHubPublisherClient, "check_branch_exists", return_value=True):
                        res = await ac.post(
                            "/api/fixes/fix-step8-test/publish-branch",
                            json={"custom_branch_name": "fix-existing-branch"},
                        )
                        assert res.status_code == 409
                        assert "already exists" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_publish_branch_success():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                    with patch.object(GitHubPublisherClient, "check_branch_exists", return_value=False):
                        with patch.object(GitHubPublisherClient, "create_branch", return_value={"ref": "refs/heads/codelens/fix-finding-vuln-01-hardcoded-api"}):
                            with patch.object(GitHubPublisherClient, "commit_file_change", return_value=("commit-sha-777", "https://github.com/test-owner/test-repo/commit/commit-sha-777")):
                                res = await ac.post(
                                    "/api/fixes/fix-step8-test/publish-branch",
                                    json={"target_branch": "main"},
                                )
                                assert res.status_code == 201
                                data = res.json()
                                assert data["fix_id"] == "fix-step8-test"
                                assert data["created_branch"].startswith("codelens/fix-")
                                assert data["published_commit_sha"] == "commit-sha-777"
                                assert data["status"] == "commit_created"
                                assert "src/auth.ts" in data["files_changed"]


@pytest.mark.asyncio
async def test_publish_branch_idempotent():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                    with patch.object(GitHubPublisherClient, "check_branch_exists", return_value=False):
                        with patch.object(GitHubPublisherClient, "create_branch", return_value={"ref": "refs/heads/codelens/fix-idempotent"}):
                            with patch.object(GitHubPublisherClient, "commit_file_change", return_value=("sha-1", "url-1")):
                                # First publish
                                res1 = await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})
                                assert res1.status_code == 201

                                # Second publish should return existing record idempotently
                                res2 = await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})
                                assert res2.status_code == 201
                                assert res2.json()["published_commit_sha"] == "sha-1"


# =========================================================================
# 4. Pull Request Creation Tests
# =========================================================================

@pytest.mark.asyncio
async def test_create_pull_request_before_branch_published():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/fixes/fix-step8-test/create-pull-request",
            json={"title": "fix: auth.ts"},
        )
        assert res.status_code == 400
        assert "must be published" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_pull_request_without_confirmation():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post(
            "/api/fixes/fix-step8-test/create-pull-request",
            json={"title": "fix: auth.ts", "confirm_creation": False},
        )
        assert res.status_code == 400
        assert "confirmation" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_pull_request_success():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                    with patch.object(GitHubPublisherClient, "check_branch_exists", return_value=False):
                        with patch.object(GitHubPublisherClient, "create_branch", return_value={"ref": "refs/heads/codelens/fix-finding-vuln-01-hardcoded-api"}):
                            with patch.object(GitHubPublisherClient, "commit_file_change", return_value=("commit-sha-777", "url-commit")):
                                # First publish the branch
                                pub_res = await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})
                                assert pub_res.status_code == 201

                                # Now create the PR
                                with patch.object(GitHubPublisherClient, "create_pull_request") as mock_pr:
                                    mock_pr.return_value = {
                                        "id": 101,
                                        "number": 42,
                                        "html_url": "https://github.com/test-owner/test-repo/pull/42",
                                        "title": "fix: Hardcoded API Secret in source [CodeLens AI]",
                                        "state": "open",
                                        "draft": False,
                                        "created_at": "2026-10-24T12:10:00Z",
                                    }

                                    pr_res = await ac.post(
                                        "/api/fixes/fix-step8-test/create-pull-request",
                                        json={
                                            "title": "fix: Hardcoded API Secret in source [CodeLens AI]",
                                            "confirm_creation": True,
                                        },
                                    )
                                    assert pr_res.status_code == 201
                                    data = pr_res.json()
                                    assert data["pr_number"] == 42
                                    assert data["html_url"] == "https://github.com/test-owner/test-repo/pull/42"
                                    assert data["head_branch"] == pub_res.json()["created_branch"]
                                    assert data["base_branch"] == "main"
                                    assert data["status"] == "open"


# =========================================================================
# 5. Retrieval & Listing Tests
# =========================================================================

@pytest.mark.asyncio
async def test_get_publish_status():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Initial publish status before publishing
        res = await ac.get("/api/fixes/fix-step8-test/publish-status")
        assert res.status_code == 200
        data = res.json()
        assert data["fix_id"] == "fix-step8-test"
        assert data["publish_record"] is None
        assert data["pull_request"] is None


@pytest.mark.asyncio
async def test_list_repository_pull_requests():
    create_sample_finding()
    create_sample_proposal(status="approved")
    create_sample_verification()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch.dict(os.environ, {"GITHUB_TOKEN": "ghp_valid"}):
            with patch.object(GitHubPublisherClient, "get_auth_status", return_value=GitHubAuthStatus(
                connected=True, user="tester", scopes=["repo"], can_publish=True, auth_type="token"
            )):
                with patch.object(GitHubPublisherClient, "get_branch_head", return_value=("abcdef1234567890abcdef1234567890abcdef12", "commit")):
                    with patch.object(GitHubPublisherClient, "check_branch_exists", return_value=False):
                        with patch.object(GitHubPublisherClient, "create_branch", return_value={"ref": "refs/heads/codelens/fix-01"}):
                            with patch.object(GitHubPublisherClient, "commit_file_change", return_value=("commit-sha-777", "url-commit")):
                                await ac.post("/api/fixes/fix-step8-test/publish-branch", json={})

                                with patch.object(GitHubPublisherClient, "create_pull_request", return_value={
                                    "id": 101,
                                    "number": 42,
                                    "html_url": "https://github.com/test-owner/test-repo/pull/42",
                                    "title": "fix: auth.ts",
                                    "state": "open",
                                    "draft": False,
                                    "created_at": "2026-10-24T12:10:00Z",
                                }):
                                    await ac.post(
                                        "/api/fixes/fix-step8-test/create-pull-request",
                                        json={"title": "fix: auth.ts", "confirm_creation": True},
                                    )

                                    res = await ac.get("/api/repositories/test-owner/test-repo/pull-requests")
                                    assert res.status_code == 200
                                    list_data = res.json()
                                    assert list_data["total"] == 1
                                    assert list_data["pull_requests"][0]["pr_number"] == 42
                                    assert list_data["pull_requests"][0]["pr_number"] == 42


# =========================================================================
# 6. PR Description Builder Tests
# =========================================================================

def test_pr_description_builder_content():
    finding = create_sample_finding()
    proposal = create_sample_proposal()
    rec = create_sample_verification()

    builder = PRDescriptionBuilder()
    body = builder.build_pr_body(finding=finding, proposal=proposal, verification=rec)
    assert "CodeLens AI Automated Fix Summary" in body
    assert "Root-Cause Diagnosis & Explanation" in body
    assert "Changes Implemented" in body
    assert "Isolated Workspace Verification Results" in body
    assert "src/auth.ts" in body
    assert "Security & Lineage References" in body
    assert "abcdef1234567890abcdef1234567890abcdef12" in body

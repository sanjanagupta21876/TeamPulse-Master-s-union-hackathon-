import hashlib
import os
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal, PatchValidationResult
from app.services.diagnosis.storage import storage as diagnosis_storage, ScanRecord
from app.services.fixes.storage import fix_storage
from app.services.verification.storage import verification_storage
from app.services.verification.workspace_manager import WorkspaceManager, WorkspaceSecurityError
from app.services.verification.patch_applier import PatchApplier


@pytest.fixture(autouse=True)
def clean_stores():
    diagnosis_storage.clear()
    fix_storage.clear()
    verification_storage.clear()
    yield
    diagnosis_storage.clear()
    fix_storage.clear()
    verification_storage.clear()


def seed_scan_and_proposal(
    file_path: str = "app/models/user.py",
    original_content: str = "def get_user(uid):\n    query = 'SELECT * FROM users WHERE id = %s' % uid\n    return query\n",
    proposed_content: str = "def get_user(uid):\n    query = 'SELECT * FROM users WHERE id = %s'\n    return (query, (uid,))\n",
    proposal_status: str = "approved",
):
    scan_id = "scan_test_verify_001"
    repo_name = "testowner/testrepo"
    commit_sha = "c0ffee1234567890abcdef1234567890abcdef12"

    orig_hash = hashlib.sha256(original_content.encode("utf-8")).hexdigest()

    finding = Finding(
        id="fnd_test_sql_001",
        repository=repo_name,
        branch="main",
        commit_sha=commit_sha,
        file_path=file_path,
        start_line=2,
        end_line=2,
        severity="high",
        category="security",
        rule_id="PY-SEC-001",
        title="SQL Injection Detected",
        description="String formatting in SQL query can allow SQL injection.",
        analyzer="security_rules",
        remediation="Use parameterized queries instead of string formatting.",
        code_excerpt="query = 'SELECT * FROM users WHERE id = %s' % uid",
    )

    scan_record = diagnosis_storage.save_scan(
        scan_id=scan_id,
        repository=repo_name,
        branch="main",
        commit_sha=commit_sha,
        findings=[finding],
        files={file_path: original_content},
    )

    proposal = FixProposal(
        id="fix_test_001",
        finding_id=finding.id,
        scan_id=scan_id,
        repository_id=repo_name,
        commit_sha=commit_sha,
        file_path=file_path,
        status=proposal_status,
        original_sha256=orig_hash,
        original_content=original_content,
        proposed_content=proposed_content,
        explanation="Use parameterized query to eliminate SQL injection vulnerability.",
        validation=PatchValidationResult(
            syntax_check="passed",
            patch_integrity="valid",
            source_hash_match=True,
            path_traversal_safe=True,
            within_size_limits=True,
        ),
        created_at="2026-10-24T06:00:00Z",
        updated_at="2026-10-24T06:00:00Z",
        approved_at="2026-10-24T06:05:00Z" if proposal_status == "approved" else None,
    )
    fix_storage.save_fix(proposal)
    return scan_record, proposal


@pytest.mark.asyncio
async def test_verify_approved_proposal_success():
    """Verify that an approved proposal runs cleanly in an isolated workspace."""
    seed_scan_and_proposal()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["fix_id"] == "fix_test_001"
        assert data["status"] == "completed"
        assert data["patch_application_status"] == "applied"
        assert data["static_checks_status"] == "passed"
        assert data["tests_status"] == "not_requested"
        assert data["workspace_status"] == "cleaned_up"
        assert len(data["resolved_findings"]) == 1
        assert data["resolved_findings"][0]["id"] == "fnd_test_sql_001"
        assert len(data["newly_introduced_findings"]) == 0
        assert "Potentially resolved" in data["assessment"]
        assert "python_ast_syntax_parser" in data["tools_executed"]


@pytest.mark.asyncio
async def test_rejection_of_unapproved_proposal():
    """Verify that unapproved proposals are rejected with HTTP 400."""
    seed_scan_and_proposal(proposal_status="proposed")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "PROPOSAL_NOT_APPROVED"


@pytest.mark.asyncio
async def test_rejection_of_rejected_proposal():
    """Verify that rejected proposals cannot be verified."""
    seed_scan_and_proposal(proposal_status="rejected")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "PROPOSAL_NOT_APPROVED"


@pytest.mark.asyncio
async def test_verify_nonexistent_proposal():
    """Verify that an invalid fix proposal ID returns 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_does_not_exist/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == "PROPOSAL_NOT_FOUND"


@pytest.mark.asyncio
async def test_verify_source_hash_mismatch():
    """Verify that if the source in scan does not match proposal.original_sha256, it is rejected."""
    _, proposal = seed_scan_and_proposal()
    proposal.original_sha256 = "0000000000000000000000000000000000000000000000000000000000000000"
    fix_storage.save_fix(proposal)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "SOURCE_HASH_MISMATCH"


@pytest.mark.asyncio
async def test_syntax_failure_in_patched_code():
    """Verify that broken syntax in the patched code is caught and marked as failed."""
    broken_code = "def get_user(uid):\n    return (query, (uid,}\n"  # mismatched brace/paren
    seed_scan_and_proposal(proposed_content=broken_code)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["static_checks_status"] == "failed"
        assert len(data["warnings"]) > 0
        assert "failed" in data["assessment"].lower()


@pytest.mark.asyncio
async def test_test_execution_safety_limitation():
    """Verify that requesting tests when container sandbox is absent reports unavailable safely."""
    seed_scan_and_proposal()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": True, "run_static_checks": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tests_status"] == "unavailable"
        assert len(data["limitations"]) > 0
        assert any("container" in lim.lower() for lim in data["limitations"])


@pytest.mark.asyncio
async def test_get_and_list_verifications():
    """Verify retrieving specific verifications and listing by fix_id."""
    seed_scan_and_proposal()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Run verification
        post_res = await client.post(
            "/api/fixes/fix_test_001/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
        assert post_res.status_code == 200
        vid = post_res.json()["verification_id"]

        # Get verification by id
        get_res = await client.get(f"/api/verifications/{vid}")
        assert get_res.status_code == 200
        assert get_res.json()["verification_id"] == vid

        # List verifications for fix
        list_res = await client.get("/api/fixes/fix_test_001/verifications")
        assert list_res.status_code == 200
        assert len(list_res.json()["verifications"]) == 1

        # Cancel verification
        cancel_res = await client.post(f"/api/verifications/{vid}/cancel")
        assert cancel_res.status_code == 200


def test_workspace_manager_rejects_path_traversal():
    """Verify WorkspaceManager rejects attempts to escape boundary."""
    mgr = WorkspaceManager()
    with pytest.raises(WorkspaceSecurityError):
        mgr.resolve_safe_path(Path("C:/test_workspace"), "../../etc/passwd")

    with pytest.raises(WorkspaceSecurityError):
        mgr.resolve_safe_path(Path("C:/test_workspace"), "/etc/shadow")


def test_workspace_manager_lifecycle_cleanup():
    """Verify temporary workspace directory is created and cleaned up completely."""
    mgr = WorkspaceManager()
    ws = mgr.create_workspace("test_job_123", {"src/index.py": "print('hello')"})
    assert os.path.exists(ws)
    assert os.path.exists(os.path.join(ws, "src", "index.py"))

    cleaned = mgr.clean_workspace(ws)
    assert cleaned is True
    assert not os.path.exists(ws)


@pytest.mark.asyncio
async def test_verify_comment_only_fix_fails_and_ignores_other_files():
    """A patch that leaves the target finding in place must not verify, and findings in
    untouched files must not be reported as regressions introduced by the patch."""
    original = "def parse(x):\n    try:\n        return int(x)\n    except Exception:\n        pass\n"
    proposed = (
        "def parse(x):\n    try:\n        return int(x)\n"
        "    # TeamPulse TODO (PY-ERR-002): handle the error\n"
        "    except Exception:\n        pass\n"
    )
    _, proposal = seed_scan_and_proposal(
        file_path="app/parse.py", original_content=original, proposed_content=proposed
    )
    finding = Finding(
        id=proposal.finding_id,
        repository=proposal.repository_id,
        branch="main",
        commit_sha=proposal.commit_sha,
        file_path="app/parse.py",
        start_line=4,
        end_line=4,
        severity="medium",
        category="reliability",
        rule_id="PY-ERR-002",
        title="Silently Suppressed Exception (pass)",
        description="An exception handler block contains only 'pass'.",
        analyzer="python_ast",
        remediation="Log or handle the exception.",
    )
    diagnosis_storage.save_scan(
        scan_id=proposal.scan_id,
        repository=proposal.repository_id,
        branch="main",
        commit_sha=proposal.commit_sha,
        findings=[finding],
        files={
            "app/parse.py": original,
            # Pre-existing issue in an unrelated file
            "app/runner.py": "import subprocess\nsubprocess.call('ls', shell=True)\n",
        },
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            f"/api/fixes/{proposal.id}/verify",
            json={"run_tests": False, "run_static_checks": True},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "failed"
    assert [f["id"] for f in data["remaining_findings"]] == [proposal.finding_id]
    assert all(f["file_path"] == "app/parse.py" for f in data["newly_introduced_findings"])

import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.bug_report import (
    AnalysisMetadata,
    AnalysisSummary,
    Finding,
    RepositoryAnalysisResponse,
    RepositoryInfo,
)
from app.schemas.monitoring import FindingComparisonSummary
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.monitoring import (
    FindingComparator,
    WebhookVerifier,
    monitoring_service,
    monitoring_storage,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_storage():
    monitoring_storage.clear()
    diagnosis_storage.clear()
    yield
    monitoring_storage.clear()
    diagnosis_storage.clear()


def make_payload_and_signature(payload_dict: dict, secret: str = "test_secret_key"):
    verifier = WebhookVerifier(secret=secret)
    raw_bytes = json.dumps(payload_dict).encode("utf-8")
    signature = verifier.generate_signature(raw_bytes, secret=secret)
    return raw_bytes, signature


# 1. Signature Verification Tests
def test_webhook_missing_signature():
    payload = {"repository": {"full_name": "owner/repo"}}
    response = client.post(
        "/api/webhooks/github",
        json=payload,
        headers={"X-GitHub-Event": "push", "X-GitHub-Delivery": "deliv-1"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_SIGNATURE"


def test_webhook_invalid_signature():
    payload = {"repository": {"full_name": "owner/repo"}}
    response = client.post(
        "/api/webhooks/github",
        json=payload,
        headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "deliv-2",
            "X-Hub-Signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        },
    )
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "INVALID_SIGNATURE"


def test_webhook_valid_signature_ping():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "zen": "Responsive is better than fast.",
            "hook_id": 12345,
            "repository": {"full_name": "acme/awesome-app"},
            "sender": {"login": "octocat"},
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        response = client.post(
            "/api/webhooks/github",
            content=raw_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "ping",
                "X-GitHub-Delivery": "ping-deliv-123",
                "X-Hub-Signature-256": sig,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["event"] == "ping"

        # Check settings updated
        settings = monitoring_storage.get_or_create_settings("acme/awesome-app")
        assert settings.webhook_configured is True


def test_webhook_duplicate_delivery_idempotency():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/main",
            "after": "abc1234",
            "commits": [],
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        headers = {
            "Content-Type": "application/json",
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "dup-deliv-001",
            "X-Hub-Signature-256": sig,
        }

        # First delivery
        res1 = client.post("/api/webhooks/github", content=raw_bytes, headers=headers)
        assert res1.status_code in (200, 202)

        # Second delivery with same delivery ID
        res2 = client.post("/api/webhooks/github", content=raw_bytes, headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["status"] == "ignored"
        assert "Duplicate webhook delivery" in data2["message"]


def test_webhook_push_to_unmonitored_branch():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        # Setup settings: only monitor main
        monitoring_storage.update_settings(
            repository="acme/awesome-app",
            monitored_branches=["main"],
            analyze_all_branches=False,
        )

        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/feature-branch",
            "after": "feature_sha_999",
            "commits": [{"added": ["foo.py"], "modified": [], "removed": []}],
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        response = client.post(
            "/api/webhooks/github",
            content=raw_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": "push-unmonitored-1",
                "X-Hub-Signature-256": sig,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "skipped"
        assert "not monitored" in data["message"]


def test_webhook_push_branch_deleted():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/old-branch",
            "after": "0000000000000000000000000000000000000000",
            "deleted": True,
            "commits": [],
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        response = client.post(
            "/api/webhooks/github",
            content=raw_bytes,
            headers={
                "Content-Type": "application/json",
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": "deleted-branch-1",
                "X-Hub-Signature-256": sig,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "Branch deletion detected" in data["message"]


def test_webhook_initial_push_and_job_queue():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/main",
            "before": "0000000000000000000000000000000000000000",
            "after": "commit_sha_init_1",
            "forced": False,
            "commits": [
                {
                    "added": ["src/app.py", "README.md"],
                    "modified": [],
                    "removed": [],
                }
            ],
            "sender": {"login": "dev_alice"},
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock) as mock_run:
            response = client.post(
                "/api/webhooks/github",
                content=raw_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "push",
                    "X-GitHub-Delivery": "init-push-1",
                    "X-Hub-Signature-256": sig,
                },
            )
            assert response.status_code == 202
            data = response.json()
            assert data["status"] == "queued"
            assert data["job_id"] is not None

            # Verify job is recorded in storage
            job = monitoring_storage.get_job(data["job_id"])
            assert job is not None
            assert job.repository == "acme/awesome-app"
            assert job.commit_sha == "commit_sha_init_1"
            assert job.status == "queued"


def test_duplicate_job_prevention():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/main",
            "after": "sha_unique_123",
            "commits": [{"added": ["main.py"], "modified": [], "removed": []}],
        }
        raw_bytes1, sig1 = make_payload_and_signature(payload, secret="test_secret_key")

        with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock):
            res1 = client.post(
                "/api/webhooks/github",
                content=raw_bytes1,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "push",
                    "X-GitHub-Delivery": "deliv-job-1",
                    "X-Hub-Signature-256": sig1,
                },
            )
            assert res1.status_code == 202

            # Try second delivery with different delivery_id but same repository and commit SHA
            raw_bytes2, sig2 = make_payload_and_signature(payload, secret="test_secret_key")
            res2 = client.post(
                "/api/webhooks/github",
                content=raw_bytes2,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "push",
                    "X-GitHub-Delivery": "deliv-job-2",
                    "X-Hub-Signature-256": sig2,
                },
            )
            assert res2.status_code == 200
            data2 = res2.json()
            assert data2["status"] == "skipped"
            assert "already active" in data2["message"]


# 2. Finding Comparison Unit Tests
def test_finding_comparator_new_resolved_persistent():
    comparator = FindingComparator()

    f1 = Finding(
        id="f1",
        repository="owner/repo",
        branch="main",
        commit_sha="sha_old",
        file_path="src/login.py",
        start_line=10,
        severity="high",
        category="security",
        title="SQL Injection",
        description="Raw SQL",
        rule_id="PY-SEC-003",
        analyzer="python_ast",
        confidence="confirmed",
        remediation="Use params",
    )
    f2 = Finding(
        id="f2",
        repository="owner/repo",
        branch="main",
        commit_sha="sha_old",
        file_path="src/auth.py",
        start_line=25,
        severity="medium",
        category="correctness",
        title="Unused variable",
        description="var x is unused",
        rule_id="PY-ERR-001",
        analyzer="python_ast",
        confidence="confirmed",
        remediation="Remove x",
    )

    f1_fixed_location = Finding(
        id="f1_new",
        repository="owner/repo",
        branch="main",
        commit_sha="sha_new",
        file_path="src/login.py",
        start_line=15,  # shifted line
        severity="high",
        category="security",
        title="SQL Injection",
        description="Raw SQL",
        rule_id="PY-SEC-003",
        analyzer="python_ast",
        confidence="confirmed",
        remediation="Use params",
    )
    f3 = Finding(
        id="f3",
        repository="owner/repo",
        branch="main",
        commit_sha="sha_new",
        file_path="src/utils.py",
        start_line=5,
        severity="critical",
        category="security",
        title="Hardcoded Secret",
        description="AWS Secret Key exposed",
        rule_id="SEC-KEY-001",
        analyzer="security_rules",
        confidence="confirmed",
        remediation="Move to env",
    )

    # Previous had f1 and f2. Current has f1 (persistent) and f3 (new). f2 was in src/auth.py which was analyzed -> resolved!
    diff = comparator.compare(
        previous_findings=[f1, f2],
        current_findings=[f1_fixed_location, f3],
        analyzed_files={"src/login.py", "src/auth.py", "src/utils.py"},
        previous_commit_sha="sha_old",
        new_commit_sha="sha_new",
        is_full_scan=True,
    )

    assert diff.persistent_findings_count == 1
    assert "f1_new" in diff.persistent_finding_ids
    assert diff.new_findings_count == 1
    assert "f3" in diff.new_finding_ids
    assert diff.resolved_findings_count == 1
    assert "f2" in diff.resolved_finding_ids


# 3. Repository Monitoring Settings Endpoints
def test_monitoring_settings_endpoints():
    # GET settings default
    res = client.get("/api/repositories/facebook/react/monitoring")
    assert res.status_code == 200
    data = res.json()
    assert data["repository"] == "facebook/react"
    assert data["is_active"] is True
    assert "main" in data["monitored_branches"]

    # PATCH settings
    patch_res = client.patch(
        "/api/repositories/facebook/react/monitoring",
        json={
            "monitored_branches": ["main", "staging", "v2-dev"],
            "analyze_all_branches": True,
            "auto_diagnose_high_priority": True,
        },
    )
    assert patch_res.status_code == 200
    pdata = patch_res.json()
    assert pdata["analyze_all_branches"] is True
    assert "v2-dev" in pdata["monitored_branches"]
    assert pdata["auto_diagnose_high_priority"] is True

    # Disable
    dis_res = client.post("/api/repositories/facebook/react/monitoring/disable")
    assert dis_res.status_code == 200
    assert dis_res.json()["is_active"] is False

    # Enable
    en_res = client.post("/api/repositories/facebook/react/monitoring/enable")
    assert en_res.status_code == 200
    assert en_res.json()["is_active"] is True


# 4. Job Lifecycle & Retry
@pytest.mark.asyncio
async def test_job_execution_success_and_diff():
    # Pre-populate a previous scan in diagnosis_storage
    f_prev = Finding(
        id="f_prev_1",
        repository="acme/awesome-app",
        branch="main",
        commit_sha="sha_111",
        file_path="app.py",
        start_line=10,
        severity="high",
        category="security",
        title="Command Injection",
        description="Shell execution",
        rule_id="PY-SEC-001",
        analyzer="python_ast",
        confidence="confirmed",
        remediation="Sanitize input",
    )
    diagnosis_storage.save_scan(
        scan_id="scan_prev_1",
        repository="acme/awesome-app",
        branch="main",
        commit_sha="sha_111",
        findings=[f_prev],
    )

    # Mock analyze_repository to return 0 findings (issue fixed)
    mock_scan_id = "scan_new_2"
    mock_response = RepositoryAnalysisResponse(
        repository=RepositoryInfo(
            full_name="acme/awesome-app",
            branch="main",
            commit_sha="sha_222",
        ),
        analysis=AnalysisMetadata(
            status="completed",
            files_discovered=1,
            files_analyzed=1,
            findings_count=0,
            analyzers_completed=["python_ast"],
        ),
        summary=AnalysisSummary(),
        findings=[],
        scan_id=mock_scan_id,
    )

    with patch.object(
        monitoring_service.analysis_engine,
        "analyze_repository",
        new_callable=AsyncMock,
        return_value=mock_response,
    ):
        from app.schemas.monitoring import AnalysisJobRecord

        test_job = AnalysisJobRecord(
            job_id="job_exec_success",
            repository="acme/awesome-app",
            branch="main",
            commit_sha="sha_222",
            trigger="webhook_push",
            status="queued",
        )
        monitoring_storage.save_job(test_job)

        updated = await monitoring_service.run_analysis_job("job_exec_success")
        assert updated is not None
        assert updated.status == "completed"
        assert updated.scan_id == mock_scan_id
        assert updated.comparison is not None
        assert updated.comparison.resolved_findings_count == 1
        assert "f_prev_1" in updated.comparison.resolved_finding_ids
        assert updated.comparison.new_findings_count == 0


def test_job_retry_endpoint():
    from app.schemas.monitoring import AnalysisJobRecord

    failed_job = AnalysisJobRecord(
        job_id="job_to_retry",
        repository="acme/awesome-app",
        branch="main",
        commit_sha="sha_retry",
        trigger="webhook_push",
        status="failed",
        error="Network timeout during scan",
    )
    monitoring_storage.save_job(failed_job)

    with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock):
        res = client.post("/api/analysis-jobs/job_to_retry/retry")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "queued"
        assert "job_to_retry" in data["message"]

        # Job in storage should now be queued and retry_count == 1
        j = monitoring_storage.get_job("job_to_retry")
        assert j.status == "queued"
        assert j.retry_count == 1


def test_list_events_and_jobs_endpoints():
    from app.schemas.monitoring import AnalysisJobRecord, WebhookEventRecord

    monitoring_storage.save_event(
        WebhookEventRecord(
            delivery_id="deliv-list-1",
            event_type="push",
            repository="facebook/react",
            branch="main",
            commits_count=2,
            status="queued",
        )
    )

    monitoring_storage.save_job(
        AnalysisJobRecord(
            job_id="job-list-1",
            repository="facebook/react",
            branch="main",
            commit_sha="sha_list_1",
            status="completed",
        )
    )

    ev_res = client.get("/api/repositories/facebook/react/events")
    assert ev_res.status_code == 200
    assert len(ev_res.json()) >= 1
    assert ev_res.json()[0]["delivery_id"] == "deliv-list-1"

    jobs_res = client.get("/api/repositories/facebook/react/analysis-jobs")
    assert jobs_res.status_code == 200
    assert len(jobs_res.json()) >= 1
    assert jobs_res.json()[0]["job_id"] == "job-list-1"

    single_job = client.get("/api/analysis-jobs/job-list-1")
    assert single_job.status_code == 200
    assert single_job.json()["job_id"] == "job-list-1"


def test_get_nonexistent_job_404():
    res = client.get("/api/analysis-jobs/nonexistent-job-999")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "JOB_NOT_FOUND"


def test_webhook_pull_request_event():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "action": "opened",
            "repository": {"full_name": "acme/awesome-app"},
            "pull_request": {
                "number": 42,
                "head": {
                    "sha": "pr_head_sha_99",
                    "ref": "main",
                },
            },
            "sender": {"login": "pr_author"},
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock):
            res = client.post(
                "/api/webhooks/github",
                content=raw_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "pull_request",
                    "X-GitHub-Delivery": "pr-deliv-42",
                    "X-Hub-Signature-256": sig,
                },
            )
            assert res.status_code == 202
            data = res.json()
            assert data["status"] == "queued"
            assert data["event"] == "pull_request"


def test_webhook_force_push():
    with patch.object(monitoring_service.verifier, "_secret", "test_secret_key"):
        payload = {
            "repository": {"full_name": "acme/awesome-app"},
            "ref": "refs/heads/main",
            "before": "old_commit_before_force",
            "after": "new_commit_after_force",
            "forced": True,
            "commits": [{"added": ["file.py"], "modified": [], "removed": []}],
        }
        raw_bytes, sig = make_payload_and_signature(payload, secret="test_secret_key")

        with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock):
            res = client.post(
                "/api/webhooks/github",
                content=raw_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-GitHub-Event": "push",
                    "X-GitHub-Delivery": "force-push-deliv-1",
                    "X-Hub-Signature-256": sig,
                },
            )
            assert res.status_code == 202
            event = monitoring_storage.get_event("force-push-deliv-1")
            assert event is not None
            assert event.is_forced is True


def test_manual_analysis_trigger():
    from app.schemas.repository import RepositoryMetadata, InspectionSummary, RepositoryInspectionResponse

    mock_inspection = RepositoryInspectionResponse(
        repository=RepositoryMetadata(
            owner="facebook",
            name="react",
            full_name="facebook/react",
            html_url="https://github.com/facebook/react",
            default_branch="main",
            selected_branch="main",
            latest_commit_sha="manual_sha_777",
        ),
        inspection=InspectionSummary(),
    )

    with patch.object(
        monitoring_service.github_service,
        "inspect_repository",
        new_callable=AsyncMock,
        return_value=mock_inspection,
    ):
        with patch.object(monitoring_service, "run_analysis_job", new_callable=AsyncMock):
            res = client.post("/api/repositories/facebook/react/analyze-latest")
            assert res.status_code == 200
            data = res.json()
            assert data["repository"] == "facebook/react"
            assert data["commit_sha"] == "manual_sha_777"
            assert data["trigger"] == "manual"
            assert data["status"] == "queued"


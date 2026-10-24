import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.bug_report import Finding
from app.schemas.diagnosis import DiagnosisReport
from app.services.diagnosis.storage import storage
from app.services.diagnosis.llm_provider import (
    LLMProvider,
    LLMTimeoutError,
    LLMExecutionError,
)
from app.services.diagnosis.root_cause_analyzer import LLMDiagnosisPayload, LLMRootCauseOutput
from app.services.diagnosis.cross_layer_analyzer import CrossLayerAnalyzer
from app.services.diagnosis.remediation_planner import RemediationPlanner
from app.services.diagnosis.context_builder import ContextBuilder

client = TestClient(app)

SAMPLE_FINDING_1 = Finding(
    id="fnd_111111111111",
    repository="acme/platform",
    branch="main",
    commit_sha="commit12345",
    file_path="src/api/auth.ts",
    start_line=15,
    end_line=15,
    severity="high",
    category="reliability",
    title="Unhandled Promise in API Client",
    description="Promise returned by fetch is not handled with catch.",
    rule_id="JS-REL-001",
    analyzer="javascript_rules",
    confidence="confirmed",
    remediation="Add .catch() or wrap in try/catch.",
    code_excerpt="15: fetch('/api/login', { method: 'GET' });",
    status="open",
    verification_status="not_run",
)

SAMPLE_FINDING_2 = Finding(
    id="fnd_222222222222",
    repository="acme/platform",
    branch="main",
    commit_sha="commit12345",
    file_path="backend/app/routes/auth.py",
    start_line=25,
    end_line=25,
    severity="critical",
    category="security",
    title="Hardcoded AWS Access Key",
    description="Found embedded AWS access key.",
    rule_id="SEC-AWS-001",
    analyzer="security_secrets",
    confidence="confirmed",
    remediation="Move credentials to environment variables.",
    code_excerpt="25: aws_key = 'AKIAIOSFODNN7EXAMPLE'",
    status="open",
    verification_status="not_run",
)

SAMPLE_FILES = {
    "src/api/auth.ts": (
        "import axios from 'axios';\n"
        "export async function loginUser(email: string) {\n"
        "  // Sensitive secret in comment: ghp_123456789012345678901234567890123456\n"
        "  return fetch('/api/login', {\n"
        "    method: 'GET',\n"
        "    body: JSON.stringify({ email })\n"
        "  });\n"
        "}\n"
    ),
    "backend/app/routes/auth.py": (
        "from fastapi import APIRouter, Depends\n"
        "from pydantic import BaseModel\n"
        "router = APIRouter()\n"
        "class LoginRequest(BaseModel):\n"
        "    email: str\n"
        "    password: str\n\n"
        "@router.post('/api/login')\n"
        "def login(payload: LoginRequest):\n"
        "    aws_key = 'AKIAIOSFODNN7EXAMPLE'\n"
        "    return {'status': 'ok'}\n"
    ),
}


@pytest.fixture(autouse=True)
def setup_storage():
    """Populate storage with a fixture scan record before tests."""
    storage.clear()
    storage.save_scan(
        scan_id="scan_test_123",
        repository="acme/platform",
        branch="main",
        commit_sha="commit12345",
        findings=[SAMPLE_FINDING_1, SAMPLE_FINDING_2],
        files=SAMPLE_FILES,
    )
    yield
    storage.clear()


def test_diagnose_scan_not_found():
    response = client.post(
        "/api/repositories/acme/platform/diagnose",
        json={"scan_id": "nonexistent_scan_id", "finding_ids": []},
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "SCAN_NOT_FOUND"


def test_diagnose_scan_repository_mismatch():
    response = client.post(
        "/api/repositories/other/repo/diagnose",
        json={"scan_id": "scan_test_123", "finding_ids": []},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "SCAN_REPOSITORY_MISMATCH"


def test_diagnose_invalid_finding_ids():
    response = client.post(
        "/api/repositories/acme/platform/diagnose",
        json={"scan_id": "scan_test_123", "finding_ids": ["fnd_999999999999"]},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_FINDING_IDS"


def test_diagnose_deterministic_fallback_when_unconfigured():
    """When OpenAI API key is missing or blank, system falls back to deterministic analysis with clear limitation notes."""
    with patch.object(LLMProvider, "is_configured", False):
        response = client.post(
            "/api/repositories/acme/platform/diagnose",
            json={"scan_id": "scan_test_123", "finding_ids": [SAMPLE_FINDING_1.id]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["completed", "inconclusive"]
        assert data["repository"] == "acme/platform"
        assert len(data["root_causes"]) >= 1
        assert any("OpenAI API key is not configured" in lim for lim in data["limitations"])


@pytest.mark.asyncio
async def test_diagnose_with_mocked_llm():
    """Verifies end-to-end diagnosis parsing when OpenAI returns a structured response."""
    mock_payload = LLMDiagnosisPayload(
        summary="API contract method mismatch leads to unhandled runtime failures in authentication flow.",
        root_causes=[
            LLMRootCauseOutput(
                title="HTTP Method and Payload Inconsistency",
                explanation="Frontend initiates GET request with payload body, while backend route expects POST with password.",
                confidence="high",
                assumptions=["No API gateway URL rewriting in effect."],
                recommended_actions=["Align frontend client method to POST and include password field."],
            )
        ],
    )

    with patch.object(LLMProvider, "is_configured", True), \
         patch.object(LLMProvider, "generate_structured", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_payload

        response = client.post(
            "/api/repositories/acme/platform/diagnose",
            json={"scan_id": "scan_test_123", "finding_ids": [SAMPLE_FINDING_1.id]},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["summary"] == mock_payload.summary
        assert len(data["root_causes"]) == 1
        assert data["root_causes"][0]["title"] == "HTTP Method and Payload Inconsistency"
        assert data["root_causes"][0]["confidence"] == "high"


def test_diagnose_llm_timeout_graceful_handling():
    """Verifies that an LLM timeout is gracefully handled without 500 crashes, providing fallback insights."""
    with patch.object(LLMProvider, "is_configured", True), \
         patch.object(LLMProvider, "generate_structured", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = LLMTimeoutError("Request timed out after 30s")

        response = client.post(
            "/api/repositories/acme/platform/diagnose",
            json={"scan_id": "scan_test_123", "finding_ids": []},
        )
        assert response.status_code == 200
        data = response.json()
        assert any("timed out" in lim for lim in data["limitations"])
        assert len(data["root_causes"]) >= 1


def test_cross_layer_endpoint_and_relationships():
    """Verifies /diagnose/cross-layer detects method and payload mismatches between frontend and backend."""
    response = client.post(
        "/api/repositories/acme/platform/diagnose/cross-layer",
        json={"scan_id": "scan_test_123"},
    )
    assert response.status_code == 200
    data = response.json()
    relationships = data["relationships"]
    assert len(relationships) >= 1

    # Check for HTTP method mismatch
    method_mismatch = any(
        "HTTP Method Mismatch" in r["evidence"]
        for r in relationships
    )
    assert method_mismatch, "Should detect HTTP Method Mismatch between GET and POST"


def test_secret_redaction_in_context_builder():
    """Verifies that secrets embedded in comments or strings are redacted before building LLM prompt context."""
    cb = ContextBuilder()
    context = cb.build_context(
        repository="acme/platform",
        commit_sha="commit12345",
        findings=[SAMPLE_FINDING_1],
        files=SAMPLE_FILES,
    )
    assert len(context.findings_contexts) == 1
    snippet = context.findings_contexts[0].enclosing_snippet
    assert "ghp_123456789012345678901234567890123456" not in snippet
    assert "[REDACTED_GITHUB_TOKEN]" in snippet


def test_remediation_planner_priority_ordering():
    """Verifies that cross-layer contract mismatches and critical security issues are prioritized first."""
    planner = RemediationPlanner()
    analyzer = CrossLayerAnalyzer()
    relationships = analyzer.analyze_cross_layer(SAMPLE_FILES, [SAMPLE_FINDING_1, SAMPLE_FINDING_2])

    steps = planner.plan_remediation(
        findings=[SAMPLE_FINDING_1, SAMPLE_FINDING_2],
        root_causes=[],
        relationships=relationships,
    )
    assert len(steps) >= 2
    # First step should be contract mismatch or critical security
    first_step = steps[0]
    assert first_step.priority_label in ["Investigate first", "High priority"]
    assert ("Mismatch" in first_step.title or "Security" in first_step.title)


def test_list_and_get_diagnosis():
    """Tests GET /api/repositories/{owner}/{repo}/diagnoses and GET /api/diagnoses/{id}."""
    # First run a diagnosis
    diag_res = client.post(
        "/api/repositories/acme/platform/diagnose",
        json={"scan_id": "scan_test_123", "finding_ids": []},
    )
    assert diag_res.status_code == 200
    diag_id = diag_res.json()["diagnosis_id"]

    # Test list endpoint
    list_res = client.get("/api/repositories/acme/platform/diagnoses")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["repository"] == "acme/platform"
    assert any(d["diagnosis_id"] == diag_id for d in list_data["diagnoses"])

    # Test get by ID endpoint
    get_res = client.get(f"/api/diagnoses/{diag_id}")
    assert get_res.status_code == 200
    assert get_res.json()["diagnosis_id"] == diag_id

    # Test get nonexistent
    not_found_res = client.get("/api/diagnoses/diag_nonexistent")
    assert not_found_res.status_code == 404

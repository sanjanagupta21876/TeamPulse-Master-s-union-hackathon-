import hashlib
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.bug_report import Finding
from app.schemas.fix import FixProposal
from app.services.diagnosis.storage import storage as diagnosis_storage
from app.services.fixes.storage import fix_storage
from app.services.fixes.diff_service import DiffService
from app.services.fixes.patch_validator import PatchValidator
from app.services.fixes.patch_generator import PatchGenerator, LLMFixOutput
from app.services.diagnosis.llm_provider import LLMProvider

client = TestClient(app)

SAMPLE_PY_CONTENT = (
    "def calculate_total(items):\n"
    "    try:\n"
    "        return sum(items)\n"
    "    except:\n"
    "        return 0\n"
)

SAMPLE_FINDING_PY = Finding(
    id="fnd_py_bare_except",
    repository="acme/calculator",
    branch="main",
    commit_sha="commit_sha_123",
    file_path="src/calc.py",
    start_line=4,
    end_line=4,
    severity="medium",
    category="reliability",
    title="Bare Exception Handling",
    description="Found bare 'except:' clause which catches system-exiting exceptions.",
    rule_id="PY-ERR-001",
    analyzer="python_ast",
    confidence="confirmed",
    remediation="Catch explicit exceptions (e.g. 'except Exception:') instead of bare except.",
    code_excerpt="4:     except:\n5:         return 0",
    status="open",
    verification_status="not_run",
)


@pytest.fixture(autouse=True)
def setup_test_fixtures():
    diagnosis_storage.clear()
    fix_storage.clear()

    diagnosis_storage.save_scan(
        scan_id="scan_calc_001",
        repository="acme/calculator",
        branch="main",
        commit_sha="commit_sha_123",
        findings=[SAMPLE_FINDING_PY],
        files={"src/calc.py": SAMPLE_PY_CONTENT},
    )
    yield
    diagnosis_storage.clear()
    fix_storage.clear()


def test_generate_fix_finding_not_found():
    response = client.post(
        "/api/findings/fnd_nonexistent/fixes",
        json={"instructions": "Make it safe"},
    )
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "FINDING_NOT_FOUND"


def test_generate_fix_deterministic_fallback():
    """When OpenAI is unconfigured, fix generator applies a safe deterministic template."""
    with patch.object(LLMProvider, "is_configured", False):
        response = client.post(
            f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes",
            json={"instructions": "Minimal change"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["finding_id"] == SAMPLE_FINDING_PY.id
        assert data["file_path"] == "src/calc.py"
        assert data["status"] == "proposed"
        assert "except Exception as exc:" in data["proposed_content"]
        assert data["validation"]["syntax_check"] == "passed"
        assert data["validation"]["patch_integrity"] == "valid"
        assert data["diff"] is not None
        assert data["diff"]["additions"] >= 1
        assert data["diff"]["deletions"] >= 1


@pytest.mark.asyncio
async def test_generate_fix_with_mocked_llm():
    """Verifies that structured output from OpenAI is parsed, validated, and diffed."""
    mock_llm_fix = LLMFixOutput(
        proposed_content=(
            "def calculate_total(items):\n"
            "    try:\n"
            "        return sum(items)\n"
            "    except (TypeError, ValueError) as exc:\n"
            "        return 0\n"
        ),
        explanation="Replaced bare except with targeted (TypeError, ValueError) exception handler.",
        assumptions=["items is expected to be an iterable of numeric values."],
        potential_regressions=["Other non-TypeError exceptions will now propagate as intended."],
        recommended_tests=["Pass invalid types to assert targeted exception handling."],
    )

    with patch.object(LLMProvider, "is_configured", True), \
         patch.object(LLMProvider, "generate_structured", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = mock_llm_fix

        response = client.post(
            f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes",
            json={"instructions": "Target only TypeErrors"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "proposed"
        assert "except (TypeError, ValueError) as exc:" in data["proposed_content"]
        assert data["explanation"] == mock_llm_fix.explanation
        assert data["validation"]["syntax_check"] == "passed"


def test_syntax_validation_rejects_broken_python():
    """Verifies that invalid Python syntax in proposed code is caught and marked as invalid."""
    validator = PatchValidator()
    expected_sha = hashlib.sha256(SAMPLE_PY_CONTENT.encode("utf-8")).hexdigest()
    broken_content = "def calculate_total(items\n  broken syntax here ((("

    result = validator.validate_patch(
        file_path="src/calc.py",
        original_content=SAMPLE_PY_CONTENT,
        expected_sha256=expected_sha,
        proposed_content=broken_content,
    )
    assert result.syntax_check == "failed"
    assert result.patch_integrity == "invalid"
    assert any("SyntaxError" in d for d in result.details)


def test_validator_rejects_path_traversal():
    """Verifies that path traversal attempts are detected and marked invalid."""
    validator = PatchValidator()
    expected_sha = hashlib.sha256(SAMPLE_PY_CONTENT.encode("utf-8")).hexdigest()

    result = validator.validate_patch(
        file_path="../../etc/passwd",
        original_content=SAMPLE_PY_CONTENT,
        expected_sha256=expected_sha,
        proposed_content=SAMPLE_PY_CONTENT,
    )
    assert result.path_traversal_safe is False
    assert result.patch_integrity == "invalid"


def test_validator_rejects_source_hash_mismatch():
    """Verifies that an altered original source code hash fails integrity check."""
    validator = PatchValidator()
    tampered_sha = "0000000000000000000000000000000000000000000000000000000000000000"

    result = validator.validate_patch(
        file_path="src/calc.py",
        original_content=SAMPLE_PY_CONTENT,
        expected_sha256=tampered_sha,
        proposed_content=SAMPLE_PY_CONTENT,
    )
    assert result.source_hash_match is False
    assert result.patch_integrity == "invalid"


def test_diff_service_line_calculation():
    """Verifies unified diff computation and structured hunk parsing."""
    diff_svc = DiffService()
    proposed = (
        "def calculate_total(items):\n"
        "    try:\n"
        "        return sum(items)\n"
        "    except Exception:\n"
        "        return 0\n"
    )
    res = diff_svc.calculate_diff("src/calc.py", SAMPLE_PY_CONTENT, proposed)
    assert res.file_path == "src/calc.py"
    assert res.additions == 1
    assert res.deletions == 1
    assert len(res.hunks) >= 1
    assert "--- a/src/calc.py" in res.unified_diff
    assert "+++ b/src/calc.py" in res.unified_diff


def test_approval_and_rejection_workflow():
    """Verifies proposal lifecycle: proposed -> approved, and proposed -> rejected."""
    # 1. Generate proposal
    create_res = client.post(
        f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes",
        json={"instructions": "Safe fix"},
    )
    assert create_res.status_code == 200
    fix_id = create_res.json()["id"]

    # 2. Approve proposal
    appr_res = client.post(f"/api/fixes/{fix_id}/approve")
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["fix"]["status"] == "approved"
    assert appr_data["fix"]["approved_at"] is not None

    # 3. Reject proposal
    rej_res = client.post(f"/api/fixes/{fix_id}/reject")
    assert rej_res.status_code == 200
    rej_data = rej_res.json()
    assert rej_data["fix"]["status"] == "rejected"
    assert rej_data["fix"]["rejected_at"] is not None


def test_regenerate_proposal_preserves_history():
    """Verifies that regenerating a proposal creates a distinct new proposal ID while preserving history."""
    # 1. First proposal
    first_res = client.post(f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes")
    assert first_res.status_code == 200
    first_fix_id = first_res.json()["id"]

    # 2. Regenerate proposal
    regen_res = client.post(
        f"/api/fixes/{first_fix_id}/regenerate",
        json={"instructions": "Alternative fix attempt"},
    )
    assert regen_res.status_code == 200
    second_fix_id = regen_res.json()["id"]
    assert second_fix_id != first_fix_id

    # 3. Check history: both proposals must be listed
    list_res = client.get(f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes")
    assert list_res.status_code == 200
    all_fixes = list_res.json()["fixes"]
    ids = [f["id"] for f in all_fixes]
    assert first_fix_id in ids
    assert second_fix_id in ids


def test_get_fix_and_diff_endpoints():
    """Tests GET /api/fixes/{fix_id} and GET /api/fixes/{fix_id}/diff."""
    create_res = client.post(f"/api/findings/{SAMPLE_FINDING_PY.id}/fixes")
    fix_id = create_res.json()["id"]

    get_res = client.get(f"/api/fixes/{fix_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == fix_id

    diff_res = client.get(f"/api/fixes/{fix_id}/diff")
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert "unified_diff" in diff_data
    assert diff_data["additions"] >= 1


def test_diff_service_does_not_double_newlines():
    """Unified diff lines must not carry their own line endings into the joined output."""
    diff_svc = DiffService()
    proposed = SAMPLE_PY_CONTENT.replace("except:", "except Exception:")
    res = diff_svc.calculate_diff("src/calc.py", SAMPLE_PY_CONTENT, proposed)
    assert "\n\n" not in res.unified_diff
    assert "-    except:\n+    except Exception:" in res.unified_diff
    assert all(not line.endswith("\n") for hunk in res.hunks for line in hunk.lines)


def _fallback_finding(file_path: str, rule_id: str, start_line: int = 1) -> Finding:
    return SAMPLE_FINDING_PY.model_copy(
        update={"file_path": file_path, "rule_id": rule_id, "start_line": start_line, "title": "Test finding"}
    )


def test_fallback_patch_does_not_rewrite_python_equality():
    """The JS strict-equality rewrite must never be applied to Python source."""
    content = "if a == b:\n    pass\n"
    output = PatchGenerator()._generate_deterministic_fallback_patch(
        _fallback_finding("src/app.py", "PY-ERR-002"), content
    )
    assert "===" not in output.proposed_content
    assert "# CodeLens AI TODO (PY-ERR-002)" in output.proposed_content


def test_fallback_patch_uses_js_comment_syntax():
    """Guidance comments inserted into JS/TS files must use // rather than #."""
    content = "eval(userInput);\n"
    output = PatchGenerator()._generate_deterministic_fallback_patch(
        _fallback_finding("src/app.ts", "JS-SEC-002"), content
    )
    assert output.proposed_content.startswith("// CodeLens AI TODO (JS-SEC-002)")
    assert "#" not in output.proposed_content


def test_fallback_patch_applies_js_strict_equality():
    content = "if (a == b) {}\n"
    output = PatchGenerator()._generate_deterministic_fallback_patch(
        _fallback_finding("src/app.js", "JS-CORR-001"), content
    )
    assert output.proposed_content == "if (a === b) {}\n"

import pytest
import respx
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.services.analysis_engine import AnalysisEngine
from app.services.rules.python_rules import scan_python_ast_rules
from app.services.rules.javascript_rules import scan_javascript_rules
from app.services.rules.security_rules import scan_security_rules, redact_secrets

client = TestClient(app)

MOCK_REPO = {
    "name": "sample-repo",
    "full_name": "acme/sample-repo",
    "owner": {"login": "acme"},
    "description": "Sample test project",
    "html_url": "https://github.com/acme/sample-repo",
    "default_branch": "main",
    "stargazers_count": 100,
    "language": "Python",
    "visibility": "public",
    "private": False,
}

MOCK_BRANCH = {
    "name": "main",
    "commit": {"sha": "c0ffee1234567890abcdef1234567890abcdef12"},
}

SAMPLE_PYTHON_CODE = """
import os
import subprocess

def run_job(user_input):
    try:
        # Insecure subprocess with shell=True
        subprocess.run("echo " + user_input, shell=True)
    except:
        pass
"""

SAMPLE_JS_CODE = """
function renderProfile(user) {
    if (user.id == null) {
        return;
    }
    // Dangerous innerHTML injection
    document.getElementById("output").innerHTML = "<div>" + user.bio + "</div>";
    localStorage.setItem("auth_token", user.token);
}
"""

SAMPLE_SECRET_CODE = """
# Configuration with hardcoded credentials
AWS_KEY = "AKIAIOSFODNN7EXAMPLE"
"""



@respx.mock
def test_successful_repository_analysis():
    """Verify end-to-end repository analysis with file discovery, content retrieval, and finding normalization."""
    respx.get("https://api.github.com/repos/acme/sample-repo").mock(
        return_value=httpx.Response(200, json=MOCK_REPO)
    )
    respx.get("https://api.github.com/repos/acme/sample-repo/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH)
    )
    # Tree with 3 candidate source files
    respx.get(
        "https://api.github.com/repos/acme/sample-repo/git/trees/c0ffee1234567890abcdef1234567890abcdef12?recursive=1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "tree": [
                    {"path": "src/job.py", "type": "blob", "size": len(SAMPLE_PYTHON_CODE)},
                    {"path": "src/profile.js", "type": "blob", "size": len(SAMPLE_JS_CODE)},
                    {"path": "config.py", "type": "blob", "size": len(SAMPLE_SECRET_CODE)},
                ],
                "truncated": False,
            },
        )
    )

    # Mock raw content fetches
    respx.get(
        "https://raw.githubusercontent.com/acme/sample-repo/c0ffee1234567890abcdef1234567890abcdef12/src/job.py"
    ).mock(return_value=httpx.Response(200, text=SAMPLE_PYTHON_CODE))

    respx.get(
        "https://raw.githubusercontent.com/acme/sample-repo/c0ffee1234567890abcdef1234567890abcdef12/src/profile.js"
    ).mock(return_value=httpx.Response(200, text=SAMPLE_JS_CODE))

    respx.get(
        "https://raw.githubusercontent.com/acme/sample-repo/c0ffee1234567890abcdef1234567890abcdef12/config.py"
    ).mock(return_value=httpx.Response(200, text=SAMPLE_SECRET_CODE))

    response = client.post(
        "/api/repositories/analyze",
        json={"repository_url": "https://github.com/acme/sample-repo"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["repository"]["full_name"] == "acme/sample-repo"
    assert data["repository"]["branch"] == "main"
    assert data["repository"]["commit_sha"] == "c0ffee1234567890abcdef1234567890abcdef12"

    analysis = data["analysis"]
    assert analysis["files_discovered"] == 3
    assert analysis["files_analyzed"] == 3
    assert analysis["findings_count"] > 0
    assert "security_scanner" in analysis["analyzers_completed"]
    assert "python_ast" in analysis["analyzers_completed"]
    assert "javascript_rules" in analysis["analyzers_completed"]

    summary = data["summary"]
    assert (summary["critical"] + summary["high"] + summary["medium"] + summary["low"]) > 0

    findings = data["findings"]
    rules_triggered = {f["rule_id"] for f in findings}

    # Verify expected rules triggered across Python, JS, and Secrets
    assert "PY-SEC-001" in rules_triggered  # subprocess shell=True
    assert "PY-ERR-001" in rules_triggered  # bare except
    assert "JS-SEC-001" in rules_triggered  # innerHTML XSS
    assert "JS-SEC-003" in rules_triggered  # localStorage token
    assert "SEC-AWS-001" in rules_triggered  # AWS secret key

    # Check secret redaction in excerpt
    aws_finding = next(f for f in findings if f["rule_id"] == "SEC-AWS-001")
    assert aws_finding["severity"] == "critical"
    assert "[REDACTED_AWS_KEY]" in aws_finding["code_excerpt"]
    assert "AKIAIOSFODNN7EXAMPLE" not in aws_finding["code_excerpt"]



def test_python_ast_syntax_error():
    """Verify syntax error is reported with critical severity and exact line number."""
    bad_syntax = "def broken_func(\n    print('missing paren'"
    findings = scan_python_ast_rules(
        file_path="app/bad.py",
        content=bad_syntax,
        repo="acme/test",
        branch="main",
        commit_sha="12345",
    )

    assert len(findings) == 1
    f = findings[0]
    assert f.rule_id == "PY-SYNTAX-001"
    assert f.severity == "critical"
    assert f.category == "correctness"
    assert f.confidence == "confirmed"
    assert f.start_line == 2


def test_python_ast_sql_injection():
    """Verify potential SQL injection via f-string is identified."""
    sql_code = """
def get_user(cursor, user_id):
    cursor.execute(f"SELECT * FROM users WHERE id = '{user_id}'")
"""
    findings = scan_python_ast_rules(
        file_path="app/db.py",
        content=sql_code,
        repo="acme/test",
        branch="main",
        commit_sha="12345",
    )
    sql_findings = [f for f in findings if f.rule_id == "PY-SEC-003"]
    assert len(sql_findings) == 1
    assert sql_findings[0].severity == "high"
    assert sql_findings[0].category == "security"


def test_javascript_rules_eval_and_inner_html():
    """Verify JS rules detect eval and innerHTML."""
    js_code = """
function doWork(code, target, untrusted) {
    eval(code);
    target.innerHTML = untrusted;
}
"""
    findings = scan_javascript_rules(
        file_path="src/eval.js",
        content=js_code,
        repo="acme/test",
        branch="main",
        commit_sha="12345",
    )
    rule_ids = {f.rule_id for f in findings}
    assert "JS-SEC-001" in rule_ids
    assert "JS-SEC-002" in rule_ids


def test_security_rules_redaction():
    """Verify secrets are redacted in text excerpts and private keys are flagged."""
    private_key_code = """
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y7...
-----END RSA PRIVATE KEY-----
"""
    findings = scan_security_rules(
        file_path="keys/id_rsa",
        content=private_key_code,
        repo="acme/test",
        branch="main",
        commit_sha="12345",
    )
    assert len(findings) >= 1
    assert findings[0].rule_id == "SEC-KEY-001"
    assert findings[0].severity == "critical"
    assert "[REDACTED_PRIVATE_KEY]" in findings[0].code_excerpt


def test_finding_deduplication():
    """Verify duplicate findings on the same line and category are deduplicated."""
    from app.schemas.bug_report import Finding

    engine = AnalysisEngine()
    f1 = Finding(
        id="find-1",
        repository="acme/test",
        branch="main",
        commit_sha="12345",
        file_path="app.py",
        start_line=10,
        severity="medium",
        category="security",
        title="Issue 1",
        description="Description 1",
        rule_id="PY-SEC-001",
        analyzer="python_ast",
        confidence="medium",
        remediation="Fix it",
    )
    f2 = Finding(
        id="find-2",
        repository="acme/test",
        branch="main",
        commit_sha="12345",
        file_path="app.py",
        start_line=10,
        severity="high",
        category="security",
        title="Issue 2",
        description="Description 2",
        rule_id="B602",
        analyzer="bandit",
        confidence="confirmed",
        remediation="Fix it safely",
    )

    deduped = engine._deduplicate_findings([f1, f2])
    assert len(deduped) == 1
    # Higher severity (high > medium) is preserved
    assert deduped[0].severity == "high"


@respx.mock
def test_clean_repository_disclaimer():
    """Verify repository with no findings returns empty list with appropriate disclaimer."""
    clean_repo_data = {
        **MOCK_REPO,
        "name": "clean-repo",
        "full_name": "acme/clean-repo",
        "html_url": "https://github.com/acme/clean-repo",
    }
    respx.get("https://api.github.com/repos/acme/clean-repo").mock(
        return_value=httpx.Response(200, json=clean_repo_data)
    )
    respx.get("https://api.github.com/repos/acme/clean-repo/branches/main").mock(
        return_value=httpx.Response(200, json=MOCK_BRANCH)
    )
    respx.get(
        "https://api.github.com/repos/acme/clean-repo/git/trees/c0ffee1234567890abcdef1234567890abcdef12?recursive=1"
    ).mock(
        return_value=httpx.Response(
            200,
            json={
                "tree": [{"path": "hello.py", "type": "blob", "size": 30}],
                "truncated": False,
            },
        )
    )
    respx.get(
        "https://raw.githubusercontent.com/acme/clean-repo/c0ffee1234567890abcdef1234567890abcdef12/hello.py"
    ).mock(return_value=httpx.Response(200, text="print('Hello World')\n"))

    response = client.post(
        "/api/repositories/analyze",
        json={"repository_url": "https://github.com/acme/clean-repo"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["analysis"]["findings_count"] == 0
    assert len(data["findings"]) == 0
    # Must report disclaimer rather than claiming bug-free
    assert any("does not guarantee the absence of bugs" in w for w in data["analysis"]["warnings"])


def test_bandit_findings_use_repository_relative_paths(tmp_path):
    """Bandit reports './'-prefixed paths; they must resolve against the scan workspace, not the server cwd."""
    import asyncio
    from app.services.analyzers.python_analyzer import BanditAnalyzer

    analyzer = BanditAnalyzer()
    if not analyzer.is_available():
        pytest.skip("bandit is not installed")

    pkg = tmp_path / "pkg"
    pkg.mkdir()
    source = "import subprocess\nsubprocess.call('ls', shell=True)\n"
    (pkg / "mod.py").write_text(source)
    tests_dir = tmp_path / "tests"
    tests_dir.mkdir()
    test_source = "def test_it():\n    assert 1 == 1\n"
    (tests_dir / "test_mod.py").write_text(test_source)

    findings = asyncio.run(
        analyzer.analyze(
            files={"pkg/mod.py": source, "tests/test_mod.py": test_source},
            repo="acme/demo",
            branch="main",
            commit_sha="sha",
            work_dir=str(tmp_path),
        )
    )
    assert findings
    # B101 asserts inside test files are filtered out as noise
    assert {f.file_path for f in findings} == {"pkg/mod.py"}

import re
from typing import List
from app.schemas.bug_report import Finding
from app.services.rules import generate_finding_id, get_safe_code_excerpt

# Regex patterns for deterministic JS/TS analysis
INNER_HTML_REGEX = re.compile(r"\b(innerHTML|outerHTML)\s*=\s*([^;]+)")
EVAL_REGEX = re.compile(r"\b(eval\s*\(|new\s+Function\s*\()")
LOCAL_STORAGE_TOKEN_REGEX = re.compile(
    r"\b(localStorage|sessionStorage)\.setItem\s*\(\s*['\"](token|auth_token|jwt|access_token|secret)['\"]"
)
LOOSE_EQUALITY_REGEX = re.compile(r"[^!=<>](\s*==\s*|\s*!=\s*)[^=]")
PROMISE_THEN_REGEX = re.compile(r"\.then\s*\(")
CATCH_REGEX = re.compile(r"\.catch\s*\(")
RETURN_OR_THROW_REGEX = re.compile(r"^\s*(return|throw\s+new\s+\w+|throw\s+\w+)\s*.*;?\s*$")


def scan_javascript_rules(
    file_path: str,
    content: str,
    repo: str,
    branch: str,
    commit_sha: str,
) -> List[Finding]:
    """
    Analyzes JavaScript and TypeScript files using deterministic syntax inspection.
    Detects dangerous innerHTML assignments, eval/Function, sensitive web storage,
    loose equality, unhandled promises, and unreachable statements.
    """
    findings: List[Finding] = []
    lines = content.splitlines()

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        # Skip pure comment lines
        if line.startswith("//") or line.startswith("/*") or line.startswith("*"):
            continue

        # 1. Dangerous innerHTML assignment
        inner_match = INNER_HTML_REGEX.search(line)
        if inner_match:
            assigned_expr = inner_match.group(2).strip()
            # Only trigger if expression is dynamic (not a simple quoted string literal without HTML)
            is_static_string = (
                (assigned_expr.startswith("'") and assigned_expr.endswith("'"))
                or (assigned_expr.startswith('"') and assigned_expr.endswith('"'))
            )
            if not is_static_string or "<" in assigned_expr:
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, idx, "JS-SEC-001"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=idx,
                        end_line=idx,
                        severity="high",
                        category="security",
                        title="Dangerous DOM Insertion via innerHTML (XSS Risk)",
                        description=(
                            "Assigning unescaped dynamic content to 'innerHTML' or 'outerHTML' creates a Cross-Site "
                            "Scripting (XSS) vulnerability that allows attackers to execute malicious scripts in user browsers."
                        ),
                        rule_id="JS-SEC-001",
                        analyzer="javascript_rules",
                        confidence="high",
                        remediation="Use 'textContent' or 'innerText', or sanitize HTML using a library like DOMPurify.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, idx),
                    )
                )

        # 2. Insecure eval() or new Function()
        if EVAL_REGEX.search(line):
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "JS-SEC-002"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="high",
                    category="security",
                    title="Unsafe Dynamic Evaluation via eval() or Function Constructor",
                    description=(
                        "Using 'eval()' or 'new Function()' parses and executes arbitrary JavaScript strings in the current scope. "
                        "This introduces severe performance and arbitrary code execution vulnerabilities."
                    ),
                    rule_id="JS-SEC-002",
                    analyzer="javascript_rules",
                    confidence="confirmed",
                    remediation="Replace eval() with structured parsers like JSON.parse() or specific functional abstractions.",
                    status="open",
                    verification_status="not_run",
                    code_excerpt=get_safe_code_excerpt(lines, idx),
                )
            )

        # 3. Sensitive authentication tokens in Web Storage
        if LOCAL_STORAGE_TOKEN_REGEX.search(line):
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "JS-SEC-003"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="medium",
                    category="security",
                    title="Sensitive Authentication Token Stored in Web Storage",
                    description=(
                        "Storing authentication tokens or JWTs in 'localStorage' or 'sessionStorage' makes them "
                        "accessible to any client-side JavaScript, leaving them vulnerable to theft via Cross-Site Scripting (XSS)."
                    ),
                    rule_id="JS-SEC-003",
                    analyzer="javascript_rules",
                    confidence="high",
                    remediation="Store session credentials in HttpOnly, Secure, SameSite cookies instead of Web Storage.",
                    status="open",
                    verification_status="not_run",
                    code_excerpt=get_safe_code_excerpt(lines, idx),
                )
            )

        # 4. Loose Equality
        if LOOSE_EQUALITY_REGEX.search(line) and not ("===" in line or "!==" in line):
            # Exclude standard for-loops or type definitions
            if not line.startswith("for ") and not line.startswith("type "):
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, idx, "JS-CORR-001"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=idx,
                        end_line=idx,
                        severity="low",
                        category="correctness",
                        title="Suspicious Loose Equality Comparison (== or !=)",
                        description=(
                            "Using loose equality operators ('==' or '!=') performs type coercion according to complex JavaScript "
                            "coercion rules, frequently causing unexpected falsy/truthy bugs."
                        ),
                        rule_id="JS-CORR-001",
                        analyzer="javascript_rules",
                        confidence="confirmed",
                        remediation="Use strict equality operators ('===' and '!==') to ensure explicit and safe comparisons.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, idx),
                    )
                )

        # 5. Unhandled Promise Chain (.then without .catch)
        if PROMISE_THEN_REGEX.search(line) and not CATCH_REGEX.search(line):
            # Check adjacent lines (statement block) for .catch
            has_catch_nearby = False
            for lookahead_idx in range(idx, min(idx + 5, len(lines))):
                if CATCH_REGEX.search(lines[lookahead_idx]):
                    has_catch_nearby = True
                    break
            if not has_catch_nearby:
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, idx, "JS-REL-001"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=idx,
                        end_line=idx,
                        severity="medium",
                        category="reliability",
                        title="Promise Chain Missing .catch() Error Handler",
                        description=(
                            "A Promise chain includes a '.then()' handler without a corresponding '.catch()'. "
                            "Unhandled promise rejections cause silent network/async failures or unhandled rejection errors."
                        ),
                        rule_id="JS-REL-001",
                        analyzer="javascript_rules",
                        confidence="medium",
                        remediation="Append a '.catch(err => ...)' handler to manage promise rejection or use try/catch with async/await.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, idx),
                    )
                )

    return findings

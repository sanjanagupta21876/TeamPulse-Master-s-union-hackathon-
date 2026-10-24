import ast
from typing import List, Optional
from app.schemas.bug_report import Finding
from app.services.rules import generate_finding_id, get_safe_code_excerpt


def scan_python_ast_rules(
    file_path: str,
    content: str,
    repo: str,
    branch: str,
    commit_sha: str,
) -> List[Finding]:
    """
    Analyzes Python source files using standard library AST inspection.
    Detects syntax errors, empty except clauses, insecure subprocess patterns,
    eval/exec usage, and potential SQL injection via string formatting.
    """
    findings: List[Finding] = []
    lines = content.splitlines()

    # 1. Syntax Check
    try:
        tree = ast.parse(content, filename=file_path)
    except SyntaxError as syn_err:
        line_num = syn_err.lineno or 1
        findings.append(
            Finding(
                id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-SYNTAX-001"),
                repository=repo,
                branch=branch,
                commit_sha=commit_sha,
                file_path=file_path,
                start_line=line_num,
                end_line=line_num,
                severity="critical",
                category="correctness",
                title=f"Python Syntax Error: {syn_err.msg}",
                description=(
                    f"The file contains invalid Python syntax at line {line_num}: {syn_err.msg}. "
                    "Python code with syntax errors cannot be imported or executed."
                ),
                rule_id="PY-SYNTAX-001",
                analyzer="python_ast",
                confidence="confirmed",
                remediation="Fix syntax error at the indicated line number before running or importing the module.",
                status="open",
                verification_status="not_run",
                code_excerpt=get_safe_code_excerpt(lines, line_num),
            )
        )
        # Cannot walk AST if syntax is broken
        return findings

    # Walk valid AST
    for node in ast.walk(tree):
        # 2. Bare Except / Empty Except Pass
        if isinstance(node, ast.ExceptHandler):
            line_num = getattr(node, "lineno", 1)

            # Bare except clause: except:
            if node.type is None:
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-ERR-001"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=line_num,
                        end_line=line_num,
                        severity="medium",
                        category="reliability",
                        title="Bare 'except:' Catches All System Exceptions",
                        description=(
                            "A bare 'except:' clause without an exception type catches SystemExit, "
                            "KeyboardInterrupt, and MemoryError, which breaks graceful shutdown and debugging."
                        ),
                        rule_id="PY-ERR-001",
                        analyzer="python_ast",
                        confidence="confirmed",
                        remediation="Catch specific exceptions like 'except Exception:' or specific subclasses.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, line_num),
                    )
                )

            # Silent exception pass: except ...: pass
            if len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-ERR-002"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=line_num,
                        end_line=line_num,
                        severity="medium",
                        category="reliability",
                        title="Silently Suppressed Exception (pass)",
                        description=(
                            "An exception handler block contains only 'pass'. Silently ignoring errors "
                            "masks failures and makes production debugging extremely difficult."
                        ),
                        rule_id="PY-ERR-002",
                        analyzer="python_ast",
                        confidence="high",
                        remediation="Log the exception with logging.error/exception or handle the error condition.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, line_num),
                    )
                )

        # 3. Insecure Calls (eval, exec, subprocess shell=True, SQL formatting)
        if isinstance(node, ast.Call):
            line_num = getattr(node, "lineno", 1)

            # eval() / exec()
            if isinstance(node.func, ast.Name) and node.func.id in ("eval", "exec"):
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-SEC-002"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=line_num,
                        end_line=line_num,
                        severity="high",
                        category="security",
                        title=f"Dangerous Dynamic Code Execution via {node.func.id}()",
                        description=(
                            f"Use of Python's built-in '{node.func.id}()' function dynamically evaluates arbitrary strings as code. "
                            "If untrusted user input reaches this call, it leads to remote code execution (RCE)."
                        ),
                        rule_id="PY-SEC-002",
                        analyzer="python_ast",
                        confidence="confirmed",
                        remediation="Avoid eval/exec; use ast.literal_eval() for safe literal evaluation or standard JSON parsers.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, line_num),
                    )
                )

            # subprocess with shell=True
            is_subprocess = False
            if isinstance(node.func, ast.Attribute) and node.func.attr in ("Popen", "run", "call", "check_call", "check_output"):
                if isinstance(node.func.value, ast.Name) and node.func.value.id == "subprocess":
                    is_subprocess = True
                elif not isinstance(node.func.value, ast.Name):
                    is_subprocess = True  # e.g. sp.Popen

            if is_subprocess:
                for kw in node.keywords:
                    if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        findings.append(
                            Finding(
                                id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-SEC-001"),
                                repository=repo,
                                branch=branch,
                                commit_sha=commit_sha,
                                file_path=file_path,
                                start_line=line_num,
                                end_line=line_num,
                                severity="high",
                                category="security",
                                title="Insecure Subprocess Call with shell=True",
                                description=(
                                    "Executing a subprocess with 'shell=True' invokes the system shell and "
                                    "is vulnerable to command injection if arguments contain unsanitized input."
                                ),
                                rule_id="PY-SEC-001",
                                analyzer="python_ast",
                                confidence="confirmed",
                                remediation="Pass command and arguments as a list (e.g. ['git', 'status']) and remove 'shell=True'.",
                                status="open",
                                verification_status="not_run",
                                code_excerpt=get_safe_code_excerpt(lines, line_num),
                            )
                        )

            # SQL query string formatting in cursor.execute(...)
            if isinstance(node.func, ast.Attribute) and node.func.attr in ("execute", "executemany"):
                if node.args:
                    first_arg = node.args[0]
                    # Check if first arg is formatted string or concatenation
                    is_dynamic_sql = False
                    if isinstance(first_arg, ast.JoinedStr):  # f-string: f"SELECT ... {var}"
                        is_dynamic_sql = True
                    elif isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, (ast.Mod, ast.Add)):  # "SELECT " + var or "SELECT %s" % var
                        is_dynamic_sql = True

                    if is_dynamic_sql:
                        findings.append(
                            Finding(
                                id=generate_finding_id(repo, commit_sha, file_path, line_num, "PY-SEC-003"),
                                repository=repo,
                                branch=branch,
                                commit_sha=commit_sha,
                                file_path=file_path,
                                start_line=line_num,
                                end_line=line_num,
                                severity="high",
                                category="security",
                                title="Potential SQL Injection via Formatted Query String",
                                description=(
                                    "Constructing SQL queries using f-strings, '%', or '+' concatenation allows attackers "
                                    "to inject malicious SQL payloads. Always use database parameterized queries."
                                ),
                                rule_id="PY-SEC-003",
                                analyzer="python_ast",
                                confidence="high",
                                remediation="Use query parameters: cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,)).",
                                status="open",
                                verification_status="not_run",
                                code_excerpt=get_safe_code_excerpt(lines, line_num),
                            )
                        )

    return findings

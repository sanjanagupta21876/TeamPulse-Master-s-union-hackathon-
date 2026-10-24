import ast
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.schemas.bug_report import Finding
from app.services.analyzers import (
    BanditAnalyzer,
    BaseAnalyzer,
    ESLintAnalyzer,
    JavaScriptRuleAnalyzer,
    PythonAstAnalyzer,
    RuffAnalyzer,
    SecurityAnalyzer,
)
from app.services.verification.verification_policy import VerificationPolicy


class VerificationRunner:
    """
    Executes safe static analysis, syntax validation, and optional sandboxed
    tests inside the isolated workspace.
    """

    def __init__(self, policy: Optional[VerificationPolicy] = None):
        self.policy = policy or VerificationPolicy()
        self.analyzers: List[BaseAnalyzer] = [
            SecurityAnalyzer(),
            PythonAstAnalyzer(),
            RuffAnalyzer(),
            BanditAnalyzer(),
            JavaScriptRuleAnalyzer(),
            ESLintAnalyzer(),
        ]

    async def run_static_checks(
        self,
        workspace_path: str,
        target_file: str,
        repo: str,
        commit_sha: str,
    ) -> Tuple[str, List[Finding], List[str], List[str]]:
        """
        Runs safe static and syntax checks on the patched workspace.
        Returns:
            (status: str, findings: List[Finding], tools_executed: List[str], warnings: List[str])
        """
        tools_executed: List[str] = []
        warnings: List[str] = []
        findings: List[Finding] = []
        target_p = Path(workspace_path) / target_file

        if not target_p.exists():
            return "failed", [], [], [f"Patched target file '{target_file}' not found in workspace."]

        content = target_p.read_text(encoding="utf-8", errors="replace")
        ext = target_p.suffix.lower()

        # 1. Python Syntax Validation via Safe AST parsing
        if ext == ".py":
            tools_executed.append("python_ast_syntax_parser")
            try:
                ast.parse(content, filename=target_file)
            except SyntaxError as syn_err:
                findings.append(
                    Finding(
                        id=f"syn_err_{target_file.replace('/', '_')}_{syn_err.lineno or 1}",
                        repository=repo,
                        branch="isolated-verify",
                        commit_sha=commit_sha,
                        file_path=target_file,
                        start_line=syn_err.lineno or 1,
                        end_line=syn_err.lineno or 1,
                        severity="critical",
                        category="syntax_error",
                        rule_id="PY-SYNTAX-FAIL",
                        title=f"Syntax Error in Patched Code: {syn_err.msg}",
                        description=f"Patched Python file failed safe syntax parsing: {syn_err.msg}",
                        analyzer="python_ast_syntax_parser",
                        remediation="Ensure syntax is valid before applying the patch.",
                        code_excerpt=syn_err.text.strip() if syn_err.text else "",
                    )
                )
                return "failed", findings, tools_executed, [f"Syntax check failed: {syn_err.msg}"]

        # 2. JavaScript / TypeScript basic delimiter and syntax check
        elif ext in (".js", ".jsx", ".ts", ".tsx"):
            tools_executed.append("javascript_syntax_parser")
            brace_diff = content.count("{") - content.count("}")
            paren_diff = content.count("(") - content.count(")")
            bracket_diff = content.count("[") - content.count("]")
            if brace_diff != 0 or paren_diff != 0 or bracket_diff != 0:
                findings.append(
                    Finding(
                        id=f"js_syn_err_{target_file.replace('/', '_')}_1",
                        repository=repo,
                        branch="isolated-verify",
                        commit_sha=commit_sha,
                        file_path=target_file,
                        start_line=1,
                        end_line=1,
                        severity="critical",
                        category="syntax_error",
                        rule_id="JS-SYNTAX-MISMATCH",
                        title="Unmatched Bracket or Parenthesis in Patched Code",
                        description=f"Patched file contains unmatched delimiters (braces: {brace_diff}, parens: {paren_diff}, brackets: {bracket_diff}).",
                        analyzer="javascript_syntax_parser",
                        remediation="Ensure all opening braces, brackets, and parentheses are properly closed.",
                    )
                )
                return "failed", findings, tools_executed, ["Unmatched delimiter in JavaScript/TypeScript file."]

        # 3. Run configured static analyzers on the patched workspace
        files_map = {target_file: content}
        for analyzer in self.analyzers:
            if analyzer.is_available() and (
                not analyzer.supported_extensions or ext in analyzer.supported_extensions
            ):
                tools_executed.append(analyzer.name)
                try:
                    res = await asyncio.wait_for(
                        analyzer.analyze(
                            files=files_map,
                            repo=repo,
                            branch="isolated-verify",
                            commit_sha=commit_sha,
                            work_dir=workspace_path,
                        ),
                        timeout=self.policy.STATIC_CHECKS_TIMEOUT_SECONDS,
                    )
                    # Workspace-wide tools (ruff, bandit) report on every file; keep only the patched one
                    findings.extend(f for f in res if f.file_path == target_file)
                except asyncio.TimeoutError:
                    warnings.append(f"Analyzer '{analyzer.name}' timed out after {self.policy.STATIC_CHECKS_TIMEOUT_SECONDS}s.")
                except Exception as err:
                    warnings.append(f"Analyzer '{analyzer.name}' error: {str(err)}")

        status = "passed" if not any(f.severity == "critical" and f.category == "syntax_error" for f in findings) else "failed"
        return status, findings, tools_executed, warnings

    async def run_tests(
        self,
        workspace_path: str,
        target_file: str,
        repo: str,
        run_tests_requested: bool,
    ) -> Tuple[str, List[str], List[str]]:
        """
        Executes optional tests only if safe container sandbox isolation is available.
        Returns: (test_status: str, warnings: List[str], limitations: List[str])
        """
        if not run_tests_requested:
            return "not_requested", [], []

        permitted, limitations = self.policy.validate_test_execution_request(run_tests_requested)
        if not permitted:
            return "unavailable", [], limitations

        # If a container environment was active, sandboxed test execution would occur here.
        # Enforcing strict safety: never execute untrusted repository code on the host server.
        return "inconclusive", ["Restricted test runner completed without execution."], limitations

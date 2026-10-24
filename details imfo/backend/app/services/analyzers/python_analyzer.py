import asyncio
import json
import os
import shutil
import subprocess
import sys
from typing import Dict, List, Optional, Set
from app.schemas.bug_report import Finding
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.services.rules import generate_finding_id, get_safe_code_excerpt
from app.services.rules.python_rules import scan_python_ast_rules


class PythonAstAnalyzer(BaseAnalyzer):
    """Deterministic Python AST analyzer for syntax, exception patterns, subprocess, and SQL formatting."""

    name: str = "python_ast"
    supported_extensions: Set[str] = {".py", ".pyi"}

    def is_available(self) -> bool:
        return True

    async def analyze(
        self,
        files: Dict[str, str],
        repo: str,
        branch: str,
        commit_sha: str,
        work_dir: Optional[str] = None,
    ) -> List[Finding]:
        findings: List[Finding] = []
        for file_path, content in files.items():
            _, ext = os.path.splitext(file_path.lower())
            if ext in self.supported_extensions:
                file_findings = scan_python_ast_rules(
                    file_path=file_path,
                    content=content,
                    repo=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                )
                findings.extend(file_findings)
        return findings


class RuffAnalyzer(BaseAnalyzer):
    """
    Ruff static analysis tool runner.
    Parses JSON output from Ruff for Pyflakes, Bugbear, and security checks.
    """

    name: str = "ruff"
    supported_extensions: Set[str] = {".py", ".pyi"}

    def is_available(self) -> bool:
        # Check if ruff executable is in environment or PATH
        if shutil.which("ruff"):
            return True
        # Check if installed in current python environment
        try:
            res = subprocess.run(
                [sys.executable, "-m", "ruff", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            )
            return res.returncode == 0
        except Exception:
            return False

    async def analyze(
        self,
        files: Dict[str, str],
        repo: str,
        branch: str,
        commit_sha: str,
        work_dir: Optional[str] = None,
    ) -> List[Finding]:
        if not work_dir or not os.path.exists(work_dir):
            return []

        py_files = [f for f in files.keys() if f.endswith((".py", ".pyi"))]
        if not py_files:
            return []

        # Determine executable
        cmd = ["ruff"] if shutil.which("ruff") else [sys.executable, "-m", "ruff"]
        full_cmd = cmd + ["check", "--output-format", "json", "."]

        try:
            # Run in safe subprocess with strict 15-second timeout
            proc = await asyncio.create_subprocess_exec(
                *full_cmd,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        except asyncio.TimeoutError:
            raise RuntimeError("Ruff analyzer execution timed out after 15 seconds.")
        except Exception as exc:
            raise RuntimeError(f"Ruff execution failed: {str(exc)}")

        output_str = stdout.decode("utf-8", errors="replace").strip()
        if not output_str:
            return []

        try:
            raw_issues = json.loads(output_str)
        except json.JSONDecodeError:
            return []

        findings: List[Finding] = []
        for issue in raw_issues:
            raw_filename = issue.get("filename", "")
            # Normalize to relative path
            rel_path = os.path.relpath(raw_filename, work_dir).replace("\\", "/")
            rule_code = issue.get("code") or "RUFF-000"
            message = issue.get("message", "Lint warning reported by Ruff")
            location = issue.get("location", {})
            end_location = issue.get("end_location", {})
            start_line = location.get("row", 1)
            end_line = end_location.get("row", start_line)

            # Map Ruff rule prefixes to severity and category
            severity = "low"
            category = "maintainability"
            if rule_code.startswith("E9") or rule_code in ("F821", "F822", "F823"):
                severity = "high"
                category = "correctness"
            elif rule_code.startswith("S"):  # flake8-bandit
                severity = "high"
                category = "security"
            elif rule_code.startswith("B"):  # bugbear
                severity = "medium"
                category = "reliability"
            elif rule_code.startswith("E") or rule_code.startswith("W"):
                severity = "low"
                category = "style"

            file_content = files.get(rel_path, "")
            lines = file_content.splitlines() if file_content else []

            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, rel_path, start_line, rule_code),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=rel_path,
                    start_line=start_line,
                    end_line=end_line,
                    severity=severity,
                    category=category,
                    title=f"Ruff [{rule_code}]: {message}",
                    description=message,
                    rule_id=rule_code,
                    analyzer="ruff",
                    confidence="confirmed",
                    remediation=f"Address rule {rule_code}: consult Ruff documentation for standard resolution.",
                    status="open",
                    verification_status="not_run",
                    code_excerpt=get_safe_code_excerpt(lines, start_line, end_line),
                )
            )

        return findings


class BanditAnalyzer(BaseAnalyzer):
    """
    Bandit security static analysis tool runner for Python.
    Executes AST-based security checks and reports vulnerability issues.
    """

    name: str = "bandit"
    supported_extensions: Set[str] = {".py", ".pyi"}

    def is_available(self) -> bool:
        if shutil.which("bandit"):
            return True
        try:
            res = subprocess.run(
                [sys.executable, "-m", "bandit", "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
            )
            return res.returncode == 0
        except Exception:
            return False

    async def analyze(
        self,
        files: Dict[str, str],
        repo: str,
        branch: str,
        commit_sha: str,
        work_dir: Optional[str] = None,
    ) -> List[Finding]:
        if not work_dir or not os.path.exists(work_dir):
            return []

        py_files = [f for f in files.keys() if f.endswith((".py", ".pyi"))]
        if not py_files:
            return []

        cmd = ["bandit"] if shutil.which("bandit") else [sys.executable, "-m", "bandit"]
        full_cmd = cmd + ["-r", "-f", "json", "-q", "."]

        try:
            proc = await asyncio.create_subprocess_exec(
                *full_cmd,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=20.0)
        except asyncio.TimeoutError:
            raise RuntimeError("Bandit analyzer execution timed out after 20 seconds.")
        except Exception as exc:
            raise RuntimeError(f"Bandit execution failed: {str(exc)}")

        output_str = stdout.decode("utf-8", errors="replace").strip()
        if not output_str:
            return []

        try:
            report_data = json.loads(output_str)
        except json.JSONDecodeError:
            return []

        raw_results = report_data.get("results", [])
        findings: List[Finding] = []

        for item in raw_results:
            raw_filename = item.get("filename", "")
            rel_path = os.path.relpath(raw_filename, work_dir).replace("\\", "/")
            test_id = item.get("test_id", "B000")
            issue_text = item.get("issue_text", "Security issue detected by Bandit")
            line_number = item.get("line_number", 1)
            line_range = item.get("line_range", [line_number])
            end_line = line_range[-1] if line_range else line_number
            raw_severity = (item.get("issue_severity") or "MEDIUM").lower()
            raw_confidence = (item.get("issue_confidence") or "MEDIUM").lower()

            severity = "medium"
            if raw_severity == "high":
                severity = "high"
            elif raw_severity == "low":
                severity = "low"

            confidence = "high"
            if raw_confidence == "high":
                confidence = "confirmed"
            elif raw_confidence == "low":
                confidence = "medium"

            file_content = files.get(rel_path, "")
            lines = file_content.splitlines() if file_content else []

            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, rel_path, line_number, test_id),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=rel_path,
                    start_line=line_number,
                    end_line=end_line,
                    severity=severity,
                    category="security",
                    title=f"Bandit [{test_id}]: {issue_text}",
                    description=issue_text,
                    rule_id=test_id,
                    analyzer="bandit",
                    confidence=confidence,
                    remediation=item.get("more_info", "Follow Bandit remediation recommendations for this security issue."),
                    status="open",
                    verification_status="not_run",
                    code_excerpt=get_safe_code_excerpt(lines, line_number, end_line),
                )
            )

        return findings

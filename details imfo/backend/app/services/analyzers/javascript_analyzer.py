import asyncio
import json
import os
import shutil
from typing import Dict, List, Optional, Set
from app.schemas.bug_report import Finding
from app.services.analyzers.base_analyzer import BaseAnalyzer
from app.services.rules import generate_finding_id, get_safe_code_excerpt
from app.services.rules.javascript_rules import scan_javascript_rules


class JavaScriptRuleAnalyzer(BaseAnalyzer):
    """
    Deterministic JavaScript & TypeScript code analyzer.
    Analyzes DOM XSS risks, dynamic eval, loose equality, promise rejections, and web storage.
    """

    name: str = "javascript_rules"
    supported_extensions: Set[str] = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"}

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
                file_findings = scan_javascript_rules(
                    file_path=file_path,
                    content=content,
                    repo=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                )
                findings.extend(file_findings)
        return findings


class ESLintAnalyzer(BaseAnalyzer):
    """
    ESLint static analysis tool wrapper.
    Executes ESLint in controlled mode with JSON output format.
    """

    name: str = "eslint"
    supported_extensions: Set[str] = {".js", ".jsx", ".ts", ".tsx"}

    def is_available(self) -> bool:
        return bool(shutil.which("eslint"))

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

        js_files = [f for f in files.keys() if f.endswith((".js", ".jsx", ".ts", ".tsx"))]
        if not js_files:
            return []

        # Run eslint with json format
        cmd = ["eslint", "--format", "json", "--no-ignore", "."]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=work_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=20.0)
        except asyncio.TimeoutError:
            raise RuntimeError("ESLint execution timed out after 20 seconds.")
        except Exception as exc:
            raise RuntimeError(f"ESLint execution failed: {str(exc)}")

        output_str = stdout.decode("utf-8", errors="replace").strip()
        if not output_str:
            return []

        try:
            report_data = json.loads(output_str)
        except json.JSONDecodeError:
            return []

        findings: List[Finding] = []
        for file_result in report_data:
            raw_filepath = file_result.get("filePath", "")
            rel_path = os.path.relpath(raw_filepath, work_dir).replace("\\", "/")
            messages = file_result.get("messages", [])

            file_content = files.get(rel_path, "")
            lines = file_content.splitlines() if file_content else []

            for msg in messages:
                rule_id = msg.get("ruleId") or "ESLINT-UNKNOWN"
                message_text = msg.get("message", "Lint warning reported by ESLint")
                line_num = msg.get("line", 1)
                end_line = msg.get("endLine", line_num)
                eslint_severity = msg.get("severity", 1)  # 1 = warning, 2 = error

                severity = "high" if eslint_severity == 2 else "medium"
                category = "correctness" if eslint_severity == 2 else "maintainability"
                if "security" in rule_id.lower() or "xss" in rule_id.lower():
                    category = "security"

                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, rel_path, line_num, rule_id),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=rel_path,
                        start_line=line_num,
                        end_line=end_line,
                        severity=severity,
                        category=category,
                        title=f"ESLint [{rule_id}]: {message_text}",
                        description=message_text,
                        rule_id=rule_id,
                        analyzer="eslint",
                        confidence="confirmed",
                        remediation=f"Address ESLint rule {rule_id}.",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=get_safe_code_excerpt(lines, line_num, end_line),
                    )
                )

        return findings

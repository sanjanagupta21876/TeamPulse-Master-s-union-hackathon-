import re
from typing import Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.schemas.bug_report import Finding
from app.services.rules.security_rules import redact_secrets

MAX_CONTEXT_LINES_PER_FINDING = 50
MAX_TOTAL_CONTEXT_CHARS = 24000
MAX_RELATED_FILES = 5


class FindingContext(BaseModel):
    finding_id: str
    file_path: str
    target_lines: str
    start_line: int
    end_line: int
    enclosing_snippet: str
    relevant_imports: List[str] = Field(default_factory=list)
    related_findings: List[str] = Field(default_factory=list)


class DiagnosisContext(BaseModel):
    repository: str
    commit_sha: str
    findings_contexts: List[FindingContext] = Field(default_factory=list)
    related_files_excerpts: Dict[str, str] = Field(default_factory=dict)
    limitations: List[str] = Field(default_factory=list)
    total_characters: int = 0


class ContextBuilder:
    """
    Constructs focused, secret-redacted source code context around analyzer findings.
    Prevents prompt injection by isolating untrusted repository code as passive data.
    Enforces strict context character limits.
    """

    def __init__(
        self,
        max_context_chars: int = MAX_TOTAL_CONTEXT_CHARS,
        max_lines_per_finding: int = MAX_CONTEXT_LINES_PER_FINDING,
    ):
        self.max_context_chars = max_context_chars
        self.max_lines_per_finding = max_lines_per_finding

    def build_context(
        self,
        repository: str,
        commit_sha: str,
        findings: List[Finding],
        files: Dict[str, str],
    ) -> DiagnosisContext:
        findings_contexts: List[FindingContext] = []
        limitations: List[str] = []
        related_files_excerpts: Dict[str, str] = {}
        total_chars = 0

        # Group findings by file to detect co-located issues
        file_to_findings: Dict[str, List[Finding]] = {}
        for f in findings:
            file_to_findings.setdefault(f.file_path, []).append(f)

        for finding in findings:
            content = files.get(finding.file_path)
            if not content:
                limitations.append(
                    f"Source code for file '{finding.file_path}' was unavailable in cached scan context."
                )
                continue

            lines = content.splitlines()
            total_lines = len(lines)
            start_line = max(1, finding.start_line)
            end_line = finding.end_line or start_line

            # Extract window surrounding the finding
            half_window = self.max_lines_per_finding // 2
            win_start = max(1, start_line - half_window)
            win_end = min(total_lines, end_line + half_window)

            window_lines = []
            for l_num in range(win_start, win_end + 1):
                raw_line = lines[l_num - 1] if (l_num - 1) < total_lines else ""
                # Redact any secrets before adding to prompt context
                safe_line = redact_secrets(raw_line)
                prefix = ">> " if (start_line <= l_num <= end_line) else "   "
                window_lines.append(f"{prefix}{l_num:4d} | {safe_line}")

            snippet = "\n".join(window_lines)

            # Identify top imports in this file
            imports = self._extract_imports(lines[:40])

            # Other findings in same file
            co_located = [
                f.id for f in file_to_findings.get(finding.file_path, [])
                if f.id != finding.id
            ]

            fc = FindingContext(
                finding_id=finding.id,
                file_path=finding.file_path,
                target_lines=f"{start_line}-{end_line}",
                start_line=start_line,
                end_line=end_line,
                enclosing_snippet=snippet,
                relevant_imports=imports,
                related_findings=co_located,
            )
            findings_contexts.append(fc)
            total_chars += len(snippet)

            # Discover related files (e.g. schemas, routes, or client definitions)
            related_paths = self._find_related_files(finding.file_path, files.keys())
            for r_path in related_paths[:MAX_RELATED_FILES]:
                if r_path not in related_files_excerpts and r_path in files:
                    r_content = files[r_path]
                    # Include first 40 lines of related file
                    r_sample = "\n".join(r_content.splitlines()[:40])
                    safe_sample = redact_secrets(r_sample)
                    if total_chars + len(safe_sample) < self.max_context_chars:
                        related_files_excerpts[r_path] = safe_sample
                        total_chars += len(safe_sample)

        if not files:
            limitations.append("No source file contents were loaded for context building.")

        return DiagnosisContext(
            repository=repository,
            commit_sha=commit_sha,
            findings_contexts=findings_contexts,
            related_files_excerpts=related_files_excerpts,
            limitations=limitations,
            total_characters=total_chars,
        )

    def _extract_imports(self, top_lines: List[str]) -> List[str]:
        imports = []
        for line in top_lines:
            stripped = line.strip()
            if (
                stripped.startswith("import ")
                or stripped.startswith("from ")
                or "require(" in stripped
            ):
                imports.append(redact_secrets(stripped))
                if len(imports) >= 8:
                    break
        return imports

    def _find_related_files(self, primary_path: str, all_paths: Set[str] or List[str]) -> List[str]:
        """Finds related schemas, models, or clients based on directory and naming conventions."""
        candidates = []
        p_lower = primary_path.lower()

        # If frontend file, look for backend api / routes
        if any(ext in p_lower for ext in [".js", ".jsx", ".ts", ".tsx"]):
            for path in all_paths:
                p_r = path.lower()
                if any(k in p_r for k in ["schema", "route", "api", "controller", "model"]):
                    candidates.append(path)
        # If backend file, look for schema / models / tests
        elif ".py" in p_lower:
            for path in all_paths:
                p_r = path.lower()
                if any(k in p_r for k in ["schema", "model", "test", "client"]):
                    candidates.append(path)

        return candidates

import ast
import hashlib
import os
import re
from typing import List, Optional
from app.schemas.fix import PatchValidationResult

MAX_PROPOSED_CONTENT_BYTES = 512 * 1024  # 512 KB
DISALLOWED_TARGET_PATTERNS = [
    r"\.\.",
    r"^[/\\]",
    r"^[a-zA-Z]:",
    r"(^|/)\.git(/|$)",
    r"(^|/)\.env(\.|$)",
    r"\.pem$",
    r"\.key$",
    r"id_rsa",
]


class PatchValidator:
    """
    Performs safety, integrity, and syntax validation on proposed code modifications.
    Ensures patches respect repository boundaries, source hashes, and language syntax rules.
    """

    def validate_patch(
        self,
        file_path: str,
        original_content: str,
        expected_sha256: str,
        proposed_content: str,
    ) -> PatchValidationResult:
        details: List[str] = []
        is_path_safe = True
        is_hash_match = True
        is_within_size = True
        syntax_status = "not_run"
        patch_integrity = "valid"

        # 1. Path Safety & Traversal checks
        clean_path = file_path.strip().replace("\\", "/")
        for pattern in DISALLOWED_TARGET_PATTERNS:
            if re.search(pattern, clean_path, re.IGNORECASE):
                is_path_safe = False
                details.append(f"Security Alert: Disallowed target file pattern detected: '{pattern}' in path '{file_path}'.")
                patch_integrity = "invalid"
                break

        # 2. Source Hash Verification
        actual_sha256 = hashlib.sha256(original_content.encode("utf-8")).hexdigest()
        if actual_sha256 != expected_sha256:
            is_hash_match = False
            details.append(
                f"Integrity Warning: Original source content hash mismatch (expected {expected_sha256[:8]}, got {actual_sha256[:8]})."
            )
            patch_integrity = "invalid"

        # 3. Size Limits Check
        content_bytes = len(proposed_content.encode("utf-8"))
        if content_bytes > MAX_PROPOSED_CONTENT_BYTES:
            is_within_size = False
            details.append(
                f"Size Error: Proposed content exceeds maximum permissible size ({content_bytes} > {MAX_PROPOSED_CONTENT_BYTES} bytes)."
            )
            patch_integrity = "invalid"

        # 4. Safe Language Syntax Checks
        ext = os.path.splitext(clean_path)[1].lower()
        if ext in [".py", ".pyi"]:
            syntax_status = self._check_python_syntax(proposed_content, details)
            if syntax_status == "failed":
                patch_integrity = "invalid"
        elif ext in [".js", ".jsx", ".ts", ".tsx", ".json"]:
            syntax_status = self._check_javascript_syntax(proposed_content, ext, details)
            if syntax_status == "failed":
                patch_integrity = "invalid"
        else:
            syntax_status = "not_run"
            details.append(f"Syntax validation skipped for extension '{ext}' (no safe in-process parser).")

        return PatchValidationResult(
            syntax_check=syntax_status,
            patch_integrity=patch_integrity,
            source_hash_match=is_hash_match,
            path_traversal_safe=is_path_safe,
            within_size_limits=is_within_size,
            details=details,
        )

    def _check_python_syntax(self, code: str, details: List[str]) -> str:
        try:
            ast.parse(code)
            return "passed"
        except SyntaxError as exc:
            details.append(f"Python SyntaxError at line {exc.lineno}, col {exc.offset}: {exc.msg}")
            return "failed"
        except Exception as exc:
            details.append(f"Python syntax check error: {str(exc)}")
            return "failed"

    def _check_javascript_syntax(self, code: str, ext: str, details: List[str]) -> str:
        """Safe heuristic delimiter and structure validation for JS/TS/JSON."""
        if ext == ".json":
            import json
            try:
                json.loads(code)
                return "passed"
            except Exception as exc:
                details.append(f"JSON SyntaxError: {str(exc)}")
                return "failed"

        # Check balanced brackets and quotes in code (excluding comments)
        stack = []
        matching = {')': '(', '}': '{', ']': '['}

        lines = code.splitlines()
        for l_num, line in enumerate(lines, start=1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
                continue

            for ch in stripped:
                if ch in "({[":
                    stack.append((ch, l_num))
                elif ch in ")}]":
                    if not stack:
                        details.append(f"JS/TS Syntax Warning: Unmatched closing '{ch}' at line {l_num}.")
                        return "failed"
                    top_ch, _ = stack.pop()
                    if matching[ch] != top_ch:
                        details.append(f"JS/TS Syntax Warning: Mismatched bracket '{top_ch}' and '{ch}' at line {l_num}.")
                        return "failed"

        if stack:
            unclosed, l_num = stack[-1]
            details.append(f"JS/TS Syntax Warning: Unclosed delimiter '{unclosed}' opened at line {l_num}.")
            return "failed"

        return "passed"

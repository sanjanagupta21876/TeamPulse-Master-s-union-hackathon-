import hashlib
from typing import Optional


def generate_finding_id(
    repo: str,
    commit_sha: str,
    file_path: str,
    start_line: int,
    rule_id: str,
) -> str:
    """Generates a stable, deterministic 16-character identifier for a finding."""
    key = f"{repo}:{commit_sha}:{file_path}:{start_line}:{rule_id}".encode("utf-8")
    return hashlib.sha256(key).hexdigest()[:16]


def get_safe_code_excerpt(lines: list, start_line: int, end_line: Optional[int] = None) -> str:
    """Extracts a short, safe code excerpt (up to 3 lines) around the reported line."""
    if not lines or start_line < 1:
        return ""
    idx = start_line - 1
    if idx >= len(lines):
        return ""
    end_idx = (end_line - 1) if (end_line and end_line >= start_line) else idx
    # Limit excerpt to at most 3 lines
    end_idx = min(end_idx, idx + 2, len(lines) - 1)
    excerpt = "\n".join(lines[idx : end_idx + 1])
    return excerpt.strip()

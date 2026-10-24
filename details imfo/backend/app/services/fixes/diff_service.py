import difflib
import re
from typing import List, Optional
from app.schemas.fix import DiffHunk, DiffResult


class DiffService:
    """
    Computes unified diffs and structured line change hunks between original and proposed source code.
    """

    HUNK_HEADER_REGEX = re.compile(
        r"^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@"
    )

    def calculate_diff(
        self,
        file_path: str,
        original_content: str,
        proposed_content: str,
    ) -> DiffResult:
        orig_lines = original_content.splitlines(keepends=True)
        prop_lines = proposed_content.splitlines(keepends=True)

        raw_diff_lines = list(
            difflib.unified_diff(
                orig_lines,
                prop_lines,
                fromfile=f"a/{file_path}",
                tofile=f"b/{file_path}",
                lineterm="",
            )
        )

        unified_diff_str = "\n".join(raw_diff_lines)

        additions = 0
        deletions = 0
        hunks: List[DiffHunk] = []
        current_hunk: Optional[DiffHunk] = None

        for line in raw_diff_lines:
            if line.startswith("+++") or line.startswith("---"):
                continue

            hunk_match = self.HUNK_HEADER_REGEX.match(line)
            if hunk_match:
                if current_hunk:
                    hunks.append(current_hunk)

                old_start = int(hunk_match.group(1))
                old_lines = int(hunk_match.group(2)) if hunk_match.group(2) else 1
                new_start = int(hunk_match.group(3))
                new_lines = int(hunk_match.group(4)) if hunk_match.group(4) else 1

                current_hunk = DiffHunk(
                    old_start=old_start,
                    old_lines=old_lines,
                    new_start=new_start,
                    new_lines=new_lines,
                    lines=[line],
                )
            elif current_hunk:
                current_hunk.lines.append(line)
                if line.startswith("+"):
                    additions += 1
                elif line.startswith("-"):
                    deletions += 1

        if current_hunk:
            hunks.append(current_hunk)

        return DiffResult(
            file_path=file_path,
            unified_diff=unified_diff_str,
            additions=additions,
            deletions=deletions,
            hunks=hunks,
        )

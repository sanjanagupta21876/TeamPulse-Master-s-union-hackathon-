import os
import shutil
import tempfile
from pathlib import Path
from typing import Dict, Optional, Set


class WorkspaceSecurityError(Exception):
    """Raised when an unsafe path or symlink operation is detected."""
    pass


class WorkspaceManager:
    """
    Manages isolated temporary filesystem workspaces for verification jobs.
    Enforces strict path containment, size limits, and safe teardown.
    """

    MAX_FILES = 250
    MAX_FILE_SIZE_BYTES = 1024 * 1024  # 1 MB

    def create_workspace(
        self,
        job_id: str,
        files: Dict[str, str],
        target_file_path: Optional[str] = None,
    ) -> str:
        """
        Creates an isolated temporary directory and populates it with the specified repository files.
        Ensures all paths remain strictly contained inside the workspace.
        """
        safe_prefix = f"codelens_verify_{job_id[:8]}_"
        workspace_dir = tempfile.mkdtemp(prefix=safe_prefix)
        workspace_path = Path(workspace_dir).resolve()

        try:
            count = 0
            for rel_path, content in files.items():
                if count >= self.MAX_FILES:
                    break

                # Validate and resolve destination path
                dest_path = self.resolve_safe_path(workspace_path, rel_path)

                # Ensure parent directory exists within workspace
                dest_path.parent.mkdir(parents=True, exist_ok=True)

                # Enforce file size limit
                encoded = content.encode("utf-8")
                if len(encoded) > self.MAX_FILE_SIZE_BYTES:
                    # Truncate or skip oversized files
                    encoded = encoded[: self.MAX_FILE_SIZE_BYTES]

                dest_path.write_bytes(encoded)
                count += 1

            return str(workspace_path)
        except Exception as e:
            # Clean up on failure
            self.clean_workspace(str(workspace_path))
            raise e

    def resolve_safe_path(self, workspace_root: Path, relative_path: str) -> Path:
        """
        Validates that relative_path is strictly inside workspace_root and
        does not escape via '..' or symlinks.
        """
        clean_rel = relative_path.replace("\\", "/").strip()
        if clean_rel.startswith("/") or clean_rel.startswith("\\") or ":" in clean_rel:
            raise WorkspaceSecurityError(
                f"Absolute or drive-qualified path '{relative_path}' is not permitted."
            )

        parts = Path(clean_rel).parts
        if ".." in parts:
            raise WorkspaceSecurityError(
                f"Path traversal detected in file path '{relative_path}'."
            )

        resolved = (workspace_root / clean_rel).resolve()
        try:
            resolved.relative_to(workspace_root)
        except ValueError:
            raise WorkspaceSecurityError(
                f"Target path '{relative_path}' escapes workspace boundary '{workspace_root}'."
            )

        return resolved

    def clean_workspace(self, workspace_path: str) -> bool:
        """
        Safely removes the temporary workspace directory.
        """
        if not workspace_path or not os.path.exists(workspace_path):
            return True

        p = Path(workspace_path).resolve()
        # Verify that the folder name starts with our safe prefix before deleting
        if "codelens_verify_" not in p.name:
            return False

        try:
            shutil.rmtree(str(p), ignore_errors=True)
            return True
        except Exception:
            return False

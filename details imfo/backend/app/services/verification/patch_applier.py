import hashlib
from pathlib import Path
from typing import Optional, Tuple

from app.schemas.fix import FixProposal
from app.services.verification.workspace_manager import WorkspaceManager, WorkspaceSecurityError


class PatchApplicationError(Exception):
    pass


class PatchApplier:
    """
    Safely applies approved fix proposals to an isolated temporary workspace.
    Verifies original hash matching and prevents unauthorized or unexpected file modifications.
    """

    def __init__(self, workspace_manager: Optional[WorkspaceManager] = None):
        self.workspace_manager = workspace_manager or WorkspaceManager()

    def apply_patch(
        self,
        workspace_path: str,
        proposal: FixProposal,
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Applies proposal.proposed_content to the target file in the workspace.
        Returns: (success: bool, status_message: str, patch_hash: Optional[str])
        """
        root = Path(workspace_path).resolve()
        try:
            target_path = self.workspace_manager.resolve_safe_path(root, proposal.file_path)
        except WorkspaceSecurityError as e:
            return False, f"Patch target rejected for security: {str(e)}", None

        # Verify target file exists in workspace
        if not target_path.exists() or not target_path.is_file():
            return False, f"Target file '{proposal.file_path}' does not exist in workspace.", None

        # Verify original source hash matches before applying patch
        current_content = target_path.read_text(encoding="utf-8", errors="replace")
        current_hash = hashlib.sha256(current_content.encode("utf-8")).hexdigest()

        if current_hash != proposal.original_sha256:
            return (
                False,
                f"Source hash mismatch: expected {proposal.original_sha256[:10]}, but workspace file had {current_hash[:10]}.",
                None,
            )

        # Write proposed content
        try:
            target_path.write_text(proposal.proposed_content, encoding="utf-8")
            patch_hash = hashlib.sha256(proposal.proposed_content.encode("utf-8")).hexdigest()
            return True, "Patch applied cleanly to isolated workspace.", patch_hash
        except Exception as err:
            return False, f"Failed to write proposed patch to file: {str(err)}", None

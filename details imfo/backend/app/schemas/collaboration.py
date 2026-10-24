"""Pydantic schemas for Team Collaboration, Workspaces, Assignments, Comments, and Notifications (Step 10)."""

from typing import List, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


# Roles & Workflow Types
WorkspaceRole = Literal["owner", "admin", "developer", "viewer"]

WorkflowStatus = Literal[
    "open",
    "triaged",
    "in_progress",
    "fix_proposed",
    "awaiting_verification",
    "resolved",
    "reopened",
    "wont_fix",
]

BugPriority = Literal["P0", "P1", "P2", "P3"]

InvitationStatus = Literal["pending", "accepted", "rejected", "revoked", "expired"]

NotificationType = Literal[
    "critical_bug_detected",
    "bug_assigned",
    "workflow_status_changed",
    "comment_added",
    "user_mentioned",
    "fix_proposal_ready",
    "verification_outcome",
    "pull_request_updated",
    "push_analysis_triggered",
    "analysis_failed",
    "team_invitation",
]


# =========================================================================
# Workspaces & Members
# =========================================================================

class WorkspaceMember(BaseModel):
    member_id: str
    workspace_id: str
    user_id: str
    email: str
    name: str
    role: WorkspaceRole
    avatar_url: Optional[str] = None
    joined_at: str


class Workspace(BaseModel):
    workspace_id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    owner_email: str
    connected_repositories: List[str] = Field(default_factory=list)
    member_count: int = 1
    created_at: str
    updated_at: str


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    connected_repositories: List[str] = Field(default_factory=list)


class UpdateWorkspaceRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    connected_repositories: Optional[List[str]] = None


# =========================================================================
# Invitations
# =========================================================================

class CreateInvitationRequest(BaseModel):
    email: str = Field(..., description="Email address of the invitee")
    role: WorkspaceRole = Field(default="developer", description="Assigned role upon acceptance")


class WorkspaceInvitation(BaseModel):
    invitation_id: str
    workspace_id: str
    workspace_name: str
    email: str
    role: WorkspaceRole
    invited_by: str
    status: InvitationStatus = "pending"
    expires_at: str
    created_at: str
    invite_url: Optional[str] = None
    token_preview: Optional[str] = None


# =========================================================================
# Bug Assignment & Workflow
# =========================================================================

class UpdateAssignmentRequest(BaseModel):
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    priority: Optional[BugPriority] = None
    due_date: Optional[str] = None
    labels: Optional[List[str]] = None
    internal_notes: Optional[str] = None


class UpdateWorkflowRequest(BaseModel):
    workflow_status: WorkflowStatus
    reason: Optional[str] = Field(None, max_length=500, description="Reason for status change")


class ActivityLogEntry(BaseModel):
    activity_id: str
    finding_id: str
    actor_id: str
    actor_name: str
    action_type: str  # e.g., "assigned", "status_changed", "priority_updated", "comment_posted", "fix_approved"
    details: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    timestamp: str


class FindingCollaboration(BaseModel):
    finding_id: str
    workspace_id: Optional[str] = None
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    priority: BugPriority = "P2"
    workflow_status: WorkflowStatus = "open"
    labels: List[str] = Field(default_factory=list)
    due_date: Optional[str] = None
    internal_notes: Optional[str] = None
    updated_at: str


# =========================================================================
# Comments
# =========================================================================

class CreateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Markdown comment text")
    parent_id: Optional[str] = Field(None, description="Parent comment ID for replies")
    linked_commit_sha: Optional[str] = None
    linked_pr_number: Optional[int] = None


class UpdateCommentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class FindingComment(BaseModel):
    comment_id: str
    finding_id: str
    workspace_id: str
    author_id: str
    author_name: str
    author_email: str
    content: str
    created_at: str
    updated_at: str
    is_edited: bool = False
    parent_id: Optional[str] = None
    linked_commit_sha: Optional[str] = None
    linked_pr_number: Optional[int] = None


# =========================================================================
# Notifications
# =========================================================================

class NotificationRecord(BaseModel):
    notification_id: str
    user_id: str
    workspace_id: str
    type: NotificationType
    title: str
    message: str
    resource_type: str  # e.g., "finding", "fix", "pull_request", "invitation"
    resource_id: str
    resource_url: str
    read: bool = False
    created_at: str


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferences(BaseModel):
    user_id: str
    critical_bug_alerts: bool = True
    bug_assignments: bool = True
    mentions_and_comments: bool = True
    verification_results: bool = True
    pull_request_updates: bool = True
    analysis_failures: bool = True
    email_delivery_enabled: bool = False
    email_provider: str = "none"  # "smtp", "sendgrid", "ses", "none"


class UpdateNotificationPreferencesRequest(BaseModel):
    critical_bug_alerts: Optional[bool] = None
    bug_assignments: Optional[bool] = None
    mentions_and_comments: Optional[bool] = None
    verification_results: Optional[bool] = None
    pull_request_updates: Optional[bool] = None
    analysis_failures: Optional[bool] = None
    email_delivery_enabled: Optional[bool] = None

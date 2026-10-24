from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class WebhookEventRecord(BaseModel):
    delivery_id: str = Field(..., description="Unique GitHub delivery ID from X-GitHub-Delivery")
    event_type: str = Field(..., description="GitHub event type: push, pull_request, ping")
    repository: str = Field(..., description="Target repository full name (owner/repo)")
    sender: Optional[str] = Field(None, description="GitHub username triggering the event")
    ref: Optional[str] = Field(None, description="Git ref (e.g., refs/heads/main)")
    branch: Optional[str] = Field(None, description="Extracted branch name")
    before_sha: Optional[str] = Field(None, description="Commit SHA before the push")
    after_sha: Optional[str] = Field(None, description="Commit SHA after the push")
    commits_count: int = Field(default=0, description="Number of commits in the push payload")
    added_files: List[str] = Field(default_factory=list, description="List of files added")
    modified_files: List[str] = Field(default_factory=list, description="List of files modified")
    removed_files: List[str] = Field(default_factory=list, description="List of files removed")
    is_forced: bool = Field(default=False, description="Whether the push was force pushed")
    is_deleted: bool = Field(default=False, description="Whether the branch was deleted")
    status: str = Field(
        default="received",
        description="Event processing status: received, queued, skipped, processed, failed",
    )
    error_message: Optional[str] = Field(None, description="Error message if event processing failed")
    received_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC timestamp of webhook receipt",
    )


class FindingComparisonSummary(BaseModel):
    new_findings_count: int = Field(default=0, description="Count of newly introduced findings")
    resolved_findings_count: int = Field(default=0, description="Count of resolved findings")
    persistent_findings_count: int = Field(default=0, description="Count of findings still present")
    new_finding_ids: List[str] = Field(default_factory=list, description="IDs of new findings")
    resolved_finding_ids: List[str] = Field(default_factory=list, description="IDs of resolved findings")
    persistent_finding_ids: List[str] = Field(default_factory=list, description="IDs of persistent findings")
    previous_commit_sha: Optional[str] = Field(None, description="Previous commit SHA compared against")
    new_commit_sha: str = Field(..., description="New commit SHA analyzed")


class AnalysisJobRecord(BaseModel):
    job_id: str = Field(..., description="Unique job identifier")
    repository: str = Field(..., description="Repository full name (owner/repo)")
    branch: str = Field(..., description="Git branch name")
    commit_sha: str = Field(..., description="Exact commit SHA being analyzed")
    trigger: str = Field(
        default="webhook_push",
        description="Trigger origin: webhook_push, webhook_pr, manual",
    )
    status: str = Field(
        default="queued",
        description="Job state: queued, running, completed, partial, failed",
    )
    queued_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC timestamp when job was queued",
    )
    started_at: Optional[str] = Field(None, description="UTC timestamp when job started running")
    completed_at: Optional[str] = Field(None, description="UTC timestamp when job completed")
    execution_time_seconds: Optional[float] = Field(None, description="Total execution time in seconds")
    scan_id: Optional[str] = Field(None, description="Reference to generated ScanRecord in storage")
    retry_count: int = Field(default=0, description="Number of times job was retried")
    error: Optional[str] = Field(None, description="Error details if job failed")
    comparison: Optional[FindingComparisonSummary] = Field(
        None, description="Diff comparison between previous and current findings"
    )
    findings_count: int = Field(default=0, description="Total findings detected in this analysis")


class RepositoryMonitoringSettings(BaseModel):
    repository: str = Field(..., description="Repository full name (owner/repo)")
    is_active: bool = Field(default=True, description="Whether automatic monitoring is active")
    monitored_branches: List[str] = Field(
        default_factory=lambda: ["main", "master"],
        description="Branches to monitor for pushes and PRs",
    )
    analyze_all_branches: bool = Field(
        default=False,
        description="If True, analyzes every push regardless of branch list",
    )
    webhook_configured: bool = Field(
        default=False,
        description="Whether a webhook has delivered a verified ping or push event",
    )
    webhook_url: str = Field(
        default="/api/webhooks/github",
        description="Endpoint URL to configure in GitHub repository settings",
    )
    last_webhook_event_at: Optional[str] = Field(None, description="UTC timestamp of last webhook event")
    last_analyzed_at: Optional[str] = Field(None, description="UTC timestamp of last completed analysis")
    latest_commit_sha: Optional[str] = Field(None, description="Latest analyzed commit SHA")
    latest_job_id: Optional[str] = Field(None, description="ID of most recent analysis job")
    latest_job_status: Optional[str] = Field(None, description="Status of most recent analysis job")
    auto_diagnose_high_priority: bool = Field(
        default=False,
        description="Automatically trigger AI diagnosis for high/critical findings on push",
    )


class UpdateMonitoringSettingsRequest(BaseModel):
    is_active: Optional[bool] = Field(None, description="Enable or disable live monitoring")
    monitored_branches: Optional[List[str]] = Field(None, description="Updated list of monitored branches")
    analyze_all_branches: Optional[bool] = Field(None, description="Whether to analyze all branches")
    auto_diagnose_high_priority: Optional[bool] = Field(
        None, description="Whether to auto-diagnose critical/high issues"
    )


class WebhookResponse(BaseModel):
    status: str = Field(..., description="Webhook processing outcome: ok, queued, skipped, ignored")
    event: str = Field(..., description="GitHub event type")
    delivery_id: str = Field(..., description="X-GitHub-Delivery ID")
    job_id: Optional[str] = Field(None, description="ID of queued analysis job if one was created")
    message: str = Field(..., description="Human-readable processing summary")


class JobRetryResponse(BaseModel):
    job_id: str = Field(..., description="Analysis job ID")
    status: str = Field(..., description="Updated job status")
    message: str = Field(..., description="Retry status message")

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class Finding(BaseModel):
    id: str = Field(..., description="Deterministic unique identifier for finding")
    repository: str = Field(..., description="Full repository name (owner/repo)")
    branch: str = Field(..., description="Branch analyzed")
    commit_sha: str = Field(..., description="Commit SHA analyzed")
    file_path: str = Field(..., description="Relative file path in repository")
    start_line: int = Field(..., description="1-based starting line number")
    end_line: Optional[int] = Field(None, description="1-based ending line number if available")
    severity: str = Field(
        ...,
        description="Severity level: critical, high, medium, low, informational",
    )
    category: str = Field(
        ...,
        description="Issue category: correctness, reliability, security, performance, maintainability, style, typing, configuration",
    )
    title: str = Field(..., description="Short, human-readable finding title")
    description: str = Field(..., description="Detailed explanation of the detected issue")
    rule_id: str = Field(..., description="Identifier of the rule or check that triggered")
    analyzer: str = Field(..., description="Tool or analyzer that identified the issue")
    confidence: str = Field(
        default="confirmed",
        description="Confidence level: confirmed, high, medium, low (distinguishes confirmed vs possible issues)",
    )
    remediation: str = Field(..., description="Recommended remediation guidance")
    status: str = Field(
        default="open",
        description="Finding status: open, acknowledged, resolved, dismissed",
    )
    verification_status: str = Field(
        default="not_run",
        description="Verification state: not_run, proposed, verified, failed",
    )
    code_excerpt: Optional[str] = Field(
        None, description="Short, safe source code excerpt with secrets redacted"
    )


class AnalysisSummary(BaseModel):
    critical: int = Field(default=0, description="Count of critical severity findings")
    high: int = Field(default=0, description="Count of high severity findings")
    medium: int = Field(default=0, description="Count of medium severity findings")
    low: int = Field(default=0, description="Count of low severity findings")
    informational: int = Field(default=0, description="Count of informational findings")


class AnalysisMetadata(BaseModel):
    status: str = Field(
        default="completed",
        description="Analysis state: queued, running, completed, partial, failed",
    )
    files_discovered: int = Field(default=0, description="Total files discovered in repository tree")
    files_analyzed: int = Field(default=0, description="Candidate source files retrieved and analyzed")
    files_skipped: int = Field(default=0, description="Files skipped due to limits, exclusions, or errors")
    findings_count: int = Field(default=0, description="Total unique findings detected")
    analyzers_completed: List[str] = Field(
        default_factory=list, description="Analyzers that executed successfully"
    )
    analyzers_failed: List[str] = Field(
        default_factory=list, description="Analyzers that encountered execution errors or were unavailable"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Warnings encountered during file retrieval or analysis"
    )


class RepositoryInfo(BaseModel):
    full_name: str = Field(..., description="owner/repository")
    branch: str = Field(..., description="Target branch")
    commit_sha: str = Field(..., description="Resolved Git commit SHA")


class RepositoryAnalysisRequest(BaseModel):
    repository_url: str = Field(
        ...,
        description="Public GitHub repository URL (e.g. https://github.com/psf/requests)",
        max_length=500,
    )
    branch: Optional[str] = Field(
        default=None,
        description="Optional Git branch name to analyze (defaults to default branch)",
        max_length=255,
    )


class RepositoryAnalysisResponse(BaseModel):
    repository: RepositoryInfo
    analysis: AnalysisMetadata
    summary: AnalysisSummary
    findings: List[Finding]
    scan_id: Optional[str] = Field(
        default=None,
        description="Unique scan identifier for subsequent root-cause diagnosis",
    )

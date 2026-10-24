export interface RepositoryInspectionRequest {
  repository_url: string;
  branch?: string | null;
}

export interface RepositoryMetadata {
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  selected_branch?: string | null;
  stars: number;
  language: string | null;
  visibility: string;
  latest_commit_sha: string;
}

export interface InspectionSummary {
  status: string;
  source: string;
  files_analyzed: number;
  bugs_detected: number;
  message: string;
}

export interface RepositoryInspectionResponse {
  repository: RepositoryMetadata;
  inspection: InspectionSummary;
}

export interface APIErrorDetail {
  code: string;
  message: string;
}

export interface APIError {
  error: APIErrorDetail;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:8000';

export interface Finding {
  id: string;
  repository: string;
  branch: string;
  commit_sha: string;
  file_path: string;
  start_line: number;
  end_line?: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  category: 'correctness' | 'reliability' | 'security' | 'performance' | 'maintainability' | 'style' | 'typing' | 'configuration';
  title: string;
  description: string;
  rule_id: string;
  analyzer: string;
  confidence: 'confirmed' | 'high' | 'medium' | 'low';
  remediation: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  verification_status: 'not_run' | 'proposed' | 'verified' | 'failed';
  code_excerpt?: string | null;
}

export interface AnalysisSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export interface AnalysisMetadata {
  status: 'completed' | 'partial' | 'failed';
  files_discovered: number;
  files_analyzed: number;
  files_skipped: number;
  findings_count: number;
  analyzers_completed: string[];
  analyzers_failed: string[];
  warnings: string[];
}

export interface RepositoryAnalysisRequest {
  repository_url: string;
  branch?: string | null;
}

export interface RepositoryAnalysisResponse {
  repository: {
    full_name: string;
    branch: string;
    commit_sha: string;
  };
  analysis: AnalysisMetadata;
  summary: AnalysisSummary;
  findings: Finding[];
  scan_id?: string;
}

export interface EvidenceItem {
  file_path: string;
  start_line: number;
  end_line?: number | null;
  description: string;
  snippet?: string | null;
}

export interface RootCause {
  title: string;
  explanation: string;
  confidence: 'high' | 'medium' | 'low' | 'inconclusive';
  evidence: EvidenceItem[];
  related_finding_ids: string[];
  assumptions: string[];
  recommended_actions: string[];
}

export interface Relationship {
  source_file: string;
  source_location: string;
  target_file?: string | null;
  target_location?: string | null;
  relationship_type:
    | 'imports'
    | 'calls'
    | 'sends_request_to'
    | 'handles_request_from'
    | 'expects_response_from'
    | 'validates_with'
    | 'reads_from'
    | 'writes_to'
    | 'potentially_causes'
    | 'related_to'
    | 'covered_by_test';
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  potential_impact: string;
}

export interface RemediationStep {
  order: number;
  priority_label: 'Investigate first' | 'High priority' | 'Normal priority' | 'Needs more evidence';
  title: string;
  target_file?: string | null;
  related_finding_ids: string[];
  reason: string;
}

export interface DiagnosisReport {
  diagnosis_id: string;
  repository: string;
  commit_sha: string;
  scan_id: string;
  status: 'completed' | 'inconclusive' | 'failed';
  summary: string;
  root_causes: RootCause[];
  relationships: Relationship[];
  remediation_order: RemediationStep[];
  limitations: string[];
  model: string;
  created_at: string;
}

export interface DiagnosisRequest {
  scan_id: string;
  finding_ids?: string[];
}

export interface CrossLayerDiagnosisRequest {
  scan_id: string;
}

export interface DiagnosisListResponse {
  repository: string;
  diagnoses: DiagnosisReport[];
}

export interface PatchValidationResult {
  syntax_check: 'passed' | 'failed' | 'not_run' | 'inconclusive';
  patch_integrity: 'valid' | 'invalid' | 'pending';
  source_hash_match: boolean;
  path_traversal_safe: boolean;
  within_size_limits: boolean;
  details: string[];
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: string[];
}

export interface DiffResult {
  file_path: string;
  unified_diff: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface FixProposal {
  id: string;
  finding_id: string;
  scan_id: string;
  repository_id: string;
  commit_sha: string;
  file_path: string;
  status: 'generating' | 'proposed' | 'approved' | 'rejected' | 'failed' | 'invalid';
  original_sha256: string;
  original_content: string;
  proposed_content: string;
  diff?: DiffResult | null;
  explanation: string;
  assumptions: string[];
  potential_regressions: string[];
  recommended_tests: string[];
  validation: PatchValidationResult;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
}

export interface GenerateFixRequest {
  diagnosis_id?: string | null;
  instructions?: string | null;
}

export interface FixListResponse {
  finding_id: string;
  fixes: FixProposal[];
}

export interface FixActionResponse {
  message: string;
  fix: FixProposal;
}

export interface VerificationRequest {
  run_tests?: boolean;
  run_static_checks?: boolean;
}

export interface VerificationRecord {
  verification_id: string;
  fix_id: string;
  repository_id: string;
  scan_id: string;
  original_commit_sha: string;
  patch_hash?: string | null;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  workspace_status: string;
  patch_application_status: 'pending' | 'applied' | 'failed';
  static_checks_status: 'not_requested' | 'passed' | 'failed' | 'unavailable' | 'timed_out' | 'inconclusive';
  tests_status: 'not_requested' | 'passed' | 'failed' | 'unavailable' | 'timed_out' | 'inconclusive';
  original_findings: Finding[];
  remaining_findings: Finding[];
  resolved_findings: Finding[];
  newly_introduced_findings: Finding[];
  execution_duration: number;
  warnings: string[];
  limitations: string[];
  assessment: string;
  tools_executed: string[];
  created_at: string;
  completed_at?: string | null;
}

export interface VerificationListResponse {
  fix_id: string;
  verifications: VerificationRecord[];
}

export interface VerificationActionResponse {
  message: string;
  verification: VerificationRecord;
}

export class CodeLensAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    // Strip trailing slash if present
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async checkHealth(): Promise<{ status: string; service: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Backend health check failed with status ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      throw new Error(
        `Unable to reach backend service at ${this.baseUrl}. Please verify the FastAPI server is running.`
      );
    }
  }

  async inspectRepository(
    payload: RepositoryInspectionRequest
  ): Promise<RepositoryInspectionResponse> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/repositories/inspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          repository_url: payload.repository_url.trim(),
          branch: payload.branch?.trim() || null,
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message:
            `Cannot connect to TeamPulse backend at ${this.baseUrl}. Please ensure the FastAPI server is running on port 8000.`,
        },
      } as APIError;
    }

    const data = await response.json();

    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message:
            data?.detail ||
            `Server returned status ${response.status}. Please check your repository URL.`,
        },
      } as APIError;
    }

    return data as RepositoryInspectionResponse;
  }

  async analyzeRepository(
    payload: RepositoryAnalysisRequest
  ): Promise<RepositoryAnalysisResponse> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/api/repositories/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          repository_url: payload.repository_url.trim(),
          branch: payload.branch?.trim() || null,
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message:
            `Cannot connect to TeamPulse backend at ${this.baseUrl}. Please ensure the FastAPI server is running on port 8000.`,
        },
      } as APIError;
    }

    const data = await response.json();

    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message:
            data?.detail ||
            `Server returned status ${response.status}. Please verify repository URL and access permissions.`,
        },
      } as APIError;
    }

    return data as RepositoryAnalysisResponse;
  }

  async diagnoseRepository(
    owner: string,
    repo: string,
    scanId: string,
    findingIds?: string[]
  ): Promise<DiagnosisReport> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/repositories/${owner}/${repo}/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          scan_id: scanId,
          finding_ids: findingIds || [],
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Diagnosis failed with status ${response.status}`,
        },
      } as APIError;
    }
    return data as DiagnosisReport;
  }

  async diagnoseCrossLayer(
    owner: string,
    repo: string,
    scanId: string
  ): Promise<DiagnosisReport> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/repositories/${owner}/${repo}/diagnose/cross-layer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          scan_id: scanId,
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Cross-layer analysis failed with status ${response.status}`,
        },
      } as APIError;
    }
    return data as DiagnosisReport;
  }

  async getRepositoryDiagnoses(
    owner: string,
    repo: string
  ): Promise<DiagnosisListResponse> {
    const response = await fetch(`${this.baseUrl}/api/repositories/${owner}/${repo}/diagnoses`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load diagnoses: ${response.statusText}`);
    }
    return await response.json();
  }

  async getDiagnosis(diagnosisId: string): Promise<DiagnosisReport> {
    const response = await fetch(`${this.baseUrl}/api/diagnoses/${diagnosisId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Diagnosis with ID ${diagnosisId} not found.`);
    }
    return await response.json();
  }

  async generateFix(
    findingId: string,
    diagnosisId?: string | null,
    instructions?: string | null
  ): Promise<FixProposal> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/findings/${findingId}/fixes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          diagnosis_id: diagnosisId || null,
          instructions: instructions || null,
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Fix generation failed with status ${response.status}`,
        },
      } as APIError;
    }
    return data as FixProposal;
  }

  async getFindingFixes(findingId: string): Promise<FixListResponse> {
    const response = await fetch(`${this.baseUrl}/api/findings/${findingId}/fixes`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load fixes for finding ${findingId}`);
    }
    return await response.json();
  }

  async getFix(fixId: string): Promise<FixProposal> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Fix proposal ${fixId} not found.`);
    }
    return await response.json();
  }

  async getFixDiff(fixId: string): Promise<DiffResult> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/diff`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Diff for fix ${fixId} not found.`);
    }
    return await response.json();
  }

  async approveFix(fixId: string): Promise<FixActionResponse> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/approve`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw data as APIError;
    }
    return data as FixActionResponse;
  }

  async rejectFix(fixId: string): Promise<FixActionResponse> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/reject`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw data as APIError;
    }
    return data as FixActionResponse;
  }

  async regenerateFix(
    fixId: string,
    instructions?: string | null
  ): Promise<FixProposal> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        instructions: instructions || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw data as APIError;
    }
    return data as FixProposal;
  }

  async verifyFix(
    fixId: string,
    runTests: boolean = false,
    runStaticChecks: boolean = true
  ): Promise<VerificationRecord> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          run_tests: runTests,
          run_static_checks: runStaticChecks,
        }),
      });
    } catch (networkErr: any) {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      if (data && data.error) {
        throw data as APIError;
      }
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Verification failed with status ${response.status}`,
        },
      } as APIError;
    }
    return data as VerificationRecord;
  }

  async getVerification(verificationId: string): Promise<VerificationRecord> {
    const response = await fetch(`${this.baseUrl}/api/verifications/${verificationId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Verification record ${verificationId} not found.`);
    }
    return await response.json();
  }

  async getFixVerifications(fixId: string): Promise<VerificationListResponse> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/verifications`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to load verifications for fix ${fixId}`);
    }
    return await response.json();
  }

  async cancelVerification(verificationId: string): Promise<VerificationActionResponse> {
    const response = await fetch(`${this.baseUrl}/api/verifications/${verificationId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw data as APIError;
    }
    return data as VerificationActionResponse;
  }

  // --- Step 8: GitHub Branch Creation & Pull Request Preparation ---

  async getGitHubAuthStatus(): Promise<GitHubAuthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/github/auth-status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        return {
          connected: false,
          user: null,
          scopes: [],
          auth_type: 'unauthenticated',
          can_publish: false,
          error_message: `HTTP ${response.status}: Failed to fetch auth status`,
        };
      }
      return await response.json();
    } catch {
      return {
        connected: false,
        user: null,
        scopes: [],
        auth_type: 'unauthenticated',
        can_publish: false,
        error_message: 'Backend connection unreachable',
      };
    }
  }

  async checkPublishEligibility(
    fixId: string,
    targetBranch?: string
  ): Promise<PublishEligibilityCheck> {
    const query = targetBranch ? `?target_branch=${encodeURIComponent(targetBranch)}` : '';
    const response = await fetch(
      `${this.baseUrl}/api/fixes/${fixId}/publish-eligibility${query}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || 'Eligibility check failed',
        },
      } as APIError;
    }
    return data as PublishEligibilityCheck;
  }

  async publishBranch(
    fixId: string,
    request: PublishBranchRequest = {}
  ): Promise<PublishBranchResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/publish-branch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Branch publishing failed (${response.status})`,
        },
      } as APIError;
    }
    return data as PublishBranchResponse;
  }

  async getPublishStatus(fixId: string): Promise<PublishStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/publish-status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || 'Failed to fetch publishing status',
        },
      } as APIError;
    }
    return data as PublishStatusResponse;
  }

  async createPullRequest(
    fixId: string,
    request: CreatePullRequestRequest
  ): Promise<PullRequestRecord> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/fixes/${fixId}/create-pull-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw {
        error: {
          code: 'BACKEND_CONNECTION_FAILED',
          message: `Cannot connect to TeamPulse backend at ${this.baseUrl}.`,
        },
      } as APIError;
    }

    const data = await response.json();
    if (!response.ok) {
      throw {
        error: {
          code: `HTTP_${response.status}`,
          message: data?.detail || `Pull request creation failed (${response.status})`,
        },
      } as APIError;
    }
    return data as PullRequestRecord;
  }

  async getPullRequest(pullRequestId: string): Promise<PullRequestRecord> {
    const response = await fetch(
      `${this.baseUrl}/api/pull-requests/${pullRequestId}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(`Pull request ${pullRequestId} not found.`);
    }
    return await response.json();
  }

  async getRepositoryPullRequests(
    owner: string,
    repo: string
  ): Promise<PullRequestListResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/pull-requests`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      return { repository: `${owner}/${repo}`, total: 0, pull_requests: [] };
    }
    return await response.json();
  }

  // Step 9 Live Monitoring Methods
  async getMonitoringSettings(
    owner: string,
    repo: string
  ): Promise<RepositoryMonitoringSettings> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/monitoring`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to load monitoring settings for ${owner}/${repo}`);
    }
    return await response.json();
  }

  async updateMonitoringSettings(
    owner: string,
    repo: string,
    request: UpdateMonitoringSettingsRequest
  ): Promise<RepositoryMonitoringSettings> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/monitoring`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to update monitoring settings for ${owner}/${repo}`);
    }
    return await response.json();
  }

  async enableMonitoring(
    owner: string,
    repo: string
  ): Promise<RepositoryMonitoringSettings> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/monitoring/enable`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to enable monitoring for ${owner}/${repo}`);
    }
    return await response.json();
  }

  async disableMonitoring(
    owner: string,
    repo: string
  ): Promise<RepositoryMonitoringSettings> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/monitoring/disable`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to disable monitoring for ${owner}/${repo}`);
    }
    return await response.json();
  }

  async analyzeLatest(
    owner: string,
    repo: string,
    branch?: string
  ): Promise<AnalysisJobRecord> {
    const url = new URL(`${this.baseUrl}/api/repositories/${owner}/${repo}/analyze-latest`);
    if (branch) {
      url.searchParams.append('branch', branch);
    }
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      throw {
        error: {
          code: data?.error?.code || `HTTP_${response.status}`,
          message: data?.error?.message || 'Failed to trigger latest analysis',
        },
      } as APIError;
    }
    return data as AnalysisJobRecord;
  }

  async getRepositoryEvents(
    owner: string,
    repo: string
  ): Promise<WebhookEventRecord[]> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/events`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      return [];
    }
    return await response.json();
  }

  async getRepositoryAnalysisJobs(
    owner: string,
    repo: string
  ): Promise<AnalysisJobRecord[]> {
    const response = await fetch(
      `${this.baseUrl}/api/repositories/${owner}/${repo}/analysis-jobs`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      return [];
    }
    return await response.json();
  }

  async getAnalysisJob(jobId: string): Promise<AnalysisJobRecord> {
    const response = await fetch(
      `${this.baseUrl}/api/analysis-jobs/${jobId}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (!response.ok) {
      throw new Error(`Analysis job ${jobId} not found`);
    }
    return await response.json();
  }

  async retryAnalysisJob(jobId: string): Promise<JobRetryResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/analysis-jobs/${jobId}/retry`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Failed to retry job ${jobId}`);
    }
    return data as JobRetryResponse;
  }
}

// Step 8 Interfaces
export interface GitHubAuthStatus {
  connected: boolean;
  user: string | null;
  scopes: string[];
  auth_type: string;
  can_publish: boolean;
  rate_limit_remaining?: number | null;
  error_message?: string | null;
}

export interface PublishEligibilityCheck {
  eligible: boolean;
  proposal_id: string;
  repository: string;
  target_branch: string;
  source_commit_sha: string;
  is_approved: boolean;
  is_verified: boolean;
  branch_head_matches: boolean;
  current_branch_head_sha?: string | null;
  reasons: string[];
}

export interface PublishBranchRequest {
  target_branch?: string | null;
  custom_branch_name?: string | null;
}

export interface PublishBranchResponse {
  publish_id: string;
  fix_id: string;
  repository: string;
  target_branch: string;
  created_branch: string;
  source_commit_sha: string;
  published_commit_sha: string;
  status: string;
  commit_message: string;
  files_changed: string[];
  html_url?: string | null;
  created_at: string;
}

export interface CreatePullRequestRequest {
  title?: string | null;
  body?: string | null;
  draft?: boolean;
  confirm_creation: boolean;
}

export interface PullRequestRecord {
  pull_request_id: string;
  fix_id: string;
  publish_id: string;
  repository: string;
  pr_number: number;
  title: string;
  html_url: string;
  head_branch: string;
  base_branch: string;
  status: string;
  summary: string;
  created_at: string;
}

export interface PullRequestListResponse {
  repository: string;
  total: number;
  pull_requests: PullRequestRecord[];
}

export interface PublishStatusResponse {
  fix_id: string;
  proposal_status: string;
  verification_status: string;
  publish_record: PublishBranchResponse | null;
  pull_request: PullRequestRecord | null;
}

// Step 9 Monitoring Interfaces
export interface FindingComparisonSummary {
  new_findings_count: number;
  resolved_findings_count: number;
  persistent_findings_count: number;
  new_finding_ids: string[];
  resolved_finding_ids: string[];
  persistent_finding_ids: string[];
  previous_commit_sha?: string | null;
  new_commit_sha: string;
}

export interface AnalysisJobRecord {
  job_id: string;
  repository: string;
  branch: string;
  commit_sha: string;
  trigger: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  queued_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  execution_time_seconds?: number | null;
  scan_id?: string | null;
  retry_count: number;
  error?: string | null;
  comparison?: FindingComparisonSummary | null;
  findings_count: number;
}

export interface WebhookEventRecord {
  delivery_id: string;
  event_type: string;
  repository: string;
  sender?: string | null;
  ref?: string | null;
  branch?: string | null;
  before_sha?: string | null;
  after_sha?: string | null;
  commits_count: number;
  added_files: string[];
  modified_files: string[];
  removed_files: string[];
  is_forced: boolean;
  is_deleted: boolean;
  status: string;
  error_message?: string | null;
  received_at: string;
}

export interface RepositoryMonitoringSettings {
  repository: string;
  is_active: boolean;
  monitored_branches: string[];
  analyze_all_branches: boolean;
  webhook_configured: boolean;
  webhook_url: string;
  last_webhook_event_at?: string | null;
  last_analyzed_at?: string | null;
  latest_commit_sha?: string | null;
  latest_job_id?: string | null;
  latest_job_status?: string | null;
  auto_diagnose_high_priority: boolean;
}

export interface UpdateMonitoringSettingsRequest {
  is_active?: boolean;
  monitored_branches?: string[];
  analyze_all_branches?: boolean;
  auto_diagnose_high_priority?: boolean;
}

export interface JobRetryResponse {
  job_id: string;
  status: string;
  message: string;
}

export const apiClient = new CodeLensAPIClient();



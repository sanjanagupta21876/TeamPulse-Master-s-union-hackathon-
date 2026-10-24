import type { Repository } from '../types';
import { mockRepositories } from './mockRepositories';
import type { RepositoryMetadata, InspectionSummary } from '../services/api';

const STORAGE_KEY = 'codelens_inspected_repos_v1';

export function getInspectedRepositoriesFromStorage(): Repository[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse inspected repositories from localStorage', err);
    return [];
  }
}

export function getAllRepositories(): Repository[] {
  const inspected = getInspectedRepositoriesFromStorage();
  const inspectedIds = new Set(inspected.map((r) => r.id));

  // Merge: inspected repositories take precedence, followed by mock demo repositories
  const combined: Repository[] = [...inspected];
  for (const mock of mockRepositories) {
    if (!inspectedIds.has(mock.id)) {
      combined.push(mock);
    }
  }
  return combined;
}

export function getRepositoryById(id: string): Repository | undefined {
  const all = getAllRepositories();
  return all.find((r) => r.id === id || r.fullName.toLowerCase() === id.toLowerCase());
}

export function saveInspectedRepository(
  metadata: RepositoryMetadata,
  inspection: InspectionSummary
): Repository {
  const existing = getInspectedRepositoriesFromStorage();

  const repoId = `repo-${metadata.owner.toLowerCase()}-${metadata.name.toLowerCase()}`;
  const displayCommitSha = metadata.latest_commit_sha.length > 7
    ? metadata.latest_commit_sha.substring(0, 7)
    : metadata.latest_commit_sha;

  const newRepoRecord: Repository = {
    id: repoId,
    name: metadata.name,
    fullName: metadata.full_name,
    owner: metadata.owner,
    url: metadata.html_url,
    defaultBranch: metadata.default_branch,
    selectedBranch: metadata.selected_branch || metadata.default_branch,
    language: metadata.language || 'Other',
    lastAnalyzed: 'Just now',
    bugsCount: 0,
    codeHealth: null, // Explicitly null for inspected-only repos
    status: 'Metadata Retrieved',
    description: metadata.description || 'No description provided on GitHub.',
    commitSha: displayCommitSha,
    stars: metadata.stars,
    visibility: metadata.visibility,
    isInspectedOnly: true,
    inspectionMessage: inspection.message,
    issueCounts: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    metrics: {
      reliability: 0,
      security: 0,
      maintainability: 0,
      testCoverage: 0,
    },
    recentActivity: [
      {
        id: `act-${Date.now()}`,
        action: `Metadata retrieved for branch ${metadata.selected_branch || metadata.default_branch}`,
        author: 'GitHub API',
        timestamp: 'Just now',
      },
    ],
  };

  const filtered = existing.filter((r) => r.id !== repoId);
  const updated = [newRepoRecord, ...filtered];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save inspected repository to localStorage', err);
  }

  // Dispatch custom storage event so other components update synchronously
  window.dispatchEvent(new Event('codelens_repositories_updated'));

  return newRepoRecord;
}

const FINDINGS_STORAGE_KEY = 'codelens_analyzed_findings_v1';

export function getAllAnalyzedFindings(): import('../services/api').Finding[] {
  try {
    const raw = localStorage.getItem(FINDINGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse analyzed findings from localStorage', err);
    return [];
  }
}

export function saveAnalysisResults(
  analysisRes: import('../services/api').RepositoryAnalysisResponse,
  metadata?: RepositoryMetadata | null
): Repository {
  const parts = analysisRes.repository.full_name.split('/');
  const owner = parts[0] || 'unknown';
  const name = parts[1] || 'repository';
  const repoId = `repo-${owner.toLowerCase()}-${name.toLowerCase()}`;

  // Store findings
  const existingFindings = getAllAnalyzedFindings();
  const otherFindings = existingFindings.filter(
    (f) => f.repository.toLowerCase() !== analysisRes.repository.full_name.toLowerCase()
  );
  const updatedFindings = [...analysisRes.findings, ...otherFindings];

  try {
    localStorage.setItem(FINDINGS_STORAGE_KEY, JSON.stringify(updatedFindings));
  } catch (err) {
    console.error('Failed to save findings to localStorage', err);
  }

  // Calculate health score: 100 - penalties
  const critical = analysisRes.summary.critical;
  const high = analysisRes.summary.high;
  const medium = analysisRes.summary.medium;
  const low = analysisRes.summary.low;
  const penalty = critical * 25 + high * 15 + medium * 5 + low * 2;
  const calculatedHealth = Math.max(10, Math.min(100, 100 - penalty));

  const existingRepos = getInspectedRepositoriesFromStorage();
  const prevRepo = existingRepos.find((r) => r.id === repoId);

  const displayCommitSha =
    analysisRes.repository.commit_sha.length > 7
      ? analysisRes.repository.commit_sha.substring(0, 7)
      : analysisRes.repository.commit_sha;

  const updatedRepoRecord: Repository = {
    id: repoId,
    name: name,
    fullName: analysisRes.repository.full_name,
    owner: owner,
    url: metadata?.html_url || `https://github.com/${analysisRes.repository.full_name}`,
    defaultBranch: metadata?.default_branch || analysisRes.repository.branch,
    selectedBranch: analysisRes.repository.branch,
    language: metadata?.language || prevRepo?.language || 'Multi-language',
    lastAnalyzed: 'Just now',
    bugsCount: analysisRes.findings.length,
    codeHealth: calculatedHealth,
    status: analysisRes.findings.length > 0 ? 'Issues Found' : 'Healthy',
    description:
      metadata?.description ||
      prevRepo?.description ||
      'Public GitHub repository analyzed by TeamPulse.',
    commitSha: displayCommitSha,
    stars: metadata?.stars ?? prevRepo?.stars ?? 0,
    visibility: metadata?.visibility || 'public',
    isInspectedOnly: false,
    inspectionMessage: `Real static analysis completed: ${analysisRes.analysis.findings_count} findings discovered across ${analysisRes.analysis.files_analyzed} files.`,
    latestScanId: analysisRes.scan_id || prevRepo?.latestScanId,
    issueCounts: {
      critical,
      high,
      medium,
      low,
    },
    metrics: {
      reliability: Math.max(15, 100 - (medium * 8 + high * 15)),
      security: Math.max(10, 100 - (critical * 30 + high * 20)),
      maintainability: Math.max(20, 100 - (low * 5 + medium * 5)),
      testCoverage: 75,
    },
    recentActivity: [
      {
        id: `act-${Date.now()}`,
        action: `Static analysis completed: ${analysisRes.findings.length} findings (${analysisRes.analysis.status})`,
        author: 'TeamPulse Engine',
        timestamp: 'Just now',
      },
      ...(prevRepo?.recentActivity || []),
    ],
  };

  const filtered = existingRepos.filter((r) => r.id !== repoId);
  const updatedList = [updatedRepoRecord, ...filtered];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error('Failed to save analyzed repository to localStorage', err);
  }

  window.dispatchEvent(new Event('codelens_repositories_updated'));
  window.dispatchEvent(new Event('codelens_findings_updated'));

  return updatedRepoRecord;
}

const DIAGNOSES_STORAGE_KEY = 'codelens_diagnoses_v1';

export function saveDiagnosisResult(report: import('../services/api').DiagnosisReport): void {
  try {
    const raw = localStorage.getItem(DIAGNOSES_STORAGE_KEY);
    const existing: import('../services/api').DiagnosisReport[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((d) => d.diagnosis_id !== report.diagnosis_id);
    const updated = [report, ...filtered];
    localStorage.setItem(DIAGNOSES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('codelens_diagnoses_updated'));
  } catch (err) {
    console.error('Failed to save diagnosis result to localStorage', err);
  }
}

export function getDiagnosesForRepo(repoFullName: string): import('../services/api').DiagnosisReport[] {
  try {
    const raw = localStorage.getItem(DIAGNOSES_STORAGE_KEY);
    if (!raw) return [];
    const list: import('../services/api').DiagnosisReport[] = JSON.parse(raw);
    return list.filter((d) => d.repository.toLowerCase() === repoFullName.toLowerCase());
  } catch (err) {
    console.error('Failed to parse diagnoses from localStorage', err);
    return [];
  }
}

export function getLatestDiagnosisForRepo(repoFullName: string): import('../services/api').DiagnosisReport | null {
  const all = getDiagnosesForRepo(repoFullName);
  return all.length > 0 ? all[0] : null;
}

const FIXES_STORAGE_KEY = 'codelens_fixes_v1';

export function saveFixProposal(fix: import('../services/api').FixProposal): void {
  try {
    const raw = localStorage.getItem(FIXES_STORAGE_KEY);
    const existing: import('../services/api').FixProposal[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((f) => f.id !== fix.id);
    const updated = [fix, ...filtered];
    localStorage.setItem(FIXES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('codelens_fixes_updated'));
  } catch (err) {
    console.error('Failed to save fix proposal to localStorage', err);
  }
}

export function getAllFixProposals(): import('../services/api').FixProposal[] {
  try {
    const raw = localStorage.getItem(FIXES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse fix proposals from localStorage', err);
    return [];
  }
}

export function getFixProposalsForFinding(findingId: string): import('../services/api').FixProposal[] {
  const all = getAllFixProposals();
  return all.filter((f) => f.finding_id === findingId);
}

const VERIFICATIONS_STORAGE_KEY = 'codelens_verifications_v1';

export function saveVerificationRecord(record: import('../services/api').VerificationRecord): void {
  try {
    const raw = localStorage.getItem(VERIFICATIONS_STORAGE_KEY);
    const existing: import('../services/api').VerificationRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((v) => v.verification_id !== record.verification_id);
    const updated = [record, ...filtered];
    localStorage.setItem(VERIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('codelens_verifications_updated'));
  } catch (err) {
    console.error('Failed to save verification record to localStorage', err);
  }
}

export function getAllVerifications(): import('../services/api').VerificationRecord[] {
  try {
    const raw = localStorage.getItem(VERIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse verification records from localStorage', err);
    return [];
  }
}

export function getVerificationsForFix(fixId: string): import('../services/api').VerificationRecord[] {
  const all = getAllVerifications();
  return all.filter((v) => v.fix_id === fixId);
}

export function getLatestVerificationForFix(fixId: string): import('../services/api').VerificationRecord | null {
  const list = getVerificationsForFix(fixId);
  return list.length > 0 ? list[0] : null;
}

// Step 8 Publishing and Pull Request Store
const PUBLISH_STORAGE_KEY = 'codelens_publish_records_v1';
const PR_STORAGE_KEY = 'codelens_pull_requests_v1';

export function savePublishRecord(record: import('../services/api').PublishBranchResponse): void {
  try {
    const raw = localStorage.getItem(PUBLISH_STORAGE_KEY);
    const existing: import('../services/api').PublishBranchResponse[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((p) => p.fix_id !== record.fix_id);
    const updated = [record, ...filtered];
    localStorage.setItem(PUBLISH_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('codelens_publish_updated'));
  } catch (err) {
    console.error('Failed to save publish record to localStorage', err);
  }
}

export function getAllPublishRecords(): import('../services/api').PublishBranchResponse[] {
  try {
    const raw = localStorage.getItem(PUBLISH_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse publish records from localStorage', err);
    return [];
  }
}

export function getPublishRecordForFix(fixId: string): import('../services/api').PublishBranchResponse | null {
  const all = getAllPublishRecords();
  return all.find((p) => p.fix_id === fixId) || null;
}

export function savePullRequestRecord(record: import('../services/api').PullRequestRecord): void {
  try {
    const raw = localStorage.getItem(PR_STORAGE_KEY);
    const existing: import('../services/api').PullRequestRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((pr) => pr.pull_request_id !== record.pull_request_id);
    const updated = [record, ...filtered];
    localStorage.setItem(PR_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('codelens_pull_requests_updated'));
  } catch (err) {
    console.error('Failed to save PR record to localStorage', err);
  }
}

export function getAllPullRequests(): import('../services/api').PullRequestRecord[] {
  try {
    const raw = localStorage.getItem(PR_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse PR records from localStorage', err);
    return [];
  }
}

export function getPullRequestForFix(fixId: string): import('../services/api').PullRequestRecord | null {
  const all = getAllPullRequests();
  return all.find((pr) => pr.fix_id === fixId) || null;
}



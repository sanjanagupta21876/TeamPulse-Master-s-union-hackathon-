import type {
  DiagnosisReport,
  Finding,
  FixProposal,
  PublishBranchResponse,
  PullRequestRecord,
  RepositoryAnalysisResponse,
  RepositoryMetadata,
  VerificationRecord,
} from '../services/api';
import type { Repository } from '../types';

/*
  Code check results are kept in this browser's localStorage so they survive page reloads.
  The backend keeps its own copy in memory only, so after a backend restart these records
  may refer to scans the backend no longer knows; pages offer "Run checks again" for that.
*/

export const STORE_EVENT = 'teampulse_store_updated';

const KEYS = {
  repositories: 'teampulse_repositories_v2',
  findings: 'teampulse_findings_v2',
  diagnoses: 'teampulse_diagnoses_v2',
  fixes: 'teampulse_fixes_v2',
  verifications: 'teampulse_verifications_v2',
  publishes: 'teampulse_publishes_v2',
  pullRequests: 'teampulse_pull_requests_v2',
};

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage full or blocked; results stay visible until the page reloads
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}

function upsert<T>(key: string, item: T, sameAs: (a: T, b: T) => boolean): void {
  write(key, [item, ...read<T>(key).filter((existing) => !sameAs(existing, item))]);
}

// Repositories ---------------------------------------------------------------

export function getAllRepositories(): Repository[] {
  return read<Repository>(KEYS.repositories);
}

export function getRepositoryById(id: string): Repository | undefined {
  return getAllRepositories().find((r) => r.id === id);
}

export function repositoryId(fullName: string): string {
  return fullName.toLowerCase().replace('/', '--');
}

export function saveAnalysisResults(result: RepositoryAnalysisResponse, metadata?: RepositoryMetadata | null): Repository {
  const fullName = result.repository.full_name;
  const [owner = '', name = fullName] = fullName.split('/');
  const previous = getRepositoryById(repositoryId(fullName));

  const repo: Repository = {
    id: repositoryId(fullName),
    name,
    fullName,
    owner,
    url: metadata?.html_url ?? previous?.url ?? `https://github.com/${fullName}`,
    description: metadata?.description ?? previous?.description ?? null,
    language: metadata?.language ?? previous?.language ?? null,
    stars: metadata?.stars ?? previous?.stars ?? 0,
    defaultBranch: metadata?.default_branch ?? previous?.defaultBranch ?? result.repository.branch,
    branch: result.repository.branch,
    commitSha: result.repository.commit_sha,
    analyzedAt: new Date().toISOString(),
    latestScanId: result.scan_id,
    filesAnalyzed: result.analysis.files_analyzed,
    analysisStatus: result.analysis.status,
    analysisWarnings: result.analysis.warnings,
    findingCounts: { ...result.summary },
  };

  const others = read<Finding>(KEYS.findings).filter((f) => f.repository.toLowerCase() !== fullName.toLowerCase());
  write(KEYS.findings, [...result.findings, ...others]);
  upsert(KEYS.repositories, repo, (a, b) => a.id === b.id);
  return repo;
}

// Findings -------------------------------------------------------------------

export function getAllFindings(): Finding[] {
  return read<Finding>(KEYS.findings);
}

export function getFindingsForRepo(fullName: string): Finding[] {
  return getAllFindings().filter((f) => f.repository.toLowerCase() === fullName.toLowerCase());
}

export function getFindingById(id: string): Finding | undefined {
  return getAllFindings().find((f) => f.id === id);
}

// Diagnoses ------------------------------------------------------------------

export function saveDiagnosis(report: DiagnosisReport): void {
  upsert(KEYS.diagnoses, report, (a, b) => a.diagnosis_id === b.diagnosis_id);
}

export function getLatestDiagnosisForRepo(fullName: string): DiagnosisReport | null {
  return read<DiagnosisReport>(KEYS.diagnoses).find((d) => d.repository.toLowerCase() === fullName.toLowerCase()) ?? null;
}

// Fixes, verification, publishing --------------------------------------------

export function saveFix(fix: FixProposal): void {
  upsert(KEYS.fixes, fix, (a, b) => a.id === b.id);
}

export function getAllFixes(): FixProposal[] {
  return read<FixProposal>(KEYS.fixes);
}

export function getLatestFixForFinding(findingId: string): FixProposal | null {
  return getAllFixes().find((f) => f.finding_id === findingId) ?? null;
}

export function saveVerification(record: VerificationRecord): void {
  upsert(KEYS.verifications, record, (a, b) => a.verification_id === b.verification_id);
}

export function getLatestVerificationForFix(fixId: string): VerificationRecord | null {
  return read<VerificationRecord>(KEYS.verifications).find((v) => v.fix_id === fixId) ?? null;
}

export function savePublish(record: PublishBranchResponse): void {
  upsert(KEYS.publishes, record, (a, b) => a.publish_id === b.publish_id);
}

export function getPublishForFix(fixId: string): PublishBranchResponse | null {
  return read<PublishBranchResponse>(KEYS.publishes).find((p) => p.fix_id === fixId) ?? null;
}

export function savePullRequest(record: PullRequestRecord): void {
  upsert(KEYS.pullRequests, record, (a, b) => a.pull_request_id === b.pull_request_id);
}

export function getPullRequestForFix(fixId: string): PullRequestRecord | null {
  return read<PullRequestRecord>(KEYS.pullRequests).find((p) => p.fix_id === fixId) ?? null;
}

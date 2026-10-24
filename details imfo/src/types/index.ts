export type BugSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type BugCategory = 'Frontend' | 'Backend' | 'Security';

export type BugStatus = 'Open' | 'Resolved' | 'In Review';

export type VerificationStatus = 'Unverified' | 'Verified' | 'Pending Verification' | 'Failed';

export type RepoStatus = 'Analyzed' | 'Issues Found' | 'Healthy' | 'Analyzing' | 'Metadata Retrieved';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner?: string;
  url: string;
  defaultBranch: string;
  selectedBranch?: string | null;
  language: string | null;
  lastAnalyzed: string;
  bugsCount: number;
  codeHealth: number | null; // null for newly inspected repos where bug analysis has not yet run
  status: RepoStatus;
  description: string | null;
  commitSha: string;
  stars?: number;
  visibility?: string;
  isInspectedOnly?: boolean;
  inspectionMessage?: string;
  latestScanId?: string;
  issueCounts?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  metrics?: {
    reliability: number;
    security: number;
    maintainability: number;
    testCoverage: number;
  };
  recentActivity?: {
    id: string;
    action: string;
    author: string;
    timestamp: string;
  }[];
}

export interface BugReport {
  id: string;
  title: string;
  severity: BugSeverity;
  category: BugCategory;
  status: BugStatus;
  file: string;
  lineRange: string;
  detectedAt: string;
  repositoryId: string;
  repositoryName: string;
  description: string;
  rootCause: string;
  suggestedFix: string;
  originalCode: string;
  proposedCode: string;
  verificationStatus: VerificationStatus;
}

export interface FixHistoryItem {
  id: string;
  bugId: string;
  issueTitle: string;
  repositoryName: string;
  date: string;
  fixStatus: 'Applied' | 'Reviewing' | 'Reverted';
  verificationStatus: 'Verified' | 'Pending' | 'Manual Check Needed';
  author: string;
  commitMessage: string;
  file: string;
  originalCode: string;
  proposedCode: string;
}

export interface AnalysisCategoryStat {
  title: string;
  count: number;
  critical: number;
  description: string;
}

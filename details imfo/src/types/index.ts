import type { Finding } from '../services/api';

export type Severity = Finding['severity'];

/** A GitHub repository that has been through code checks, as stored in this browser. */
export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  defaultBranch: string;
  branch: string;
  commitSha: string;
  analyzedAt: string;
  latestScanId?: string;
  filesAnalyzed: number;
  analysisStatus: 'completed' | 'partial' | 'failed';
  analysisWarnings: string[];
  findingCounts: Record<Severity, number>;
}

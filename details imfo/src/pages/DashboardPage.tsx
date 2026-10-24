import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/dashboard/StatCard';
import { CodeHealthCard } from '../components/dashboard/CodeHealthCard';
import { IssueDistributionCard } from '../components/dashboard/IssueDistributionCard';
import { RepositoryTable } from '../components/dashboard/RepositoryTable';
import { RecentBugReports } from '../components/dashboard/RecentBugReports';
import { mockRepositories } from '../data/mockRepositories';
import { getAllRepositories } from '../data/repositoryStore';
import { mockBugs } from '../data/mockBugs';
import type { Repository } from '../types';
import {
  Bug,
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Plus,
  Eye,
  FileDown,
} from 'lucide-react';
import { generateIssuesPdfReport, type ReportItem } from '../utils/pdfGenerator';
import { getAllAnalyzedFindings } from '../data/repositoryStore';
import { useToast } from '../components/ui/Toast';

interface OutletContextType {
  selectedRepoId: string;
  repositories?: Repository[];
  onOpenAnalyzeModal: () => void;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { onOpenAnalyzeModal, repositories: contextRepos } = useOutletContext<OutletContextType>();
  const repos = contextRepos && contextRepos.length > 0 ? contextRepos : getAllRepositories();

  const handleExportDashboardPdf = () => {
    const realFindings = getAllAnalyzedFindings();
    const demoItems: ReportItem[] = mockBugs.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
      category: b.category,
      filePath: b.file,
      lineRange: b.lineRange,
      description: b.description,
      remediation: b.suggestedFix,
      codeExcerpt: b.originalCode,
      rootCause: b.rootCause,
      proposedFix: b.proposedCode,
      verificationStatus: b.verificationStatus,
    }));

    const realItems: ReportItem[] = realFindings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      category: f.category,
      filePath: f.file_path,
      lineRange: f.end_line && f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : `${f.start_line}`,
      description: f.description,
      analyzer: f.analyzer,
      ruleId: f.rule_id,
      remediation: f.remediation,
      codeExcerpt: f.code_excerpt,
      verificationStatus: f.status,
    }));

    const combined = [...realItems, ...demoItems];
    generateIssuesPdfReport(combined, {
      repositoryName: 'All Monitored Repositories',
      generatedAt: new Date().toUTCString(),
    });
    toast('PDF Report Generated', `Downloaded PDF report with ${combined.length} detected issues.`, 'success');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
            Code Intelligence Overview
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Monitor your repositories, identify issues, and track code health.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            leftIcon={<FileDown className="w-4 h-4 text-[#8B5CF6]" />}
            onClick={handleExportDashboardPdf}
          >
            Export PDF Report
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Eye className="w-4 h-4" />}
            onClick={() => navigate('/bugs')}
          >
            View Reports
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onOpenAnalyzeModal}
          >
            Analyze Repository
          </Button>
        </div>
      </div>

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bugs"
          value="24"
          change="8 new this week"
          icon={Bug}
          color="red"
        />
        <StatCard
          title="Critical Issues"
          value="3"
          change="2 unresolved"
          icon={AlertTriangle}
          color="orange"
        />
        <StatCard
          title="Fixes Verified"
          value="18"
          change="75% verification rate"
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Repositories"
          value={repos.length}
          change={`${repos.length} connected`}
          icon={GitBranch}
          color="purple"
        />
      </div>

      {/* Code Health & Issue Distribution 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <CodeHealthCard score={82} statusLabel="Good" />
        <IssueDistributionCard critical={3} high={7} medium={9} low={5} />
      </div>

      {/* Repository Health Table */}
      <RepositoryTable repositories={repos} />

      {/* Recent Bug Reports */}
      <RecentBugReports bugs={mockBugs} />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeverityBadge, RepoStatusBadge } from '../components/ui/Badge';
import { getRepositoryById } from '../data/repositoryStore';
import { mockRepositories } from '../data/mockRepositories';
import { mockBugs } from '../data/mockBugs';
import {
  GitBranch,
  GitCommit,
  Clock,
  Play,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  Star,
  Info,
  Sparkles,
  Network,
  ListOrdered,
  ArrowRight,
  Radio,
  Activity,
  RotateCw,
  Check,
  X,
  Sliders,
  Webhook,
  Terminal,
  Copy,
  Plus,
  RefreshCw,
  GitPullRequest,
  CheckCircle,
  XCircle,
  Layers,
  FileDown,
} from 'lucide-react';
import { generateIssuesPdfReport, type ReportItem } from '../utils/pdfGenerator';
import { useToast } from '../components/ui/Toast';
import {
  getLatestDiagnosisForRepo,
  saveDiagnosisResult,
} from '../data/repositoryStore';
import {
  apiClient,
  type DiagnosisReport,
  type RepositoryMonitoringSettings,
  type AnalysisJobRecord,
  type WebhookEventRecord,
} from '../services/api';

export const RepositoryDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'monitoring' | 'bugs' | 'frontend' | 'backend' | 'security' | 'history' | 'diagnosis'
  >('overview');

  const repo = (id ? getRepositoryById(id) : null) || mockRepositories[0];
  const repoBugs = mockBugs.filter((b) => b.repositoryId === repo.id);

  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(() => {
    return getLatestDiagnosisForRepo(repo.fullName);
  });
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  // Live GitHub Monitoring state
  const [monitoringSettings, setMonitoringSettings] = useState<RepositoryMonitoringSettings | null>(null);
  const [events, setEvents] = useState<WebhookEventRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);
  const [isAnalyzingLatest, setIsAnalyzingLatest] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [newBranchInput, setNewBranchInput] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const ownerName = repo.owner || (repo.fullName.includes('/') ? repo.fullName.split('/')[0] : 'Organization');
  const repoShortName = repo.fullName.includes('/') ? repo.fullName.split('/')[1] : repo.name;

  const fetchMonitoringData = async () => {
    try {
      const [settingsData, eventsData, jobsData] = await Promise.all([
        apiClient.getMonitoringSettings(ownerName, repoShortName).catch(() => null),
        apiClient.getRepositoryEvents(ownerName, repoShortName).catch(() => []),
        apiClient.getRepositoryAnalysisJobs(ownerName, repoShortName).catch(() => []),
      ]);
      if (settingsData) setMonitoringSettings(settingsData);
      setEvents(eventsData);
      setJobs(jobsData);
    } catch {
      // Ignore background poll errors
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 5000);
    return () => clearInterval(interval);
  }, [ownerName, repoShortName]);

  const handleToggleMonitoring = async (enable: boolean) => {
    try {
      if (enable) {
        const updated = await apiClient.enableMonitoring(ownerName, repoShortName);
        setMonitoringSettings(updated);
        toast('Monitoring Enabled', `Live monitoring is now active for ${repo.fullName}.`, 'success');
      } else {
        const updated = await apiClient.disableMonitoring(ownerName, repoShortName);
        setMonitoringSettings(updated);
        toast('Monitoring Paused', `Live monitoring paused for ${repo.fullName}.`, 'info');
      }
    } catch (err: any) {
      toast('Update Failed', err.message || 'Failed to update monitoring status.', 'error');
    }
  };

  const handleToggleAnalyzeAllBranches = async (analyzeAll: boolean) => {
    try {
      const updated = await apiClient.updateMonitoringSettings(ownerName, repoShortName, {
        analyze_all_branches: analyzeAll,
      });
      setMonitoringSettings(updated);
      toast('Settings Saved', analyzeAll ? 'Now monitoring all branches.' : 'Monitoring selected branches only.', 'success');
    } catch (err: any) {
      toast('Update Failed', err.message || 'Failed to update branch settings.', 'error');
    }
  };

  const handleAddBranch = async () => {
    if (!newBranchInput.trim() || !monitoringSettings) return;
    const branchName = newBranchInput.trim();
    if (monitoringSettings.monitored_branches.includes(branchName)) {
      setNewBranchInput('');
      return;
    }
    const updatedBranches = [...monitoringSettings.monitored_branches, branchName];
    try {
      const updated = await apiClient.updateMonitoringSettings(ownerName, repoShortName, {
        monitored_branches: updatedBranches,
      });
      setMonitoringSettings(updated);
      setNewBranchInput('');
      toast('Branch Added', `Added '${branchName}' to monitored branches.`, 'success');
    } catch (err: any) {
      toast('Update Failed', err.message, 'error');
    }
  };

  const handleRemoveBranch = async (branchToRemove: string) => {
    if (!monitoringSettings) return;
    const updatedBranches = monitoringSettings.monitored_branches.filter((b) => b !== branchToRemove);
    try {
      const updated = await apiClient.updateMonitoringSettings(ownerName, repoShortName, {
        monitored_branches: updatedBranches,
      });
      setMonitoringSettings(updated);
      toast('Branch Removed', `Removed '${branchToRemove}' from monitored branches.`, 'info');
    } catch (err: any) {
      toast('Update Failed', err.message, 'error');
    }
  };

  const handleAnalyzeLatestCommit = async () => {
    setIsAnalyzingLatest(true);
    try {
      toast('Analysis Queued', `Triggering live analysis for latest commit on ${repo.fullName}...`, 'info');
      const job = await apiClient.analyzeLatest(ownerName, repoShortName, repo.selectedBranch || undefined);
      setJobs((prev) => [job, ...prev.filter((j) => j.job_id !== job.job_id)]);
      toast('Job Queued', `Job ${job.job_id} is running in background.`, 'success');
      setTimeout(fetchMonitoringData, 1000);
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to trigger latest analysis.';
      toast('Analysis Trigger Failed', msg, 'error');
    } finally {
      setIsAnalyzingLatest(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await apiClient.retryAnalysisJob(jobId);
      toast('Job Retried', res.message, 'info');
      fetchMonitoringData();
    } catch (err: any) {
      toast('Retry Failed', err.message, 'error');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast('Copied to Clipboard', text, 'info');
  };

  const handleExportRepositoryIssuesPdf = () => {
    const reportItems: ReportItem[] = repoBugs.map((b) => ({
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
    generateIssuesPdfReport(reportItems, {
      repositoryName: repo.fullName,
      branch: repo.selectedBranch || repo.defaultBranch,
      commitSha: repo.commitSha,
      codeHealth: repo.codeHealth,
      generatedAt: new Date().toUTCString(),
    });
    toast('PDF Report Generated', `Downloaded report for ${repo.name}.`, 'success');
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    {
      key: 'monitoring',
      label: (
        <span className="flex items-center gap-1.5">
          <Radio className={`w-3 h-3 ${monitoringSettings?.is_active ? 'text-emerald-400 animate-pulse' : 'text-[#71717A]'}`} />
          Live Monitoring
          {jobs.some((j) => j.status === 'running' || j.status === 'queued') && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-0.5" />
          )}
        </span>
      ),
    },
    { key: 'bugs', label: `Bugs (${repoBugs.length})` },
    { key: 'diagnosis', label: 'AI Diagnosis & Cross-Layer' },
    { key: 'frontend', label: 'Frontend' },
    { key: 'backend', label: 'Backend' },
    { key: 'security', label: 'Security' },
    { key: 'history', label: 'Analysis History' },
  ];

  const handleRunRepoDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisError(null);

    try {
      const parts = repo.fullName.split('/');
      const owner = parts[0] || repo.owner || 'unknown';
      const repoName = parts[1] || repo.name;

      if (!repo.latestScanId) {
        toast(
          'Scan Required',
          'Please run a static bug analysis on this repository first so files and findings are indexed.',
          'warning'
        );
        setIsDiagnosing(false);
        return;
      }

      toast(
        'Analyzing Root Causes & Cross-Layer',
        'Retrieving source code context and correlating frontend-backend contracts...',
        'info'
      );

      const report = await apiClient.diagnoseRepository(owner, repoName, repo.latestScanId);
      setDiagnosis(report);
      saveDiagnosisResult(report);
      toast('Diagnosis Generated', 'Root-cause and cross-layer report updated.', 'success');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to complete diagnosis.';
      setDiagnosisError(msg);
      toast('Diagnosis Failed', msg, 'error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          onClick={() => navigate('/repositories')}
        >
          Back to Repositories
        </Button>
      </div>

      {/* Hero Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] shrink-0">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#FAFAFA] tracking-tight">
                  {repo.name}
                </h1>
                <RepoStatusBadge status={repo.status} />
                <span className="text-xs px-2 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                  {repo.language || 'Codebase'}
                </span>
                {repo.stars !== undefined && (
                  <span className="text-xs px-2 py-0.5 rounded bg-[#18181B] text-[#FAFAFA] border border-[#27272A] flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    {repo.stars.toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
                {repo.description || 'No description provided.'}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-[#71717A] flex-wrap font-mono">
                <span className="flex items-center gap-1.5 text-[#A1A1AA]">
                  <span className="text-[#71717A] font-sans">Owner:</span>
                  <span className="font-semibold text-[#FAFAFA]">{ownerName}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#A1A1AA]">
                  <GitBranch className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>default: {repo.defaultBranch}</span>
                  {repo.selectedBranch && repo.selectedBranch !== repo.defaultBranch && (
                    <span className="text-[#3B82F6]">(selected: {repo.selectedBranch})</span>
                  )}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#A1A1AA]">
                  <GitCommit className="w-3.5 h-3.5 text-[#71717A]" />
                  <span>commit {repo.commitSha}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-[#A1A1AA] font-sans">
                  <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                  <span>{repo.lastAnalyzed}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5" />}
              onClick={() => {
                toast(
                  `Scanning ${repo.name}`,
                  repo.isInspectedOnly
                    ? 'In Step 2, metadata is live. AI AST source-code bug analysis will be connected in a later step.'
                    : 'AST deep scan simulation underway.',
                  'info'
                );
              }}
            >
              Run Full Scan
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileDown className="w-3.5 h-3.5 text-[#8B5CF6]" />}
              onClick={handleExportRepositoryIssuesPdf}
            >
              Export PDF Report
            </Button>
            <a
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-xs font-medium text-[#FAFAFA] hover:border-[#3F3F46] transition-all"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </a>
          </div>
        </div>

        {/* Explicit Notice Label for newly inspected repos */}
        {repo.isInspectedOnly && (
          <div className="mt-5 p-3.5 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-start gap-2.5 text-xs text-[#FAFAFA]">
            <Info className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">
                Metadata Retrieved — Bug Analysis Not Yet Run
              </span>
              <p className="text-[#A1A1AA] leading-relaxed text-[11px]">
                Repository details, branch configuration, and commit SHA were retrieved directly from the public GitHub API. Source-code syntax and AST bug analysis has not yet been executed for this repository.
              </p>
            </div>
          </div>
        )}

        {/* Severity Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-[#27272A]">
          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#27272A]">
            <span className="text-[11px] text-[#A1A1AA] uppercase tracking-wider block">Code Health</span>
            <span className="text-2xl font-bold text-[#FAFAFA] font-mono mt-0.5 block">
              {repo.codeHealth !== null ? `${repo.codeHealth}/100` : 'N/A'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#EF4444]/20">
            <span className="text-[11px] text-[#EF4444] uppercase tracking-wider block">Critical</span>
            <span className="text-2xl font-bold text-[#EF4444] font-mono mt-0.5 block">
              {repo.issueCounts?.critical ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#F59E0B]/20">
            <span className="text-[11px] text-[#F59E0B] uppercase tracking-wider block">High</span>
            <span className="text-2xl font-bold text-[#F59E0B] font-mono mt-0.5 block">
              {repo.issueCounts?.high ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#3B82F6]/20">
            <span className="text-[11px] text-[#3B82F6] uppercase tracking-wider block">Medium</span>
            <span className="text-2xl font-bold text-[#3B82F6] font-mono mt-0.5 block">
              {repo.issueCounts?.medium ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-[#0C0C0F] border border-[#71717A]/20">
            <span className="text-[11px] text-[#A1A1AA] uppercase tracking-wider block">Low</span>
            <span className="text-2xl font-bold text-[#A1A1AA] font-mono mt-0.5 block">
              {repo.issueCounts?.low ?? 0}
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs navigation */}
      <div className="flex border-b border-[#27272A] gap-2 overflow-x-auto text-xs font-medium">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-[#8B5CF6] text-[#FAFAFA]'
                : 'border-transparent text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Analysis Activity</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[#27272A]/70 pt-0">
              {repo.recentActivity && repo.recentActivity.length > 0 ? (
                repo.recentActivity.map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6] mt-1.5 shrink-0" />
                      <div>
                        <p className="font-medium text-[#FAFAFA]">{act.action}</p>
                        <span className="text-[11px] text-[#71717A]">by {act.author}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#71717A] shrink-0 font-mono">
                      {act.timestamp}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#71717A]">
                  No analysis activity recorded yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pillar Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Pillars</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {repo.metrics && repo.metrics.reliability > 0 ? (
                <>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#A1A1AA]">Reliability</span>
                      <span className="font-semibold text-[#FAFAFA]">{repo.metrics.reliability}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#18181B] overflow-hidden">
                      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${repo.metrics.reliability}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#A1A1AA]">Security</span>
                      <span className="font-semibold text-[#FAFAFA]">{repo.metrics.security}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#18181B] overflow-hidden">
                      <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${repo.metrics.security}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#A1A1AA]">Maintainability</span>
                      <span className="font-semibold text-[#FAFAFA]">{repo.metrics.maintainability}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#18181B] overflow-hidden">
                      <div className="h-full bg-[#22C55E] rounded-full" style={{ width: `${repo.metrics.maintainability}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#A1A1AA]">Test Coverage</span>
                      <span className="font-semibold text-[#FAFAFA]">{repo.metrics.testCoverage}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#18181B] overflow-hidden">
                      <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${repo.metrics.testCoverage}%` }} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-xs text-[#71717A] space-y-2">
                  <p>Quality scores will populate after source-code AST bug analysis is run.</p>
                  <span className="inline-block text-[11px] text-[#8B5CF6] font-medium bg-[#8B5CF6]/10 px-2 py-0.5 rounded">
                    Metadata Stage
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live GitHub Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Controls & Webhook Header Card */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#27272A]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#FAFAFA] flex items-center gap-2">
                      Live GitHub Repository Monitoring
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        monitoringSettings?.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#27272A] text-[#71717A] border border-[#3F3F46]'
                      }`}>
                        {monitoringSettings?.is_active ? 'Active' : 'Paused'}
                      </span>
                    </h2>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Automatically detects code pushes, analyzes changed files, tracks bug regressions, and compares commit diffs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant={monitoringSettings?.is_active ? 'outline' : 'primary'}
                  size="sm"
                  leftIcon={monitoringSettings?.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  onClick={() => handleToggleMonitoring(!monitoringSettings?.is_active)}
                >
                  {monitoringSettings?.is_active ? 'Pause Monitoring' : 'Enable Monitoring'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Webhook className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                  onClick={() => setShowWebhookModal(true)}
                >
                  Webhook Setup Guide
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={isAnalyzingLatest ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  disabled={isAnalyzingLatest}
                  onClick={handleAnalyzeLatestCommit}
                >
                  {isAnalyzingLatest ? 'Analyzing...' : 'Analyze Latest Commit'}
                </Button>
              </div>
            </div>

            {/* Connection and Status Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="p-3.5 rounded-xl bg-[#0C0C0F] border border-[#27272A]">
                <span className="text-[11px] text-[#71717A] uppercase tracking-wider block">Webhook Delivery Status</span>
                <div className="flex items-center gap-2 mt-1">
                  {monitoringSettings?.webhook_configured ? (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Webhook Connected
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Setup Required
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#71717A] block mt-1">
                  {monitoringSettings?.last_webhook_event_at
                    ? `Last event: ${new Date(monitoringSettings.last_webhook_event_at).toLocaleTimeString()}`
                    : 'Awaiting first webhook delivery'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0C0C0F] border border-[#27272A]">
                <span className="text-[11px] text-[#71717A] uppercase tracking-wider block">Monitored Scope</span>
                <span className="text-xs font-semibold text-[#FAFAFA] block mt-1 font-mono truncate">
                  {monitoringSettings?.analyze_all_branches
                    ? 'All Branches (*)'
                    : monitoringSettings?.monitored_branches?.join(', ') || 'main'}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-1">
                  {monitoringSettings?.analyze_all_branches ? 'Analyzes all incoming pushes' : 'Selective branch filtering'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0C0C0F] border border-[#27272A]">
                <span className="text-[11px] text-[#71717A] uppercase tracking-wider block">Latest Analyzed SHA</span>
                <span className="text-xs font-semibold text-[#8B5CF6] block mt-1 font-mono truncate">
                  {monitoringSettings?.latest_commit_sha ? monitoringSettings.latest_commit_sha.slice(0, 10) : repo.commitSha.slice(0, 10)}
                </span>
                <span className="text-[10px] text-[#71717A] block mt-1">
                  {monitoringSettings?.last_analyzed_at
                    ? `Analyzed at ${new Date(monitoringSettings.last_analyzed_at).toLocaleTimeString()}`
                    : 'No automated scan completed'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0C0C0F] border border-[#27272A]">
                <span className="text-[11px] text-[#71717A] uppercase tracking-wider block">Recent Queue State</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-semibold uppercase font-mono ${
                    monitoringSettings?.latest_job_status === 'completed'
                      ? 'text-emerald-400'
                      : monitoringSettings?.latest_job_status === 'running'
                      ? 'text-cyan-400 animate-pulse'
                      : monitoringSettings?.latest_job_status === 'failed'
                      ? 'text-rose-400'
                      : 'text-[#A1A1AA]'
                  }`}>
                    {monitoringSettings?.latest_job_status || 'Idle'}
                  </span>
                </div>
                <span className="text-[10px] text-[#71717A] block mt-1">
                  {jobs.length} total background jobs tracked
                </span>
              </div>
            </div>

            {/* Branch Monitoring Settings Section */}
            <div className="mt-6 pt-6 border-t border-[#27272A] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-bold text-[#FAFAFA] uppercase tracking-wider">
                    Branch Monitoring Configuration
                  </h3>
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    Choose whether to scan every pushed branch or restrict static analysis to release and staging branches.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#FAFAFA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitoringSettings?.analyze_all_branches || false}
                      onChange={(e) => handleToggleAnalyzeAllBranches(e.target.checked)}
                      className="rounded border-[#3F3F46] bg-[#18181B] text-[#8B5CF6] focus:ring-[#8B5CF6]"
                    />
                    <span>Analyze all branches</span>
                  </label>
                </div>
              </div>

              {!monitoringSettings?.analyze_all_branches && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {monitoringSettings?.monitored_branches.map((br) => (
                      <span
                        key={br}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#18181B] border border-[#27272A] text-xs font-mono text-[#FAFAFA]"
                      >
                        <GitBranch className="w-3 h-3 text-[#8B5CF6]" />
                        {br}
                        <button
                          onClick={() => handleRemoveBranch(br)}
                          className="text-[#71717A] hover:text-rose-400 ml-1 transition-colors"
                          title="Remove branch"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="e.g. staging, dev, release/v1"
                      value={newBranchInput}
                      onChange={(e) => setNewBranchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddBranch()}
                      className="flex-1 bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={handleAddBranch}
                      disabled={!newBranchInput.trim()}
                    >
                      Add Branch
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Finding Comparison Breakdown (Latest Analysis Diff) */}
          <Card className="p-6">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#FAFAFA]">
                    Findings Comparison (Latest Analyzed Commit Diff)
                  </CardTitle>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Categorizes bugs detected in the latest push relative to prior repository scan.
                  </p>
                </div>
                {jobs.length > 0 && jobs[0].comparison && (
                  <span className="text-[11px] font-mono text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded border border-[#8B5CF6]/20">
                    Compared: {jobs[0].comparison.previous_commit_sha ? jobs[0].comparison.previous_commit_sha.slice(0, 8) : 'Initial'} → {jobs[0].comparison.new_commit_sha.slice(0, 8)}
                  </span>
                )}
              </div>
            </CardHeader>

            {jobs.length > 0 && jobs[0].comparison ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      Newly Introduced
                    </span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <span className="text-3xl font-bold text-rose-400 font-mono mt-2 block">
                    +{jobs[0].comparison.new_findings_count}
                  </span>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    New bugs introduced in this commit.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Resolved Defects
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-3xl font-bold text-emerald-400 font-mono mt-2 block">
                    -{jobs[0].comparison.resolved_findings_count}
                  </span>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    Prior issues verified absent in changed files.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      Persistent Issues
                    </span>
                    <Layers className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-3xl font-bold text-blue-400 font-mono mt-2 block">
                    {jobs[0].comparison.persistent_findings_count}
                  </span>
                  <p className="text-[11px] text-[#A1A1AA] mt-1">
                    Existing defects that remain unresolved.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#71717A] bg-[#0C0C0F] rounded-xl border border-[#27272A]">
                <Activity className="w-6 h-6 text-[#71717A] mx-auto mb-2" />
                <p className="font-semibold text-[#FAFAFA]">No Commit Comparison Available Yet</p>
                <p className="mt-1">
                  Push new commits or click <strong>"Analyze Latest Commit"</strong> above to produce a comparative diff between repository versions.
                </p>
              </div>
            )}
          </Card>

          {/* Analysis Jobs & Webhook Events Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Background Analysis Jobs */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-[#FAFAFA] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#8B5CF6]" />
                  Analysis Jobs History
                </CardTitle>
                <button
                  onClick={fetchMonitoringData}
                  className="text-xs text-[#71717A] hover:text-[#FAFAFA] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              <div className="divide-y divide-[#27272A]/70">
                {jobs.length > 0 ? (
                  jobs.map((job) => (
                    <div key={job.job_id} className="py-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-[#FAFAFA]">{job.job_id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] border border-[#27272A] font-mono">
                            {job.branch}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#18181B] text-[#A1A1AA] font-mono">
                            {job.commit_sha.slice(0, 7)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#71717A]">
                          <span>Trigger: {job.trigger}</span>
                          {job.execution_time_seconds && (
                            <>
                              <span>•</span>
                              <span>{job.execution_time_seconds}s</span>
                            </>
                          )}
                          {job.findings_count !== undefined && (
                            <>
                              <span>•</span>
                              <span>{job.findings_count} findings</span>
                            </>
                          )}
                        </div>
                        {job.error && (
                          <p className="text-[11px] text-rose-400 font-mono mt-0.5 truncate max-w-sm">
                            {job.error}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                          job.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : job.status === 'running'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                            : job.status === 'queued'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : job.status === 'partial'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {job.status}
                        </span>

                        {job.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 px-2"
                            leftIcon={<RotateCw className="w-3 h-3" />}
                            onClick={() => handleRetryJob(job.job_id)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-[#71717A]">
                    No analysis jobs queued yet.
                  </div>
                )}
              </div>
            </Card>

            {/* Recent GitHub Webhook Events */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-[#FAFAFA] flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-emerald-400" />
                  Recent GitHub Webhook Deliveries
                </CardTitle>
                <span className="text-[11px] text-[#71717A] font-mono">
                  {events.length} deliveries
                </span>
              </div>

              <div className="divide-y divide-[#27272A]/70">
                {events.length > 0 ? (
                  events.map((ev) => (
                    <div key={ev.delivery_id} className="py-3.5 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                            ev.event_type === 'push'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : ev.event_type === 'pull_request'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {ev.event_type}
                          </span>
                          <span className="font-semibold text-[#FAFAFA] font-mono">
                            {ev.branch || 'repository'}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#71717A] font-mono">
                          {new Date(ev.received_at).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                        <span>
                          by {ev.sender || 'github'} • {ev.commits_count} commits
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          ev.status === 'queued' || ev.status === 'processed'
                            ? 'text-emerald-400'
                            : 'text-[#71717A]'
                        }`}>
                          {ev.status}
                        </span>
                      </div>

                      {(ev.added_files.length > 0 || ev.modified_files.length > 0 || ev.removed_files.length > 0) && (
                        <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-[#71717A]">
                          {ev.added_files.length > 0 && (
                            <span className="text-emerald-400">+{ev.added_files.length} added</span>
                          )}
                          {ev.modified_files.length > 0 && (
                            <span className="text-blue-400">~{ev.modified_files.length} modified</span>
                          )}
                          {ev.removed_files.length > 0 && (
                            <span className="text-rose-400">-{ev.removed_files.length} removed</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-[#71717A]">
                    No webhook deliveries received yet. Check the setup guide to connect your repository.
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Webhook Configuration Modal */}
          {showWebhookModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
              <Card className="w-full max-w-lg p-6 bg-[#121216] border border-[#27272A] shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#FAFAFA]">
                    <Webhook className="w-4 h-4 text-[#8B5CF6]" />
                    GitHub Webhook Setup Instructions
                  </div>
                  <button
                    onClick={() => setShowWebhookModal(false)}
                    className="text-[#71717A] hover:text-[#FAFAFA] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  Configure a GitHub webhook in your repository settings to enable automatic push detection, changed-file AST scans, and instant dashboard updates.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                      Payload URL
                    </label>
                    <div className="flex items-center gap-2 bg-[#0C0C0F] border border-[#27272A] rounded-lg p-2 font-mono text-[11px] text-[#FAFAFA]">
                      <span className="truncate flex-1">http://localhost:8000/api/webhooks/github</span>
                      <button
                        onClick={() => copyToClipboard('http://localhost:8000/api/webhooks/github', 'url')}
                        className="text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                        title="Copy URL"
                      >
                        {copiedField === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                      Content type
                    </label>
                    <div className="bg-[#0C0C0F] border border-[#27272A] rounded-lg p-2 font-mono text-[11px] text-[#FAFAFA]">
                      application/json
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                      Secret (HMAC-SHA256)
                    </label>
                    <div className="flex items-center gap-2 bg-[#0C0C0F] border border-[#27272A] rounded-lg p-2 font-mono text-[11px] text-[#FAFAFA]">
                      <span className="truncate flex-1">codelens_dev_webhook_secret_key</span>
                      <button
                        onClick={() => copyToClipboard('codelens_dev_webhook_secret_key', 'secret')}
                        className="text-[#8B5CF6] hover:text-[#A78BFA] transition-colors"
                        title="Copy Secret"
                      >
                        {copiedField === 'secret' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider block mb-1">
                      Events to Select
                    </label>
                    <ul className="list-disc list-inside space-y-1 text-[#A1A1AA] text-[11px]">
                      <li><strong className="text-[#FAFAFA]">Pushes</strong> — triggers automatic commit analysis</li>
                      <li><strong className="text-[#FAFAFA]">Pull requests</strong> — tracks PR reviews and branch updates</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#27272A] flex justify-end">
                  <Button variant="primary" size="sm" onClick={() => setShowWebhookModal(false)}>
                    Got it, Close
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Bugs Tab */}
      {(activeTab === 'bugs' || activeTab === 'frontend' || activeTab === 'backend' || activeTab === 'security') && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>
              {activeTab === 'bugs' ? 'All Repository Issues' : `${activeTab.toUpperCase()} Findings`}
            </CardTitle>
          </CardHeader>
          <div className="divide-y divide-[#27272A]/70">
            {repoBugs.length > 0 ? (
              repoBugs
                .filter((b) =>
                  activeTab === 'bugs'
                    ? true
                    : b.category.toLowerCase() === activeTab
                )
                .map((bug) => (
                  <div
                    key={bug.id}
                    className="p-4 hover:bg-[#18181B]/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <SeverityBadge severity={bug.severity} size="sm" />
                      <div className="min-w-0">
                        <button
                          onClick={() => navigate(`/bugs/${bug.id}`)}
                          className="text-xs sm:text-sm font-semibold text-[#FAFAFA] hover:text-[#8B5CF6] text-left block truncate"
                        >
                          {bug.title}
                        </button>
                        <div className="mt-1 flex items-center gap-2 text-xs text-[#71717A] font-mono">
                          <FileCode className="w-3.5 h-3.5" />
                          <span className="truncate">{bug.file}</span>
                          <span>•</span>
                          <span className="font-sans">{bug.detectedAt}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/bugs/${bug.id}`)}
                    >
                      Inspect
                    </Button>
                  </div>
                ))
            ) : (
              <div className="p-8 text-center text-xs text-[#71717A] space-y-1">
                <CheckCircle2 className="w-8 h-8 text-[#22C55E] mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-[#FAFAFA]">No active bugs recorded for this repository</p>
                <p>
                  {repo.isInspectedOnly
                    ? 'Metadata retrieved from GitHub. Bug detection analysis will be executed in a future milestone.'
                    : 'Clean scan reported.'}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* AI Diagnosis & Cross-Layer Tab */}
      {activeTab === 'diagnosis' && (
        <div className="space-y-6">
          <Card className="p-6 border-[#8B5CF6]/30 bg-gradient-to-br from-[#12111A] to-[#0D0D12]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#FAFAFA] flex items-center gap-2">
                    AI Root-Cause Diagnosis & Cross-Layer Correlation
                    {diagnosis && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase ${
                          diagnosis.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {diagnosis.status}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-[#A1A1AA]">
                    Synthesizes static findings, inspects API contracts, and plans an optimal remediation order
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isDiagnosing}
                  leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  onClick={handleRunRepoDiagnosis}
                >
                  {diagnosis ? 'Re-run Diagnosis' : 'Run AI Diagnosis'}
                </Button>
              </div>
            </div>

            {diagnosisError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{diagnosisError}</span>
              </div>
            )}

            {diagnosis ? (
              <div className="mt-6 space-y-6">
                <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A]">
                  <span className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider block mb-1">
                    Executive Summary
                  </span>
                  <p className="text-xs text-[#FAFAFA] leading-relaxed">
                    {diagnosis.summary}
                  </p>
                </div>

                {/* Root Causes */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Identified Root Causes
                  </h3>
                  {diagnosis.root_causes.map((rc, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#0F0F14] border border-[#27272A] space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-bold text-[#FAFAFA]">{rc.title}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#A78BFA] font-mono border border-[#8B5CF6]/30">
                          {rc.confidence} confidence
                        </span>
                      </div>
                      <p className="text-xs text-[#A1A1AA]">{rc.explanation}</p>
                      {rc.recommended_actions && rc.recommended_actions.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">
                            Recommended Action:
                          </span>
                          <ul className="list-disc list-inside text-xs text-[#71717A] space-y-0.5">
                            {rc.recommended_actions.map((act, aIdx) => (
                              <li key={aIdx}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cross Layer Relationships */}
                {diagnosis.relationships && diagnosis.relationships.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-[#3B82F6]" />
                      <h3 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Frontend ↔ Backend Correlations & Mismatches
                      </h3>
                    </div>
                    {diagnosis.relationships.map((rel, rIdx) => {
                      const isMismatch = rel.evidence.toLowerCase().includes('mismatch') ||
                        rel.evidence.toLowerCase().includes('missing');
                      return (
                        <div
                          key={rIdx}
                          className={`p-3.5 rounded-xl border text-xs ${
                            isMismatch ? 'bg-rose-500/5 border-rose-500/30' : 'bg-[#18181B] border-[#27272A]'
                          }`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2 font-mono text-[11px]">
                            <span className="text-[#FAFAFA]">{rel.source_file} ({rel.source_location})</span>
                            <ArrowRight className="w-3 h-3 text-[#8B5CF6]" />
                            <span className="text-[#FAFAFA]">{rel.target_file || 'API Gateway'} ({rel.target_location || 'Endpoint'})</span>
                            <span className="text-[#A1A1AA]">{rel.relationship_type}</span>
                          </div>
                          <p className={`mt-1.5 ${isMismatch ? 'text-rose-300 font-medium' : 'text-[#A1A1AA]'}`}>
                            {rel.evidence}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Remediation Fix Order */}
                {diagnosis.remediation_order && diagnosis.remediation_order.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-[#10B981]" />
                      <h3 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                        Recommended Investigation & Fix Sequence
                      </h3>
                    </div>
                    {diagnosis.remediation_order.map((step) => (
                      <div key={step.order} className="p-3 rounded-lg bg-[#18181B] border border-[#27272A] flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-[#8B5CF6]/20 text-[#A78BFA] font-mono text-xs flex items-center justify-center shrink-0">
                          {step.order}
                        </span>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#FAFAFA]">{step.title}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-[#27272A] text-[#A1A1AA] font-mono">
                              {step.priority_label}
                            </span>
                          </div>
                          <p className="text-xs text-[#A1A1AA]">{step.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-[#71717A] mx-auto" />
                <p className="text-sm font-semibold text-[#FAFAFA]">
                  No AI Root-Cause Diagnosis Available Yet
                </p>
                <p className="text-xs text-[#71717A] max-w-md mx-auto">
                  Click <strong>"Run AI Diagnosis"</strong> above to inspect contract relationships,
                  detect HTTP mismatches, and prioritize fix sequences.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="p-4 rounded-xl bg-[#0C0C0F] border border-[#27272A] flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-[#FAFAFA]">
                  {repo.isInspectedOnly ? 'GitHub API Public Metadata Retrieval' : 'Automated nightly AST scan'}
                </span>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                  Commit {repo.commitSha} on branch {repo.selectedBranch || repo.defaultBranch}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#22C55E] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
                <span className="text-[#71717A] font-mono">{repo.lastAnalyzed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

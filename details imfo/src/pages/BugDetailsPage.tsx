import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeverityBadge, VerificationStatusBadge } from '../components/ui/Badge';
import { CodeComparison } from '../components/bugs/CodeComparison';
import { Modal } from '../components/ui/Modal';
import { mockBugs } from '../data/mockBugs';
import {
  getAllAnalyzedFindings,
  getInspectedRepositoriesFromStorage,
  getLatestDiagnosisForRepo,
  saveDiagnosisResult,
  getFixProposalsForFinding,
  saveFixProposal,
  saveVerificationRecord,
  getLatestVerificationForFix,
  savePublishRecord,
  getPublishRecordForFix,
  savePullRequestRecord,
  getPullRequestForFix,
} from '../data/repositoryStore';
import {
  apiClient,
  type DiagnosisReport,
  type Finding,
  type FixProposal,
  type VerificationRecord,
  type GitHubAuthStatus,
  type PublishBranchResponse,
  type PullRequestRecord,
  type PublishEligibilityCheck,
} from '../services/api';
import type { BugStatus, VerificationStatus } from '../types';
import {
  ArrowLeft,
  FileCode,
  Tag,
  AlertOctagon,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  GitBranch,
  Split,
  Info,
  Network,
  ListOrdered,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  GitCommit,
  Clock,
  ShieldAlert,
  GitPullRequest,
  ExternalLink,
  Lock,
  Unlock,
  Send,
  FileDown,
} from 'lucide-react';
import { generateIssuesPdfReport } from '../utils/pdfGenerator';
import { useToast } from '../components/ui/Toast';

export const BugDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 1. Resolve finding from scanned results or mock data
  const allScanned = getAllAnalyzedFindings();
  const matchedScanned = allScanned.find((f) => f.id === id);
  const fallbackMock = mockBugs.find((b) => b.id === id) || mockBugs[0];

  const initialBug = matchedScanned
    ? {
        id: matchedScanned.id,
        title: matchedScanned.title,
        severity: (matchedScanned.severity.charAt(0).toUpperCase() +
          matchedScanned.severity.slice(1)) as any,
        category: (matchedScanned.category.charAt(0).toUpperCase() +
          matchedScanned.category.slice(1)) as any,
        status: (matchedScanned.status.charAt(0).toUpperCase() +
          matchedScanned.status.slice(1)) as BugStatus,
        verificationStatus: 'Unverified' as VerificationStatus,
        file: matchedScanned.file_path,
        lineRange: `L${matchedScanned.start_line}${
          matchedScanned.end_line && matchedScanned.end_line !== matchedScanned.start_line
            ? `-${matchedScanned.end_line}`
            : ''
        }`,
        detectedAt: 'Real Scan Finding',
        repositoryId: matchedScanned.repository,
        repositoryName: matchedScanned.repository,
        description: matchedScanned.description,
        rootCause: `Identified by ${matchedScanned.analyzer} rule ${matchedScanned.rule_id} (${matchedScanned.confidence} confidence).`,
        suggestedFix: matchedScanned.remediation,
        originalCode: matchedScanned.code_excerpt || '// Code excerpt not captured during scan',
        proposedCode: `// Proposed remediation:\n// ${matchedScanned.remediation}\n${matchedScanned.code_excerpt || ''}`,
        isRealFinding: true,
        rawFinding: matchedScanned,
      }
    : {
        ...fallbackMock,
        isRealFinding: false,
        rawFinding: null as Finding | null,
      };

  // Local state
  const [bugStatus, setBugStatus] = useState<BugStatus>(initialBug.status);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    initialBug.verificationStatus
  );
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Diagnosis state
  const [diagnosis, setDiagnosis] = useState<DiagnosisReport | null>(() => {
    return getLatestDiagnosisForRepo(initialBug.repositoryName);
  });
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  // Step 6 Fix Proposal state
  const [fixProposal, setFixProposal] = useState<FixProposal | null>(() => {
    const existing = getFixProposalsForFinding(initialBug.id);
    return existing.length > 0 ? existing[0] : null;
  });
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  const [fixInstructions, setFixInstructions] = useState('');
  const [fixActionLoading, setFixActionLoading] = useState(false);

  // Step 7 Verification state
  const [runStaticChecks, setRunStaticChecks] = useState(true);
  const [runTests, setRunTests] = useState(false);
  const [verificationRecord, setVerificationRecord] = useState<VerificationRecord | null>(() => {
    const existingFixes = getFixProposalsForFinding(initialBug.id);
    if (existingFixes.length > 0) {
      return getLatestVerificationForFix(existingFixes[0].id);
    }
    return null;
  });

  // Step 8 Publishing and Pull Request state
  const [githubAuth, setGithubAuth] = useState<GitHubAuthStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [targetBranch, setTargetBranch] = useState(initialBug.rawFinding?.branch || 'main');
  const [customBranchName, setCustomBranchName] = useState('');
  const [publishRecord, setPublishRecord] = useState<PublishBranchResponse | null>(() => {
    const existingFixes = getFixProposalsForFinding(initialBug.id);
    if (existingFixes.length > 0) {
      return getPublishRecordForFix(existingFixes[0].id);
    }
    return null;
  });
  const [pullRequest, setPullRequest] = useState<PullRequestRecord | null>(() => {
    const existingFixes = getFixProposalsForFinding(initialBug.id);
    if (existingFixes.length > 0) {
      return getPullRequestForFix(existingFixes[0].id);
    }
    return null;
  });
  const [isPublishingBranch, setIsPublishingBranch] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [confirmPRChecked, setConfirmPRChecked] = useState(false);
  const [eligibility, setEligibility] = useState<PublishEligibilityCheck | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  useEffect(() => {
    const existingDiag = getLatestDiagnosisForRepo(initialBug.repositoryName);
    if (existingDiag) setDiagnosis(existingDiag);

    const syncFixes = () => {
      const existingFixes = getFixProposalsForFinding(initialBug.id);
      if (existingFixes.length > 0) {
        setFixProposal(existingFixes[0]);
        setVerificationRecord(getLatestVerificationForFix(existingFixes[0].id));
        setPublishRecord(getPublishRecordForFix(existingFixes[0].id));
        setPullRequest(getPullRequestForFix(existingFixes[0].id));
      }
    };
    syncFixes();

    window.addEventListener('codelens_fixes_updated', syncFixes);
    window.addEventListener('codelens_verifications_updated', syncFixes);
    window.addEventListener('codelens_publish_updated', syncFixes);
    window.addEventListener('codelens_pull_requests_updated', syncFixes);
    return () => {
      window.removeEventListener('codelens_fixes_updated', syncFixes);
      window.removeEventListener('codelens_verifications_updated', syncFixes);
      window.removeEventListener('codelens_publish_updated', syncFixes);
      window.removeEventListener('codelens_pull_requests_updated', syncFixes);
    };
  }, [initialBug.id, initialBug.repositoryName]);

  // Load GitHub Auth & Backend Status on mount
  useEffect(() => {
    const loadAuth = async () => {
      setIsCheckingAuth(true);
      try {
        const auth = await apiClient.getGitHubAuthStatus();
        setGithubAuth(auth);
      } catch (err) {
        console.error('Failed to get GitHub auth status', err);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    loadAuth();
  }, []);

  // Sync publish status and eligibility from backend when proposal or branch changes
  useEffect(() => {
    if (!fixProposal) return;

    const loadPublishStatus = async () => {
      try {
        const statusRes = await apiClient.getPublishStatus(fixProposal.id);
        if (statusRes.publish_record) {
          setPublishRecord(statusRes.publish_record);
          savePublishRecord(statusRes.publish_record);
        }
        if (statusRes.pull_request) {
          setPullRequest(statusRes.pull_request);
          savePullRequestRecord(statusRes.pull_request);
        }
      } catch {
        // Fall back to localStorage
      }

      try {
        setIsCheckingEligibility(true);
        const elig = await apiClient.checkPublishEligibility(fixProposal.id, targetBranch);
        setEligibility(elig);
      } catch (err) {
        console.error('Eligibility check error', err);
      } finally {
        setIsCheckingEligibility(false);
      }
    };

    loadPublishStatus();
  }, [fixProposal?.id, targetBranch]);

  const handleExportSingleBugPdf = () => {
    generateIssuesPdfReport(
      [
        {
          id: initialBug.id,
          title: initialBug.title,
          severity: initialBug.severity,
          category: initialBug.category,
          filePath: initialBug.file,
          lineRange: initialBug.lineRange,
          description: initialBug.description,
          remediation: initialBug.suggestedFix,
          codeExcerpt: initialBug.originalCode,
          rootCause: initialBug.rootCause,
          proposedFix: fixProposal ? fixProposal.proposed_content : initialBug.proposedCode,
          verificationStatus: verificationStatus,
          ruleId: initialBug.rawFinding?.rule_id,
          analyzer: initialBug.rawFinding?.analyzer,
          suggestedFix: initialBug.suggestedFix,
        },
      ],
      {
        repositoryName: initialBug.repositoryName,
        branch: targetBranch,
        generatedAt: new Date().toUTCString(),
      }
    );
    toast('PDF Exported', `Downloaded PDF report for issue ${initialBug.id.slice(0, 8)}.`, 'success');
  };

  const handleToggleResolve = () => {
    if (bugStatus === 'Resolved') {
      setBugStatus('Open');
      toast('Bug Reopened', 'Status marked as Open in session.', 'info');
    } else {
      setBugStatus('Resolved');
      toast('Bug Marked as Resolved', 'Resolved state persisted in session.', 'success');
    }
  };

  const handleRunVerification = async () => {
    if (!fixProposal) {
      toast('Proposal Required', 'Please generate an AI fix proposal first.', 'warning');
      return;
    }

    if (fixProposal.status !== 'approved') {
      toast(
        'Approval Required',
        'Proposal must be approved before executing isolated verification checks.',
        'warning'
      );
      return;
    }

    setIsVerifying(true);
    toast('Verification Started', 'Spinning up isolated ephemeral workspace and applying patch...', 'info');

    try {
      const record = await apiClient.verifyFix(fixProposal.id, runTests, runStaticChecks);
      saveVerificationRecord(record);
      setVerificationRecord(record);

      if (record.status === 'completed') {
        setVerificationStatus('Verified');
        toast('Verification Succeeded', record.assessment, 'success');
      } else if (record.status === 'partial') {
        setVerificationStatus('Unverified');
        toast('Verification Warning', record.assessment, 'warning');
      } else {
        setVerificationStatus('Failed');
        toast('Verification Failed', record.assessment, 'error');
      }
    } catch (err: any) {
      toast(
        'Verification Error',
        err?.error?.message || 'Isolated verification encountered an unexpected error.',
        'error'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosisError(null);

    try {
      const parts = initialBug.repositoryName.split('/');
      const owner = parts[0];
      const repo = parts[1];

      if (!owner || !repo) {
        throw new Error('Invalid repository identifier for diagnosis.');
      }

      const allRepos = getInspectedRepositoriesFromStorage();
      const currentRepoRecord = allRepos.find(
        (r) => r.fullName.toLowerCase() === initialBug.repositoryName.toLowerCase()
      );
      const scanId = currentRepoRecord?.latestScanId;

      if (!scanId) {
        toast(
          'Scan ID Required',
          'Please run a static bug analysis on this repository first so files and findings are indexed.',
          'warning'
        );
        setIsDiagnosing(false);
        return;
      }

      toast('Analyzing Root Causes', 'Retrieving source context and querying diagnostic reasoning...', 'info');

      const report = await apiClient.diagnoseRepository(
        owner,
        repo,
        scanId,
        matchedScanned ? [matchedScanned.id] : []
      );

      setDiagnosis(report);
      saveDiagnosisResult(report);
      toast('Diagnosis Complete', 'AI root-cause diagnosis report generated.', 'success');
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to complete root-cause diagnosis.';
      setDiagnosisError(message);
      toast('Diagnosis Failed', message, 'error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Step 6: Generate AI Fix Proposal
  const handleGenerateFix = async () => {
    setIsGeneratingFix(true);
    try {
      toast('Synthesizing Code Fix', 'Loading original commit source code and generating minimal patch...', 'info');

      const proposal = await apiClient.generateFix(
        initialBug.id,
        diagnosis?.diagnosis_id || null,
        fixInstructions || null
      );

      setFixProposal(proposal);
      saveFixProposal(proposal);
      toast('Fix Proposal Ready', 'AI code patch generated and validated with diff review.', 'success');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to generate fix proposal.';
      toast('Fix Generation Failed', msg, 'error');
    } finally {
      setIsGeneratingFix(false);
    }
  };

  // Step 6: Approve Fix Proposal
  const handleApproveFix = async () => {
    if (!fixProposal) return;
    setFixActionLoading(true);
    try {
      const res = await apiClient.approveFix(fixProposal.id);
      setFixProposal(res.fix);
      saveFixProposal(res.fix);
      toast('Proposal Approved', 'Review accepted. Original repository remains safely unchanged.', 'success');
    } catch (err: any) {
      toast('Approval Failed', err?.message || 'Could not approve fix.', 'error');
    } finally {
      setFixActionLoading(false);
    }
  };

  // Step 6: Reject Fix Proposal
  const handleRejectFix = async () => {
    if (!fixProposal) return;
    setFixActionLoading(true);
    try {
      const res = await apiClient.rejectFix(fixProposal.id);
      setFixProposal(res.fix);
      saveFixProposal(res.fix);
      toast('Proposal Rejected', 'Fix proposal marked as rejected in audit history.', 'info');
    } catch (err: any) {
      toast('Rejection Failed', err?.message || 'Could not reject fix.', 'error');
    } finally {
      setFixActionLoading(false);
    }
  };

  // Step 6: Regenerate Fix Proposal
  const handleRegenerateFix = async () => {
    if (!fixProposal) return;
    setIsGeneratingFix(true);
    try {
      toast('Regenerating Fix', 'Creating alternative proposal while preserving history...', 'info');
      const newProposal = await apiClient.regenerateFix(fixProposal.id, fixInstructions || null);
      setFixProposal(newProposal);
      saveFixProposal(newProposal);
      toast('New Proposal Generated', 'Alternative fix created with distinct audit ID.', 'success');
    } catch (err: any) {
      toast('Regeneration Failed', err?.message || 'Could not regenerate fix.', 'error');
    } finally {
      setIsGeneratingFix(false);
    }
  };

  // Step 8: Publish to Isolated Branch
  const handlePublishBranch = async () => {
    if (!fixProposal) return;
    if (fixProposal.status !== 'approved') {
      toast('Approval Required', 'Fix proposal must be approved before publishing.', 'warning');
      return;
    }
    if (
      !verificationRecord ||
      verificationRecord.patch_application_status !== 'applied' ||
      verificationRecord.static_checks_status !== 'passed'
    ) {
      toast('Verification Required', 'Fix proposal must pass isolated verification before publishing.', 'warning');
      return;
    }

    setIsPublishingBranch(true);
    toast('Publishing Fix Branch', 'Creating dedicated branch and committing approved changes...', 'info');

    try {
      const res = await apiClient.publishBranch(fixProposal.id, {
        target_branch: targetBranch || null,
        custom_branch_name: customBranchName.trim() || null,
      });
      setPublishRecord(res);
      savePublishRecord(res);
      toast('Branch Created', `Changes committed to ${res.created_branch} (${res.published_commit_sha.slice(0, 7)})`, 'success');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Branch creation failed.';
      toast('Publish Failed', msg, 'error');
    } finally {
      setIsPublishingBranch(false);
    }
  };

  // Step 8: Create GitHub Pull Request
  const handleCreatePR = async () => {
    if (!fixProposal || !publishRecord) return;
    if (!confirmPRChecked) {
      toast('Confirmation Required', 'Please confirm PR review before opening.', 'warning');
      return;
    }

    setIsCreatingPR(true);
    toast('Preparing Pull Request', 'Generating PR summary and submitting to GitHub...', 'info');

    try {
      const defaultTitle = `fix: ${initialBug.title} [TeamPulse]`;
      const res = await apiClient.createPullRequest(fixProposal.id, {
        title: prTitle.trim() || defaultTitle,
        confirm_creation: true,
      });
      setPullRequest(res);
      savePullRequestRecord(res);
      toast('Pull Request Created', `PR #${res.pr_number} successfully opened on GitHub!`, 'success');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Failed to create pull request.';
      toast('PR Creation Failed', msg, 'error');
    } finally {
      setIsCreatingPR(false);
    }
  };

  const getPublishingStage = () => {
    if (!fixProposal) return { label: 'No Proposal', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    if (fixProposal.status !== 'approved') return { label: 'Awaiting Approval', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    if (!verificationRecord) return { label: 'Awaiting Verification', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    if (verificationRecord.patch_application_status !== 'applied' || verificationRecord.static_checks_status !== 'passed') {
      return { label: 'Verification Failed', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
    if (isPublishingBranch) return { label: 'Creating Branch', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' };
    if (isCreatingPR) return { label: 'Creating Pull Request', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' };
    if (pullRequest) return { label: 'Pull Request Open', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (publishRecord) return { label: 'Commit Created', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    return { label: 'Ready to Publish', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
  };

  const originalDisplayCode = fixProposal ? fixProposal.original_content : initialBug.originalCode;
  const proposedDisplayCode = fixProposal ? fixProposal.proposed_content : initialBug.proposedCode;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          onClick={() => navigate('/bugs')}
        >
          Back to Bug Reports
        </Button>

        <div className="flex items-center gap-2">
          {initialBug.isRealFinding && (
            <span className="px-2.5 py-0.5 text-xs font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Live Scanned Finding
            </span>
          )}
          <span className="text-xs text-[#71717A]">
            Issue ID: <strong className="font-mono text-[#FAFAFA]">{initialBug.id}</strong>
          </span>
        </div>
      </div>

      {/* Main Issue Header Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <SeverityBadge severity={initialBug.severity} />
              <span className="px-2.5 py-1 text-xs rounded-full bg-[#18181B] text-[#A1A1AA] border border-[#27272A] flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {initialBug.category}
              </span>
              <span
                className={`px-2.5 py-1 text-xs rounded-full border ${
                  bugStatus === 'Resolved'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {bugStatus}
              </span>
              <VerificationStatusBadge status={verificationStatus} />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#FAFAFA] tracking-tight">
              {initialBug.title}
            </h1>

            <div className="flex items-center gap-4 text-xs text-[#71717A] flex-wrap font-mono pt-1">
              <span className="flex items-center gap-1 text-[#A1A1AA]">
                <FileCode className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{initialBug.file}</span>
                <span className="text-[#8B5CF6]">({initialBug.lineRange})</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-sans text-[#A1A1AA]">
                <GitBranch className="w-3.5 h-3.5 text-[#71717A]" />
                <span>{initialBug.repositoryName}</span>
              </span>
              <span>•</span>
              <span className="font-sans text-[#71717A]">
                {initialBug.detectedAt}
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <Button
              variant="primary"
              size="sm"
              isLoading={isGeneratingFix}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-white" />}
              onClick={handleGenerateFix}
            >
              {fixProposal ? 'Regenerate Fix' : 'Generate AI Fix'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Split className="w-3.5 h-3.5 text-[#8B5CF6]" />}
              onClick={() => setDiffModalOpen(true)}
            >
              Review Diff
            </Button>

            <Button
              variant={bugStatus === 'Resolved' ? 'outline' : 'success'}
              size="sm"
              leftIcon={
                bugStatus === 'Resolved' ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )
              }
              onClick={handleToggleResolve}
            >
              {bugStatus === 'Resolved' ? 'Reopen Issue' : 'Mark as Resolved'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileDown className="w-3.5 h-3.5 text-[#8B5CF6]" />}
              onClick={handleExportSingleBugPdf}
            >
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* SECTION: AI Suggested Fix & Code Diff Review */}
      <Card className="p-6 border-[#8B5CF6]/30 bg-gradient-to-br from-[#12111A] to-[#0D0D12]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[#FAFAFA]">
                  AI Suggested Fix & Code Diff Review
                </h2>
                {fixProposal && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold ${
                      fixProposal.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : fixProposal.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : fixProposal.status === 'invalid'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}
                  >
                    Proposal Status: {fixProposal.status}
                  </span>
                )}
              </div>
              <span className="text-xs text-[#71717A]">
                Targeted source code repair at commit {initialBug.rawFinding?.commit_sha || 'scanned'}
              </span>
            </div>
          </div>

          {/* Fix Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {fixProposal ? (
              <>
                <Button
                  variant="success"
                  size="sm"
                  isLoading={fixActionLoading}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={handleApproveFix}
                  disabled={fixProposal.status === 'approved'}
                >
                  {fixProposal.status === 'approved' ? 'Approved' : 'Approve Proposal'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  isLoading={fixActionLoading}
                  leftIcon={<X className="w-3.5 h-3.5 text-rose-400" />}
                  onClick={handleRejectFix}
                  disabled={fixProposal.status === 'rejected'}
                  className="hover:border-rose-500/50 hover:bg-rose-500/10"
                >
                  {fixProposal.status === 'rejected' ? 'Rejected' : 'Reject Proposal'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isGeneratingFix}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={handleRegenerateFix}
                >
                  Regenerate
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                isLoading={isGeneratingFix}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-white" />}
                onClick={handleGenerateFix}
              >
                Generate Fix
              </Button>
            )}
          </div>
        </div>

        {/* Optional Guidance Input */}
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={fixInstructions}
            onChange={(e) => setFixInstructions(e.target.value)}
            placeholder="Optional prompt guidance (e.g. 'keep change minimal', 'preserve existing API contract')..."
            className="flex-1 bg-[#09090B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-[#FAFAFA] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        {fixProposal ? (
          <div className="space-y-4">
            {/* Validation Badges Row */}
            <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-lg bg-[#18181B] border border-[#27272A] text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-[#A1A1AA]">Syntax Check:</span>
                  <span
                    className={`font-semibold ${
                      fixProposal.validation.syntax_check === 'passed'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {fixProposal.validation.syntax_check}
                  </span>
                </span>

                <span className="flex items-center gap-1.5 font-mono">
                  <span className="text-[#A1A1AA]">Integrity:</span>
                  <span
                    className={`font-semibold ${
                      fixProposal.validation.patch_integrity === 'valid'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {fixProposal.validation.patch_integrity}
                  </span>
                </span>

                {fixProposal.diff && (
                  <span className="flex items-center gap-2 font-mono">
                    <span className="text-emerald-400">+{fixProposal.diff.additions}</span>
                    <span className="text-rose-400">-{fixProposal.diff.deletions}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[#71717A] text-[11px] font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>Proposal ID: {fixProposal.id}</span>
              </div>
            </div>

            {/* Side-by-Side Diff Comparison */}
            <CodeComparison
              fileName={fixProposal.file_path}
              originalCode={originalDisplayCode}
              proposedCode={proposedDisplayCode}
              originalLabel="Original Source (Target Commit)"
              proposedLabel="Proposed Code (AI Correction)"
            />

            {/* Detailed Rationale & Regressions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Why Recommended */}
              <div className="p-4 rounded-xl bg-[#141419] border border-[#27272A] space-y-2">
                <span className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider block">
                  Why Change is Recommended
                </span>
                <p className="text-xs text-[#FAFAFA] leading-relaxed">
                  {fixProposal.explanation}
                </p>
                {fixProposal.assumptions.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-[#71717A] uppercase block">
                      Assumptions:
                    </span>
                    <ul className="list-disc list-inside text-xs text-[#A1A1AA] space-y-0.5">
                      {fixProposal.assumptions.map((assump, aIdx) => (
                        <li key={aIdx}>{assump}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Potential Regressions & Recommended Tests */}
              <div className="p-4 rounded-xl bg-[#141419] border border-[#27272A] space-y-2">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
                  Potential Regressions & Safety Check
                </span>
                {fixProposal.potential_regressions.length > 0 ? (
                  <ul className="list-disc list-inside text-xs text-[#A1A1AA] space-y-0.5">
                    {fixProposal.potential_regressions.map((reg, rIdx) => (
                      <li key={rIdx}>{reg}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#71717A]">
                    Minimal localized change; low risk of external component regressions.
                  </p>
                )}

                <div className="pt-2 border-t border-[#27272A]/70">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase block mb-1">
                    Recommended Tests:
                  </span>
                  <ul className="list-disc list-inside text-xs text-[#A1A1AA] space-y-0.5">
                    {fixProposal.recommended_tests.map((test, tIdx) => (
                      <li key={tIdx}>{test}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Explicit Developer Notice */}
            <div className="p-3.5 rounded-xl bg-[#18181B] border border-[#27272A] flex items-start gap-2.5 text-xs text-[#A1A1AA]">
              <Info className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-[#FAFAFA] block">
                  Review & Approval Notice
                </strong>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  Approval in this milestone records developer review and acceptance in the TeamPulse audit log.
                  It will <strong>not</strong> push commits to GitHub or modify the original repository until containerized testing and an explicitly authorized writeback workflow are completed in subsequent steps.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <HelpCircle className="w-8 h-8 text-[#71717A] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#FAFAFA]">
                No Fix Proposal Generated Yet
              </p>
              <p className="text-xs text-[#71717A] max-w-md mx-auto">
                Click <strong>"Generate AI Fix"</strong> above to inspect the source file at commit{' '}
                <span className="font-mono text-[#FAFAFA]">{initialBug.rawFinding?.commit_sha || 'HEAD'}</span>,
                synthesize a minimal patch, and validate the code diff.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />}
              onClick={handleGenerateFix}
              isLoading={isGeneratingFix}
            >
              Generate AI Fix Proposal
            </Button>
          </div>
        )}
      </Card>

      {/* SECTION: Isolated Workspace Verification & Safety Checks (Step 7) */}
      <Card className="p-6 border-emerald-500/20 bg-gradient-to-br from-[#0E1512] to-[#090C0A]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[#FAFAFA]">
                  Isolated Workspace Verification
                </h2>
                {verificationRecord ? (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold ${
                      verificationRecord.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : verificationRecord.status === 'partial'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    Verification {verificationRecord.status}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono uppercase bg-[#18181B] text-[#71717A] border border-[#27272A]">
                    Not Run Yet
                  </span>
                )}
              </div>
              <span className="text-xs text-[#71717A]">
                Applies approved fix in an ephemeral sandbox at commit {initialBug.rawFinding?.commit_sha?.substring(0, 7) || 'scanned'} without modifying GitHub
              </span>
            </div>
          </div>

          {fixProposal && fixProposal.status === 'approved' && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                isLoading={isVerifying}
                leftIcon={<Play className="w-3.5 h-3.5" />}
                onClick={handleRunVerification}
              >
                {verificationRecord ? 'Re-run Verification' : 'Verify in Isolated Workspace'}
              </Button>
            </div>
          )}
        </div>

        {!fixProposal ? (
          <div className="py-6 text-center text-[#71717A] space-y-1">
            <ShieldAlert className="w-7 h-7 mx-auto text-[#52525B]" />
            <p className="text-xs">Generate an AI fix proposal above before executing verification checks.</p>
          </div>
        ) : fixProposal.status !== 'approved' ? (
          <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#A1A1AA]">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Proposal is currently <strong className="text-[#FAFAFA] font-mono">{fixProposal.status.toUpperCase()}</strong>.
                Only approved proposals may be applied and verified in an isolated workspace.
              </span>
            </div>
            <Button
              variant="success"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5" />}
              onClick={handleApproveFix}
              isLoading={fixActionLoading}
            >
              Approve Now
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Configuration Options */}
            <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272A] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-6 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#FAFAFA]">
                  <input
                    type="checkbox"
                    checked={runStaticChecks}
                    onChange={(e) => setRunStaticChecks(e.target.checked)}
                    className="rounded border-[#27272A] text-emerald-500 focus:ring-0 bg-[#09090B]"
                  />
                  <span>Run Safe Static & Syntax Analysis</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-[#A1A1AA]">
                  <input
                    type="checkbox"
                    checked={runTests}
                    onChange={(e) => setRunTests(e.target.checked)}
                    className="rounded border-[#27272A] text-emerald-500 focus:ring-0 bg-[#09090B]"
                  />
                  <span>Run Automated Test Suite (Restricted Container)</span>
                </label>
              </div>

              <span className="text-[11px] text-[#71717A] font-mono">
                Timeout: 15s checks / 30s tests
              </span>
            </div>

            {runTests && (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Security Enforcement:</strong> Untrusted repository code execution on the host server is strictly prohibited.
                  If a container sandbox daemon is unavailable, test suite execution will be recorded as unavailable rather than failing insecurely.
                </p>
              </div>
            )}

            {/* Verification Results Display */}
            {verificationRecord && (
              <div className="space-y-4 pt-1">
                {/* Overall Assessment Banner */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    verificationRecord.status === 'completed'
                      ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300'
                      : verificationRecord.status === 'partial'
                      ? 'bg-amber-950/25 border-amber-500/30 text-amber-300'
                      : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider block">
                      Verification Outcome
                    </span>
                    <p className="text-sm font-medium leading-relaxed">
                      {verificationRecord.assessment}
                    </p>
                  </div>

                  <div className="text-right text-xs shrink-0 font-mono text-[#A1A1AA]">
                    Duration: {verificationRecord.execution_duration}s
                  </div>
                </div>

                {/* Metrics Badges Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-lg bg-[#141417] border border-[#27272A]">
                    <span className="text-[#71717A] block text-[11px]">Workspace:</span>
                    <span className="text-emerald-400 font-medium">Cleaned up (Ephemeral)</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#141417] border border-[#27272A]">
                    <span className="text-[#71717A] block text-[11px]">Patch Applied:</span>
                    <span className="text-[#FAFAFA] font-mono font-medium truncate block">
                      {verificationRecord.patch_hash ? verificationRecord.patch_hash.substring(0, 10) : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#141417] border border-[#27272A]">
                    <span className="text-[#71717A] block text-[11px]">Static Checks:</span>
                    <span
                      className={`font-semibold ${
                        verificationRecord.static_checks_status === 'passed'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {verificationRecord.static_checks_status.toUpperCase()}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#141417] border border-[#27272A]">
                    <span className="text-[#71717A] block text-[11px]">Tests Status:</span>
                    <span className="text-[#A1A1AA] font-mono">
                      {verificationRecord.tests_status}
                    </span>
                  </div>
                </div>

                {/* Comparative Findings Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Resolved */}
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400">
                        Resolved Defects
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                        {verificationRecord.resolved_findings.length}
                      </span>
                    </div>
                    {verificationRecord.resolved_findings.length > 0 ? (
                      <div className="space-y-1.5">
                        {verificationRecord.resolved_findings.map((rf) => (
                          <div
                            key={rf.id}
                            className="p-2 rounded bg-[#09090B] border border-emerald-500/20 text-[11px]"
                          >
                            <span className="text-[#FAFAFA] font-medium block truncate">
                              {rf.title}
                            </span>
                            <span className="text-[#71717A] font-mono block">
                              Rule: {rf.rule_id} • L{rf.start_line}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#71717A]">No findings marked resolved.</p>
                    )}
                  </div>

                  {/* Remaining */}
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-400">
                        Remaining Defects
                      </span>
                      <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                        {verificationRecord.remaining_findings.length}
                      </span>
                    </div>
                    {verificationRecord.remaining_findings.length > 0 ? (
                      <div className="space-y-1.5">
                        {verificationRecord.remaining_findings.map((rem) => (
                          <div
                            key={rem.id}
                            className="p-2 rounded bg-[#09090B] border border-amber-500/20 text-[11px]"
                          >
                            <span className="text-[#FAFAFA] font-medium block truncate">
                              {rem.title}
                            </span>
                            <span className="text-[#71717A] font-mono block">
                              Rule: {rem.rule_id} • L{rem.start_line}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#71717A]">All target file defects cleared.</p>
                    )}
                  </div>

                  {/* Regressions */}
                  <div className="p-3.5 rounded-xl bg-[#141417] border border-[#27272A] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-rose-400">
                        New Regressions
                      </span>
                      <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full text-[11px] font-mono">
                        {verificationRecord.newly_introduced_findings.length}
                      </span>
                    </div>
                    {verificationRecord.newly_introduced_findings.length > 0 ? (
                      <div className="space-y-1.5">
                        {verificationRecord.newly_introduced_findings.map((reg) => (
                          <div
                            key={reg.id}
                            className="p-2 rounded bg-[#09090B] border border-rose-500/20 text-[11px]"
                          >
                            <span className="text-rose-300 font-medium block truncate">
                              {reg.title}
                            </span>
                            <span className="text-[#71717A] font-mono block">
                              Rule: {reg.rule_id} • L{reg.start_line}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#71717A]">0 regressions detected.</p>
                    )}
                  </div>
                </div>

                {/* Tools Executed */}
                {verificationRecord.tools_executed.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs text-[#71717A] pt-1">
                    <span className="font-medium text-[#FAFAFA]">Executed Analyzers:</span>
                    {verificationRecord.tools_executed.map((tool, idx) => (
                      <span
                        key={idx}
                        className="font-mono text-[11px] bg-[#141417] border border-[#27272A] px-2 py-0.5 rounded text-[#A1A1AA]"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                )}

                {/* Warnings / Limitations */}
                {verificationRecord.limitations.length > 0 && (
                  <div className="text-[11px] text-[#71717A] bg-[#141417] p-3 rounded-lg border border-[#27272A] space-y-1">
                    <span className="font-semibold text-amber-400 block">Active Verification Limitations:</span>
                    <ul className="list-disc list-inside space-y-0.5">
                      {verificationRecord.limitations.map((lim, lIdx) => (
                        <li key={lIdx}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footnote */}
                <div className="text-[11px] text-[#52525B] flex items-center gap-1.5 font-mono pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    Isolated execution completed cleanly. Ephemeral workspace deleted. Original Git repository is unmodified.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* SECTION: Step 8 — GitHub Branch Creation & Pull Request Preparation */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#60A5FA]">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#FAFAFA]">
                  GitHub Publishing & Pull Request Preparation
                </h2>
                {(() => {
                  const stage = getPublishingStage();
                  return (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-mono uppercase border ${stage.color}`}
                    >
                      {stage.label}
                    </span>
                  );
                })()}
              </div>
              <span className="text-xs text-[#71717A]">
                Publish approved, verified code patches to dedicated branches and prepare pull requests for human review.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {githubAuth?.connected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                GitHub: {githubAuth.user || 'Connected'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                <ShieldAlert className="w-3.5 h-3.5" />
                GitHub: Not Connected
              </span>
            )}
          </div>
        </div>

        {/* GitHub Connection Status Notice */}
        {githubAuth && !githubAuth.connected && (
          <div className="mb-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>GitHub Authorization Required for Remote Publishing</span>
            </div>
            <p className="text-[#A1A1AA] leading-relaxed">
              To publish branches and open pull requests directly on your repository, configure a personal access token (PAT) or GitHub App token in your backend environment. Tokens are kept securely on the backend and are never exposed to the browser.
            </p>
            <div className="p-2.5 rounded bg-[#09090B] border border-[#27272A] font-mono text-[11px] text-[#A1A1AA]">
              GITHUB_TOKEN=ghp_your_secure_pat_token_here
            </div>
            <p className="text-[11px] text-[#71717A]">
              Required scopes: <code className="text-[#FAFAFA]">repo</code> (or fine-grained permissions: <code className="text-[#FAFAFA]">contents:write</code>, <code className="text-[#FAFAFA]">pull_requests:write</code>).
            </p>
          </div>
        )}

        {/* Preconditions / Eligibility Checklist */}
        <div className="mb-5 p-4 rounded-xl bg-[#0F0F14] border border-[#27272A] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
              Publish-Fix Eligibility Checks
            </span>
            <span className="text-[11px] text-[#71717A] font-mono">
              Strict Gate: No unverified or unapproved code is ever pushed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            {/* 1. Approval */}
            <div className="p-2.5 rounded-lg bg-[#141417] border border-[#27272A] flex items-center justify-between">
              <div>
                <span className="text-[#71717A] block text-[11px]">1. Developer Approval:</span>
                <span className="font-medium text-[#FAFAFA]">
                  {fixProposal?.status === 'approved' ? 'Approved by Developer' : 'Awaiting Approval'}
                </span>
              </div>
              {fixProposal?.status === 'approved' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <X className="w-4 h-4 text-amber-400" />
              )}
            </div>

            {/* 2. Isolated Verification */}
            <div className="p-2.5 rounded-lg bg-[#141417] border border-[#27272A] flex items-center justify-between">
              <div>
                <span className="text-[#71717A] block text-[11px]">2. Workspace Verification:</span>
                <span className="font-medium text-[#FAFAFA]">
                  {verificationRecord &&
                  verificationRecord.patch_application_status === 'applied' &&
                  verificationRecord.static_checks_status === 'passed'
                    ? 'Verified Clean'
                    : 'Awaiting Verification'}
                </span>
              </div>
              {verificationRecord &&
              verificationRecord.patch_application_status === 'applied' &&
              verificationRecord.static_checks_status === 'passed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <X className="w-4 h-4 text-amber-400" />
              )}
            </div>

            {/* 3. Base Branch Safety */}
            <div className="p-2.5 rounded-lg bg-[#141417] border border-[#27272A] flex items-center justify-between">
              <div>
                <span className="text-[#71717A] block text-[11px]">3. Target Branch Protection:</span>
                <span className="font-medium text-[#FAFAFA]">
                  Dedicated Isolated Branch
                </span>
              </div>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          {/* Diverged branch warning if HEAD moved */}
          {eligibility && !eligibility.branch_head_matches && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
              <span className="font-semibold block flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Target Branch Divergence Detected:
              </span>
              <p className="text-[11px] leading-relaxed">
                The target branch HEAD has moved since this bug was originally analyzed. To prevent merge conflicts, TeamPulse stops automatic publishing until the fix is reconciled against the latest commit.
              </p>
            </div>
          )}
        </div>

        {/* STEP 1: Branch Target Selection & Branch Creation */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#141417] border border-[#27272A] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-[#60A5FA]" />
                Step 1: Isolated Branch Target & Name
              </span>
              <span className="text-[11px] text-[#71717A] font-mono">
                Never pushes directly to default branch
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-[#71717A] block mb-1">
                  Base Branch (To branch off from):
                </label>
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-1.5 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] font-mono focus:outline-none focus:border-[#3B82F6]"
                  disabled={Boolean(publishRecord)}
                />
              </div>

              <div>
                <label className="text-[11px] text-[#71717A] block mb-1">
                  Custom Branch Suffix (Optional):
                </label>
                <input
                  type="text"
                  value={customBranchName}
                  onChange={(e) => setCustomBranchName(e.target.value)}
                  placeholder="fix-token-secret"
                  className="w-full px-3 py-1.5 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] font-mono focus:outline-none focus:border-[#3B82F6]"
                  disabled={Boolean(publishRecord)}
                />
              </div>
            </div>

            {/* Generated branch preview */}
            <div className="p-2.5 rounded bg-[#09090B] border border-[#27272A] text-xs flex items-center justify-between font-mono">
              <span className="text-[#71717A] text-[11px]">Branch Name:</span>
              <span className="text-[#60A5FA]">
                {publishRecord
                  ? publishRecord.created_branch
                  : customBranchName
                  ? `codelens/${customBranchName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                  : `codelens/fix-${initialBug.id.slice(0, 8)}-remediation`}
              </span>
            </div>

            {/* Publish Button */}
            {!publishRecord ? (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#71717A]">
                  Prerequisites: Fix must be approved and verification checks must pass.
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isPublishingBranch}
                  disabled={
                    !fixProposal ||
                    fixProposal.status !== 'approved' ||
                    !verificationRecord ||
                    verificationRecord.static_checks_status !== 'passed'
                  }
                  leftIcon={<GitBranch className="w-3.5 h-3.5" />}
                  onClick={handlePublishBranch}
                >
                  Publish Fix Branch & Commit
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Branch <strong>{publishRecord.created_branch}</strong> successfully published with commit{' '}
                    <code className="font-mono">{publishRecord.published_commit_sha.slice(0, 7)}</code>
                  </span>
                </div>
                {publishRecord.html_url && (
                  <a
                    href={publishRecord.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-mono text-[11px]"
                  >
                    View Commit on GitHub <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: Pull Request Creation */}
          {publishRecord && (
            <div className="p-4 rounded-xl bg-[#141417] border border-[#27272A] space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                  <GitPullRequest className="w-4 h-4 text-[#A78BFA]" />
                  Step 2: Pull Request Preparation
                </span>
                <span className="text-[11px] text-[#71717A] font-mono">
                  Human Code Review Required • Never Auto-Merged
                </span>
              </div>

              {!pullRequest ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#71717A] block mb-1">
                      Pull Request Title:
                    </label>
                    <input
                      type="text"
                      value={prTitle || `fix: ${initialBug.title} [TeamPulse]`}
                      onChange={(e) => setPrTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272A] text-xs text-[#A1A1AA] space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#FAFAFA] block">
                      Automated Pull Request Summary Contents:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-[#71717A]">
                      <li>Defect summary & root-cause diagnostic findings</li>
                      <li>Verified diff stats on <code className="text-[#FAFAFA]">{initialBug.file}</code></li>
                      <li>Isolated workspace test and static analyzer outcomes</li>
                      <li>Source commit reference: <code className="font-mono text-[#FAFAFA]">{initialBug.rawFinding?.commit_sha || 'scanned commit'}</code></li>
                      <li>Safety notice specifying developer approval is required</li>
                    </ul>
                  </div>

                  {/* Explicit Confirmation Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-[#FAFAFA] select-none">
                    <input
                      type="checkbox"
                      checked={confirmPRChecked}
                      onChange={(e) => setConfirmPRChecked(e.target.checked)}
                      className="rounded border-[#27272A] bg-[#09090B] text-[#3B82F6] focus:ring-0"
                    />
                    <span>
                      I have reviewed the proposed changes and confirm opening a Pull Request for human review.
                    </span>
                  </label>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-[#71717A]">
                      Pull request will be opened from <code>{publishRecord.created_branch}</code> into <code>{targetBranch}</code>.
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isCreatingPR}
                      disabled={!confirmPRChecked}
                      leftIcon={<GitPullRequest className="w-3.5 h-3.5" />}
                      onClick={handleCreatePR}
                    >
                      Open Pull Request on GitHub
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#09090B] border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold">
                        PR #{pullRequest.pr_number}
                      </span>
                      <span className="text-sm font-semibold text-[#FAFAFA]">
                        {pullRequest.title}
                      </span>
                    </div>

                    <a
                      href={pullRequest.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-[#09090B] font-semibold text-xs hover:bg-emerald-400 transition"
                    >
                      <span>Open PR #{pullRequest.pr_number} on GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <p className="text-xs text-[#A1A1AA]">
                    Pull request successfully prepared from branch <code className="text-[#FAFAFA]">{pullRequest.head_branch}</code> into <code className="text-[#FAFAFA]">{pullRequest.base_branch}</code>.
                  </p>

                  <div className="text-[11px] text-[#71717A] flex items-center gap-1.5 font-mono pt-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>
                      Ready for human code review and continuous integration tests. TeamPulse will never auto-merge pull requests.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* SECTION: AI Root-Cause Diagnosis */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 border-b border-[#27272A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#A78BFA]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FAFAFA] flex items-center gap-2">
                AI Root-Cause Diagnosis
                {diagnosis && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-mono uppercase ${
                      diagnosis.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : diagnosis.status === 'inconclusive'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {diagnosis.status}
                  </span>
                )}
              </h2>
              <span className="text-xs text-[#71717A]">
                Deep code intelligence correlating analyzer evidence and causal hypotheses
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            isLoading={isDiagnosing}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            onClick={handleRunDiagnosis}
          >
            {diagnosis ? 'Re-run Diagnosis' : 'Run Diagnosis'}
          </Button>
        </div>

        {diagnosis ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#18181B] border border-[#27272A]">
              <span className="text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider block mb-1">
                Diagnostic Summary
              </span>
              <p className="text-xs text-[#FAFAFA] leading-relaxed">
                {diagnosis.summary}
              </p>
            </div>

            {diagnosis.root_causes.map((rc, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#0F0F14] border border-[#27272A] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#FAFAFA]">{rc.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#A78BFA] font-mono">
                    {rc.confidence} confidence
                  </span>
                </div>
                <p className="text-xs text-[#A1A1AA]">{rc.explanation}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#71717A]">
            No root-cause diagnosis generated yet. Click "Run Diagnosis" to analyze.
          </p>
        )}
      </Card>

      {/* Review Diff Modal */}
      <Modal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        title={`Review Fix: ${initialBug.title}`}
        description={`Side-by-side comparison for ${initialBug.file} (${initialBug.lineRange})`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-[#18181B] border border-[#27272A] text-xs text-[#A1A1AA]">
            <strong className="text-[#FAFAFA]">Recommendation: </strong>
            {fixProposal ? fixProposal.explanation : initialBug.suggestedFix}
          </div>

          <CodeComparison
            fileName={initialBug.file}
            originalCode={originalDisplayCode}
            proposedCode={proposedDisplayCode}
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#71717A]">
              Approval records review in TeamPulse. It does not push code to GitHub.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDiffModalOpen(false)}>
                Close
              </Button>
              {fixProposal && (
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    handleApproveFix();
                    setDiffModalOpen(false);
                  }}
                >
                  Approve Fix
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

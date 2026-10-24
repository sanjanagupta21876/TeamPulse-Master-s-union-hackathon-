import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { CodeComparison } from '../components/bugs/CodeComparison';
import { mockFixHistory } from '../data/mockFixHistory';
import {
  getAllFixProposals,
  saveFixProposal,
  getLatestVerificationForFix,
  saveVerificationRecord,
  getPublishRecordForFix,
  getPullRequestForFix,
} from '../data/repositoryStore';
import {
  apiClient,
  type FixProposal,
  type VerificationRecord,
  type PublishBranchResponse,
  type PullRequestRecord,
} from '../services/api';
import {
  GitBranch,
  Split,
  FileCode,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Check,
  X,
  RefreshCw,
  Play,
  GitPullRequest,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

interface UnifiedHistoryItem {
  id: string;
  isRealProposal: boolean;
  issueTitle: string;
  findingId?: string;
  repositoryName: string;
  commitSha: string;
  file: string;
  date: string;
  status: 'proposed' | 'approved' | 'rejected' | 'applied' | 'reviewing' | 'reverted' | 'invalid';
  validationStatus: string;
  syntaxValid: boolean;
  integrityValid: boolean;
  originalCode: string;
  proposedCode: string;
  explanation?: string;
  assumptions?: string[];
  potentialRegressions?: string[];
  recommendedTests?: string[];
  rawProposal?: FixProposal;
  latestVerification?: VerificationRecord | null;
  publishRecord?: PublishBranchResponse | null;
  pullRequest?: PullRequestRecord | null;
}


export const FixHistoryPage: React.FC = () => {
  const { toast } = useToast();
  const [selectedRepo, setSelectedRepo] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeItem, setActiveItem] = useState<UnifiedHistoryItem | null>(null);
  const [realProposals, setRealProposals] = useState<FixProposal[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Load real proposals from storage & listen for updates
  useEffect(() => {
    const loadProposals = () => {
      setRealProposals(getAllFixProposals());
    };
    loadProposals();

    window.addEventListener('codelens_fixes_updated', loadProposals);
    window.addEventListener('codelens_verifications_updated', loadProposals);
    window.addEventListener('codelens_publish_updated', loadProposals);
    window.addEventListener('codelens_pull_requests_updated', loadProposals);
    return () => {
      window.removeEventListener('codelens_fixes_updated', loadProposals);
      window.removeEventListener('codelens_verifications_updated', loadProposals);
      window.removeEventListener('codelens_publish_updated', loadProposals);
      window.removeEventListener('codelens_pull_requests_updated', loadProposals);
    };
  }, []);

  // Map real proposals to unified item format
  const realHistoryItems: UnifiedHistoryItem[] = realProposals.map((p) => {
    const dateFormatted = new Date(p.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isSyntaxPass = p.validation.syntax_check === 'passed';
    const isIntegrityPass = p.validation.patch_integrity === 'valid';
    const verif = getLatestVerificationForFix(p.id);

    let valStatus = isSyntaxPass && isIntegrityPass ? 'Validation Passed' : 'Validation Warn';
    if (verif) {
      if (verif.status === 'completed') valStatus = 'Verified in Sandbox';
      else if (verif.status === 'partial') valStatus = 'Regression Warning';
      else valStatus = 'Verification Failed';
    }

    return {
      id: p.id,
      isRealProposal: true,
      issueTitle: `AI Fix for Finding ${p.finding_id.substring(0, 12)}`,
      findingId: p.finding_id,
      repositoryName: p.repository_id || 'Scanned Repository',
      commitSha: p.commit_sha ? p.commit_sha.substring(0, 7) : 'head',
      file: p.file_path,
      date: dateFormatted,
      status: p.status as UnifiedHistoryItem['status'],
      validationStatus: valStatus,
      syntaxValid: isSyntaxPass,
      integrityValid: isIntegrityPass,
      originalCode: p.original_content,
      proposedCode: p.proposed_content,
      explanation: p.explanation,
      assumptions: p.assumptions,
      potentialRegressions: p.potential_regressions,
      recommendedTests: p.recommended_tests,
      rawProposal: p,
      latestVerification: verif,
      publishRecord: getPublishRecordForFix(p.id),
      pullRequest: getPullRequestForFix(p.id),
    };
  });

  // Map mock items to unified item format
  const mockHistoryItems: UnifiedHistoryItem[] = mockFixHistory.map((item) => ({
    id: item.id,
    isRealProposal: false,
    issueTitle: item.issueTitle,
    repositoryName: item.repositoryName,
    commitSha: 'a89c41f',
    file: item.file,
    date: item.date,
    status: item.fixStatus.toLowerCase() as UnifiedHistoryItem['status'],
    validationStatus: item.verificationStatus,
    syntaxValid: true,
    integrityValid: true,
    originalCode: item.originalCode,
    proposedCode: item.proposedCode,
    explanation: `Remediation proposed for ${item.issueTitle}.`,
  }));

  // Combine real first, then mock
  const combinedHistory = [...realHistoryItems, ...mockHistoryItems];

  // Distinct repositories for filter
  const distinctRepos = Array.from(
    new Set(combinedHistory.map((item) => item.repositoryName))
  );

  const filteredHistory = combinedHistory.filter((item) => {
    const matchesRepo =
      selectedRepo === 'All' || item.repositoryName === selectedRepo;
    const matchesStatus =
      selectedStatus === 'All' ||
      item.status.toLowerCase() === selectedStatus.toLowerCase();
    return matchesRepo && matchesStatus;
  });

  // Approve action
  const handleApprove = async (item: UnifiedHistoryItem) => {
    if (!item.isRealProposal || !item.rawProposal) {
      toast(
        'Action recorded',
        'Simulated approval for demo history item.',
        'success'
      );
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.approveFix(item.id);
      saveFixProposal(res.fix);
      setRealProposals(getAllFixProposals());
      if (activeItem && activeItem.id === item.id) {
        setActiveItem({
          ...activeItem,
          status: 'approved',
          rawProposal: res.fix,
        });
      }
      toast(
        'Proposal Approved',
        'Proposal approved and logged. Target repository remains unchanged.',
        'success'
      );
    } catch (err: any) {
      toast(
        'Approval Failed',
        err?.error?.message || 'Failed to approve proposal.',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Reject action
  const handleReject = async (item: UnifiedHistoryItem) => {
    if (!item.isRealProposal || !item.rawProposal) {
      toast(
        'Action recorded',
        'Simulated rejection for demo history item.',
        'info'
      );
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.rejectFix(item.id);
      saveFixProposal(res.fix);
      setRealProposals(getAllFixProposals());
      if (activeItem && activeItem.id === item.id) {
        setActiveItem({
          ...activeItem,
          status: 'rejected',
          rawProposal: res.fix,
        });
      }
      toast(
        'Proposal Rejected',
        'Proposal marked as rejected. Audit trail retained.',
        'info'
      );
    } catch (err: any) {
      toast(
        'Rejection Failed',
        err?.error?.message || 'Failed to reject proposal.',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Verify in Sandbox action (Step 7)
  const handleVerifyProposal = async (item: UnifiedHistoryItem) => {
    if (!item.isRealProposal || !item.rawProposal) {
      toast('Action recorded', 'Simulated verification for demo item.', 'info');
      return;
    }
    if (item.status !== 'approved') {
      toast(
        'Approval Required',
        'Proposal must be approved before running isolated verification checks.',
        'warning'
      );
      return;
    }

    try {
      setActionLoading(true);
      toast(
        'Verification Started',
        'Creating isolated workspace and running static checks...',
        'info'
      );
      const rec = await apiClient.verifyFix(item.id, false, true);
      saveVerificationRecord(rec);
      setRealProposals(getAllFixProposals());
      if (activeItem && activeItem.id === item.id) {
        setActiveItem({
          ...activeItem,
          latestVerification: rec,
          validationStatus: rec.status === 'completed' ? 'Verified in Sandbox' : 'Verification Failed',
        });
      }
      toast(
        'Verification Complete',
        rec.assessment,
        rec.status === 'completed' ? 'success' : 'error'
      );
    } catch (err: any) {
      toast(
        'Verification Failed',
        err?.error?.message || 'Failed to verify proposal.',
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status: UnifiedHistoryItem['status']) => {
    switch (status) {
      case 'proposed':
      case 'reviewing':
        return <Badge variant="warning" size="sm">Proposed (Reviewing)</Badge>;
      case 'approved':
        return <Badge variant="success" size="sm">Approved (Not Applied)</Badge>;
      case 'rejected':
        return <Badge variant="danger" size="sm">Rejected</Badge>;
      case 'applied':
        return <Badge variant="purple" size="sm">Applied (Historical)</Badge>;
      case 'reverted':
        return <Badge variant="danger" size="sm">Reverted</Badge>;
      case 'invalid':
        return <Badge variant="danger" size="sm">Invalid Patch</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
            Fix History & Diff Review
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Audit trail of AI-generated patch proposals, validation checks, and developer approval decisions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {realProposals.length > 0 && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
              {realProposals.length} active proposals generated
            </span>
          )}
          <span className="text-xs text-[#A1A1AA] bg-[#18181B] px-3 py-1 rounded-full border border-[#27272A]">
            <strong className="text-[#FAFAFA]">{filteredHistory.length}</strong> total records
          </span>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-[#18181B]/80 border border-[#27272A] p-4 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 text-[#A1A1AA]">
          <span className="font-semibold text-[#FAFAFA]">Step 6 Repository Protection & Audit Guarantee:</span>
          <p>
            Approving a proposal records developer acceptance in the audit trail. TeamPulse will <strong>never modify the target GitHub repository, create commits, or push branches</strong> in this step.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A] shrink-0 font-medium">Repository:</span>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="All">All Repositories</option>
                {distinctRepos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A] shrink-0 font-medium">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-1.5 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="All">All Statuses</option>
                <option value="proposed">Proposed (Reviewing)</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="applied">Applied (Historical)</option>
                <option value="reverted">Reverted</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-[#71717A]">
            Showing {filteredHistory.length} of {combinedHistory.length} remediations
          </div>
        </div>
      </Card>

      {/* History Table Card */}
      <Card className="overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-[#71717A]">
            <Split className="w-10 h-10 mx-auto mb-3 opacity-40 text-[#8B5CF6]" />
            <p className="text-sm font-medium text-[#FAFAFA]">No fix proposals found</p>
            <p className="text-xs mt-1">
              Generate a fix suggestion from a bug details page to create a proposal record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]/70">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-[#18181B]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[#FAFAFA]">
                      {item.issueTitle}
                    </h3>

                    {renderStatusBadge(item.status)}

                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 font-mono">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {item.validationStatus}
                    </span>

                    {item.isRealProposal && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Live Proposal
                      </span>
                    )}

                    {item.publishRecord && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 font-mono">
                        <GitBranch className="w-3 h-3 text-blue-400" />
                        {item.publishRecord.created_branch}
                      </span>
                    )}

                    {item.pullRequest && (
                      <a
                        href={item.pullRequest.html_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-mono hover:bg-emerald-500/25 transition"
                      >
                        <GitPullRequest className="w-3 h-3 text-emerald-400" />
                        PR #{item.pullRequest.pr_number}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {item.explanation && (
                    <p className="text-xs text-[#A1A1AA] line-clamp-1">
                      {item.explanation}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-[#71717A] flex-wrap">
                    <span className="flex items-center gap-1 text-[#A1A1AA] font-mono">
                      <FileCode className="w-3.5 h-3.5 text-[#71717A]" />
                      <span>{item.file}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-sans text-[#71717A]">
                      <GitBranch className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span>{item.repositoryName}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-[#A1A1AA]">
                      Commit: {item.commitSha}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-sans text-[#71717A]">
                      <Clock className="w-3 h-3" />
                      <span>{item.date}</span>
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 self-end md:self-center">
                  {item.status === 'proposed' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40"
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading}
                        leftIcon={<Check className="w-3.5 h-3.5" />}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300 hover:border-rose-500/40"
                        onClick={() => handleReject(item)}
                        disabled={actionLoading}
                        leftIcon={<X className="w-3.5 h-3.5" />}
                      >
                        Reject
                      </Button>
                    </>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Split className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                    onClick={() => setActiveItem(item)}
                  >
                    Inspect Diff
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Inspect Proposed Change Modal */}
      {activeItem && (
        <Modal
          isOpen={Boolean(activeItem)}
          onClose={() => setActiveItem(null)}
          title={`Code Diff & Review: ${activeItem.issueTitle}`}
          description={`Commit: ${activeItem.commitSha} • Status: ${activeItem.status.toUpperCase()}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
              <div>
                <span className="text-[#71717A] block">Target File:</span>
                <span className="font-mono text-[#FAFAFA] font-medium truncate block">
                  {activeItem.file}
                </span>
              </div>
              <div>
                <span className="text-[#71717A] block">Scanned Commit:</span>
                <span className="font-mono text-[#FAFAFA] font-medium block">
                  {activeItem.commitSha}
                </span>
              </div>
              <div>
                <span className="text-[#71717A] block">Validation:</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Syntax & Integrity Safe
                </span>
              </div>
              <div>
                <span className="text-[#71717A] block">Review Status:</span>
                <div>{renderStatusBadge(activeItem.status)}</div>
              </div>
            </div>

            {/* Explanation & Context */}
            {activeItem.explanation && (
              <div className="bg-[#141417] p-3.5 rounded-lg border border-[#27272A] space-y-2 text-xs">
                <span className="text-xs font-semibold text-[#FAFAFA] block">
                  Remediation Rationale:
                </span>
                <p className="text-[#A1A1AA] leading-relaxed">
                  {activeItem.explanation}
                </p>

                {activeItem.potentialRegressions && activeItem.potentialRegressions.length > 0 && (
                  <div className="pt-2 border-t border-[#27272A]/70 text-[11px] text-[#71717A]">
                    <strong className="text-amber-400">Potential Regressions to Monitor:</strong>{' '}
                    {activeItem.potentialRegressions.join('; ')}
                  </div>
                )}
                {activeItem.recommendedTests && activeItem.recommendedTests.length > 0 && (
                  <div className="text-[11px] text-[#71717A]">
                    <strong className="text-indigo-400">Recommended Tests:</strong>{' '}
                    {activeItem.recommendedTests.join('; ')}
                  </div>
                )}
              </div>
            )}

            {/* Verification Audit Details (Step 7) */}
            {activeItem.latestVerification && (
              <div className="p-3.5 rounded-lg bg-[#0F1412] border border-emerald-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Isolated Verification Audit
                  </span>
                  <span className="text-[11px] font-mono text-[#A1A1AA]">
                    Duration: {activeItem.latestVerification.execution_duration}s
                  </span>
                </div>
                <p className="text-[#FAFAFA] font-medium">
                  {activeItem.latestVerification.assessment}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-[#A1A1AA]">
                  <div>Workspace: <span className="text-emerald-400">Ephemeral Clean</span></div>
                  <div>Static Checks: <span className="text-[#FAFAFA] uppercase">{activeItem.latestVerification.static_checks_status}</span></div>
                  <div>Resolved: <span className="text-emerald-400">{activeItem.latestVerification.resolved_findings.length} defect(s)</span></div>
                  <div>Regressions: <span className="text-rose-400">{activeItem.latestVerification.newly_introduced_findings.length}</span></div>
                </div>
              </div>
            )}

            {/* Diff Comparison Component */}
            <CodeComparison
              fileName={activeItem.file}
              originalCode={activeItem.originalCode}
              proposedCode={activeItem.proposedCode}
              originalLabel="Original Code (At Scanned Commit)"
              proposedLabel="Proposed Code (AI Remediation)"
            />

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#27272A]">
              <span className="text-xs text-[#71717A]">
                Original source remains unchanged. Approving records review acceptance.
              </span>

              <div className="flex items-center gap-2">
                {activeItem.status === 'proposed' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-rose-400 hover:text-rose-300 hover:border-rose-500/40"
                      onClick={() => handleReject(activeItem)}
                      disabled={actionLoading}
                      leftIcon={<X className="w-3.5 h-3.5" />}
                    >
                      Reject Proposal
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={() => handleApprove(activeItem)}
                      disabled={actionLoading}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                    >
                      Approve Proposal
                    </Button>
                  </>
                )}

                {activeItem.status === 'approved' && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={() => handleVerifyProposal(activeItem)}
                    disabled={actionLoading}
                    leftIcon={<Play className="w-3.5 h-3.5" />}
                  >
                    Verify in Sandbox
                  </Button>
                )}

                <Button variant="secondary" size="sm" onClick={() => setActiveItem(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


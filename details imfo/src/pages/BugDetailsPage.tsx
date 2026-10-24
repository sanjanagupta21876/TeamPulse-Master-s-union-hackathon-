import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { DiffView, EmptyState, Section, SeverityTag } from '../components/checks/shared';
import { errorMessage, findingLocation, useStoreUpdates } from '../components/checks/helpers';
import { apiClient } from '../services/api';
import type { FixProposal, GitHubAuthStatus, VerificationRecord } from '../services/api';
import {
  getFindingById,
  getLatestDiagnosisForRepo,
  getLatestFixForFinding,
  getLatestVerificationForFix,
  getPublishForFix,
  getPullRequestForFix,
  getAllRepositories,
  saveFix,
  savePublish,
  savePullRequest,
  saveVerification,
} from '../data/repositoryStore';

type Busy = null | 'propose' | 'approve' | 'reject' | 'regenerate' | 'verify' | 'branch' | 'pr';

const VERIFY_RESULT: Record<string, { title: string; tone: string }> = {
  completed: { title: 'Verified: the finding is gone and nothing new appeared', tone: 'text-green' },
  partial: { title: 'The finding is gone, but the patch added new findings', tone: 'text-amber' },
  failed: { title: "Not verified: the fix didn't resolve the finding", tone: 'text-red' },
  cancelled: { title: 'Verification was cancelled', tone: 'text-pencil' },
};

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) =>
  items.length === 0 ? null : (
    <div>
      <h4 className="text-xs font-medium text-pencil">{title}</h4>
      <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
        {items.map((item, i) => (
          <li key={i}>– {item}</li>
        ))}
      </ul>
    </div>
  );

const VerificationResult: React.FC<{ record: VerificationRecord }> = ({ record }) => {
  const result = VERIFY_RESULT[record.status] ?? { title: record.status, tone: 'text-pencil' };
  return (
    <div className="space-y-2">
      <p className={`font-semibold ${result.tone}`}>{result.title}</p>
      <p className="text-sm text-ink-soft max-w-[75ch]">{record.assessment}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="inline text-faint">Resolved </dt>
          <dd className="inline font-medium text-ink tabular-nums">{record.resolved_findings.length}</dd>
        </div>
        <div>
          <dt className="inline text-faint">Still reported </dt>
          <dd className="inline font-medium text-ink tabular-nums">{record.remaining_findings.length}</dd>
        </div>
        <div>
          <dt className="inline text-faint">New </dt>
          <dd className="inline font-medium text-ink tabular-nums">{record.newly_introduced_findings.length}</dd>
        </div>
        <div>
          <dt className="inline text-faint">Tools </dt>
          <dd className="inline text-ink-soft">{record.tools_executed.join(', ') || 'none'}</dd>
        </div>
      </dl>
      {record.newly_introduced_findings.length > 0 && (
        <List title="New findings in the patched file" items={record.newly_introduced_findings.map((f) => `${f.title} (line ${f.start_line})`)} />
      )}
      {record.limitations.length > 0 && <p className="text-xs text-faint max-w-[75ch]">{record.limitations.join(' ')}</p>}
    </div>
  );
};

export const BugDetailsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [busy, setBusy] = useState<Busy>(null);
  const [auth, setAuth] = useState<GitHubAuthStatus | null>(null);
  useStoreUpdates();

  useEffect(() => {
    apiClient.getGitHubAuthStatus().then(setAuth);
  }, []);

  const finding = getFindingById(id);
  if (!finding) {
    return (
      <div className="space-y-6">
        <Link to="/bugs" className="inline-flex items-center gap-1.5 text-sm text-pencil hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Findings
        </Link>
        <EmptyState title="This finding isn't saved in this browser">
          Findings come from code checks you ran here. Run the checks on the repository again to see it.
        </EmptyState>
      </div>
    );
  }

  const repo = getAllRepositories().find((r) => r.fullName.toLowerCase() === finding.repository.toLowerCase());
  const fix = getLatestFixForFinding(finding.id);
  const verification = fix ? getLatestVerificationForFix(fix.id) : null;
  const published = fix ? getPublishForFix(fix.id) : null;
  const pullRequest = fix ? getPullRequestForFix(fix.id) : null;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>, hint?: string) => {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast('That didn’t work', hint ? `${errorMessage(err)} ${hint}` : errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const staleHint = 'If the backend restarted, run the checks on this repository again first.';

  const propose = () =>
    run(
      'propose',
      async () => {
        const diagnosis = getLatestDiagnosisForRepo(finding.repository);
        saveFix(await apiClient.generateFix(finding.id, diagnosis?.diagnosis_id ?? null));
      },
      staleHint
    );

  const decide = (fixId: string, kind: 'approve' | 'reject') =>
    run(kind, async () => {
      const res = kind === 'approve' ? await apiClient.approveFix(fixId) : await apiClient.rejectFix(fixId);
      saveFix(res.fix);
    }, staleHint);

  const regenerate = (current: FixProposal) =>
    run('regenerate', async () => saveFix(await apiClient.regenerateFix(current.id)), staleHint);

  const verify = (fixId: string) =>
    run('verify', async () => saveVerification(await apiClient.verifyFix(fixId, false, true)), staleHint);

  const createBranch = (fixId: string) =>
    run('branch', async () => savePublish(await apiClient.publishBranch(fixId, {})));

  const openPullRequest = (fixId: string) =>
    run('pr', async () => savePullRequest(await apiClient.createPullRequest(fixId, { confirm_creation: true, draft: true })));

  return (
    <div className="space-y-6">
      <Link
        to={repo ? `/repositories/${repo.id}` : '/bugs'}
        className="inline-flex items-center gap-1.5 text-sm text-pencil hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> {repo ? repo.fullName : 'Findings'}
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityTag severity={finding.severity} />
          <span className="text-sm text-pencil capitalize">{finding.category}</span>
        </div>
        <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold tracking-tight text-ink">{finding.title}</h1>
        <p className="mt-1 text-sm text-pencil">
          <span className="font-mono text-ink-soft">{findingLocation(finding)}</span>, found by {finding.analyzer} (
          {finding.rule_id}), {finding.confidence} confidence
        </p>
      </header>

      <Section title="What's wrong">
        <div className="space-y-4">
          <p className="text-[15px] text-ink-soft max-w-[75ch]">{finding.description}</p>
          {finding.code_excerpt && (
            <pre className="overflow-x-auto rounded-lg border border-line bg-wall px-4 py-3 text-[12.5px] leading-relaxed text-ink">
              {finding.code_excerpt}
            </pre>
          )}
          <p className="text-sm text-ink-soft max-w-[75ch]">
            <span className="font-semibold text-ink">Suggested direction: </span>
            {finding.remediation}
          </p>
        </div>
      </Section>

      <Section title="Fix">
        {!fix ? (
          <div className="space-y-3">
            <p className="text-sm text-pencil max-w-[70ch]">
              Ship Intelligence drafts a minimal patch for this file. You review the diff and approve it before anything
              else happens; nothing is written to GitHub at this step.
            </p>
            <Button variant="primary" onClick={propose} isLoading={busy === 'propose'}>
              Propose a fix
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-ink-soft max-w-[75ch]">{fix.explanation}</p>
              <span className="text-xs font-semibold text-pencil capitalize">{fix.status}</span>
            </div>

            {fix.diff && <DiffView diff={fix.diff} />}

            <div className="grid gap-4 sm:grid-cols-3">
              <List title="Assumptions" items={fix.assumptions} />
              <List title="Could affect" items={fix.potential_regressions} />
              <List title="Tests to add" items={fix.recommended_tests} />
            </div>

            {fix.validation.details.length > 0 && fix.validation.patch_integrity !== 'valid' && (
              <List title="Patch checks" items={fix.validation.details} />
            )}

            {fix.status === 'proposed' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => decide(fix.id, 'approve')} isLoading={busy === 'approve'} disabled={busy !== null}>
                  Approve fix
                </Button>
                <Button variant="secondary" onClick={() => regenerate(fix)} isLoading={busy === 'regenerate'} disabled={busy !== null}>
                  Try a different fix
                </Button>
                <Button variant="ghost" onClick={() => decide(fix.id, 'reject')} isLoading={busy === 'reject'} disabled={busy !== null}>
                  Reject
                </Button>
              </div>
            )}
            {fix.status === 'rejected' && (
              <Button variant="secondary" onClick={() => regenerate(fix)} isLoading={busy === 'regenerate'}>
                Propose another fix
              </Button>
            )}
          </div>
        )}
      </Section>

      {fix?.status === 'approved' && (
        <Section
          title="Verify"
          aside={
            <Button variant={verification ? 'secondary' : 'primary'} size="sm" onClick={() => verify(fix.id)} isLoading={busy === 'verify'}>
              {verification ? 'Verify again' : 'Verify in a clean copy'}
            </Button>
          }
        >
          {verification ? (
            <VerificationResult record={verification} />
          ) : (
            <p className="text-sm text-pencil max-w-[70ch]">
              Applies the patch to a temporary copy of the repository and runs the same checks again, to confirm the finding
              is gone and nothing new appeared. The original repository is not touched.
            </p>
          )}
        </Section>
      )}

      {fix?.status === 'approved' && verification && (verification.status === 'completed' || verification.status === 'partial') && (
        <Section title="Publish to GitHub">
          {pullRequest ? (
            <a href={pullRequest.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-marker hover:underline">
              Draft pull request #{pullRequest.pr_number} is open <ExternalLink className="w-4 h-4" />
            </a>
          ) : !auth?.can_publish ? (
            <p className="text-sm text-pencil max-w-[70ch]">
              Publishing needs a GitHub token with write access to {finding.repository}. Set <code className="text-ink">GITHUB_TOKEN</code> in{' '}
              <code className="text-ink">backend/.env</code> and restart the backend.
              {auth?.error_message ? ` (${auth.error_message})` : ''}
            </p>
          ) : !published ? (
            <div className="space-y-3">
              <p className="text-sm text-pencil max-w-[70ch]">
                Commits the verified patch to a new branch on GitHub. The default branch is never changed.
              </p>
              <Button variant="primary" onClick={() => createBranch(fix.id)} isLoading={busy === 'branch'}>
                Create fix branch
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Branch <code className="font-mono text-ink">{published.created_branch}</code> is on GitHub.
              </p>
              <Button variant="primary" onClick={() => openPullRequest(fix.id)} isLoading={busy === 'pr'}>
                Open draft pull request
              </Button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { EmptyState, PageHeader, Section, SeverityTag } from '../components/checks/shared';
import { SEVERITY_ORDER, errorMessage, sortBySeverity, useNow, useStoreUpdates } from '../components/checks/helpers';
import { FindingList } from '../components/checks/FindingList';
import { relativeTime } from '../components/mission/format';
import { apiClient } from '../services/api';
import type { DiagnosisReport, RootCause } from '../services/api';
import {
  getFindingsForRepo,
  getLatestDiagnosisForRepo,
  getRepositoryById,
  saveAnalysisResults,
  saveDiagnosis,
} from '../data/repositoryStore';

const CONFIDENCE_TEXT: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  inconclusive: 'Inconclusive',
};

export const RepositoryDetailsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'rerun' | 'diagnose'>(null);
  useStoreUpdates();
  const now = useNow();

  const repo = getRepositoryById(id);
  const findings = repo ? sortBySeverity(getFindingsForRepo(repo.fullName)) : [];
  const diagnosis: DiagnosisReport | null = repo ? getLatestDiagnosisForRepo(repo.fullName) : null;

  if (!repo) {
    return (
      <div className="space-y-6">
        <Link to="/repositories" className="inline-flex items-center gap-1.5 text-sm text-pencil hover:text-ink">
          <ArrowLeft className="w-4 h-4" /> Repositories
        </Link>
        <EmptyState title="This repository hasn't been checked in this browser">
          Results are saved per browser. Go back to Repositories and run the checks again.
        </EmptyState>
      </div>
    );
  }

  const rerun = async () => {
    setBusy('rerun');
    try {
      const result = await apiClient.analyzeRepository({ repository_url: repo.url, branch: repo.branch });
      saveAnalysisResults(result);
      toast('Checks finished', `${result.findings.length} findings in ${result.analysis.files_analyzed} files.`, 'success');
    } catch (err) {
      toast('Checks failed', errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const diagnose = async () => {
    if (!repo.latestScanId) return;
    setBusy('diagnose');
    try {
      const report = await apiClient.diagnoseRepository(repo.owner, repo.name, repo.latestScanId);
      saveDiagnosis(report);
    } catch (err) {
      toast("Couldn't diagnose", `${errorMessage(err)} If the backend restarted, run the checks again first.`, 'error');
    } finally {
      setBusy(null);
    }
  };


  const renderRootCause = (rc: RootCause, i: number) => (
    <li key={i} className="border-l-2 border-line-strong pl-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-semibold text-ink">{rc.title}</h3>
        <span className="text-xs text-faint">{CONFIDENCE_TEXT[rc.confidence] ?? rc.confidence}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft max-w-[75ch]">{rc.explanation}</p>
      {rc.recommended_actions.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
          {rc.recommended_actions.map((a, j) => (
            <li key={j}>– {a}</li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <Link to="/repositories" className="inline-flex items-center gap-1.5 text-sm text-pencil hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Repositories
      </Link>

      <PageHeader
        title={repo.fullName}
        description={repo.description ?? undefined}
        actions={
          <>
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-pencil hover:text-ink hover:bg-sunken"
            >
              GitHub <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <Button variant="secondary" onClick={rerun} isLoading={busy === 'rerun'} disabled={busy !== null} leftIcon={<RefreshCw className="w-4 h-4" />}>
              Run checks again
            </Button>
          </>
        }
      />

      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {[
          ['Branch', repo.branch],
          ['Commit', repo.commitSha.slice(0, 7)],
          ['Files checked', String(repo.filesAnalyzed)],
          ['Checked', relativeTime(repo.analyzedAt, now)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="font-medium text-ink tabular-nums">{value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-faint">Findings</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {findings.length === 0 ? (
              <span className="font-medium text-green">None</span>
            ) : (
              SEVERITY_ORDER.filter((s) => repo.findingCounts[s] > 0).map((s) => (
                <span key={s} className="flex items-center gap-1 tabular-nums font-medium text-ink">
                  {repo.findingCounts[s]} <SeverityTag severity={s} />
                </span>
              ))
            )}
          </dd>
        </div>
      </dl>

      {repo.analysisWarnings.length > 0 && (
        <div className="rounded-xl border border-amber/30 bg-amber/[0.06] px-4 py-3 text-sm text-ink-soft">
          <p className="font-medium text-amber">Some checks didn't run completely</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {repo.analysisWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <Section
          title="Likely root causes"
          aside={
            <Button
              variant={diagnosis ? 'secondary' : 'primary'}
              size="sm"
              onClick={diagnose}
              isLoading={busy === 'diagnose'}
              disabled={busy !== null || !repo.latestScanId}
            >
              {diagnosis ? 'Diagnose again' : 'Diagnose findings'}
            </Button>
          }
        >
          {!diagnosis ? (
            <p className="text-sm text-pencil">
              Groups related findings and explains the likely cause behind them, with the evidence. Uses AI when the backend
              has an OpenAI key, rules otherwise.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft max-w-[75ch]">{diagnosis.summary}</p>
              <ol className="space-y-4">{diagnosis.root_causes.slice(0, 3).map(renderRootCause)}</ol>
              {diagnosis.root_causes.length > 3 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-marker">
                    Show {diagnosis.root_causes.length - 3} more
                  </summary>
                  <ol className="mt-4 space-y-4">{diagnosis.root_causes.slice(3).map(renderRootCause)}</ol>
                </details>
              )}
              {diagnosis.limitations.length > 0 && (
                <p className="text-xs text-faint max-w-[75ch]">Limits: {diagnosis.limitations.join(' ')}</p>
              )}
            </div>
          )}
        </Section>
      )}

      <section className="rounded-2xl border border-line bg-paper">
        <div className="px-5 pt-4 pb-3 border-b border-line">
          <h2 className="font-display text-lg font-semibold text-ink">Findings</h2>
        </div>
        {findings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-pencil">The checks found nothing to report on this commit.</p>
        ) : (
          <FindingList findings={findings} />
        )}
      </section>
    </div>
  );
};

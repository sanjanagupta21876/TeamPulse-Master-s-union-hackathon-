import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState, PageHeader, SeverityTag } from '../components/checks/shared';
import { SEVERITY_ORDER, useNow } from '../components/checks/helpers';
import { relativeTime } from '../components/mission/format';
import type { Repository } from '../types';

interface OutletContextType {
  repositories: Repository[];
  onOpenAnalyzeModal: () => void;
}

export const RepositoriesPage: React.FC = () => {
  const { repositories, onOpenAnalyzeModal } = useOutletContext<OutletContextType>();
  const now = useNow();

  const addButton = (
    <Button variant="primary" onClick={onOpenAnalyzeModal} leftIcon={<Plus className="w-4 h-4" />}>
      Check a repository
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Run static code checks on a public GitHub repository, get a likely root cause, and verify a fix before opening a pull request."
        actions={repositories.length > 0 ? addButton : undefined}
      />

      {repositories.length === 0 ? (
        <EmptyState title="No repositories checked yet" action={addButton}>
          Paste a public GitHub URL to run the checks. Results are saved in this browser.
        </EmptyState>
      ) : (
        <ul className="rounded-2xl border border-line bg-paper divide-y divide-line">
          {repositories.map((repo) => {
            const total = SEVERITY_ORDER.reduce((sum, s) => sum + (repo.findingCounts[s] ?? 0), 0);
            return (
              <li key={repo.id}>
                <Link
                  to={`/repositories/${repo.id}`}
                  className="flex flex-col gap-3 px-5 py-4 hover:bg-wall/70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-ink">{repo.fullName}</div>
                    <div className="mt-0.5 text-sm text-pencil truncate">
                      {[repo.language, `${repo.branch} at ${repo.commitSha.slice(0, 7)}`, `checked ${relativeTime(repo.analyzedAt, now)}`]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {total === 0 ? (
                      <span className="text-sm text-green">No findings</span>
                    ) : (
                      SEVERITY_ORDER.filter((s) => repo.findingCounts[s] > 0).map((s) => (
                        <span key={s} className="flex items-center gap-1 text-sm text-ink-soft tabular-nums">
                          {repo.findingCounts[s]} <SeverityTag severity={s} />
                        </span>
                      ))
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

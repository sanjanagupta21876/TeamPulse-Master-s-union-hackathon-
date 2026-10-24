import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/checks/shared';
import { SEVERITY_ORDER, sortBySeverity, useStoreUpdates } from '../components/checks/helpers';
import { FindingList } from '../components/checks/FindingList';
import { getAllFindings } from '../data/repositoryStore';
import type { Severity } from '../types';

export const BugReportsPage: React.FC = () => {
  useStoreUpdates();
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');

  const all = getAllFindings();
  const q = query.trim().toLowerCase();
  const shown = sortBySeverity(
    all.filter(
      (f) =>
        (severity === 'all' || f.severity === severity) &&
        (!q || [f.title, f.file_path, f.repository, f.rule_id].some((v) => v.toLowerCase().includes(q)))
    )
  );
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, all.filter((f) => f.severity === s).length]));

  return (
    <div className="space-y-6">
      <PageHeader title="Findings" description="Every issue the code checks found, across the repositories checked in this browser." />

      {all.length === 0 ? (
        <EmptyState
          title="No findings yet"
          action={
            <Link to="/repositories" className="text-sm font-medium text-marker hover:underline">
              Check a repository
            </Link>
          }
        >
          Findings show up here after you run code checks on a repository.
        </EmptyState>
      ) : (
        <section className="rounded-2xl border border-line bg-paper">
          <div className="flex flex-col gap-3 px-5 py-3 border-b border-line sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by severity">
              {(['all', ...SEVERITY_ORDER] as const)
                .filter((s) => s === 'all' || counts[s] > 0)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    aria-pressed={severity === s}
                    className={`rounded-lg px-2.5 py-1 text-sm capitalize ${
                      severity === s ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sunken'
                    }`}
                  >
                    {s === 'all' ? `All ${all.length}` : `${s === 'informational' ? 'info' : s} ${counts[s]}`}
                  </button>
                ))}
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">Search findings</span>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, file or rule"
                className="w-full rounded-lg border border-line bg-paper pl-9 pr-3 py-1.5 text-sm text-ink placeholder-faint focus:outline-none focus:border-marker focus:ring-2 focus:ring-marker/20"
              />
            </label>
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-pencil">No findings match these filters.</p>
          ) : (
            <FindingList findings={shown} showRepository />
          )}
        </section>
      )}
    </div>
  );
};

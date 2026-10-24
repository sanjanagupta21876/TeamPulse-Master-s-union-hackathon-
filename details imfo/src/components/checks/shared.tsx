import React from 'react';
import type { DiffResult } from '../../services/api';
import type { Severity } from '../../types';

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: 'bg-red/10 text-red',
  high: 'bg-amber/10 text-amber',
  medium: 'bg-sky/10 text-sky',
  low: 'bg-sunken text-ink-soft',
  informational: 'bg-sunken text-pencil',
};

export const SeverityTag: React.FC<{ severity: Severity }> = ({ severity }) => (
  <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLE[severity]}`}>
    {severity === 'informational' ? 'info' : severity}
  </span>
);

export const PageHeader: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-1 text-[15px] text-pencil max-w-[70ch]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </header>
);

export const EmptyState: React.FC<{ title: string; children?: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  children,
  action,
}) => (
  <div className="rounded-2xl border border-dashed border-line-strong bg-paper/60 px-6 py-14 text-center">
    <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
    {children && <p className="mt-1.5 text-sm text-pencil max-w-md mx-auto">{children}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const Section: React.FC<{ title: string; aside?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  aside,
  children,
}) => (
  <section className="rounded-2xl border border-line bg-paper">
    <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {aside}
    </div>
    <div className="px-5 py-4">{children}</div>
  </section>
);

/** Unified diff, line by line, using the hunks the backend already parsed. */
export const DiffView: React.FC<{ diff: DiffResult }> = ({ diff }) => (
  <div className="rounded-lg border border-line overflow-hidden">
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-wall border-b border-line text-xs">
      <span className="font-mono text-ink-soft truncate">{diff.file_path}</span>
      <span className="shrink-0 tabular-nums">
        <span className="text-green">+{diff.additions}</span> <span className="text-red">−{diff.deletions}</span>
      </span>
    </div>
    <pre className="overflow-x-auto bg-paper text-[12.5px] leading-[1.6]">
      {diff.hunks.map((hunk, h) => (
        <div key={h}>
          {hunk.lines.map((line, i) => {
            const kind = line.startsWith('@@') ? 'hunk' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx';
            return (
              <div
                key={i}
                className={`px-3 whitespace-pre ${
                  kind === 'add'
                    ? 'bg-green/10 text-ink'
                    : kind === 'del'
                      ? 'bg-red/10 text-ink'
                      : kind === 'hunk'
                        ? 'bg-sunken text-faint'
                        : 'text-ink-soft'
                }`}
              >
                {line.replace(/\n$/, '') || ' '}
              </div>
            );
          })}
        </div>
      ))}
    </pre>
  </div>
);

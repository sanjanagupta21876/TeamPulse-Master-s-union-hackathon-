import React from 'react';
import { Check, CornerDownLeft } from 'lucide-react';
import type { LoopStage } from '../../services/teamApi';

const STEPS: { key: Exclude<LoopStage, 'recovered'>; label: string }[] = [
  { key: 'detect', label: 'Detect' },
  { key: 'diagnose', label: 'Diagnose' },
  { key: 'intervene', label: 'Intervene' },
  { key: 'verify', label: 'Verify' },
  { key: 'adapt', label: 'Adapt' },
];

const DONE_BEFORE: Record<LoopStage, number> = { detect: 0, diagnose: 1, intervene: 2, verify: 3, adapt: 4, recovered: 5 };

/** The five-step recovery loop, with the current step marked. */
export const StepTrack: React.FC<{ stage: LoopStage }> = ({ stage }) => {
  const current = STEPS.findIndex((s) => s.key === stage);
  const done = DONE_BEFORE[stage];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Recovery loop progress">
      {STEPS.map((step, idx) => {
        const isCurrent = idx === current;
        const isDone = idx < done && !isCurrent;
        return (
          <React.Fragment key={step.key}>
            {idx > 0 && <span className={`h-px w-4 sm:w-6 ${idx <= done ? 'bg-ink-soft/40' : 'bg-line-strong/60'}`} />}
            <span
              aria-current={isCurrent ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                isCurrent ? 'bg-ink text-white' : isDone ? 'text-ink-soft' : 'text-faint'
              }`}
            >
              {isDone ? (
                <Check className="w-3.5 h-3.5 text-green" />
              ) : (
                <span className={`tabular-nums ${isCurrent ? 'text-white/70' : ''}`}>{idx + 1}</span>
              )}
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
      {stage === 'adapt' && (
        <span className="inline-flex items-center gap-1 text-xs text-pencil ml-1">
          <CornerDownLeft className="w-3.5 h-3.5" /> then back to Verify
        </span>
      )}
      {stage === 'recovered' && <span className="text-xs font-medium text-green ml-1">Recovered</span>}
    </div>
  );
};

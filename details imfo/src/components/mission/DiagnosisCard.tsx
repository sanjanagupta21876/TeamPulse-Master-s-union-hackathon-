import React from 'react';
import type { InterventionView } from '../../services/teamApi';

const Evidence: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-1.5">
    {items.map((e, i) => {
      const isQuote = e.startsWith('Private check-in answer:');
      return (
        <li
          key={i}
          className={`text-sm leading-snug ${isQuote ? 'border-l-2 border-marker/50 pl-3 text-ink italic' : 'flex gap-2 text-ink-soft'}`}
        >
          {isQuote ? (
            e.replace('Private check-in answer: ', '')
          ) : (
            <>
              <span className="text-faint" aria-hidden="true">
                –
              </span>
              {e.replace(/^Signal: /, '')}
            </>
          )}
        </li>
      );
    })}
  </ul>
);

/** `compact` is used while adapting: the cause was already shown, so the evidence starts folded. */
export const DiagnosisCard: React.FC<{ intervention: InterventionView; compact?: boolean }> = ({ intervention, compact = false }) =>
  compact ? (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-soft">
        <span className="text-pencil">Likely root cause: </span>
        <span className="font-semibold text-ink">{intervention.cause_label}</span>
        <span className="ml-2 text-xs text-marker group-open:hidden">Show the evidence</span>
      </summary>
      <div className="mt-3">
        <Evidence items={intervention.evidence} />
      </div>
    </details>
  ) : (
    <section className="space-y-3">
      <div>
        <p className="text-xs text-pencil">
          Likely root cause for {intervention.mission_title}, {intervention.confidence} confidence,{' '}
          {intervention.diagnosis_source === 'llm' ? 'AI-assisted' : 'rule-based'}
        </p>
        <h3 className="mt-1 font-display text-xl font-semibold text-ink leading-snug">{intervention.cause_label}</h3>
        <p className="mt-1.5 text-sm text-ink-soft leading-relaxed max-w-[68ch]">{intervention.explanation}</p>
      </div>
      <div>
        <h4 className="text-xs font-medium text-pencil mb-1.5">Evidence</h4>
        <Evidence items={intervention.evidence} />
      </div>
    </section>
  );

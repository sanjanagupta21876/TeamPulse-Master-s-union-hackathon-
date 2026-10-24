import React from 'react';
import { CheckCircle2, CornerDownLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import type { InterventionView } from '../../services/teamApi';

interface InterventionCardProps {
  intervention: InterventionView;
  previous?: InterventionView | null;
  onApprove?: () => void;
  onReject?: () => void;
  busy?: 'approve' | 'reject' | null;
  highlightApprove?: boolean;
}

const STATUS_TEXT: Record<InterventionView['status'], { text: string; tone: string }> = {
  proposed: { text: 'Waiting for your approval', tone: 'text-marker' },
  approved: { text: 'Approved. Checking the next update', tone: 'text-sky' },
  resolved: { text: 'Worked: blocker cleared', tone: 'text-green' },
  failed: { text: "Didn't clear the blocker", tone: 'text-red' },
  rejected: { text: 'Rejected', tone: 'text-faint' },
  escalated: { text: 'Needs your decision', tone: 'text-amber' },
};

export const InterventionCard: React.FC<InterventionCardProps> = ({
  intervention,
  previous,
  onApprove,
  onReject,
  busy = null,
  highlightApprove = false,
}) => {
  const status = STATUS_TEXT[intervention.status];
  const canDecide = intervention.status === 'proposed' || intervention.status === 'escalated';

  return (
    <section className="rounded-xl border border-line bg-wall/60 p-4 sm:p-5 space-y-4">
      {previous && (
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <CornerDownLeft className="w-4 h-4 mt-0.5 shrink-0 text-amber" />
          <span>
            “{previous.action_title}” {previous.status === 'rejected' ? 'was rejected' : "didn't clear the blocker"}, so here
            is a different action.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-pencil">Recommended action, attempt {intervention.attempt_no}</p>
        <p className={`text-xs font-semibold ${status.tone}`}>{status.text}</p>
      </div>

      <div>
        <h3 className="font-display text-xl font-semibold text-ink leading-snug">{intervention.action_title}</h3>
        <p className="mt-1 text-sm text-ink-soft">{intervention.action_summary}</p>
      </div>

      <ol className="space-y-1.5">
        {intervention.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-ink-soft">
            <span className="w-5 shrink-0 text-right text-faint tabular-nums">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <figure className="rounded-lg bg-paper border border-line px-4 py-3">
        <figcaption className="text-xs text-pencil mb-1">Draft message for you to send (not sent automatically)</figcaption>
        <blockquote className="text-sm text-ink leading-relaxed">{intervention.message_draft}</blockquote>
      </figure>

      <p className="text-xs text-pencil">
        <span className="font-semibold text-ink-soft">How we'll know it worked: </span>
        {intervention.success_criteria}
      </p>

      {intervention.verification_note && (
        <p className={`text-sm font-medium ${intervention.status === 'resolved' ? 'text-green' : 'text-red'}`}>
          {intervention.verification_note}
        </p>
      )}

      {canDecide && onApprove && onReject && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="primary"
            onClick={onApprove}
            isLoading={busy === 'approve'}
            disabled={busy !== null}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className={highlightApprove ? 'guide-target' : ''}
          >
            Approve as Captain
          </Button>
          {intervention.status === 'proposed' && (
            <Button variant="secondary" onClick={onReject} isLoading={busy === 'reject'} disabled={busy !== null}>
              Reject and suggest another
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

import React from 'react';
import { Button } from '../ui/Button';

interface SimulateUpdatePanelProps {
  missionTitle: string;
  ownerCallSign: string | null;
  busy: 'resolved' | 'still_blocked' | null;
  highlight: 'resolved' | 'still_blocked' | null;
  onSimulate: (outcome: 'resolved' | 'still_blocked') => void;
}

export const SimulateUpdatePanel: React.FC<SimulateUpdatePanelProps> = ({
  missionTitle,
  ownerCallSign,
  busy,
  highlight,
  onSimulate,
}) => {
  const owner = ownerCallSign ?? 'the owner';
  return (
    <section className="rounded-xl border border-dashed border-line-strong p-4 sm:p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">Simulate {owner}'s next update</h3>
        <p className="mt-1 text-sm text-pencil max-w-[64ch]">
          With a real team, Ship Intelligence checks the next update {owner} posts on {missionTitle}. For the demo, pick
          what that update says. It's saved and labeled as simulated.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          onClick={() => onSimulate('still_blocked')}
          isLoading={busy === 'still_blocked'}
          disabled={busy !== null}
          className={highlight === 'still_blocked' ? 'guide-target' : ''}
        >
          Still blocked
        </Button>
        <Button
          variant="success"
          onClick={() => onSimulate('resolved')}
          isLoading={busy === 'resolved'}
          disabled={busy !== null}
          className={highlight === 'resolved' ? 'guide-target' : ''}
        >
          Blocker resolved
        </Button>
      </div>
    </section>
  );
};

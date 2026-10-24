import React from 'react';
import { AlertTriangle, Presentation, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import type { MissionControlView } from '../../services/teamApi';
import { CaptainAvatar, CrewAvatar } from './Avatar';
import { RISK, deadlineLabel } from './format';

interface RoomHeaderProps {
  view: MissionControlView;
  guideOn: boolean;
  onToggleGuide: () => void;
  onReset: () => void;
  isResetting: boolean;
  resetHighlighted: boolean;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({ view, guideOn, onToggleGuide, onReset, isResetting, resetHighlighted }) => {
  const hours = Math.max(0, Math.round(view.hours_to_deadline));
  const roster = view.crew.map((c) => c.call_sign);
  const root = view.missions.find((m) => m.id === view.root_bottleneck_id);
  const risk = RISK[view.risk_level];

  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight text-ink">{view.project.name}</h1>
          <p className="mt-1 text-[15px] text-pencil max-w-[62ch]">{view.project.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={guideOn ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleGuide}
            aria-pressed={guideOn}
            leftIcon={<Presentation className="w-4 h-4" />}
            title="Show the next demo step at the bottom of the screen (shortcut: G)"
          >
            {guideOn ? 'Presenter guide on' : 'Presenter guide'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            isLoading={isResetting}
            leftIcon={<RotateCcw className="w-4 h-4" />}
            className={resetHighlighted ? 'guide-target' : ''}
          >
            Reset demo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="font-display text-2xl font-semibold text-ink tabular-nums">{hours} hours left</div>
          <div className="text-xs text-pencil">Deadline {deadlineLabel(view.project.deadline_at)}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${risk.bg} ${risk.text}`}>
          <span className={`w-2 h-2 rounded-full ${risk.bar}`} />
          {risk.label}
        </span>
        <div className="flex items-center gap-3 sm:ml-auto">
          <div className="flex -space-x-1.5">
            {view.crew.map((c) => (
              <CrewAvatar key={c.id} callSign={c.call_sign} roster={roster} title={`${c.call_sign}, ${c.role}`} />
            ))}
            <CaptainAvatar />
          </div>
          <span className="text-xs text-pencil">
            {view.crew.length} crew and you, the Captain
          </span>
        </div>
      </div>

      {view.emergency_mode && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-red/25 bg-red/[0.06] px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-red">Emergency mode.</span> Under 48 hours to go with a mission at{' '}
            {risk.label.toLowerCase()}. Ship Intelligence is working on {root ? root.title : 'the blocker'} first
            {root && root.downstream.length > 0 ? ', because other missions are waiting on it.' : '.'}
          </p>
        </div>
      )}
    </header>
  );
};

import React from 'react';
import { Check } from 'lucide-react';
import type { MissionView } from '../../services/teamApi';
import { CrewAvatar } from './Avatar';
import { RISK, STATUS_LABELS } from './format';

interface WhiteboardProps {
  missions: MissionView[];
  rootBottleneckId: string | null;
  roster: string[];
}

/** A loose marker stroke between two cards. */
const Arrow: React.FC = () => (
  <svg viewBox="0 0 44 24" className="w-9 h-6 shrink-0 self-center text-ink-soft/50" aria-hidden="true">
    <path d="M2 13 C 12 9, 24 16, 38 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M32 7 L 39 12 L 32 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The Captain's red-marker circle around the blocker. pathLength=1 lets CSS draw it in. */
const MarkerCircle: React.FC<{ redrawKey: string }> = ({ redrawKey }) => (
  <svg
    key={redrawKey}
    viewBox="0 0 240 200"
    preserveAspectRatio="none"
    className="marker-circle absolute -left-4 -top-5 w-[calc(100%+2rem)] h-[calc(100%+2.5rem)] pointer-events-none text-red"
    aria-hidden="true"
  >
    <path
      pathLength={1}
      d="M70 18 C 150 4, 222 22, 232 82 C 240 140, 196 192, 116 194 C 46 196, 6 154, 8 100 C 10 46, 54 12, 132 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

export const Whiteboard: React.FC<WhiteboardProps> = ({ missions, rootBottleneckId, roster }) => {
  const root = missions.find((m) => m.id === rootBottleneckId) ?? null;
  const waitingOnRoot = new Set(root?.downstream ?? []);

  return (
    <section
      aria-label="Mission dependencies"
      className="rounded-2xl border border-line bg-paper"
      style={{
        backgroundImage: 'radial-gradient(rgb(var(--line-strong) / 0.55) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="px-5 pt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-ink">Who's waiting on whom</h2>
        <p className="text-sm text-pencil">
          {root
            ? `${root.title} is holding up ${root.downstream.length} ${root.downstream.length === 1 ? 'mission' : 'missions'}.`
            : 'Nothing is blocked right now.'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <ol className="flex items-stretch gap-1.5 px-8 pt-9 pb-10 min-w-[880px]">
          {missions.map((m, idx) => {
            const isRoot = m.id === rootBottleneckId;
            const isWaiting = waitingOnRoot.has(m.id);
            const isDone = m.status === 'done';
            return (
              <React.Fragment key={m.id}>
                {idx > 0 && <Arrow />}
                <li className="relative flex-1 min-w-0">
                  {isRoot && <MarkerCircle redrawKey={m.id} />}
                  <div
                    className={`relative h-full rounded-xl border bg-paper p-3.5 shadow-[0_1px_2px_rgb(23_32_28/0.06)] ${
                      isRoot ? 'border-red/30' : 'border-line'
                    } ${isDone ? 'opacity-70' : ''}`}
                  >
                    <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r ${RISK[m.risk_level].bar}`} aria-hidden="true" />
                    <div className="flex items-center gap-2">
                      {m.owner_call_sign && <CrewAvatar callSign={m.owner_call_sign} roster={roster} size="sm" />}
                      <span className="text-xs text-pencil">{m.owner_call_sign ?? 'Unassigned'}</span>
                      {isDone && <Check className="w-3.5 h-3.5 text-green ml-auto" aria-label="Done" />}
                    </div>
                    <h3 className="mt-2 font-display text-[15px] font-semibold leading-snug text-ink">{m.title}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-sunken overflow-hidden">
                        <div className={`h-full ${isDone ? 'bg-green' : 'bg-ink-soft'}`} style={{ width: `${m.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-pencil tabular-nums">{m.progress}%</span>
                    </div>
                    <p
                      className={`mt-2 text-xs font-medium ${
                        isRoot ? 'text-red' : isWaiting ? 'text-amber' : m.status === 'blocked' ? 'text-red' : 'text-pencil'
                      }`}
                    >
                      {isRoot && m.downstream.length > 0
                        ? `${STATUS_LABELS[m.status]}, holding up ${m.downstream.length}`
                        : isWaiting && root
                          ? `Waiting on ${root.title}`
                          : STATUS_LABELS[m.status]}
                    </p>
                  </div>
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      </div>
    </section>
  );
};

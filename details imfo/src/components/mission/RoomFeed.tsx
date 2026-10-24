import React, { useEffect, useRef } from 'react';
import type { CrewMember, TimelineEvent } from '../../services/teamApi';
import { AgentAvatar, CaptainAvatar, CrewAvatar } from './Avatar';
import { relativeTime } from './format';

interface RoomFeedProps {
  events: TimelineEvent[];
  crew: CrewMember[];
  now: string;
}

function speaker(actor: string, crew: CrewMember[], roster: string[]) {
  if (actor === 'agent') return { name: 'Ship Intelligence', avatar: <AgentAvatar size="sm" /> };
  if (actor === 'captain') return { name: 'You (Captain)', avatar: <CaptainAvatar size="sm" /> };
  if (actor.startsWith('crew:')) {
    const sign = actor.slice(5);
    const role = crew.find((c) => c.call_sign === sign)?.role;
    return {
      name: role ? `${sign}, ${role}` : sign,
      avatar: <CrewAvatar callSign={sign} roster={roster} size="sm" />,
    };
  }
  return null;
}

/** The room's shared activity, oldest first like a conversation. */
export const RoomFeed: React.FC<RoomFeedProps> = ({ events, crew, now }) => {
  const roster = crew.map((c) => c.call_sign);
  const ordered = [...events].reverse();
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view without scrolling the page itself
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [events.length]);

  return (
    <div ref={boxRef} className="max-h-[560px] overflow-y-auto px-5 py-4">
    <ol className="space-y-4">
      {ordered.map((e) => {
        const who = speaker(e.actor, crew, roster);
        if (!who) {
          return (
            <li key={e.id} className="flex items-center gap-3 text-xs text-faint">
              <span className="h-px flex-1 bg-line" />
              {e.message}
              <span className="h-px flex-1 bg-line" />
            </li>
          );
        }
        return (
          <li key={e.id} className="flex gap-2.5">
            {who.avatar}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-semibold text-ink">{who.name}</span>
                <span className="text-[11px] text-faint">{relativeTime(e.created_at, now)}</span>
                {e.simulated && (
                  <span className="rounded bg-sunken px-1.5 py-px text-[10px] font-medium text-pencil" title="Created by the demo controls">
                    Simulated
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-soft leading-snug">{e.message}</p>
              {e.meta && <p className="mt-0.5 text-xs text-faint">{e.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
    </div>
  );
};

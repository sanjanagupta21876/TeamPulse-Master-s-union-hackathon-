import React from 'react';
import type { MissionView } from '../../services/teamApi';
import { CrewAvatar } from './Avatar';
import { RISK, SIGNAL_LABELS, STATUS_LABELS, relativeTime } from './format';

interface MissionListProps {
  missions: MissionView[];
  roster: string[];
  now: string;
}

export const MissionList: React.FC<MissionListProps> = ({ missions, roster, now }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-faint">
          <th className="py-2 pl-5 pr-4 font-medium">Mission</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 pr-4 font-medium">Due</th>
          <th className="py-2 pr-4 font-medium">Last update</th>
          <th className="py-2 pr-5 font-medium">Why it's flagged</th>
        </tr>
      </thead>
      <tbody>
        {missions.map((m) => (
          <tr key={m.id} className="border-t border-line align-top">
            <td className="py-3 pl-5 pr-4">
              <div className="flex items-center gap-2.5">
                {m.owner_call_sign && <CrewAvatar callSign={m.owner_call_sign} roster={roster} size="sm" />}
                <div>
                  <div className="font-medium text-ink whitespace-nowrap">{m.title}</div>
                  <div className="text-xs text-faint">{m.owner_call_sign ?? 'Unassigned'}</div>
                </div>
              </div>
            </td>
            <td className="py-3 pr-4 whitespace-nowrap">
              <div className={`font-medium ${m.status === 'blocked' ? 'text-red' : m.status === 'done' ? 'text-green' : 'text-ink-soft'}`}>
                {STATUS_LABELS[m.status]}
              </div>
              <div className="text-xs text-faint tabular-nums">{m.progress}% done</div>
            </td>
            <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">{relativeTime(m.due_at, now)}</td>
            <td className="py-3 pr-4 whitespace-nowrap text-ink-soft">{relativeTime(m.last_update_at, now)}</td>
            <td className="py-3 pr-5">
              {m.signals.length === 0 ? (
                <span className="text-xs text-faint">Nothing</span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-semibold ${RISK[m.risk_level].text}`}>{RISK[m.risk_level].label}:</span>
                  {m.signals.map((s, i) => {
                    const label = SIGNAL_LABELS[s.code] ?? s.code;
                    return (
                      <span key={s.code} title={s.message} className="text-xs text-ink-soft">
                        {i === 0 ? label : label.toLowerCase()}
                        {i < m.signals.length - 1 ? ',' : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

import type { MissionStatus, RiskLevel } from '../../services/teamApi';

export const RISK: Record<RiskLevel, { label: string; text: string; bg: string; bar: string; badge: 'success' | 'info' | 'warning' | 'danger' }> = {
  LOW: { label: 'Low risk', text: 'text-green', bg: 'bg-green/10', bar: 'bg-green', badge: 'success' },
  MEDIUM: { label: 'Medium risk', text: 'text-sky', bg: 'bg-sky/10', bar: 'bg-sky', badge: 'info' },
  HIGH: { label: 'High risk', text: 'text-amber', bg: 'bg-amber/10', bar: 'bg-amber', badge: 'warning' },
  CRITICAL: { label: 'Critical risk', text: 'text-red', bg: 'bg-red/10', bar: 'bg-red', badge: 'danger' },
};

export const STATUS_LABELS: Record<MissionStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const SIGNAL_LABELS: Record<string, string> = {
  blocked: 'Blocked',
  overdue: 'Overdue',
  deadline_at_risk: 'Tight deadline',
  stale: 'No recent update',
  upstream_blocked: 'Upstream blocked',
  waiting_on_dependency: 'Waiting',
  workload_exceeds_time: 'Too much work left',
};

/** Soft identity tints so crew members are easy to tell apart. Kept away from the risk colors. */
const CREW_TINTS = [
  { bg: '#E7E3F6', fg: '#46398A' },
  { bg: '#DDECF3', fg: '#1D5670' },
  { bg: '#F2E7DA', fg: '#74471F' },
  { bg: '#E9E6DF', fg: '#4A463C' },
];

export function crewTint(callSign: string, roster: string[]): { bg: string; fg: string } {
  const idx = roster.indexOf(callSign);
  return CREW_TINTS[(idx >= 0 ? idx : callSign.length) % CREW_TINTS.length];
}

export function hoursFromNow(iso: string, nowIso: string): number {
  return (new Date(iso).getTime() - new Date(nowIso).getTime()) / 3_600_000;
}

export function relativeTime(iso: string | null, nowIso: string): string {
  if (!iso) return 'never';
  const hours = hoursFromNow(iso, nowIso);
  const abs = Math.abs(hours);
  if (abs < 1 / 60) return 'just now';
  const text = abs < 1 ? `${Math.round(abs * 60)} min` : abs < 48 ? `${Math.round(abs)}h` : `${Math.round(abs / 24)}d`;
  return hours < 0 ? `${text} ago` : `in ${text}`;
}

export function deadlineLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

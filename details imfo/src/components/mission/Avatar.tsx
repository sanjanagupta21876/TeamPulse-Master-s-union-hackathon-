import React from 'react';
import { crewTint } from './format';

type Size = 'sm' | 'md';
const SIZE: Record<Size, string> = { sm: 'w-6 h-6 text-[11px]', md: 'w-8 h-8 text-xs' };

export const CrewAvatar: React.FC<{ callSign: string; roster: string[]; size?: Size; title?: string }> = ({
  callSign,
  roster,
  size = 'md',
  title,
}) => {
  const tint = crewTint(callSign, roster);
  return (
    <span
      title={title ?? callSign}
      className={`${SIZE[size]} shrink-0 rounded-full flex items-center justify-center font-semibold ring-2 ring-paper`}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
    >
      {callSign.slice(0, 1)}
    </span>
  );
};

export const CaptainAvatar: React.FC<{ size?: Size }> = ({ size = 'md' }) => (
  <span
    title="Captain (you)"
    className={`${SIZE[size]} shrink-0 rounded-full flex items-center justify-center font-semibold bg-marker text-white ring-2 ring-paper`}
  >
    You
  </span>
);

export const AgentAvatar: React.FC<{ size?: Size }> = ({ size = 'md' }) => (
  <span title="Ship Intelligence" className={`${SIZE[size]} shrink-0 rounded-lg bg-ink flex items-center justify-center`}>
    <svg viewBox="0 0 32 32" className="w-[70%] h-[70%]" aria-hidden="true">
      <path d="M3 17h7l3-8 5 15 3-7h8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

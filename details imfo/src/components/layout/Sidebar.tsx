import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FolderGit2, History, ListChecks, Users, X } from 'lucide-react';
import { API_BASE_URL, apiClient } from '../../services/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const ROOM: NavItem[] = [{ name: 'Team room', path: '/room', icon: Users }];

const CODE_CHECKS: NavItem[] = [
  { name: 'Repositories', path: '/repositories', icon: FolderGit2 },
  { name: 'Findings', path: '/bugs', icon: ListChecks },
  { name: 'Fix history', path: '/fix-history', icon: History },
];

export const Logo: React.FC = () => (
  <span className="flex items-center gap-2.5">
    <svg viewBox="0 0 32 32" className="w-7 h-7" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-ink" />
      <path
        d="M5 17h6l3-7 4 13 3-6h6"
        fill="none"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="font-display text-lg font-semibold tracking-tight text-ink">TeamPulse</span>
  </span>
);

function useBackendStatus(): 'checking' | 'online' | 'offline' {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      apiClient.checkHealth().then(
        () => !cancelled && setStatus('online'),
        () => !cancelled && setStatus('offline')
      );
    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return status;
}

const NavGroup: React.FC<{ title?: string; items: NavItem[]; onNavigate: () => void }> = ({ title, items, onNavigate }) => (
  <div className="space-y-1">
    {title && <div className="px-3 pb-1 text-xs font-medium text-faint">{title}</div>}
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-sunken'
            }`
          }
        >
          <Icon className="w-4 h-4 shrink-0" />
          {item.name}
        </NavLink>
      );
    })}
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const status = useBackendStatus();

  const content = (
    <div className="flex flex-col h-full w-[232px] bg-paper border-r border-line">
      <div className="h-16 px-4 flex items-center justify-between">
        <NavLink to="/room" onClick={onClose} aria-label="TeamPulse home">
          <Logo />
        </NavLink>
        <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-pencil hover:bg-sunken" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-6">
        <NavGroup items={ROOM} onNavigate={onClose} />
        <NavGroup title="Code checks" items={CODE_CHECKS} onNavigate={onClose} />
      </nav>

      <div className="px-4 py-4 border-t border-line text-xs">
        <div className="flex items-center gap-2 text-ink-soft">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'online' ? 'bg-green' : status === 'offline' ? 'bg-red' : 'bg-line-strong'
            }`}
          />
          {status === 'online' ? 'Backend connected' : status === 'offline' ? 'Backend not reachable' : 'Checking backend…'}
        </div>
        {status === 'offline' && <p className="mt-1 text-faint break-all">Start the API at {API_BASE_URL}</p>}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block sticky top-0 h-screen shrink-0">{content}</aside>
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
          <aside className="relative z-10 h-full">{content}</aside>
        </div>
      )}
    </>
  );
};

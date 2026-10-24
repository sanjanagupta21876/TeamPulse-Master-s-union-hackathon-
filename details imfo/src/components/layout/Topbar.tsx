import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  GitBranch,
  Check,
  Slash,
} from 'lucide-react';
import { mockRepositories } from '../../data/mockRepositories';
import { getAllRepositories } from '../../data/repositoryStore';
import { useToast } from '../ui/Toast';
import type { Repository } from '../../types';

interface TopbarProps {
  onMenuToggle: () => void;
  selectedRepoId: string;
  onSelectRepo: (repoId: string) => void;
  onOpenSearch: () => void;
  repositories?: Repository[];
}

export const Topbar: React.FC<TopbarProps> = ({
  onMenuToggle,
  selectedRepoId,
  onSelectRepo,
  onOpenSearch,
  repositories,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const repoList = repositories && repositories.length > 0 ? repositories : getAllRepositories();
  const currentRepo =
    repoList.find((r) => r.id === selectedRepoId) || repoList[0] || mockRepositories[0];

  // Derive breadcrumb from pathname
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = pathParts.map((part, index) => {
    const url = `/${pathParts.slice(0, index + 1).join('/')}`;
    const formatted = part
      .replace(/-/g, ' ')
      .replace(/^([a-z])/, (m) => m.toUpperCase());

    return {
      name: formatted === 'Dashboard' ? 'Overview' : formatted,
      url,
      isLast: index === pathParts.length - 1,
    };
  });

  return (
    <header className="h-16 px-4 sm:px-6 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A] sticky top-0 z-20 flex items-center justify-between gap-4">
      {/* Left side: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb trail */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <span
            onClick={() => navigate('/dashboard')}
            className="text-[#71717A] hover:text-[#FAFAFA] transition-colors cursor-pointer"
          >
            TeamPulse
          </span>
          <Slash className="w-3 h-3 text-[#3F3F46] -rotate-12" />

          {breadcrumbItems.length === 0 ? (
            <span className="font-medium text-[#FAFAFA]">Overview</span>
          ) : (
            breadcrumbItems.map((item, idx) => (
              <React.Fragment key={item.url}>
                {idx > 0 && <Slash className="w-3 h-3 text-[#3F3F46] -rotate-12" />}
                {item.isLast ? (
                  <span className="font-medium text-[#FAFAFA] truncate max-w-[140px] sm:max-w-none">
                    {item.name}
                  </span>
                ) : (
                  <button
                    onClick={() => navigate(item.url)}
                    className="text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors truncate"
                  >
                    {item.name}
                  </button>
                )}
              </React.Fragment>
            ))
          )}
        </nav>
      </div>

      {/* Right side: Repo Selector, Global Search, Notifications, Avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Repository selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111114] border border-[#27272A] hover:border-[#3F3F46] text-xs font-medium text-[#FAFAFA] transition-all"
            aria-expanded={repoDropdownOpen}
            aria-haspopup="true"
          >
            <GitBranch className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="max-w-[100px] sm:max-w-[140px] truncate">{currentRepo.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
          </button>

          {/* Repo dropdown menu */}
          {repoDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setRepoDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#111114] border border-[#27272A] shadow-xl py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                  Select Repository
                </div>
                {repoList.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => {
                      onSelectRepo(repo.id);
                      setRepoDropdownOpen(false);
                      toast(`Switched repository to ${repo.name}`, undefined, 'info');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      repo.id === currentRepo.id
                        ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] font-medium'
                        : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <GitBranch className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{repo.name}</span>
                    </div>
                    {repo.id === currentRepo.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#111114] border border-[#27272A] text-xs text-[#71717A] hover:text-[#FAFAFA] hover:border-[#3F3F46] transition-all"
          title="Search code & bugs (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search...</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.2 bg-[#18181B] border border-[#27272A] rounded text-[10px] text-[#71717A]">
            ⌘K
          </kbd>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-lg text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B] border border-transparent hover:border-[#27272A] transition-all"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8B5CF6] ring-2 ring-[#09090B]" />
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#111114] border border-[#27272A] shadow-2xl py-2 z-40">
                <div className="px-4 py-2 border-b border-[#27272A] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#FAFAFA]">Notifications</span>
                  <span className="text-[10px] text-[#8B5CF6] font-medium bg-[#8B5CF6]/15 px-2 py-0.5 rounded-full">
                    3 New
                  </span>
                </div>
                <div className="divide-y divide-[#27272A]/50 max-h-72 overflow-y-auto">
                  <div className="p-3 text-xs hover:bg-[#18181B] cursor-pointer transition-colors">
                    <p className="font-medium text-[#FAFAFA]">High severity issue detected</p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">Missing validation in payment-api</p>
                    <span className="text-[10px] text-[#71717A] mt-1 block">12 mins ago</span>
                  </div>
                  <div className="p-3 text-xs hover:bg-[#18181B] cursor-pointer transition-colors">
                    <p className="font-medium text-[#FAFAFA]">Fix verification passed</p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">App.tsx ErrorBoundary fix simulated</p>
                    <span className="text-[10px] text-[#71717A] mt-1 block">1 hour ago</span>
                  </div>
                  <div className="p-3 text-xs hover:bg-[#18181B] cursor-pointer transition-colors">
                    <p className="font-medium text-[#FAFAFA]">Repository scan complete</p>
                    <p className="text-[11px] text-[#A1A1AA] mt-0.5">auth-service analyzed (91% health)</p>
                    <span className="text-[10px] text-[#71717A] mt-1 block">2 hours ago</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Small User Avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-xs font-bold text-white border border-[#27272A] hover:ring-2 hover:ring-[#8B5CF6] transition-all"
          title="User profile & settings"
        >
          D
        </button>
      </div>
    </header>
  );
};

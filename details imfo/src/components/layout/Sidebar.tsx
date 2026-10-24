import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  Bug,
  History,
  Layout,
  Server,
  ShieldAlert,
  Puzzle,
  Settings,
  Code2,
  X,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  bugCount?: number;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  bugCount = 12,
}) => {
  const location = useLocation();

  const navSections: NavSection[] = [
    {
      title: 'WORKSPACE',
      items: [
        { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Repositories', path: '/repositories', icon: GitBranch },
        { name: 'Bug Reports', path: '/bugs', icon: Bug, badge: bugCount },
        { name: 'Fix History', path: '/fix-history', icon: History },
      ],
    },
    {
      title: 'ANALYSIS',
      items: [
        { name: 'Frontend Analysis', path: '/analysis/frontend', icon: Layout },
        { name: 'Backend Analysis', path: '/analysis/backend', icon: Server },
        { name: 'Security Scan', path: '/analysis/security', icon: ShieldAlert },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { name: 'Integrations', path: '/integrations', icon: Puzzle },
        { name: 'Settings', path: '/settings', icon: Settings },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0C0C0F] border-r border-[#27272A] w-[260px] select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-[#27272A] flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center text-[#8B5CF6] group-hover:scale-105 transition-transform">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm tracking-tight text-[#FAFAFA]">
              TeamPulse
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A78BFA] border border-[#8B5CF6]/30 uppercase tracking-wider">
              BETA
            </span>
          </div>
        </NavLink>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden text-[#A1A1AA] hover:text-[#FAFAFA] p-1 rounded-md hover:bg-[#18181B]"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-[#71717A] uppercase">
              {section.title}
            </div>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/dashboard'
                    ? location.pathname === '/dashboard' || location.pathname === '/'
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[#8B5CF6]/15 text-[#FAFAFA] border border-[#8B5CF6]/30'
                        : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-[#8B5CF6]' : 'text-[#71717A]'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                          isActive
                            ? 'bg-[#8B5CF6] text-white'
                            : 'bg-[#27272A] text-[#A1A1AA]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* AI Assistant Banner */}
      <div className="p-3 mx-3 mb-3 rounded-xl bg-gradient-to-b from-[#8B5CF6]/10 to-transparent border border-[#8B5CF6]/20">
        <div className="flex items-center gap-2 text-xs font-medium text-[#FAFAFA]">
          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
          <span>Automated Fix Engine</span>
        </div>
        <p className="text-[11px] text-[#A1A1AA] mt-1 leading-relaxed">
          Real-time syntax & semantic AST inspection active.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-t border-[#27272A] bg-[#09090B]/50">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[#18181B] transition-colors cursor-pointer">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#3B82F6] flex items-center justify-center text-xs font-semibold text-white shadow-sm">
              D
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#22C55E] ring-2 ring-[#0C0C0F]" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-[#FAFAFA] truncate">
              Developer
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#A1A1AA] truncate">Free Plan</span>
              <span className="text-[9px] px-1 rounded bg-[#27272A] text-[#A1A1AA]">PRO SEED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (persistent) */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

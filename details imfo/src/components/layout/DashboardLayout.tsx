import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Logo, Sidebar } from './Sidebar';
import { AnalyzeRepositoryModal } from '../repositories/AnalyzeRepositoryModal';
import { STORE_EVENT, getAllRepositories } from '../../data/repositoryStore';
import type { Repository } from '../../types';

export const DashboardLayout: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>(() => getAllRepositories());
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setRepositories(getAllRepositories());
    window.addEventListener(STORE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STORE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-wall text-ink flex">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-14 px-4 flex items-center gap-3 bg-paper border-b border-line sticky top-0 z-30">
          <button onClick={() => setMenuOpen(true)} className="p-1.5 -ml-1.5 rounded-lg text-ink-soft hover:bg-sunken" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <Logo />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 max-w-[1320px] w-full mx-auto">
          <Outlet
            context={{
              repositories,
              onOpenAnalyzeModal: () => setAnalyzeModalOpen(true),
            }}
          />
        </main>
      </div>

      <AnalyzeRepositoryModal
        isOpen={analyzeModalOpen}
        onClose={() => setAnalyzeModalOpen(false)}
        onRepositoryAdded={() => setRepositories(getAllRepositories())}
      />
    </div>
  );
};

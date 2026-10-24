import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AnalyzeRepositoryModal } from '../repositories/AnalyzeRepositoryModal';
import { Modal } from '../ui/Modal';
import { mockRepositories } from '../../data/mockRepositories';
import { getAllRepositories } from '../../data/repositoryStore';
import { mockBugs } from '../../data/mockBugs';
import { Search, Bug, GitBranch, ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '../ui/Toast';
import type { Repository } from '../../types';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>(() => getAllRepositories());
  const [selectedRepoId, setSelectedRepoId] = useState('repo-1');
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Listen to storage/repository update events
  useEffect(() => {
    const handleUpdate = () => {
      setRepositories(getAllRepositories());
    };
    window.addEventListener('codelens_repositories_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('codelens_repositories_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Global hotkey Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredBugs = searchQuery
    ? mockBugs.filter(
        (b) =>
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mockBugs.slice(0, 4);

  const filteredRepos = searchQuery
    ? repositories.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : repositories.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        bugCount={mockBugs.length}
      />

      {/* Main Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onMenuToggle={() => setMobileMenuOpen(true)}
          selectedRepoId={selectedRepoId}
          onSelectRepo={setSelectedRepoId}
          onOpenSearch={() => setSearchModalOpen(true)}
          repositories={repositories}
        />

        {/* Dynamic Page Outlet with pass-through context */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet
            context={{
              selectedRepoId,
              repositories,
              onOpenAnalyzeModal: () => setAnalyzeModalOpen(true),
            }}
          />
        </main>
      </div>

      {/* Global Analyze Repository Modal */}
      <AnalyzeRepositoryModal
        isOpen={analyzeModalOpen}
        onClose={() => setAnalyzeModalOpen(false)}
        onRepositoryAdded={(newRepo) => {
          setRepositories(getAllRepositories());
          setSelectedRepoId(newRepo.id);
        }}
      />

      {/* Global Command / Search Palette */}
      <Modal
        isOpen={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false);
          setSearchQuery('');
        }}
        title="Quick Search & Navigation"
        description="Jump to bug reports, repositories, or run actions."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bugs, files, categories, repositories..."
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Quick Actions */}
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-[#71717A] uppercase px-1">
                Quick Actions
              </span>
              <div className="mt-1 space-y-1">
                <button
                  onClick={() => {
                    setSearchModalOpen(false);
                    setAnalyzeModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#18181B] text-xs text-[#FAFAFA] transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span>Analyze new GitHub repository</span>
                  </div>
                  <span className="text-[10px] text-[#71717A]">Action</span>
                </button>
              </div>
            </div>

            {/* Bugs */}
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-[#71717A] uppercase px-1">
                Bug Findings ({filteredBugs.length})
              </span>
              <div className="mt-1 space-y-1">
                {filteredBugs.map((bug) => (
                  <button
                    key={bug.id}
                    onClick={() => {
                      setSearchModalOpen(false);
                      navigate(`/bugs/${bug.id}`);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#18181B] text-xs text-left transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bug className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                      <span className="font-medium text-[#FAFAFA] truncate">
                        {bug.title}
                      </span>
                      <span className="text-[#71717A] font-mono text-[11px] truncate">
                        {bug.file}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[#71717A] shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>

            {/* Repositories */}
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-[#71717A] uppercase px-1">
                Repositories
              </span>
              <div className="mt-1 space-y-1">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => {
                      setSearchModalOpen(false);
                      navigate(`/repositories/${repo.id}`);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#18181B] text-xs text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span className="font-medium text-[#FAFAFA]">{repo.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#27272A] text-[#A1A1AA]">
                        {repo.language}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#22C55E] font-medium">
                      {repo.codeHealth}/100
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

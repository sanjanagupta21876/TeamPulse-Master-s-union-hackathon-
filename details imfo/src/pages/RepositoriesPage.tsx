import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { RepoStatusBadge } from '../components/ui/Badge';
import { getAllRepositories } from '../data/repositoryStore';
import type { Repository } from '../types';
import {
  Search,
  Plus,
  GitBranch,
  Play,
  ArrowRight,
  Shield,
  Bug,
  Activity,
  FolderGit2,
  Star,
  Info,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

interface OutletContextType {
  repositories?: Repository[];
  onOpenAnalyzeModal: () => void;
}

export const RepositoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { onOpenAnalyzeModal, repositories: contextRepos } = useOutletContext<OutletContextType>();
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const allRepos = contextRepos && contextRepos.length > 0 ? contextRepos : getAllRepositories();

  const filteredRepositories = allRepos.filter((repo) => {
    const matchesSearch =
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(search.toLowerCase())) ||
      (repo.owner && repo.owner.toLowerCase().includes(search.toLowerCase()));
    const matchesLang =
      languageFilter === 'All' || (repo.language && repo.language.toLowerCase() === languageFilter.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' || repo.status === statusFilter;
    return matchesSearch && matchesLang && matchesStatus;
  });

  const getLanguageColor = (lang: string | null) => {
    switch (lang) {
      case 'TypeScript':
        return 'bg-[#3178C6]';
      case 'Python':
        return 'bg-[#3572A5]';
      case 'JavaScript':
        return 'bg-[#F7DF1E]';
      case 'Go':
        return 'bg-[#00ADD8]';
      case 'Rust':
        return 'bg-[#DEA584]';
      default:
        return 'bg-[#8B5CF6]';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
            Repositories
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Manage connected GitHub repositories, inspect AST summaries, and review branch health.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onOpenAnalyzeModal}
        >
          Analyze Repository
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:flex-1">
          <Input
            placeholder="Search repositories by name, owner, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
          >
            <option value="All">All Languages</option>
            <option value="TypeScript">TypeScript</option>
            <option value="Python">Python</option>
            <option value="JavaScript">JavaScript</option>
            <option value="Go">Go</option>
            <option value="Rust">Rust</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
          >
            <option value="All">All Statuses</option>
            <option value="Metadata Retrieved">Metadata Retrieved</option>
            <option value="Healthy">Healthy</option>
            <option value="Analyzed">Analyzed</option>
            <option value="Issues Found">Issues Found</option>
          </select>
        </div>
      </div>

      {/* Repositories Cards Grid */}
      {filteredRepositories.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#71717A] mb-3">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#FAFAFA]">No repositories match your filter</h3>
          <p className="text-xs text-[#A1A1AA] max-w-sm mt-1">
            Try adjusting your search query or language filter, or analyze a new public repository.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearch('');
              setLanguageFilter('All');
              setStatusFilter('All');
            }}
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepositories.map((repo) => (
            <Card
              key={repo.id}
              hover
              className="p-5 flex flex-col justify-between group transition-all"
            >
              <div>
                {/* Header row: Icon, Name, Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#8B5CF6] group-hover:border-[#8B5CF6]/50 transition-colors">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <button
                        onClick={() => navigate(`/repositories/${repo.id}`)}
                        className="text-base font-semibold text-[#FAFAFA] hover:text-[#8B5CF6] transition-colors text-left flex items-center gap-1.5"
                      >
                        <span>{repo.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      <span className="text-xs text-[#71717A] font-mono">
                        {repo.owner ? `${repo.owner} • ` : ''}branch: {repo.selectedBranch || repo.defaultBranch} • commit {repo.commitSha}
                      </span>
                    </div>
                  </div>

                  <RepoStatusBadge status={repo.status} />
                </div>

                {/* Description */}
                <p className="text-xs text-[#A1A1AA] mt-3 line-clamp-2 leading-relaxed">
                  {repo.description || 'No description provided.'}
                </p>

                {/* Notice for inspected-only repo */}
                {repo.isInspectedOnly && (
                  <div className="mt-3 p-2 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center gap-2 text-[11px] text-[#A1A1AA]">
                    <Info className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                    <span>Metadata Retrieved — Bug Analysis Not Yet Run</span>
                  </div>
                )}

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#27272A]/70 text-xs">
                  <div className="p-2 rounded-lg bg-[#0C0C0F] border border-[#27272A]/60">
                    <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                      <Activity className="w-3 h-3 text-[#22C55E]" /> Health
                    </div>
                    <div className="text-sm font-bold text-[#FAFAFA] font-mono mt-0.5">
                      {repo.codeHealth !== null ? `${repo.codeHealth}/100` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#0C0C0F] border border-[#27272A]/60">
                    <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                      <Bug className="w-3 h-3 text-[#EF4444]" /> Detected
                    </div>
                    <div className="text-sm font-bold text-[#FAFAFA] font-mono mt-0.5">
                      {repo.codeHealth !== null ? `${repo.bugsCount} issues` : '0 issues'}
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#0C0C0F] border border-[#27272A]/60">
                    <div className="text-[11px] text-[#71717A] flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#8B5CF6]" /> Security
                    </div>
                    <div className="text-sm font-bold text-[#FAFAFA] font-mono mt-0.5">
                      {repo.metrics?.security ? `${repo.metrics.security}%` : 'Pending'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-[#27272A]/70 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${getLanguageColor(
                      repo.language
                    )}`}
                  />
                  <span className="text-[#A1A1AA]">{repo.language || 'Code'}</span>
                  {repo.stars !== undefined && (
                    <>
                      <span className="text-[#3F3F46]">•</span>
                      <span className="text-[#71717A] flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        {repo.stars.toLocaleString()}
                      </span>
                    </>
                  )}
                  <span className="text-[#3F3F46]">•</span>
                  <span className="text-[#71717A]">{repo.lastAnalyzed}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      toast(
                        `Inspecting ${repo.name}`,
                        'Live metadata and branch commit SHA synced.',
                        'info'
                      );
                    }}
                    title="Run Analysis"
                  >
                    <Play className="w-3 h-3 text-[#8B5CF6]" />
                    <span className="hidden sm:inline">Inspect</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/repositories/${repo.id}`)}
                  >
                    Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { RepoStatusBadge } from '../ui/Badge';
import type { Repository } from '../../types';
import {
  GitBranch,
  ArrowRight,
  MoreVertical,
  ExternalLink,
  Play,
} from 'lucide-react';
import { useToast } from '../ui/Toast';

interface RepositoryTableProps {
  repositories: Repository[];
  onAnalyzeRepo?: (repo: Repository) => void;
}

export const RepositoryTable: React.FC<RepositoryTableProps> = ({
  repositories,
  onAnalyzeRepo,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const getLanguageColor = (lang: string | null) => {
    switch (lang) {
      case 'TypeScript':
        return 'bg-[#3178C6]';
      case 'Python':
        return 'bg-[#3572A5]';
      case 'JavaScript':
        return 'bg-[#F7DF1E]';
      case 'Rust':
        return 'bg-[#DEA584]';
      case 'Go':
        return 'bg-[#00ADD8]';
      default:
        return 'bg-[#8B5CF6]';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Your Repositories</CardTitle>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Monitored codebases and latest health metrics
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          onClick={() => navigate('/repositories')}
        >
          View All
        </Button>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#27272A] bg-[#0C0C0F]/60 text-[#71717A] uppercase tracking-wider text-[11px]">
              <th className="py-3 px-5 font-semibold">Repository</th>
              <th className="py-3 px-4 font-semibold">Language</th>
              <th className="py-3 px-4 font-semibold">Last Analyzed</th>
              <th className="py-3 px-4 font-semibold">Bugs</th>
              <th className="py-3 px-4 font-semibold">Code Health</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272A]/70">
            {repositories.map((repo) => (
              <tr
                key={repo.id}
                className="hover:bg-[#18181B]/40 transition-colors group"
              >
                {/* Repository Name */}
                <td className="py-3.5 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#8B5CF6] group-hover:border-[#8B5CF6]/40 transition-colors">
                      <GitBranch className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <button
                        onClick={() => navigate(`/repositories/${repo.id}`)}
                        className="font-medium text-[#FAFAFA] hover:text-[#8B5CF6] transition-colors text-left truncate max-w-[180px] sm:max-w-xs block"
                      >
                        {repo.name}
                      </button>
                      <span className="text-[11px] text-[#71717A] truncate block">
                        {repo.defaultBranch}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Language */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${getLanguageColor(
                        repo.language
                      )}`}
                    />
                    <span className="text-[#A1A1AA]">{repo.language}</span>
                  </div>
                </td>

                {/* Last Analyzed */}
                <td className="py-3.5 px-4 text-[#A1A1AA] whitespace-nowrap">
                  {repo.lastAnalyzed}
                </td>

                {/* Bugs */}
                <td className="py-3.5 px-4">
                  <span
                    className={`font-semibold ${
                      repo.bugsCount > 5
                        ? 'text-[#EF4444]'
                        : repo.bugsCount > 0
                        ? 'text-[#F59E0B]'
                        : 'text-[#22C55E]'
                    }`}
                  >
                    {repo.bugsCount}
                  </span>
                  <span className="text-[#71717A] ml-1">issues</span>
                </td>

                {/* Code Health */}
                <td className="py-3.5 px-4">
                  {repo.codeHealth !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#FAFAFA] font-mono">
                        {repo.codeHealth}/100
                      </span>
                      <div className="w-14 h-1.5 rounded-full bg-[#18181B] border border-[#27272A] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            repo.codeHealth >= 80
                              ? 'bg-[#22C55E]'
                              : repo.codeHealth >= 70
                              ? 'bg-[#F59E0B]'
                              : 'bg-[#EF4444]'
                          }`}
                          style={{ width: `${repo.codeHealth}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#A1A1AA] italic bg-[#18181B] px-2 py-0.5 rounded border border-[#27272A]">
                      Not Yet Run
                    </span>
                  )}
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <RepoStatusBadge status={repo.status} />
                </td>

                {/* Actions */}
                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (onAnalyzeRepo) {
                          onAnalyzeRepo(repo);
                        } else {
                          toast(
                            `Analysis triggered for ${repo.name}`,
                            'Simulating static code AST review in demonstration mode.',
                            'info'
                          );
                        }
                      }}
                      title="Run quick scan"
                    >
                      <Play className="w-3 h-3 text-[#8B5CF6]" />
                      <span className="hidden sm:inline">Scan</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/repositories/${repo.id}`)}
                      title="View repository details"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

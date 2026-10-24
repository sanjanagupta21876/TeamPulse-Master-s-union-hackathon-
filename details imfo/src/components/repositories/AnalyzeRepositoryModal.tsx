import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  GitBranch,
  Info,
  CheckCircle2,
  ExternalLink,
  Star,
  GitCommit,
  AlertCircle,
  FileCode,
  Tag,
  ArrowRight,
  ShieldAlert,
  Play,
  Layers,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { apiClient } from '../../services/api';
import type {
  RepositoryInspectionResponse,
  RepositoryAnalysisResponse,
  APIError,
} from '../../services/api';
import { saveInspectedRepository, saveAnalysisResults } from '../../data/repositoryStore';
import type { Repository } from '../../types';

interface AnalyzeRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepositoryAdded?: (repo: Repository) => void;
}

export const AnalyzeRepositoryModal: React.FC<AnalyzeRepositoryModalProps> = ({
  isOpen,
  onClose,
  onRepositoryAdded,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [description, setDescription] = useState('');
  const [urlError, setUrlError] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inspectedResult, setInspectedResult] = useState<RepositoryInspectionResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<RepositoryAnalysisResponse | null>(null);
  const [savedRepo, setSavedRepo] = useState<Repository | null>(null);

  const validateGitHubUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const githubRegex = /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\/?$/i;
    return githubRegex.test(trimmed);
  };

  const handleReset = () => {
    setRepoUrl('');
    setDefaultBranch('');
    setDescription('');
    setUrlError('');
    setApiError(null);
    setIsLoading(false);
    setIsAnalyzing(false);
    setInspectedResult(null);
    setAnalysisResult(null);
    setSavedRepo(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError('');
    setApiError(null);

    const trimmedUrl = repoUrl.trim();

    if (!trimmedUrl) {
      setUrlError('GitHub repository URL is required.');
      return;
    }

    if (!validateGitHubUrl(trimmedUrl)) {
      setUrlError(
        'Please enter a valid GitHub repository URL (e.g. https://github.com/facebook/react).'
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.inspectRepository({
        repository_url: trimmedUrl,
        branch: defaultBranch.trim() || null,
      });

      // Save repository to localStorage store
      const repoRecord = saveInspectedRepository(response.repository, response.inspection);

      setInspectedResult(response);
      setSavedRepo(repoRecord);

      if (onRepositoryAdded) {
        onRepositoryAdded(repoRecord);
      }

      toast(
        `Repository Inspected: ${response.repository.full_name}`,
        'Metadata and latest commit SHA verified from GitHub.',
        'success'
      );
    } catch (err: any) {
      const customError = err as APIError;
      const message =
        customError?.error?.message ||
        (err instanceof Error ? err.message : 'Failed to inspect GitHub repository.');
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunStaticAnalysis = async () => {
    if (!inspectedResult && !repoUrl.trim()) return;
    setIsAnalyzing(true);
    setApiError(null);

    try {
      const targetUrl = inspectedResult?.repository.html_url || repoUrl.trim();
      const targetBranch = inspectedResult?.repository.selected_branch || defaultBranch.trim() || null;

      const analysisRes = await apiClient.analyzeRepository({
        repository_url: targetUrl,
        branch: targetBranch,
      });

      // Persist results and update repository status to 'Analyzed'
      const updatedRepo = saveAnalysisResults(analysisRes, inspectedResult?.repository);

      setAnalysisResult(analysisRes);
      setSavedRepo(updatedRepo);

      if (onRepositoryAdded) {
        onRepositoryAdded(updatedRepo);
      }

      toast(
        'Static Analysis Completed',
        `Discovered ${analysisRes.analysis.findings_count} findings across ${analysisRes.analysis.files_analyzed} files.`,
        'success'
      );
    } catch (err: any) {
      const customError = err as APIError;
      const message =
        customError?.error?.message ||
        (err instanceof Error ? err.message : 'Static analysis engine encountered an unexpected error.');
      setApiError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={analysisResult ? "Analysis Report Completed" : "Analyze a Repository"}
      description={
        analysisResult
          ? "Real static code analysis executed across Python, JavaScript/TypeScript, and Security checks."
          : "Connect your public codebase to retrieve verified metadata and run real static bug detection."
      }
      maxWidth="lg"
    >
      {analysisResult ? (
        <div className="space-y-5 py-1 animate-in fade-in duration-200">
          {/* Analysis Header Banner */}
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#A855F7] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#FAFAFA]">
                Static Analysis Completed ({analysisResult.analysis.status})
              </h4>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Scanned {analysisResult.analysis.files_analyzed} files ({analysisResult.analysis.files_discovered} discovered).
                Identified <strong>{analysisResult.analysis.findings_count}</strong> distinct findings using configured static analyzers.
              </p>
            </div>
          </div>

          {/* Repo & Commit Snapshot */}
          <div className="p-3.5 rounded-xl bg-[#0C0C0F] border border-[#27272A] grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-[#71717A] uppercase font-medium block">Repository</span>
              <span className="font-semibold text-[#FAFAFA] truncate block">{analysisResult.repository.full_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#71717A] uppercase font-medium block">Branch</span>
              <span className="font-mono text-[#FAFAFA] flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-emerald-400" />
                {analysisResult.repository.branch}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#71717A] uppercase font-medium block">Commit</span>
              <span className="font-mono text-[#FAFAFA] flex items-center gap-1">
                <GitCommit className="w-3 h-3 text-sky-400" />
                {analysisResult.repository.commit_sha.substring(0, 7)}
              </span>
            </div>
          </div>

          {/* Severity Distribution */}
          <div>
            <span className="text-xs font-semibold text-[#FAFAFA] block mb-2">Severity Distribution</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/25">
                <span className="text-[10px] text-[#EF4444] font-medium uppercase block">Critical</span>
                <span className="text-lg font-bold text-[#EF4444]">{analysisResult.summary.critical}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#F97316]/10 border border-[#F97316]/25">
                <span className="text-[10px] text-[#F97316] font-medium uppercase block">High</span>
                <span className="text-lg font-bold text-[#F97316]">{analysisResult.summary.high}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#EAB308]/10 border border-[#EAB308]/25">
                <span className="text-[10px] text-[#EAB308] font-medium uppercase block">Medium</span>
                <span className="text-lg font-bold text-[#EAB308]">{analysisResult.summary.medium}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/25">
                <span className="text-[10px] text-[#3B82F6] font-medium uppercase block">Low</span>
                <span className="text-lg font-bold text-[#3B82F6]">{analysisResult.summary.low}</span>
              </div>
            </div>
          </div>

          {/* Analyzers Executed */}
          <div className="p-3 rounded-lg bg-[#111114] border border-[#27272A] space-y-2 text-xs">
            <span className="text-[11px] text-[#71717A] uppercase font-semibold block">Analyzers Executed</span>
            <div className="flex flex-wrap gap-1.5">
              {analysisResult.analysis.analyzers_completed.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 rounded-md bg-[#22C55E]/15 border border-[#22C55E]/30 text-emerald-400 font-mono text-[11px]"
                >
                  ✓ {tool}
                </span>
              ))}
              {analysisResult.analysis.analyzers_failed.map((tool) => (
                <span
                  key={tool}
                  className="px-2 py-0.5 rounded-md bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] font-mono text-[11px]"
                >
                  ✕ {tool} (unavailable/failed)
                </span>
              ))}
            </div>
          </div>

          {/* Warnings if any */}
          {analysisResult.analysis.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-[#18181B] border border-[#27272A] text-xs text-[#A1A1AA] space-y-1">
              <span className="font-semibold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Analysis Limitations & Warnings
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#71717A]">
                {analysisResult.analysis.warnings.slice(0, 3).map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  handleReset();
                  if (savedRepo) navigate(`/repositories/${savedRepo.id}`);
                }}
              >
                Repository Details
              </Button>
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => {
                  handleReset();
                  navigate('/bugs');
                }}
              >
                View Bug Reports ({analysisResult.findings.length})
              </Button>
            </div>
          </div>
        </div>
      ) : inspectedResult ? (
        <div className="space-y-5 py-1 animate-in fade-in duration-200">
          {apiError && (
            <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-start gap-2.5 text-xs text-[#EF4444]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Analysis Error</span>
                <span className="text-xs text-[#FCA5A5] mt-0.5 block leading-relaxed">{apiError}</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#FAFAFA]">
                Metadata Retrieved Successfully
              </h4>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                {inspectedResult.inspection.message}
              </p>
            </div>
          </div>

          {/* Retrieved Metadata Card */}
          <div className="p-4 rounded-xl bg-[#0C0C0F] border border-[#27272A] space-y-3.5 text-xs">
            {/* Header: Name + Owner + Link */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#27272A]">
              <div>
                <span className="text-[11px] text-[#71717A] uppercase tracking-wider font-semibold">
                  Owner: <strong className="text-[#FAFAFA] font-mono">{inspectedResult.repository.owner}</strong>
                </span>
                <h3 className="text-base font-bold text-[#FAFAFA] mt-0.5 flex items-center gap-2">
                  <span>{inspectedResult.repository.name}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#18181B] text-[#A1A1AA] border border-[#27272A]">
                    {inspectedResult.repository.visibility}
                  </span>
                </h3>
              </div>

              <a
                href={inspectedResult.repository.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-[#3F3F46] transition-all"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#8B5CF6]" />
              </a>
            </div>

            {/* Description */}
            <div>
              <span className="text-[11px] text-[#71717A] font-medium uppercase tracking-wider block mb-1">
                Description
              </span>
              <p className="text-xs text-[#A1A1AA] leading-relaxed italic">
                {inspectedResult.repository.description || 'No description provided for this repository.'}
              </p>
            </div>

            {/* Key Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-2.5 rounded-lg bg-[#111114] border border-[#27272A]">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wider block">Language</span>
                <span className="text-xs font-semibold text-[#FAFAFA] mt-0.5 flex items-center gap-1">
                  <FileCode className="w-3 h-3 text-[#8B5CF6]" />
                  {inspectedResult.repository.language || 'Unknown'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#111114] border border-[#27272A]">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wider block">Stars</span>
                <span className="text-xs font-semibold text-[#FAFAFA] mt-0.5 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  {inspectedResult.repository.stars.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#111114] border border-[#27272A]">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wider block">Default Branch</span>
                <span className="text-xs font-semibold text-[#FAFAFA] mt-0.5 flex items-center gap-1 font-mono">
                  <GitBranch className="w-3 h-3 text-[#22C55E]" />
                  {inspectedResult.repository.default_branch}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#111114] border border-[#27272A]">
                <span className="text-[10px] text-[#71717A] uppercase tracking-wider block">Latest Commit</span>
                <span className="text-xs font-semibold text-[#FAFAFA] mt-0.5 flex items-center gap-1 font-mono truncate" title={inspectedResult.repository.latest_commit_sha}>
                  <GitCommit className="w-3 h-3 text-[#3B82F6]" />
                  {inspectedResult.repository.latest_commit_sha.substring(0, 7)}
                </span>
              </div>
            </div>
          </div>

          {/* Run Real Bug Detection CTA */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#8B5CF6]" />
                Step 4: Execute Real Bug Detection Engine
              </h5>
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">
                Scans source code with Ruff, Bandit, AST rules, and secret inspection to find real vulnerabilities.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              isLoading={isAnalyzing}
              disabled={isAnalyzing}
              onClick={handleRunStaticAnalysis}
              className="shrink-0 bg-gradient-to-r from-[#8B5CF6] to-[#6366F1]"
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              {isAnalyzing ? 'Analyzing Repository...' : 'Run Bug Detection'}
            </Button>
          </div>

          {/* Success Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={isAnalyzing}>
              Close
            </Button>
            {savedRepo && (
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => {
                  handleReset();
                  navigate(`/repositories/${savedRepo.id}`);
                }}
              >
                View Repository Details
              </Button>
            )}
          </div>
        </div>
      ) : (

        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && (
            <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-start gap-2.5 text-xs text-[#EF4444]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Inspection Error</span>
                <span className="text-xs text-[#FCA5A5] mt-0.5 block leading-relaxed">{apiError}</span>
              </div>
            </div>
          )}

          <Input
            label="GitHub Repository URL"
            placeholder="https://github.com/facebook/react"
            value={repoUrl}
            disabled={isLoading}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              if (urlError) setUrlError('');
              if (apiError) setApiError(null);
            }}
            error={urlError}
            helperText="Example: https://github.com/facebook/react or https://github.com/pallets/flask"
            autoFocus
          />

          <div className="w-full flex flex-col gap-1.5">
            <label htmlFor="default-branch" className="text-xs font-medium text-[#FAFAFA]">
              Default Branch <span className="text-[#71717A] font-normal">(Optional, defaults to repository's default)</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-[#A1A1AA]">
                <GitBranch className="w-4 h-4" />
              </div>
              <input
                id="default-branch"
                disabled={isLoading}
                className="w-full bg-[#18181B] border border-[#27272A] rounded-lg pl-9 pr-3 py-2 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all disabled:opacity-50"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="Leave blank to use default (e.g. main)"
              />
            </div>
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label htmlFor="project-desc" className="text-xs font-medium text-[#FAFAFA]">
              Project Description <span className="text-[#71717A] font-normal">(Optional)</span>
            </label>
            <textarea
              id="project-desc"
              rows={2}
              disabled={isLoading}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all resize-none disabled:opacity-50"
              placeholder="Custom project notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-lg bg-[#18181B] border border-[#27272A] flex items-start gap-2.5 text-xs text-[#A1A1AA]">
            <Info className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
            <p>
              In Step 2, CodeLens AI retrieves live public repository metadata and branch commit SHAs via the FastAPI backend. Private repositories and AST bug analysis will be enabled in subsequent milestones.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272A]">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Inspecting Repository...' : 'Analyze Repository'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

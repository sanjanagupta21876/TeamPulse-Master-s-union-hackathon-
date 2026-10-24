import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { apiClient } from '../../services/api';
import { saveAnalysisResults } from '../../data/repositoryStore';
import { errorMessage } from '../checks/helpers';
import type { Repository } from '../../types';

interface AnalyzeRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepositoryAdded?: (repo: Repository) => void;
}

const GITHUB_URL = /^https:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

type Phase = 'idle' | 'fetching' | 'checking';

export const AnalyzeRepositoryModal: React.FC<AnalyzeRepositoryModalProps> = ({ isOpen, onClose, onRepositoryAdded }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (phase !== 'idle') return;
    setError(null);
    onClose();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const repoUrl = url.trim();
    if (!GITHUB_URL.test(repoUrl)) {
      setError('Enter a public GitHub repository URL, for example https://github.com/pallets/itsdangerous');
      return;
    }
    setError(null);
    try {
      setPhase('fetching');
      const inspected = await apiClient.inspectRepository({ repository_url: repoUrl, branch: branch.trim() || null });
      setPhase('checking');
      const result = await apiClient.analyzeRepository({
        repository_url: inspected.repository.html_url,
        branch: inspected.repository.selected_branch ?? null,
      });
      const repo = saveAnalysisResults(result, inspected.repository);
      onRepositoryAdded?.(repo);
      toast(`Checked ${repo.fullName}`, `${result.findings.length} findings in ${result.analysis.files_analyzed} files.`, 'success');
      setUrl('');
      setBranch('');
      setPhase('idle');
      onClose();
      navigate(`/repositories/${repo.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPhase('idle');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Check a repository"
      description="Downloads the source of a public GitHub repository and runs the code checks on it."
    >
      <form onSubmit={run} className="space-y-4">
        <Input
          label="GitHub URL"
          placeholder="https://github.com/owner/repository"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={phase !== 'idle'}
          autoFocus
        />
        <Input
          label="Branch (optional)"
          placeholder="Default branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={phase !== 'idle'}
        />
        {error && <p className="text-sm text-red">{error}</p>}
        {phase !== 'idle' && (
          <p className="text-sm text-pencil" role="status">
            {phase === 'fetching' ? 'Looking up the repository on GitHub…' : 'Running the checks. Large repositories can take a minute…'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={close} disabled={phase !== 'idle'}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={phase !== 'idle'}>
            Run code checks
          </Button>
        </div>
      </form>
    </Modal>
  );
};

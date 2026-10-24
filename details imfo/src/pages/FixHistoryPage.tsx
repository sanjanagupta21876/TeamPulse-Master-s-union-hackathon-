import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/checks/shared';
import { useNow, useStoreUpdates } from '../components/checks/helpers';
import { relativeTime } from '../components/mission/format';
import {
  getAllFixes,
  getFindingById,
  getLatestVerificationForFix,
  getPullRequestForFix,
} from '../data/repositoryStore';
import type { FixProposal, VerificationRecord } from '../services/api';

const FIX_STATUS: Record<FixProposal['status'], { text: string; tone: string }> = {
  generating: { text: 'Generating', tone: 'text-pencil' },
  proposed: { text: 'Waiting for review', tone: 'text-marker' },
  approved: { text: 'Approved', tone: 'text-ink' },
  rejected: { text: 'Rejected', tone: 'text-faint' },
  failed: { text: 'Generation failed', tone: 'text-red' },
  invalid: { text: 'Invalid patch', tone: 'text-red' },
};

function verificationText(v: VerificationRecord | null): { text: string; tone: string } {
  if (!v) return { text: 'Not verified', tone: 'text-faint' };
  if (v.status === 'completed') return { text: 'Verified', tone: 'text-green' };
  if (v.status === 'partial') return { text: 'Verified with new findings', tone: 'text-amber' };
  if (v.status === 'failed') return { text: "Didn't fix the finding", tone: 'text-red' };
  return { text: v.status, tone: 'text-pencil' };
}

export const FixHistoryPage: React.FC = () => {
  useStoreUpdates();
  const fixes = getAllFixes();
  const now = useNow();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fix history"
        description="Every fix proposed for a finding: whether it was approved, whether verification confirmed it, and any pull request."
      />

      {fixes.length === 0 ? (
        <EmptyState title="No fixes proposed yet">
          Open a finding and choose Propose a fix. Proposals and their verification results appear here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-faint">
                <th className="py-2.5 pl-5 pr-4 font-medium">Finding</th>
                <th className="py-2.5 pr-4 font-medium">Fix</th>
                <th className="py-2.5 pr-4 font-medium">Verification</th>
                <th className="py-2.5 pr-4 font-medium">Pull request</th>
                <th className="py-2.5 pr-5 font-medium">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {fixes.map((fix) => {
                const finding = getFindingById(fix.finding_id);
                const status = FIX_STATUS[fix.status];
                const verification = verificationText(getLatestVerificationForFix(fix.id));
                const pr = getPullRequestForFix(fix.id);
                return (
                  <tr key={fix.id} className="border-t border-line align-top">
                    <td className="py-3 pl-5 pr-4">
                      <Link to={`/bugs/${fix.finding_id}`} className="font-medium text-ink hover:text-marker">
                        {finding?.title ?? fix.finding_id}
                      </Link>
                      <div className="text-xs text-pencil">
                        <span className="font-mono">{fix.file_path}</span>, {fix.repository_id}
                      </div>
                    </td>
                    <td className={`py-3 pr-4 whitespace-nowrap font-medium ${status.tone}`}>{status.text}</td>
                    <td className={`py-3 pr-4 whitespace-nowrap font-medium ${verification.tone}`}>{verification.text}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {pr ? (
                        <a href={pr.html_url} target="_blank" rel="noreferrer" className="text-marker hover:underline">
                          #{pr.pr_number}
                        </a>
                      ) : (
                        <span className="text-faint">None</span>
                      )}
                    </td>
                    <td className="py-3 pr-5 whitespace-nowrap text-pencil">{relativeTime(fix.created_at, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

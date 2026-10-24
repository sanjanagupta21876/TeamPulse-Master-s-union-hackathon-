import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SeverityBadge } from '../ui/Badge';
import type { BugReport } from '../../types';
import {
  ArrowRight,
  FileCode,
  ArrowUpRight,
  Clock,
  Tag,
} from 'lucide-react';

interface RecentBugReportsProps {
  bugs: BugReport[];
  onInspectBug?: (bug: BugReport) => void;
}

export const RecentBugReports: React.FC<RecentBugReportsProps> = ({
  bugs,
  onInspectBug,
}) => {
  const navigate = useNavigate();
  const displayBugs = bugs.slice(0, 5);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Frontend':
        return 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20';
      case 'Backend':
        return 'text-[#818CF8] bg-[#818CF8]/10 border-[#818CF8]/20';
      case 'Security':
        return 'text-[#F43F5E] bg-[#F43F5E]/10 border-[#F43F5E]/20';
      default:
        return 'text-[#A1A1AA] bg-[#27272A] border-[#3F3F46]';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Recent Bug Reports</CardTitle>
          <p className="text-xs text-[#A1A1AA] mt-0.5">
            Latest AST anomalies and architectural vulnerabilities detected
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          onClick={() => navigate('/bugs')}
        >
          View All
        </Button>
      </CardHeader>

      <div className="divide-y divide-[#27272A]/70">
        {displayBugs.map((bug) => (
          <div
            key={bug.id}
            className="p-4 sm:px-5 hover:bg-[#18181B]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            {/* Left: Severity + Title + Path */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 shrink-0">
                <SeverityBadge severity={bug.severity} size="sm" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      if (onInspectBug) onInspectBug(bug);
                      else navigate(`/bugs/${bug.id}`);
                    }}
                    className="font-medium text-xs sm:text-sm text-[#FAFAFA] hover:text-[#8B5CF6] transition-colors text-left"
                  >
                    {bug.title}
                  </button>

                  {/* Category Pill */}
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(
                      bug.category
                    )}`}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {bug.category}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-[#71717A] flex-wrap font-mono">
                  <span className="flex items-center gap-1 text-[#A1A1AA] truncate">
                    <FileCode className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                    <span className="truncate">{bug.file}</span>
                  </span>
                  <span className="text-[#3F3F46]">•</span>
                  <span className="flex items-center gap-1 font-sans text-[#71717A]">
                    <Clock className="w-3 h-3 shrink-0" />
                    {bug.detectedAt}
                  </span>
                  <span className="text-[#3F3F46]">•</span>
                  <span className="font-sans text-[#71717A] truncate">
                    {bug.repositoryName}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="shrink-0 flex items-center self-end sm:self-center">
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (onInspectBug) onInspectBug(bug);
                  else navigate(`/bugs/${bug.id}`);
                }}
              >
                Inspect
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 bg-[#0C0C0F]/50 border-t border-[#27272A]/70 text-[11px] text-[#71717A] flex items-center justify-between">
        <span>* Demonstration sample findings illustrating CodeLens AI detection capabilities.</span>
        <button
          onClick={() => navigate('/bugs')}
          className="text-[#8B5CF6] hover:underline"
        >
          View all 12 findings &rarr;
        </button>
      </div>
    </Card>
  );
};

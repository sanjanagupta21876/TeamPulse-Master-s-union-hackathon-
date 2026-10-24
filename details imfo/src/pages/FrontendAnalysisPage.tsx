import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeverityBadge } from '../components/ui/Badge';
import { mockBugs } from '../data/mockBugs';
import {
  Layout,
  Layers,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  FileCode,
  Gauge,
  Cpu,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const FrontendAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const frontendBugs = mockBugs.filter((b) => b.category === 'Frontend');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8]">
              <Layout className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
              Frontend Analysis
            </h1>
          </div>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Detect render loops, missing error boundaries, bundle inflation, and unhandled async UI states.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Sparkles className="w-4 h-4" />}
          onClick={() => {
            toast(
              'Frontend AST Analysis Triggered',
              'Scanning React JSX components and hook dependency trees.',
              'info'
            );
          }}
        >
          Scan Frontend Tree
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">Active Frontend Bugs</span>
            <AlertCircle className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            {frontendBugs.length} Issues
          </div>
          <span className="text-[11px] text-[#22C55E] mt-1 block">1 Verified Fix Available</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">React Render Health</span>
            <Gauge className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            89/100
          </div>
          <span className="text-[11px] text-[#A1A1AA] mt-1 block">Hook deps & memoization verified</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">Bundle & Tree Shaking</span>
            <Cpu className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            412 KB
          </div>
          <span className="text-[11px] text-[#F59E0B] mt-1 block">2 heavy imports flagged</span>
        </Card>
      </div>

      {/* Issues List */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Frontend Issues Detected</CardTitle>
        </CardHeader>
        <div className="divide-y divide-[#27272A]/70">
          {frontendBugs.map((bug) => (
            <div
              key={bug.id}
              className="p-4 sm:p-5 hover:bg-[#18181B]/40 transition-colors flex items-center justify-between gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <SeverityBadge severity={bug.severity} size="sm" />
                  <button
                    onClick={() => navigate(`/bugs/${bug.id}`)}
                    className="text-sm font-semibold text-[#FAFAFA] hover:text-[#8B5CF6] transition-colors text-left truncate"
                  >
                    {bug.title}
                  </button>
                </div>
                <p className="text-xs text-[#A1A1AA] line-clamp-1">
                  {bug.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#71717A] font-mono">
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{bug.file}:{bug.lineRange}</span>
                  <span>•</span>
                  <span className="font-sans">{bug.repositoryName}</span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                onClick={() => navigate(`/bugs/${bug.id}`)}
              >
                Inspect
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

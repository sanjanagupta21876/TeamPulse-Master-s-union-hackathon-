import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeverityBadge } from '../components/ui/Badge';
import { mockBugs } from '../data/mockBugs';
import {
  ShieldAlert,
  Lock,
  Sparkles,
  ArrowUpRight,
  AlertOctagon,
  FileCode,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const SecurityAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const securityBugs = mockBugs.filter((b) => b.category === 'Security');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F43F5E]/15 border border-[#F43F5E]/30 flex items-center justify-center text-[#F43F5E]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA]">
              Security Scan
            </h1>
          </div>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Detect SQL injection vulnerabilities, hardcoded secrets, dangerous innerHTML, and authentication lapses.
          </p>
        </div>

        <Button
          variant="danger"
          leftIcon={<Sparkles className="w-4 h-4" />}
          onClick={() => {
            toast(
              'Security Audit Initiated',
              'Scanning for OWASP Top 10 vulnerabilities, secrets, and auth flows.',
              'warning'
            );
          }}
        >
          Run Security Audit
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-[#EF4444]/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#EF4444] font-medium">Critical Vulnerabilities</span>
            <AlertOctagon className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            {securityBugs.filter((b) => b.severity === 'Critical').length} Critical
          </div>
          <span className="text-[11px] text-[#EF4444] mt-1 block">SQLi & DOM XSS require priority patch</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">Secret & Key Leak Detection</span>
            <KeyRound className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            1 Secret Flagged
          </div>
          <span className="text-[11px] text-[#F59E0B] mt-1 block">JWT fallback default secret detected</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A1A1AA]">Overall Security Posture</span>
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-2xl font-bold text-[#FAFAFA] font-mono mt-1">
            72/100
          </div>
          <span className="text-[11px] text-[#22C55E] mt-1 block">Automatic remediation available</span>
        </Card>
      </div>

      {/* Issues List */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Vulnerabilities & Security Findings</CardTitle>
        </CardHeader>
        <div className="divide-y divide-[#27272A]/70">
          {securityBugs.map((bug) => (
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

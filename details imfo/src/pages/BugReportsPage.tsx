import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SeverityBadge, VerificationStatusBadge } from '../components/ui/Badge';
import { mockBugs } from '../data/mockBugs';
import { getAllAnalyzedFindings } from '../data/repositoryStore';
import type { Finding } from '../services/api';
import {
  Search,
  Filter,
  FileCode,
  ArrowUpRight,
  Clock,
  Tag,
  CheckCircle2,
  SlidersHorizontal,
  ShieldAlert,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileDown,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { generateIssuesPdfReport, type ReportItem } from '../utils/pdfGenerator';

interface UnifiedFindingItem {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
  category: string;
  status: string;
  file: string;
  lineRange: string;
  detectedAt: string;
  repositoryName: string;
  description: string;
  analyzer: string;
  confidence: string;
  remediation?: string;
  codeExcerpt?: string | null;
  isRealAnalysis: boolean;
}

export const BugReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const repoParam = searchParams.get('repo');
  const { toast } = useToast();

  const [realFindings, setRealFindings] = useState<Finding[]>([]);
  const [search, setSearch] = useState(repoParam || '');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'real' | 'demo'>(
    repoParam ? 'real' : 'all'
  );
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [analyzerFilter, setAnalyzerFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'severity' | 'repo'>('severity');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());

  // Load real findings and listen for storage updates
  useEffect(() => {
    const loadFindings = () => {
      setRealFindings(getAllAnalyzedFindings());
    };
    loadFindings();

    window.addEventListener('codelens_findings_updated', loadFindings);
    return () => {
      window.removeEventListener('codelens_findings_updated', loadFindings);
    };
  }, []);

  // Map real findings to unified presentation items
  const normalizedRealItems: UnifiedFindingItem[] = realFindings.map((f) => {
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    const severityMap: Record<string, UnifiedFindingItem['severity']> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      informational: 'Informational',
    };

    return {
      id: f.id,
      title: f.title,
      severity: severityMap[f.severity.toLowerCase()] || 'Medium',
      category: capitalize(f.category),
      status: capitalize(f.status),
      file: f.file_path,
      lineRange: f.end_line && f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : `${f.start_line}`,
      detectedAt: 'Live Scan',
      repositoryName: f.repository,
      description: f.description,
      analyzer: f.analyzer,
      confidence: capitalize(f.confidence),
      remediation: f.remediation,
      codeExcerpt: f.code_excerpt,
      isRealAnalysis: true,
    };
  });

  // Map mock demo findings to unified presentation items
  const normalizedDemoItems: UnifiedFindingItem[] = mockBugs.map((b) => ({
    id: b.id,
    title: b.title,
    severity: b.severity as any,
    category: b.category,
    status: b.status,
    file: b.file,
    lineRange: b.lineRange,
    detectedAt: b.detectedAt,
    repositoryName: b.repositoryName,
    description: b.description,
    analyzer: 'TeamPulse AST Demo',
    confidence: 'Confirmed',
    remediation: b.suggestedFix,
    codeExcerpt: b.originalCode,
    isRealAnalysis: false,
  }));

  // Combine items according to source filter
  const allItems: UnifiedFindingItem[] =
    sourceFilter === 'real'
      ? normalizedRealItems
      : sourceFilter === 'demo'
      ? normalizedDemoItems
      : [...normalizedRealItems, ...normalizedDemoItems];

  const severityOrder: Record<string, number> = {
    Critical: 5,
    High: 4,
    Medium: 3,
    Low: 2,
    Informational: 1,
  };

  const filteredItems = allItems
    .filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.file.toLowerCase().includes(q) ||
        item.repositoryName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.analyzer.toLowerCase().includes(q);

      const matchesSeverity =
        severityFilter === 'All' || item.severity === severityFilter;

      const matchesCategory =
        categoryFilter === 'All' || item.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchesAnalyzer =
        analyzerFilter === 'All' || item.analyzer.toLowerCase().includes(analyzerFilter.toLowerCase());

      return matchesSearch && matchesSeverity && matchesCategory && matchesAnalyzer;
    })
    .sort((a, b) => {
      if (sortBy === 'severity') {
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      }
      if (sortBy === 'repo') {
        return a.repositoryName.localeCompare(b.repositoryName);
      }
      return 0;
    });

  const toggleExpand = (id: string) => {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportPdf = () => {
    if (filteredItems.length === 0) {
      toast('No Findings', 'No issues available under current filter criteria to export.', 'warning');
      return;
    }
    const reportItems: ReportItem[] = filteredItems.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      category: f.category,
      filePath: f.file,
      lineRange: f.lineRange,
      description: f.description,
      analyzer: f.analyzer,
      remediation: f.remediation,
      suggestedFix: f.remediation,
      codeExcerpt: f.codeExcerpt || undefined,
      verificationStatus: f.status,
    }));
    generateIssuesPdfReport(reportItems, {
      repositoryName: repoParam || 'All Repositories',
      generatedAt: new Date().toUTCString(),
    });
    toast('PDF Report Generated', `Downloaded PDF audit report containing ${reportItems.length} issues.`, 'success');
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'frontend':
        return 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20';
      case 'backend':
        return 'text-[#818CF8] bg-[#818CF8]/10 border-[#818CF8]/20';
      case 'security':
        return 'text-[#F43F5E] bg-[#F43F5E]/10 border-[#F43F5E]/20';
      case 'correctness':
        return 'text-[#EC4899] bg-[#EC4899]/10 border-[#EC4899]/20';
      case 'reliability':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
      default:
        return 'text-[#A1A1AA] bg-[#27272A] border-[#3F3F46]';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      case 'high':
        return 'bg-sky-500/15 border-sky-500/30 text-sky-400';
      case 'medium':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      default:
        return 'bg-zinc-800 border-zinc-700 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FAFAFA] flex items-center gap-2.5">
            Bug Reports & Static Analysis
            {normalizedRealItems.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[#C084FC]">
                Live Engine Active
              </span>
            )}
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-1">
            Real static findings from Ruff, Bandit, AST rules, and secret detection across connected repositories.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#18181B] border border-[#27272A] text-[#A1A1AA]">
            Showing <strong className="text-[#FAFAFA]">{filteredItems.length}</strong> findings
          </span>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileDown className="w-3.5 h-3.5 text-[#8B5CF6]" />}
            onClick={handleExportPdf}
          >
            Export PDF Report
          </Button>
        </div>
      </div>

      {/* Source Toggle Bar */}
      <div className="flex items-center gap-2 p-1 bg-[#111114] border border-[#27272A] rounded-xl w-fit">
        <button
          onClick={() => setSourceFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sourceFilter === 'all'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
          }`}
        >
          All Findings ({normalizedRealItems.length + normalizedDemoItems.length})
        </button>
        <button
          onClick={() => setSourceFilter('real')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
            sourceFilter === 'real'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
          Real Scanned Findings ({normalizedRealItems.length})
        </button>
        <button
          onClick={() => setSourceFilter('demo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            sourceFilter === 'demo'
              ? 'bg-[#8B5CF6] text-white shadow-sm'
              : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
          }`}
        >
          Demo Mock Data ({normalizedDemoItems.length})
        </button>
      </div>

      {/* Filter and Control Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <Input
              placeholder="Search by title, file, repo, rule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Informational">Informational</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="All">All Categories</option>
              <option value="Security">Security</option>
              <option value="Correctness">Correctness</option>
              <option value="Reliability">Reliability</option>
              <option value="Maintainability">Maintainability</option>
              <option value="Frontend">Frontend</option>
              <option value="Backend">Backend</option>
            </select>
          </div>

          {/* Analyzer Filter */}
          <div>
            <select
              value={analyzerFilter}
              onChange={(e) => setAnalyzerFilter(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="All">All Analyzers</option>
              <option value="security">Security Scanner</option>
              <option value="python_ast">Python AST</option>
              <option value="ruff">Ruff</option>
              <option value="bandit">Bandit</option>
              <option value="javascript">JavaScript Rules</option>
              <option value="eslint">ESLint</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="severity">Sort: Highest Severity</option>
              <option value="newest">Sort: Newest First</option>
              <option value="repo">Sort: Repository Name</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Issues List Card */}
      <Card className="overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <SlidersHorizontal className="w-10 h-10 text-[#71717A] mb-3" />
            <h3 className="text-base font-semibold text-[#FAFAFA]">No findings match your filters</h3>
            <p className="text-xs text-[#A1A1AA] max-w-sm mt-1">
              {sourceFilter === 'real' && normalizedRealItems.length === 0
                ? "No real repository scans have been executed yet. Click '+ Analyze Repository' on the dashboard to run static analysis on a public GitHub repo."
                : 'Try clearing your search query or adjusting your severity and category filters.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setSeverityFilter('All');
                setCategoryFilter('All');
                setAnalyzerFilter('All');
                setSourceFilter('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#27272A]/70">
            {filteredItems.map((item) => {
              const isExpanded = expandedFindings.has(item.id);

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-[#18181B]/40 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left details */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        <SeverityBadge severity={item.severity as any} size="sm" />
                      </div>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-[#FAFAFA]">
                            {item.title}
                          </h4>

                          {/* Category Tag */}
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${getCategoryColor(
                              item.category
                            )}`}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {item.category}
                          </span>

                          {/* Analyzer Badge */}
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#18181B] border border-[#27272A] text-[#A1A1AA]">
                            <Cpu className="w-2.5 h-2.5 text-[#8B5CF6]" />
                            {item.analyzer}
                          </span>

                          {/* Confidence Indicator */}
                          <span
                            className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${getConfidenceBadge(
                              item.confidence
                            )}`}
                          >
                            Confidence: {item.confidence}
                          </span>

                          {/* Real vs Mock badge */}
                          {item.isRealAnalysis ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[#C084FC]">
                              REAL STATIC SCAN
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                              DEMO MOCK
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#A1A1AA] leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-[#71717A] flex-wrap font-mono pt-0.5">
                          <span className="flex items-center gap-1 text-[#A1A1AA] truncate">
                            <FileCode className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
                            <span className="text-[#FAFAFA]">{item.file}</span>
                            <span className="text-[#8B5CF6]">:{item.lineRange}</span>
                          </span>
                          <span>•</span>
                          <span className="font-sans text-[#71717A] truncate">
                            {item.repositoryName}
                          </span>
                          <span>•</span>
                          <span className="font-sans text-[#71717A]">
                            {item.detectedAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-start">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleExpand(item.id)}
                        rightIcon={
                          isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {isExpanded ? 'Hide Details' : 'View Remediation'}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Evidence & Remediation Drawer */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-[#27272A]/80 space-y-3 animate-in fade-in duration-150">
                      {/* Code Excerpt */}
                      {item.codeExcerpt && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-[#71717A] tracking-wider block">
                            Code Evidence (Line {item.lineRange})
                          </span>
                          <pre className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A] text-xs font-mono text-[#FAFAFA] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {item.codeExcerpt}
                          </pre>
                        </div>
                      )}

                      {/* Remediation Guidance */}
                      {item.remediation && (
                        <div className="p-3 rounded-lg bg-[#18181B] border border-[#27272A] space-y-1 text-xs">
                          <span className="text-[11px] font-semibold text-emerald-400 block flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Remediation Guidance
                          </span>
                          <p className="text-[#A1A1AA] leading-relaxed">
                            {item.remediation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};


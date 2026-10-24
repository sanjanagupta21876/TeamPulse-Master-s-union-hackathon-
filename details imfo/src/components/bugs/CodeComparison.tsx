import React, { useState } from 'react';
import { Copy, Check, Split, AlignJustify } from 'lucide-react';

interface CodeComparisonProps {
  originalCode: string;
  proposedCode: string;
  fileName?: string;
  originalLabel?: string;
  proposedLabel?: string;
}

export const CodeComparison: React.FC<CodeComparisonProps> = ({
  originalCode,
  proposedCode,
  fileName,
  originalLabel = 'Original Code (Current)',
  proposedLabel = 'Suggested AI Fix (Proposed)',
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedProposed, setCopiedProposed] = useState(false);

  const copyToClipboard = (text: string, isOriginal: boolean) => {
    navigator.clipboard.writeText(text);
    if (isOriginal) {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedProposed(true);
      setTimeout(() => setCopiedProposed(false), 2000);
    }
  };

  const renderCodeLines = (code: string, type: 'original' | 'proposed') => {
    const lines = code.trim().split('\n');
    const isProposed = type === 'proposed';

    return (
      <div className="text-xs font-mono py-3">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`flex items-start px-3 py-0.5 hover:bg-white/[0.02] ${
              isProposed
                ? 'bg-emerald-500/[0.07] border-l-2 border-emerald-500'
                : 'bg-rose-500/[0.07] border-l-2 border-rose-500'
            }`}
          >
            <span className="w-8 shrink-0 text-right pr-3 select-none text-[#52525B] text-[11px]">
              {idx + 1}
            </span>
            <span className="shrink-0 select-none pr-2 font-semibold">
              {isProposed ? (
                <span className="text-emerald-400">+</span>
              ) : (
                <span className="text-rose-400">-</span>
              )}
            </span>
            <span className={`flex-1 overflow-x-auto whitespace-pre ${isProposed ? 'text-emerald-200' : 'text-rose-200'}`}>
              {line}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-[#27272A] bg-[#0C0C0F] overflow-hidden">
      {/* Diff Toolbar */}
      <div className="px-4 py-2.5 bg-[#18181B]/80 border-b border-[#27272A] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {fileName && (
            <span className="font-mono text-xs font-medium text-[#FAFAFA] bg-[#27272A] px-2 py-0.5 rounded">
              {fileName}
            </span>
          )}
          <span className="text-[#A1A1AA]">Visual Diff Comparison</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#0C0C0F] p-0.5 border border-[#27272A]">
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-[#27272A] text-[#FAFAFA] font-medium'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === 'unified'
                  ? 'bg-[#27272A] text-[#FAFAFA] font-medium'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              Unified
            </button>
          </div>
        </div>
      </div>

      {/* Code Display */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#27272A]">
          {/* Original */}
          <div className="flex flex-col">
            <div className="px-3.5 py-2 bg-[#141417] border-b border-[#27272A] flex items-center justify-between">
              <span className="text-xs font-medium text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {originalLabel}
              </span>
              <button
                onClick={() => copyToClipboard(originalCode, true)}
                className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center gap-1 transition-colors"
                title="Copy original code"
              >
                {copiedOriginal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOriginal ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="overflow-x-auto bg-[#09090B] flex-1">
              {renderCodeLines(originalCode, 'original')}
            </div>
          </div>

          {/* Proposed */}
          <div className="flex flex-col">
            <div className="px-3.5 py-2 bg-[#141417] border-b border-[#27272A] flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {proposedLabel}
              </span>
              <button
                onClick={() => copyToClipboard(proposedCode, false)}
                className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center gap-1 transition-colors"
                title="Copy proposed fix"
              >
                {copiedProposed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedProposed ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="overflow-x-auto bg-[#09090B] flex-1">
              {renderCodeLines(proposedCode, 'proposed')}
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#27272A]">
          <div>
            <div className="px-3.5 py-1.5 bg-rose-950/20 text-xs font-medium text-rose-400 border-b border-[#27272A]">
              --- {originalLabel}
            </div>
            <div className="overflow-x-auto bg-[#09090B]">
              {renderCodeLines(originalCode, 'original')}
            </div>
          </div>
          <div>
            <div className="px-3.5 py-1.5 bg-emerald-950/20 text-xs font-medium text-emerald-400 border-b border-[#27272A]">
              +++ {proposedLabel}
            </div>
            <div className="overflow-x-auto bg-[#09090B]">
              {renderCodeLines(proposedCode, 'proposed')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

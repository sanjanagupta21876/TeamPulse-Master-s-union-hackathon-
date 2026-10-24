import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

interface IssueDistributionCardProps {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

export const IssueDistributionCard: React.FC<IssueDistributionCardProps> = ({
  critical = 3,
  high = 7,
  medium = 9,
  low = 5,
}) => {
  const total = critical + high + medium + low;

  const items = [
    { label: 'Critical', count: critical, color: '#EF4444', bgClass: 'bg-[#EF4444]' },
    { label: 'High', count: high, color: '#F59E0B', bgClass: 'bg-[#F59E0B]' },
    { label: 'Medium', count: medium, color: '#3B82F6', bgClass: 'bg-[#3B82F6]' },
    { label: 'Low', count: low, color: '#71717A', bgClass: 'bg-[#71717A]' },
  ];

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <div>
          <CardTitle>Issue Distribution</CardTitle>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Categorized by severity tier</p>
        </div>
        <span className="text-xs font-mono text-[#A1A1AA]">
          Total: <strong className="text-[#FAFAFA]">{total}</strong>
        </span>
      </CardHeader>

      <CardContent className="pt-2 pb-6 space-y-6">
        {/* Horizontal Stacked Bar */}
        <div>
          <div className="h-4 w-full rounded-full bg-[#18181B] overflow-hidden flex p-0.5 gap-0.5 border border-[#27272A]">
            {items.map((item) => {
              const pct = (item.count / total) * 100;
              return (
                <div
                  key={item.label}
                  style={{ width: `${pct}%` }}
                  className={`${item.bgClass} h-full first:rounded-l-full last:rounded-r-full transition-all duration-500`}
                  title={`${item.label}: ${item.count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>

          <div className="mt-2 flex justify-between text-[11px] text-[#71717A]">
            <span>0%</span>
            <span>Severity distribution</span>
            <span>100%</span>
          </div>
        </div>

        {/* Compact Legend Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item) => {
            const pct = Math.round((item.count / total) * 100);
            return (
              <div
                key={item.label}
                className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A]/80 flex flex-col"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-medium text-[#A1A1AA] truncate">
                    {item.label}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-[#FAFAFA]">{item.count}</span>
                  <span className="text-xs font-mono text-[#71717A]">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

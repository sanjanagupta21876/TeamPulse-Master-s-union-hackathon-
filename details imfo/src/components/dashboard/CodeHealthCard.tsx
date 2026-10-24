import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { ShieldCheck, Cpu, GitPullRequest, Activity } from 'lucide-react';

interface CodeHealthCardProps {
  score?: number;
  statusLabel?: string;
}

export const CodeHealthCard: React.FC<CodeHealthCardProps> = ({
  score = 82,
  statusLabel = 'Good',
}) => {
  // SVG Circular progress math
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const metrics = [
    { name: 'Reliability', value: '88%', score: 88, icon: Activity, color: '#3B82F6' },
    { name: 'Security', value: '79%', score: 79, icon: ShieldCheck, color: '#8B5CF6' },
    { name: 'Maintainability', value: '84%', score: 84, icon: Cpu, color: '#22C55E' },
    { name: 'Test Coverage', value: '77%', score: 77, icon: GitPullRequest, color: '#F59E0B' },
  ];

  return (
    <Card className="h-full flex flex-col justify-between">
      <CardHeader>
        <div>
          <CardTitle>Code Health</CardTitle>
          <p className="text-xs text-[#A1A1AA] mt-0.5">Aggregate software quality metrics</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30">
          {statusLabel}
        </span>
      </CardHeader>

      <CardContent className="pt-2 pb-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-around">
          {/* Circular Progress Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 130 130">
              {/* Background circle track */}
              <circle
                cx="65"
                cy="65"
                r={radius}
                className="text-[#27272A]"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Foreground progress */}
              <circle
                cx="65"
                cy="65"
                r={radius}
                className="text-[#8B5CF6] transition-all duration-1000 ease-out"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-[#FAFAFA] tracking-tight">
                {score}
              </span>
              <span className="text-[11px] font-medium text-[#71717A] -mt-1 uppercase tracking-wider">
                out of 100
              </span>
            </div>
          </div>

          {/* Metrics breakdown list */}
          <div className="grid grid-cols-2 gap-3 w-full sm:max-w-xs">
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.name}
                  className="p-3 rounded-lg bg-[#0C0C0F] border border-[#27272A]/80 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-[#A1A1AA]">
                    <span className="text-[11px] font-medium truncate">{item.name}</span>
                    <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-[#FAFAFA]">{item.value}</span>
                    <div className="w-12 h-1.5 rounded-full bg-[#27272A] overflow-hidden ml-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.score}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

import React from 'react';
import { Card } from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  icon: React.ElementType;
  color: 'red' | 'orange' | 'green' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color,
}) => {
  const colorStyles = {
    red: {
      iconBg: 'bg-[#EF4444]/15',
      iconColor: 'text-[#EF4444]',
      border: 'border-[#EF4444]/20',
    },
    orange: {
      iconBg: 'bg-[#F59E0B]/15',
      iconColor: 'text-[#F59E0B]',
      border: 'border-[#F59E0B]/20',
    },
    green: {
      iconBg: 'bg-[#22C55E]/15',
      iconColor: 'text-[#22C55E]',
      border: 'border-[#22C55E]/20',
    },
    purple: {
      iconBg: 'bg-[#8B5CF6]/15',
      iconColor: 'text-[#8B5CF6]',
      border: 'border-[#8B5CF6]/20',
    },
  };

  const style = colorStyles[color];

  return (
    <Card hover className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-lg ${style.iconBg} ${style.border} border flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-3xl font-bold tracking-tight text-[#FAFAFA]">
          {value}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#A1A1AA]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#71717A]" />
          <span>{change}</span>
        </div>
      </div>
    </Card>
  );
};

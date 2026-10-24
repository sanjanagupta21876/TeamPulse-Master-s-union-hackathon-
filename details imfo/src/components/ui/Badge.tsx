import type { BugSeverity, RepoStatus, VerificationStatus } from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'purple' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const variantStyles = {
    default: 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A]',
    outline: 'bg-transparent text-[#A1A1AA] border border-[#27272A]',
    purple: 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30',
    success: 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30',
    warning: 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30',
    danger: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30',
    info: 'bg-[#3B82F6]/15 text-[#60A5FA] border border-[#3B82F6]/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full leading-none tracking-wide ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: BugSeverity; size?: 'sm' | 'md' }> = ({
  severity,
  size = 'md',
}) => {
  switch (severity) {
    case 'Critical':
      return (
        <Badge variant="danger" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          Critical
        </Badge>
      );
    case 'High':
      return (
        <Badge variant="warning" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
          High
        </Badge>
      );
    case 'Medium':
      return (
        <Badge variant="info" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          Medium
        </Badge>
      );
    case 'Low':
      return (
        <Badge variant="default" size={size}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" />
          Low
        </Badge>
      );
  }
};

export const RepoStatusBadge: React.FC<{ status: RepoStatus }> = ({ status }) => {
  switch (status) {
    case 'Healthy':
      return <Badge variant="success">Healthy</Badge>;
    case 'Analyzed':
      return <Badge variant="info">Analyzed</Badge>;
    case 'Issues Found':
      return <Badge variant="danger">Issues Found</Badge>;
    case 'Analyzing':
      return <Badge variant="purple">Analyzing...</Badge>;
    case 'Metadata Retrieved':
      return <Badge variant="purple">Metadata Retrieved</Badge>;
  }
};

export const VerificationStatusBadge: React.FC<{ status: VerificationStatus }> = ({ status }) => {
  switch (status) {
    case 'Verified':
      return <Badge variant="success">Verified Fix</Badge>;
    case 'Pending Verification':
      return <Badge variant="warning">Pending Verification</Badge>;
    case 'Failed':
      return <Badge variant="danger">Verification Failed</Badge>;
    case 'Unverified':
      return <Badge variant="outline">Unverified</Badge>;
  }
};

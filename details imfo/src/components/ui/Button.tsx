import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#09090B] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-3.5 py-2 gap-2',
      lg: 'text-base px-4 py-2.5 gap-2.5',
    };

    const variantStyles = {
      primary: 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-sm focus:ring-[#8B5CF6]',
      secondary: 'bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] border border-[#27272A] focus:ring-[#27272A]',
      outline: 'bg-transparent hover:bg-[#18181B] text-[#FAFAFA] border border-[#27272A] focus:ring-[#27272A]',
      ghost: 'bg-transparent hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA] focus:ring-[#27272A]',
      danger: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/25 focus:ring-[#EF4444]',
      success: 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 hover:bg-[#22C55E]/25 focus:ring-[#22C55E]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

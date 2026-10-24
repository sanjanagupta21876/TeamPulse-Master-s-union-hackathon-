import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-[#FAFAFA]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#A1A1AA] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-[#18181B] border rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:ring-1 transition-all ${
              leftIcon ? 'pl-9' : ''
            } ${rightIcon ? 'pr-9' : ''} ${
              error
                ? 'border-[#EF4444] focus:ring-[#EF4444]'
                : 'border-[#27272A] focus:border-[#8B5CF6] focus:ring-[#8B5CF6]'
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[#A1A1AA] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-[#EF4444] mt-0.5">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-[#A1A1AA] mt-0.5">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

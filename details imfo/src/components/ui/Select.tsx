import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      options,
      children,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-[#FAFAFA]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            className={`w-full appearance-none bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 pr-9 text-sm text-[#FAFAFA] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all cursor-pointer ${
              error ? 'border-[#EF4444]' : ''
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#18181B] text-[#FAFAFA]">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-3 pointer-events-none text-[#A1A1AA]">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-[#EF4444] mt-0.5">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-slate-500">{prefix}</span>
          )}
          <input
            ref={ref}
            className={cn(
              'h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100',
              'placeholder:text-slate-600',
              'transition-colors duration-150',
              'focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
              prefix && 'pl-9',
              error && 'border-danger/60 focus:border-danger/80 focus:ring-danger/20',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

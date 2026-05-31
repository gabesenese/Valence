import { cn } from '@/utils/cn';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const variantStyles: Record<Variant, string> = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-surface-400/50 text-slate-300 border-surface-500',
  brand: 'bg-brand-600/20 text-brand-300 border-brand-600/30',
};

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = 'neutral', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tracking-wide',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', {
          'bg-success': variant === 'success',
          'bg-warning': variant === 'warning',
          'bg-danger': variant === 'danger',
          'bg-info': variant === 'info',
          'bg-slate-400': variant === 'neutral',
          'bg-brand-400': variant === 'brand',
        })} />
      )}
      {children}
    </span>
  );
}

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ children, className, hover, onClick }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-surface-400/60 bg-surface-100',
        hover && 'cursor-pointer transition-colors duration-150 hover:border-brand-600/40 hover:bg-surface-200',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
});

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between border-b border-surface-400/40 px-5 py-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-200 tracking-tight', className)}>
      {children}
    </h3>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

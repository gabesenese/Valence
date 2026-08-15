import { useUIStore } from '@/state/ui.store';
import { resolveTheme } from '@/lib/theme';
import { cn } from '@/utils/cn';
import type { Shot } from '../landingContent';

interface ProductFrameProps {
  shot: Shot;
  alt: string;
  path: string;
  priority?: boolean;
  className?: string;
}

export function ProductFrame({ shot, alt, path, priority = false, className }: ProductFrameProps) {
  const theme = useUIStore((s) => s.theme);
  const src = resolveTheme(theme) === 'dark' ? shot.dark : shot.light;

  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-6 top-10 rounded-[2rem]"
        style={{
          background: 'radial-gradient(closest-side, rgb(var(--brand-400) / 0.16), transparent 100%)',
          filter: 'blur(38px)',
        }}
      />
      <div className="relative overflow-hidden rounded-xl border border-surface-400 bg-surface-100 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.65)]">
        <div aria-hidden className="flex items-center gap-2 border-b border-surface-400 bg-surface-200 px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          <span className="font-mono text-[0.6875rem] tracking-tight text-slate-500">app.valenceos.ca{path}</span>
        </div>
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          draggable={false}
          className="block aspect-[1440/900] w-full select-none object-cover object-top"
        />
      </div>
    </div>
  );
}

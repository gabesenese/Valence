import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ABOUT_LINKS } from './aboutLinks';

/**
 * "About" nav dropdown. Opens on hover (desktop) and click (keyboard / touch),
 * closes on outside click or Escape.
 */
export function AboutMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        About
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Hover bridge so the menu doesn't close in the gap below the trigger */}
      <div
        className={cn(
          'absolute right-0 top-full z-50 pt-3 w-72',
          open ? 'block' : 'pointer-events-none hidden',
        )}
      >
        <div className="overflow-hidden rounded-xl border border-surface-400/40 bg-surface-100 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          {ABOUT_LINKS.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-200/60"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600/10">
                <Icon className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">{label}</p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { X, Check } from 'lucide-react';

export interface WorkspaceMeta {
  label: string;
  value: string;
  tone?: string;
}

interface WorkspaceShellProps {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: WorkspaceMeta[];
  footer?: ReactNode;
  children: ReactNode;
}

const PANEL_EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';

export function WorkspaceShell({ open, onClose, eyebrow, title, subtitle, meta, footer, children }: WorkspaceShellProps) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
  }, [open]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && !shown) setRender(false); }}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-surface-400/60 bg-surface-100 shadow-2xl transition-transform duration-300 ${PANEL_EASE} ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="border-b border-surface-400/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{eyebrow}</p>
              <h2 className="mt-0.5 truncate text-base font-semibold text-fg">{title}</h2>
              {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-surface-300 hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {meta && meta.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 border-t border-surface-400/30 pt-3">
              {meta.map((m) => (
                <div key={m.label}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className={`text-sm font-semibold tabular-nums ${m.tone ?? 'text-slate-200'}`}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {footer && (
          <div className="border-t border-surface-400/40 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function WorkspaceRecommendation({ lines, note }: { lines: string[]; note?: string }) {
  return (
    <div className="rounded-lg border border-brand-500/30 bg-brand-500/[0.06] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-brand-300">Recommended</p>
      <div className="mt-1.5 flex flex-col gap-1">
        {lines.map((l) => (
          <span key={l} className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />{l}
          </span>
        ))}
      </div>
      {note && <p className="mt-1.5 text-[11px] text-slate-500">{note}</p>}
    </div>
  );
}

export function WorkspaceSuccess({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
        <Check className="h-6 w-6 text-success" />
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {detail && <p className="max-w-xs text-xs leading-relaxed text-slate-500">{detail}</p>}
    </div>
  );
}

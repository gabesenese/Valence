import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FAQS } from '../landingContent';

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="border-b border-surface-400">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-start justify-between gap-8 py-6 text-left"
        >
          <span
            className={cn(
              'text-[1.0625rem] font-medium leading-snug tracking-[-0.015em] transition-colors duration-200',
              open ? 'text-fg' : 'text-slate-300 group-hover:text-fg',
            )}
          >
            {q}
          </span>
          <Plus
            aria-hidden
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 group-hover:text-slate-300',
              open && 'rotate-45 text-brand-400 group-hover:text-brand-400',
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-hidden={!open}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-7 pr-8 text-[0.9375rem] leading-[1.65] text-slate-400">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion() {
  return (
    <div className="border-t border-surface-400">
      {FAQS.map((f) => <Item key={f.q} {...f} />)}
    </div>
  );
}

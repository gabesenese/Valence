import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  disabled,
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  };

  const selected = options.find((o) => o.value === value);
  const sm = size === 'sm';

  const estimatedHeight = Math.min(options.length * 28 + 8, 260);
  const opensBelow = rect ? window.innerHeight - rect.bottom > estimatedHeight : true;
  const dropTop = rect
    ? opensBelow ? rect.bottom + 4 : rect.top - estimatedHeight - 4
    : 0;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex w-full items-center gap-2 rounded-lg border bg-surface-200 transition-all disabled:opacity-50 ${
          sm ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'
        } ${
          open
            ? 'border-brand-500/60 ring-2 ring-brand-500/10'
            : 'border-surface-400/40 hover:border-surface-300'
        } ${selected ? 'text-slate-200' : 'text-slate-500'}`}
      >
        <span className="flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChevronDown className={`shrink-0 text-slate-600 ${sm ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
        </motion.div>
      </button>

      {rect && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={dropdownRef}
              key="select-dropdown"
              initial={{ opacity: 0, scale: 0.95, y: opensBelow ? -6 : 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: opensBelow ? -6 : 6 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: dropTop,
                left: rect.left,
                minWidth: rect.width,
                zIndex: 9999,
                transformOrigin: opensBelow ? 'top' : 'bottom',
              }}
              className="max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border border-surface-400/60 bg-surface-100 py-1 shadow-2xl shadow-black/50"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 text-left transition-colors hover:bg-surface-300 ${
                    sm ? 'py-1.5 text-xs' : 'py-2 text-sm'
                  } ${value === opt.value ? 'text-brand-300' : 'text-slate-300'}`}
                >
                  <Check
                    className={`shrink-0 ${sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${
                      value === opt.value ? 'text-brand-400' : 'opacity-0'
                    }`}
                  />
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

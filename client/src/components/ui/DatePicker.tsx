import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  onClear,
  placeholder = 'Select date',
  disabled,
  className,
}: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;

  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewYear, setViewYear] = useState(() => parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth() ?? today.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = value ? new Date(value + 'T00:00:00') : null;
    if (p) {
      setViewYear(p.getFullYear());
      setViewMonth(p.getMonth());
    }
  }, [value]);

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

  const step = (dir: 1 | -1) => {
    setViewMonth((m) => {
      const next = m + dir;
      if (next < 0) { setViewYear((y) => y - 1); return 11; }
      if (next > 11) { setViewYear((y) => y + 1); return 0; }
      return next;
    });
  };

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const pick = (day: number) => {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setOpen(false);
  };

  const isSel = (d: number) =>
    !!parsed &&
    parsed.getFullYear() === viewYear &&
    parsed.getMonth() === viewMonth &&
    parsed.getDate() === d;

  const isTod = (d: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === d;

  const label = parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const dropdownHeight = onClear ? 310 : 280;
  const dropTop = rect
    ? window.innerHeight - rect.bottom > dropdownHeight
      ? rect.bottom + 4
      : rect.top - dropdownHeight - 4
    : 0;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`flex h-9 w-full items-center gap-2.5 rounded-xl border bg-surface-200 px-3 text-sm transition-all disabled:opacity-50 ${
          open
            ? 'border-brand-500/60 ring-2 ring-brand-500/10'
            : 'border-surface-400 hover:border-surface-300'
        } ${label ? 'text-slate-100' : 'text-slate-500'}`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="flex-1 text-left">{label || placeholder}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropTop, left: rect.left, zIndex: 9999, width: 264 }}
          className="overflow-hidden rounded-2xl border border-surface-400/60 bg-surface-100 shadow-2xl shadow-black/50"
        >
          <div className="flex items-center justify-between border-b border-surface-400/30 px-4 py-3">
            <button
              type="button"
              onClick={() => step(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-300 hover:text-fg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-200">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-300 hover:text-fg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="mb-1 grid grid-cols-7">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => (
                <div key={i} className="flex items-center justify-center p-0.5">
                  {day && (
                    <button
                      type="button"
                      onClick={() => pick(day)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-all ${
                        isSel(day)
                          ? 'bg-brand-600 font-semibold text-white shadow-sm shadow-brand-600/40'
                          : isTod(day)
                          ? 'font-medium text-brand-400 ring-1 ring-inset ring-brand-500/50 hover:bg-brand-600/20'
                          : 'text-slate-300 hover:bg-surface-300 hover:text-fg'
                      }`}
                    >
                      {day}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {onClear && (
            <div className="border-t border-surface-400/30 px-4 py-2.5">
              <button
                type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="text-xs text-slate-600 transition-colors hover:text-danger"
              >
                Clear date
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

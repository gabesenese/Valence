import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { alertsService } from '@/services/alerts.service';
import { useUIStore } from '@/state/ui.store';
import { cn } from '@/utils/cn';

const SEVERITY_CHIP: Record<string, string> = {
  CRITICAL: 'bg-danger/10 text-danger border border-danger/20',
  WARNING:  'bg-warning/10 text-warning border border-warning/20',
  INFO:     'bg-brand-500/10 text-brand-300 border border-brand-500/20',
};

const SEVERITY_STATUSES: Record<string, string[]> = {
  all:      ['OPEN'],
  warning:  ['OPEN'],
  critical: ['OPEN'],
};


export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const severityFilter = useUIStore((s) => s.alertSeverityFilter);
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: alertsService.getSummary,
    refetchInterval: 60_000,
  });

  const safeStatuses = SEVERITY_STATUSES[severityFilter] ?? SEVERITY_STATUSES['all'];

  const { data: recent } = useQuery({
    queryKey: ['alerts', 'recent-bell', severityFilter],
    queryFn: () => alertsService.getAlerts({
      statuses: safeStatuses,
      ...(severityFilter !== 'all' && { severity: severityFilter.toUpperCase() }),
      limit: 5,
    }),
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const clearAllMutation = useMutation({
    mutationFn: alertsService.dismissAll,
    onMutate: () => {
      qc.setQueryData<{ openTotal: number }>(['alerts', 'summary'], (old) =>
        old ? { ...old, openTotal: 0 } : old,
      );
      qc.setQueryData<{ data: unknown[] }>(['alerts', 'recent-bell', severityFilter], (old) =>
        old ? { ...old, data: [] } : old,
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const count = summary?.openTotal ?? 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-200 hover:text-slate-200',
          open && 'bg-surface-200 text-slate-200',
        )}
        aria-label={`Notifications${count > 0 ? ` — ${count} open` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-[10px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-surface-400/40 bg-surface-100 shadow-card">
          <div className="flex items-center justify-between border-b border-surface-400/20 px-4 py-3">
            <span className="text-sm font-semibold text-slate-200">Notifications</span>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                  {count} open
                </span>
              )}
              {count > 0 && (
                <button
                  onClick={() => clearAllMutation.mutate()}
                  disabled={clearAllMutation.isPending}
                  title="Dismiss all notifications"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-surface-300/60 hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto">
            {!recent?.data?.length ? (
              <li className="px-4 py-8 text-center text-xs text-slate-600">
                {recent ? 'No open alerts' : 'Loading…'}
              </li>
            ) : (
              recent.data.map((alert) => (
                <li key={alert.id} className="border-b border-surface-400/10 last:border-0">
                  <Link
                    to="/alerts"
                    onClick={() => setOpen(false)}
                    className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-200/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', SEVERITY_CHIP[alert.severity] ?? SEVERITY_CHIP.INFO)}>
                        {alert.severity}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-600">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs font-medium text-slate-300">{alert.title}</p>
                    {alert.property && (
                      <p className="text-[10px] text-slate-600">{alert.property.name}</p>
                    )}
                  </Link>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-surface-400/20 px-4 py-2.5">
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

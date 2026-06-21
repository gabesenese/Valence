import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, AlertTriangle, FileText, DollarSign, ChevronRight, Sparkles } from 'lucide-react';
import { workQueueService, type WorkItem } from '@/services/workQueue.service';
import { useAuthStore } from '@/state/auth.store';
import { cn } from '@/utils/cn';

const DISMISS_KEY = 'valence-brief-dismissed';

function getTimeOfDay(): { label: string; greeting: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { label: 'Morning Brief', greeting: 'Good morning' };
  if (hour < 17) return { label: 'Afternoon Brief', greeting: 'Good afternoon' };
  return { label: 'Evening Brief', greeting: 'Good evening' };
}

function wasDismissedToday(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === new Date().toDateString();
  } catch { return false; }
}

function dismissToday() {
  try { sessionStorage.setItem(DISMISS_KEY, new Date().toDateString()); } catch {}
}

function fmtRisk(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function TopItem({ item }: { item: WorkItem }) {
  const Icon = item.type.includes('LEASE') ? FileText : item.type.includes('INVOICE') || item.type.includes('PAYMENT') ? DollarSign : AlertTriangle;
  const color = item.severity === 'CRITICAL' ? 'text-danger' : 'text-warning';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-surface-400/30 bg-surface-200/40 px-3 py-2.5">
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', color)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-200 leading-snug truncate">{item.title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 truncate">{item.property?.name ?? ''}{item.lease ? ` · ${item.lease.tenantName}` : ''}</p>
      </div>
      {item.monthlyRisk > 0 && (
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">{fmtRisk(item.monthlyRisk)}</span>
      )}
    </div>
  );
}

export function MorningBrief() {
  const [dismissed, setDismissed] = useState(wasDismissedToday);
  const user = useAuthStore((s) => s.user);
  const { label, greeting } = getTimeOfDay();

  const { data, isLoading } = useQuery({
    queryKey: ['morning-brief'],
    queryFn: workQueueService.getBrief,
    staleTime: 60 * 60 * 1_000,
    enabled: !dismissed,
  });

  if (dismissed || isLoading || !data) return null;

  function handleDismiss() {
    dismissToday();
    setDismissed(true);
  }

  const { stats } = data;

  return (
    <div className="mx-auto mb-6 max-w-5xl rounded-xl border border-brand-500/20 bg-gradient-to-br from-brand-600/8 to-surface-100 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">{label}</span>
          </div>
          <p className="text-base font-semibold text-fg">{greeting}, {user?.firstName}.</p>
          <p className="mt-0.5 text-sm text-slate-400">{data.headline}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-slate-600 hover:text-slate-400 hover:bg-surface-300/50 transition-colors"
          title="Dismiss for today"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats row */}
      {stats.total > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {stats.critical > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-danger" />
              <span className="text-[11px] font-semibold text-danger">{stats.critical} critical</span>
            </div>
          )}
          {stats.warning > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-warning" />
              <span className="text-[11px] font-semibold text-warning">{stats.warning} warning</span>
            </div>
          )}
          {stats.totalMonthlyRisk > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-surface-400/40 bg-surface-200/60 px-3 py-1">
              <span className="text-[11px] font-semibold text-slate-400">{fmtRisk(stats.totalMonthlyRisk)} at risk</span>
            </div>
          )}
          {stats.urgentLeases > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-surface-400/40 bg-surface-200/60 px-3 py-1">
              <FileText className="h-3 w-3 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-400">{stats.urgentLeases} lease{stats.urgentLeases > 1 ? 's' : ''} expiring ≤30d</span>
            </div>
          )}
          {stats.overduePayments > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-surface-400/40 bg-surface-200/60 px-3 py-1">
              <AlertTriangle className="h-3 w-3 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-400">{stats.overduePayments} overdue</span>
            </div>
          )}
        </div>
      )}

      {/* Top items */}
      {data.topItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Top priorities</p>
          {data.topItems.map((item) => <TopItem key={item.id} item={item} />)}
          {stats.total > 3 && (
            <div className="flex items-center gap-1 pt-1">
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-[11px] text-slate-600">{stats.total - 3} more item{stats.total - 3 > 1 ? 's' : ''} in queue below</span>
            </div>
          )}
        </div>
      )}

      {stats.total === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-success/8 border border-success/20 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-success" />
          <p className="text-xs text-success font-medium">All clear — no items requiring action today.</p>
        </div>
      )}
    </div>
  );
}

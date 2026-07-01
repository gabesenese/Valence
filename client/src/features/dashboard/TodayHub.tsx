import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ListTodo, Bell } from 'lucide-react';
import { briefService } from '@/services/brief.service';
import { compactCurrency } from '@/utils/format';

export function TodayHub() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['brief', 'today'],
    queryFn: briefService.getToday,
    staleTime: 60_000,
  });

  if (!data) return null;

  const sections = [
    { key: 'risk', label: 'Revenue at risk', items: data.atRisk, href: '/finance?tab=forecast', icon: AlertTriangle, tone: 'text-danger' },
    { key: 'tasks', label: 'Due today', items: data.dueTasks, href: '/tasks', icon: ListTodo, tone: 'text-info' },
    { key: 'alerts', label: 'New alerts', items: data.newAlerts, href: '/alerts', icon: Bell, tone: 'text-warning' },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-surface-400/30 bg-surface-200/30">
        <span className="text-sm font-semibold text-fg">Today</span>
        {data.isEmpty ? (
          <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> All caught up</span>
        ) : (
          <span className="text-xs text-slate-500 tabular-nums">{compactCurrency(data.totalAtRisk)}/mo at risk · {data.counts.dueTasks} due · {data.counts.newAlerts} alert{data.counts.newAlerts === 1 ? '' : 's'}</span>
        )}
      </div>

      {data.isEmpty ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">Nothing needs you right now. Nice.</div>
      ) : (
        <div className="divide-y divide-surface-400/30">
          {sections.map((s) => (
            <div key={s.key} className="px-5 py-3">
              <button
                onClick={() => navigate(s.href)}
                className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-fg"
              >
                <s.icon className={`h-3.5 w-3.5 ${s.tone}`} /> {s.label} <span className="text-slate-600">({s.items.length})</span>
              </button>
              <div className="space-y-1.5">
                {s.items.slice(0, 4).map((i, idx) => (
                  <div key={idx} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-fg">{i.title}</span>
                    <span className="shrink-0 truncate text-xs text-slate-500">{i.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

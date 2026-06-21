import { useQuery } from '@tanstack/react-query';
import { Cpu, Clock, Loader2 } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { cn } from '@/utils/cn';

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SystemTab({ secret }: { secret: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'system', secret],
    queryFn: () => adminService.getSystem(secret),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-24 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading system data…</div>;
  }

  const heapPct = Math.round((data.memory.heapUsed / data.memory.heapTotal) * 100);
  const sysPct  = Math.round((data.memory.systemUsed / data.memory.systemTotal) * 100);

  return (
    <div className="space-y-6">
      {/* Server health */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Server Health</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Uptime',       value: fmtUptime(data.uptime), icon: Clock },
            { label: 'Heap Used',    value: `${data.memory.heapUsed} MB`,   icon: Cpu },
            { label: 'RSS',          value: `${data.memory.rss} MB`,        icon: Cpu },
            { label: 'System RAM',   value: `${data.memory.systemUsed} / ${data.memory.systemTotal} MB`, icon: Cpu },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-slate-500">{k.label}</p>
                <k.icon className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <p className="text-lg font-bold text-fg tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Memory bars */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Heap Usage', pct: heapPct, used: data.memory.heapUsed, total: data.memory.heapTotal },
          { label: 'System Memory', pct: sysPct, used: data.memory.systemUsed, total: data.memory.systemTotal },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">{m.label}</p>
              <p className="text-xs font-semibold tabular-nums text-slate-300">{m.pct}%</p>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-400/40 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', m.pct > 85 ? 'bg-danger' : m.pct > 65 ? 'bg-amber-400' : 'bg-brand-500')}
                style={{ width: `${m.pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-600 tabular-nums">{m.used} MB / {m.total} MB</p>
          </div>
        ))}
      </div>

      {/* DB counts */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Database</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          {Object.entries(data.db).map(([key, count]) => (
            <div key={key} className="rounded-xl border border-surface-400/40 bg-surface-100 px-3 py-3 text-center">
              <p className="text-xl font-bold text-fg tabular-nums">{count}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 capitalize">{key}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent errors */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Recent Errors</h2>
        {data.recentErrors.length === 0 ? (
          <div className="rounded-xl border border-surface-400/40 bg-surface-100 py-8 text-center">
            <p className="text-xs text-slate-600">No errors logged.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-400/30 bg-surface-200/50">
                  {['Time', 'Method', 'Path', 'Status', 'Message'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/20">
                {data.recentErrors.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-200/40 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-surface-300 text-slate-400">{e.method}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 font-mono max-w-[200px] truncate">{e.path}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-bold tabular-nums', e.status >= 500 ? 'text-danger' : e.status >= 400 ? 'text-amber-400' : 'text-slate-400')}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 max-w-[300px] truncate">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

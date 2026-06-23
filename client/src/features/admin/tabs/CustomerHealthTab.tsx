import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminService, type HealthAccount } from '@/services/admin.service';

const BAND: Record<string, { label: string; bar: string; pill: string }> = {
  healthy: { label: 'Healthy', bar: 'bg-success', pill: 'text-success bg-success/10' },
  watch:   { label: 'Watch',   bar: 'bg-warning', pill: 'text-warning bg-warning/10' },
  at_risk: { label: 'At risk', bar: 'bg-danger',  pill: 'text-danger bg-danger/10' },
};

function signalRow(label: string, ok: boolean) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className={ok ? 'text-success' : 'text-slate-600'}>{ok ? '✓' : '⚠'}</span>
      <span className={ok ? 'text-slate-300' : 'text-slate-500'}>{label}</span>
    </div>
  );
}

function HealthCard({ a }: { a: HealthAccount }) {
  const band = BAND[a.band] ?? BAND.watch;
  return (
    <div className={`rounded-xl border bg-surface-100 p-4 ${a.band === 'at_risk' ? 'border-danger/30' : 'border-surface-400/40'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{a.name || a.email}</p>
          <p className="truncate text-[11px] text-slate-500">{a.email} · {a.plan}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${band.pill}`}>{a.score}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-400/40">
        <div className={`h-1.5 rounded-full ${band.bar}`} style={{ width: `${a.score}%` }} />
      </div>
      <div className="mt-3 space-y-1">
        {signalRow('Active this week', a.signals.active)}
        {signalRow('Imported properties', a.signals.hasProperties)}
        {signalRow('Has leases', a.signals.hasLeases)}
        {signalRow('Sees revenue', a.signals.hasRevenue)}
      </div>
      {a.risks.length > 0 && (
        <div className="mt-3 border-t border-surface-400/30 pt-2">
          {a.risks.map((r) => (
            <p key={r} className="text-[11px] text-danger/90">⚠ {r}</p>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${band.pill}`}>{band.label}</span>
        {a.band === 'at_risk' && <button className="rounded-lg border border-surface-400/50 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-fg">Reach out</button>}
      </div>
    </div>
  );
}

export function CustomerHealthTab({ secret }: { secret: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'customer-health', secret],
    queryFn: () => adminService.getCustomerHealth(secret),
    staleTime: 60_000,
  });

  if (!data) {
    return <div className="flex items-center justify-center py-24 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading customer health…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Accounts', value: data.summary.total, cls: 'text-fg' },
          { label: 'Healthy', value: data.summary.healthy, cls: 'text-success' },
          { label: 'Watch', value: data.summary.watch, cls: 'text-warning' },
          { label: 'At risk', value: data.summary.atRisk, cls: 'text-danger' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <p className={`text-xl font-bold tabular-nums ${k.cls}`}>{k.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Accounts — worst first</h2>
        {data.accounts.length === 0 ? (
          <p className="text-xs text-slate-500">No accounts.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((a) => <HealthCard key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

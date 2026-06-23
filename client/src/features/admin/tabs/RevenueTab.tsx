import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { formatCurrency, compactCurrency } from '@/utils/format';

const PLAN_BAR: Record<string, string> = {
  EXECUTIVE: 'bg-amber-400',
  PROFESSIONAL: 'bg-brand-500',
  ESSENTIALS: 'bg-info',
};

export function RevenueTab({ secret }: { secret: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'revenue', secret],
    queryFn: () => adminService.getRevenue(secret),
    staleTime: 60_000,
  });

  if (!data) {
    return <div className="flex items-center justify-center py-24 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading revenue…</div>;
  }

  const maxMrr = Math.max(1, ...data.planMix.map((p) => p.mrr));
  const netColor = data.netProfit >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="space-y-6">
      {/* P&L hero */}
      <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-surface-400/30 bg-surface-200/30 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Net profit / month</p>
            <p className={`text-4xl font-extrabold tabular-nums tracking-tight ${netColor}`}>{compactCurrency(data.netProfit)}<span className="text-lg font-semibold text-slate-500">/mo</span></p>
            <p className="mt-1 text-xs text-slate-500">MRR {compactCurrency(data.mrr)} · ARR {compactCurrency(data.arr)} · margin {data.margin}%</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Paying accounts</p>
            <p className="text-2xl font-bold tabular-nums text-fg">{data.payingAccounts}</p>
            <p className="text-[11px] text-slate-500">{data.activeTrials} active trials</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="p-5 sm:border-r border-surface-400/30">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Revenue in</p>
            <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-300">Subscriptions</span><span className="font-semibold tabular-nums text-success">+{formatCurrency(data.mrr)}</span></div>
            <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-500">AI add-on</span><span className="text-xs text-slate-600">not yet billed</span></div>
            <div className="mt-1 flex items-center justify-between border-t border-surface-400/30 py-1.5 text-sm"><span className="text-slate-400">Gross MRR</span><span className="font-bold tabular-nums text-fg">{formatCurrency(data.mrr)}</span></div>
          </div>
          <div className="p-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Costs out · est. infra</p>
            <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-300">Vercel</span><span className="tabular-nums text-danger/90">−{formatCurrency(data.costs.vercel)}</span></div>
            <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-300">Neon Postgres</span><span className="tabular-nums text-danger/90">−{formatCurrency(data.costs.neon)}</span></div>
            <div className="flex items-center justify-between py-1.5 text-sm"><span className="text-slate-300">AI Gateway · Resend</span><span className="tabular-nums text-danger/90">−{formatCurrency(data.costs.aiGateway + data.costs.resend)}</span></div>
            <div className="mt-1 flex items-center justify-between border-t border-surface-400/30 py-1.5 text-sm"><span className="text-slate-400">Total cost</span><span className="font-bold tabular-nums text-danger">−{formatCurrency(data.totalCost)}</span></div>
          </div>
        </div>
        {data.costEstimated && (
          <p className="border-t border-surface-400/30 px-5 py-2 text-[11px] text-slate-600">Infrastructure costs are an estimate — wire real Vercel/Neon/Resend billing to make net profit exact.</p>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'ARPU / mo', value: formatCurrency(data.arpu) },
          { label: 'ARR', value: compactCurrency(data.arr) },
          { label: 'Trial → paid', value: `${data.trialConvRate}%` },
          { label: 'Margin', value: `${data.margin}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <p className="text-lg font-bold tabular-nums text-fg">{k.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Plan mix */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Plan mix</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {data.planMix.length === 0 && <p className="text-xs text-slate-500">No paying accounts yet.</p>}
          {data.planMix.map((p) => (
            <div key={p.plan} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{p.plan} · {formatCurrency(p.price)}</p>
              <div className="mt-1.5 flex items-end justify-between">
                <span className="text-lg font-bold tabular-nums text-fg">{p.count} <span className="text-xs font-normal text-slate-500">accts</span></span>
                <span className="text-sm tabular-nums text-slate-400">{formatCurrency(p.mrr)}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-400/40">
                <div className={`h-1.5 rounded-full ${PLAN_BAR[p.plan] ?? 'bg-slate-500'}`} style={{ width: `${Math.round((p.mrr / maxMrr) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

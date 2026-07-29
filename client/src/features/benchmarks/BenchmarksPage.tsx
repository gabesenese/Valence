import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, ShieldCheck, TrendingUp, Building2, ChevronRight } from 'lucide-react';
import { analyticsService, type PropertyScorecard } from '@/services/analytics.service';
import { compactCurrency } from '@/utils/format';
import { PageLoader } from '@/components/ui/Spinner';

type RiskBand = { label: string; text: string; dot: string };

function riskBand(score: number): RiskBand {
  if (score >= 40) return { label: 'High', text: 'text-danger', dot: 'bg-danger' };
  if (score >= 20) return { label: 'Elevated', text: 'text-warning', dot: 'bg-warning' };
  return { label: 'Low', text: 'text-success', dot: 'bg-success' };
}

function riskFactors(p: PropertyScorecard): string[] {
  const factors: string[] = [];
  if (p.criticalAlerts > 0) factors.push(`${p.criticalAlerts} critical alert${p.criticalAlerts !== 1 ? 's' : ''}`);
  const otherAlerts = p.openAlerts - p.criticalAlerts;
  if (otherAlerts > 0) factors.push(`${otherAlerts} open alert${otherAlerts !== 1 ? 's' : ''}`);
  if (p.expiringSoon > 0) factors.push(`${p.expiringSoon} lease${p.expiringSoon !== 1 ? 's' : ''} expiring ≤90d`);
  if (p.highRiskLeases > 0) factors.push(`${p.highRiskLeases} high-risk lease${p.highRiskLeases !== 1 ? 's' : ''}`);
  if (p.occupancyRate < 80) factors.push(`${p.occupancyRate}% occupancy`);
  return factors;
}

function CodeChip({ code }: { code: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-[10px] font-bold text-slate-400">
      {code.slice(0, 3)}
    </div>
  );
}

function GrowthValue({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className="text-xs text-slate-600" title="Trend unavailable until multiple revenue periods exist">—</span>
    );
  }
  if (delta === 0) {
    return <span className="text-sm font-bold tabular-nums text-slate-400">0%</span>;
  }
  const up = delta > 0;
  return (
    <span className={`text-sm font-bold tabular-nums ${up ? 'text-success' : 'text-danger'}`}>
      {up ? '▲' : '▼'}{Math.abs(delta)}%
    </span>
  );
}

export default function PortfolioPerformancePage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'benchmarks'],
    queryFn:  analyticsService.getBenchmarks,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const { properties } = data;

  if (properties.length === 0) {
    return (
      <div className="p-4 sm:p-5">
        <p className="rounded-xl border border-surface-400/50 bg-surface-100 px-5 py-8 text-center text-sm text-slate-500">
          No active buildings yet — add a property to see how your portfolio is performing.
        </p>
      </div>
    );
  }

  const byRisk    = [...properties].sort((a, b) => b.riskScore - a.riskScore || b.noi - a.noi);
  const attention = byRisk.filter(p => p.riskScore >= 20);

  const withGrowth   = properties.filter(p => p.revenueDeltaPct !== null)
                         .sort((a, b) => (b.revenueDeltaPct ?? 0) - (a.revenueDeltaPct ?? 0));
  const growthPending = properties.length - withGrowth.length;

  const hasExpenses  = properties.some(p => p.monthlyExpenses > 0);

  const allClear = attention.length === 0;
  const verdict = allClear
    ? 'Every building is running clean.'
    : `${attention.length} building${attention.length !== 1 ? 's' : ''} require attention.`;

  const expiringLeases = properties.reduce((s, p) => s + p.expiringSoon, 0);
  const criticalAlerts = properties.reduce((s, p) => s + p.criticalAlerts, 0);
  const highRiskLeases = properties.reduce((s, p) => s + p.highRiskLeases, 0);

  return (
    <div className="flex flex-col gap-5 p-4 animate-fade-in sm:p-5">

      {/* CONCLUSION — which buildings deserve attention */}
      <div className="rounded-2xl border border-surface-400/60 bg-surface-100 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-slate-500">
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Asset Overview</span>
        </div>
        <p className="mt-4 text-2xl font-bold leading-snug text-fg sm:text-3xl">{verdict}</p>
        {allClear && <p className="mt-1 max-w-2xl text-sm text-slate-400">No elevated risk across the portfolio right now.</p>}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-surface-200/30 px-4 py-3">
            <p className="text-lg font-bold tabular-nums text-fg">{expiringLeases}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Leases expiring ≤90d</p>
          </div>
          <div className="rounded-xl bg-surface-200/30 px-4 py-3">
            <p className={`text-lg font-bold tabular-nums ${criticalAlerts > 0 ? 'text-danger' : 'text-fg'}`}>{criticalAlerts}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">Critical alerts</p>
          </div>
          <div className="rounded-xl bg-surface-200/30 px-4 py-3">
            <p className="text-lg font-bold tabular-nums text-fg">{highRiskLeases}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">High-risk leases</p>
          </div>
        </div>
      </div>

      {/* ASSET RISK — what threatens each building */}
      <section>
        <h3 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Asset Risk</h3>
        <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4 text-success" />
              All buildings are low-risk right now.
            </div>
          ) : (
            <div className="divide-y divide-surface-400/30">
              {attention.map(p => {
                const band = riskBand(p.riskScore);
                const factors = riskFactors(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="flex w-full items-center gap-4 px-4 py-3 hover:bg-surface-200/40 transition-colors text-left group"
                  >
                    <CodeChip code={p.code} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors truncate">{p.name}</p>
                      <p className="text-xs text-slate-600 truncate">{factors.length > 0 ? factors.join(' · ') : 'Elevated risk'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${band.dot}`} />
                        <span className={`text-sm font-bold tabular-nums ${band.text}`}>{p.riskScore}</span>
                      </span>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">{band.label} risk</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* GROWTH — direction of change, honest where unavailable */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Growth</h3>
          <span className="text-[11px] text-slate-600">Month-over-month revenue change</span>
        </div>
        <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
          {withGrowth.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-500">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              Trend unavailable until multiple revenue periods exist.
            </div>
          ) : (
            <>
              <div className="divide-y divide-surface-400/30">
                {withGrowth.map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="flex w-full items-center gap-4 px-4 py-3 hover:bg-surface-200/40 transition-colors text-left group"
                  >
                    <CodeChip code={p.code} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors truncate">{p.name}</p>
                      <p className="text-xs text-slate-600 truncate">{compactCurrency(p.monthlyRevenue)}/mo revenue</p>
                    </div>
                    <div className="text-right shrink-0">
                      <GrowthValue delta={p.revenueDeltaPct} />
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider">vs last month</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
              {growthPending > 0 && (
                <p className="border-t border-surface-400/30 bg-surface-200/20 px-4 py-2.5 text-[11px] text-slate-500">
                  {growthPending} building{growthPending !== 1 ? 's' : ''} awaiting a second revenue period before a trend can be shown.
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* BUILDING COMPARISON — the anchor: compare every building across five signals */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Building Comparison</h3>
          <span className="text-[11px] text-slate-600">{properties.length} building{properties.length !== 1 ? 's' : ''} · sorted by risk</span>
        </div>
        <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-400/40 bg-surface-200/30 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 text-left font-semibold">Building</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Occupancy</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2.5 text-right font-semibold">NOI</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Risk</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/20">
                {byRisk.map(p => {
                  const band = riskBand(p.riskScore);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/properties/${p.id}`)}
                      className="cursor-pointer transition-colors hover:bg-surface-200/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CodeChip code={p.code} />
                          <span className="truncate font-medium text-slate-200">{p.name}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${p.occupancyRate < 80 ? 'text-warning' : 'text-slate-300'}`}>{p.occupancyRate}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">{compactCurrency(p.monthlyRevenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums ${p.noi >= 0 ? 'text-slate-200' : 'text-danger'}`}>{compactCurrency(p.noi)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center justify-end gap-1.5 tabular-nums ${band.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${band.dot}`} />
                          {p.riskScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right"><GrowthValue delta={p.revenueDeltaPct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!hasExpenses && (
            <button
              type="button"
              onClick={() => navigate('/integrations')}
              className="group flex w-full items-center gap-2 border-t border-surface-400/30 bg-surface-200/20 px-4 py-2.5 text-left transition-colors hover:bg-brand-600/10"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span className="text-[11px] text-slate-500">NOI reflects contracted rent — connect QuickBooks or import expenses to see true net operating income.</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-brand-300" />
            </button>
          )}
        </div>
      </section>

    </div>
  );
}

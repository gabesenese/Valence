import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trophy, AlertTriangle, ChevronRight, Scale } from 'lucide-react';
import { analyticsService, type PropertyScorecard } from '@/services/analytics.service';
import { compactCurrency } from '@/utils/format';
import { PageLoader } from '@/components/ui/Spinner';

const marginPct = (noi: number, revenue: number) => (revenue > 0 ? Math.round((noi / revenue) * 100) : 0);

type CardEntry = Pick<PropertyScorecard, 'id' | 'name' | 'code' | 'totalUnits'> & {
  metricLabel: string;
  metricValue: string;
  metricColor: string;
  reason?: string;
};

function PropertyRow({
  name, code, totalUnits, metricLabel, metricValue, metricColor, reason, onClick,
}: CardEntry & { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3 hover:bg-surface-200/40 transition-colors text-left group"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-[10px] font-bold text-slate-400">
        {code.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors truncate">{name}</p>
        <p className="text-xs text-slate-600 truncate">{totalUnits} units{reason ? ` · ${reason}` : ''}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold tabular-nums ${metricColor}`}>{metricValue}</p>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">{metricLabel}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
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

  const { highlights, outliers, properties } = data;

  const portfolioRevenue  = properties.reduce((s, p) => s + p.monthlyRevenue, 0);
  const portfolioExpenses = properties.reduce((s, p) => s + p.monthlyExpenses, 0);
  const portfolioNOI      = portfolioRevenue - portfolioExpenses;
  const hasExpenses       = portfolioExpenses > 0;
  const byNOI = hasExpenses ? [...properties].sort((a, b) => b.noi - a.noi) : [...properties].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);

  const topCandidates: (CardEntry | null)[] = [
    highlights.bestRevenue
      ? { ...highlights.bestRevenue, metricLabel: 'Monthly Revenue', metricValue: compactCurrency(highlights.bestRevenue.monthlyRevenue), metricColor: 'text-success' }
      : null,
    highlights.fastestGrowing && highlights.fastestGrowing.revenueDeltaPct != null
      ? { ...highlights.fastestGrowing, metricLabel: 'Revenue Growth', metricValue: `+${highlights.fastestGrowing.revenueDeltaPct}%`, metricColor: 'text-success' }
      : null,
    highlights.lowestRisk
      ? { ...highlights.lowestRisk, metricLabel: 'Risk Score', metricValue: `${highlights.lowestRisk.riskScore}/100`, metricColor: 'text-brand-400' }
      : null,
  ];

  const seen = new Set<string>();
  const topPerformers = topCandidates.filter((p): p is CardEntry => {
    if (!p || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const attentionIds = new Set<string>();
  const needsAttention: CardEntry[] = [];

  if (highlights.highestRisk) {
    attentionIds.add(highlights.highestRisk.id);
    needsAttention.push({ ...highlights.highestRisk, metricLabel: 'Risk Score', metricValue: `${highlights.highestRisk.riskScore}/100`, metricColor: 'text-danger', reason: 'highest risk' });
  }

  if (highlights.worstPerforming && !attentionIds.has(highlights.worstPerforming.id)) {
    attentionIds.add(highlights.worstPerforming.id);
    needsAttention.push({ ...highlights.worstPerforming, metricLabel: 'Monthly Revenue', metricValue: compactCurrency(highlights.worstPerforming.monthlyRevenue), metricColor: 'text-warning', reason: 'lowest revenue' });
  }

  outliers.filter(o => !attentionIds.has(o.id)).slice(0, 3).forEach(o => {
    attentionIds.add(o.id);
    needsAttention.push({ ...o, metricLabel: 'Issue', metricValue: o.outlierReasons[0] ?? 'Outlier', metricColor: 'text-warning', reason: o.outlierReasons.slice(0, 2).join(', ') });
  });

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-400/40 bg-surface-200/30">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-fg">Top Performers</span>
          </div>
          {topPerformers.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600">No data yet</p>
          ) : (
            <div className="divide-y divide-surface-400/30">
              {topPerformers.map(p => (
                <PropertyRow key={p.id} {...p} onClick={() => navigate(`/properties/${p.id}`)} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-400/40 bg-surface-200/30">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
            <span className="text-xs font-semibold text-fg">Needs Attention</span>
          </div>
          {needsAttention.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-600">All properties are performing well</p>
          ) : (
            <div className="divide-y divide-surface-400/30">
              {needsAttention.map(p => (
                <PropertyRow key={p.id} {...p} onClick={() => navigate(`/properties/${p.id}`)} />
              ))}
            </div>
          )}
        </div>

      </div>

      {properties.length > 0 && (
        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-400/40 bg-surface-200/30">
            <div className="flex items-center gap-2">
              <Scale className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-xs font-semibold text-fg">Profitability by Property</span>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-xs font-bold tabular-nums text-success">{compactCurrency(portfolioRevenue)}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">Revenue</p>
              </div>
              <div>
                <p className={`text-xs font-bold tabular-nums ${hasExpenses ? 'text-danger' : 'text-slate-600'}`}>{hasExpenses ? compactCurrency(portfolioExpenses) : '—'}</p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">Expenses</p>
              </div>
              <div>
                <p className={`text-xs font-bold tabular-nums ${!hasExpenses ? 'text-slate-600' : portfolioNOI >= 0 ? 'text-success' : 'text-danger'}`}>
                  {hasExpenses
                    ? <>{compactCurrency(portfolioNOI)} <span className="text-slate-600">({marginPct(portfolioNOI, portfolioRevenue)}%)</span></>
                    : '—'}
                </p>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">NOI · Margin</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-surface-400/30">
            {byNOI.map((p, i) => (
              <button
                key={p.id}
                onClick={() => navigate(`/properties/${p.id}`)}
                className="flex w-full items-center gap-4 px-4 py-3 hover:bg-surface-200/40 transition-colors text-left group"
              >
                <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-slate-600">#{i + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-[10px] font-bold text-slate-400">
                  {p.code.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors truncate">{p.name}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {hasExpenses
                      ? `${compactCurrency(p.monthlyRevenue)} rev · ${compactCurrency(p.monthlyExpenses)} exp${p.costPerSqft > 0 ? ` · $${p.costPerSqft.toFixed(2)}/ft² cost` : ''}`
                      : `${p.activeLeases} lease${p.activeLeases !== 1 ? 's' : ''} · contracted rent`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${hasExpenses ? (p.noi >= 0 ? 'text-success' : 'text-danger') : 'text-success'}`}>
                    {compactCurrency(hasExpenses ? p.noi : p.monthlyRevenue)}
                  </p>
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">{hasExpenses ? `${marginPct(p.noi, p.monthlyRevenue)}% margin` : 'per month'}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
          {!hasExpenses && (
            <button
              type="button"
              onClick={() => navigate('/integrations')}
              className="group flex w-full items-center gap-2 border-t border-surface-400/30 bg-surface-200/20 px-4 py-2.5 text-left transition-colors hover:bg-brand-600/10"
            >
              <Scale className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span className="text-[11px] text-slate-500">Connect QuickBooks or import expenses to see NOI &amp; margins.</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-brand-300" />
            </button>
          )}
        </div>
      )}

    </div>
  );
}

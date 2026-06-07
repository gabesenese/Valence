import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trophy, AlertTriangle, ChevronRight } from 'lucide-react';
import { analyticsService, type PropertyScorecard } from '@/services/analytics.service';
import { compactCurrency } from '@/utils/format';
import { PageLoader } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';

// ─── Property card ────────────────────────────────────────────────────────────

function PropertyCard({
  name, code, totalUnits, metricLabel, metricValue, metricColor, reason, onClick,
}: {
  name: string; code: string; totalUnits: number;
  metricLabel: string; metricValue: string; metricColor: string;
  reason?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-surface-400/40 bg-surface-100 px-4 py-3.5 hover:bg-surface-200/40 transition-colors text-left group w-full"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-300 text-xs font-bold text-slate-400">
        {code.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 group-hover:text-brand-300 transition-colors truncate">{name}</p>
        <p className="text-xs text-slate-600">{totalUnits} units{reason ? ` · ${reason}` : ''}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold tabular-nums ${metricColor}`}>{metricValue}</p>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider">{metricLabel}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CardEntry = Pick<PropertyScorecard, 'id' | 'name' | 'code' | 'totalUnits'> & {
  metricLabel: string;
  metricValue: string;
  metricColor: string;
  reason?: string;
};

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

  // Top performers — de-duplicate by id
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

  // Needs attention — high risk + worst performing + outliers
  const attentionIds = new Set<string>();
  const needsAttention: CardEntry[] = [];

  if (highlights.highestRisk) {
    attentionIds.add(highlights.highestRisk.id);
    needsAttention.push({
      ...highlights.highestRisk,
      metricLabel: 'Risk Score',
      metricValue: `${highlights.highestRisk.riskScore}/100`,
      metricColor: 'text-danger',
      reason: 'highest risk',
    });
  }

  if (highlights.worstPerforming && !attentionIds.has(highlights.worstPerforming.id)) {
    attentionIds.add(highlights.worstPerforming.id);
    needsAttention.push({
      ...highlights.worstPerforming,
      metricLabel: 'Monthly Revenue',
      metricValue: compactCurrency(highlights.worstPerforming.monthlyRevenue),
      metricColor: 'text-warning',
      reason: 'lowest revenue',
    });
  }

  outliers
    .filter(o => !attentionIds.has(o.id))
    .slice(0, 3)
    .forEach(o => {
      attentionIds.add(o.id);
      needsAttention.push({
        ...o,
        metricLabel: 'Issue',
        metricValue: o.outlierReasons[0] ?? 'Outlier',
        metricColor: 'text-warning',
        reason: o.outlierReasons.slice(0, 2).join(', '),
      });
    });

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Portfolio Performance"
        description={`${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}`}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top Performers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Top Performers</h2>
          </div>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">No data yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topPerformers.map(p => (
                <PropertyCard
                  key={p.id}
                  {...p}
                  onClick={() => navigate(`/properties/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-danger" />
            <h2 className="text-sm font-semibold text-white">Needs Attention</h2>
          </div>
          {needsAttention.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">All properties are performing well</p>
          ) : (
            <div className="flex flex-col gap-2">
              {needsAttention.map(p => (
                <PropertyCard
                  key={p.id}
                  {...p}
                  onClick={() => navigate(`/properties/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

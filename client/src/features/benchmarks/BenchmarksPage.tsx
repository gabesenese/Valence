import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, TrendingUp, TrendingDown, AlertTriangle, Building2,
  DollarSign, Users, Zap, ChevronRight, BarChart2, ArrowUp, ArrowDown,
} from 'lucide-react';
import { analyticsService, type PropertyScorecard } from '@/services/analytics.service';
import { formatCurrency, compactCurrency } from '@/utils/format';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank, total }: { rank: number; total: number }) {
  const isTop    = rank === 1;
  const isBottom = rank === total;
  const cls = isTop
    ? 'bg-amber-500/20 text-amber-400 ring-amber-500/30'
    : isBottom
    ? 'bg-danger/10 text-danger ring-danger/20'
    : 'bg-surface-300/50 text-slate-400 ring-surface-400/30';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cls}`}>
      #{rank}
    </span>
  );
}

// ─── Risk bar ─────────────────────────────────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score >= 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#10b981';
  return (
    <div className="relative h-1.5 w-16 rounded-full bg-surface-400/30 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Highlight card ───────────────────────────────────────────────────────────

function HighlightCard({
  title, subtitle, property, valueLabel, value, icon: Icon, accentColor, onClick,
}: {
  title: string;
  subtitle: string;
  property: PropertyScorecard | null;
  valueLabel: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  onClick: () => void;
}) {
  if (!property) return null;
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-xl border border-surface-400/40 bg-surface-100 p-4 hover:bg-surface-200/40 transition-colors text-left group"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${accentColor}20` }}>
          <span style={{ color: accentColor }}><Icon className="h-3.5 w-3.5" /></span>
        </div>
        <div>
          <p className="text-xs font-semibold text-white">{title}</p>
          <p className="text-[10px] text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div>
        <p className="text-sm font-bold text-slate-200 truncate">{property.name}</p>
        <p className="text-[11px] text-slate-500">{property.code} · {property.totalUnits} units</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">{valueLabel}</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: accentColor }}>{value}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BenchmarksPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'benchmarks'],
    queryFn:  analyticsService.getBenchmarks,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const { highlights, portfolioAverages, properties, outliers } = data;
  const total = properties.length;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Property Benchmarks</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {total} propert{total !== 1 ? 'ies' : 'y'} ranked and compared across key performance metrics
        </p>
      </div>

      {/* Portfolio averages */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Avg Occupancy',   value: `${portfolioAverages.occupancyRate}%`,            icon: Users,      color: 'text-brand-400',  bg: 'bg-brand-600/10'  },
          { label: 'Avg Revenue',     value: compactCurrency(portfolioAverages.monthlyRevenue), icon: DollarSign, color: 'text-success',    bg: 'bg-success/10'    },
          { label: 'Avg NOI',         value: compactCurrency(portfolioAverages.noi),            icon: TrendingUp, color: 'text-success',    bg: 'bg-success/10'    },
          { label: 'Rev / Unit',      value: compactCurrency(portfolioAverages.revenuePerUnit), icon: Building2,  color: 'text-brand-400',  bg: 'bg-brand-600/10'  },
          { label: 'Avg Risk Score',  value: `${portfolioAverages.riskScore}`,                 icon: AlertTriangle, color: portfolioAverages.riskScore >= 40 ? 'text-warning' : 'text-success', bg: portfolioAverages.riskScore >= 40 ? 'bg-warning/10' : 'bg-success/10' },
        ].map(kpi => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-xl border border-surface-400/40 bg-surface-100 p-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-base font-bold text-white tabular-nums">{kpi.value}</p>
              <p className="text-[10px] text-slate-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Highlight cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Portfolio Rankings</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <HighlightCard
            title="Best Revenue"
            subtitle="Highest monthly revenue"
            property={highlights.bestRevenue}
            valueLabel="Monthly Revenue"
            value={compactCurrency(highlights.bestRevenue?.monthlyRevenue ?? 0)}
            icon={Trophy}
            accentColor="#f59e0b"
            onClick={() => navigate(`/properties/${highlights.bestRevenue?.id}`)}
          />
          <HighlightCard
            title="Fastest Growing"
            subtitle="Strongest MoM growth"
            property={highlights.fastestGrowing}
            valueLabel="Revenue Growth"
            value={highlights.fastestGrowing?.revenueDeltaPct != null ? `+${highlights.fastestGrowing.revenueDeltaPct}%` : 'N/A'}
            icon={TrendingUp}
            accentColor="#10b981"
            onClick={() => navigate(`/properties/${highlights.fastestGrowing?.id}`)}
          />
          <HighlightCard
            title="Highest NOI"
            subtitle="Most profitable property"
            property={highlights.highestNOI}
            valueLabel="Monthly NOI"
            value={compactCurrency(highlights.highestNOI?.noi ?? 0)}
            icon={DollarSign}
            accentColor="#6366f1"
            onClick={() => navigate(`/properties/${highlights.highestNOI?.id}`)}
          />
          <HighlightCard
            title="Lowest Risk"
            subtitle="Best operational health"
            property={highlights.lowestRisk}
            valueLabel="Risk Score"
            value={`${highlights.lowestRisk?.riskScore ?? 0}/100`}
            icon={Zap}
            accentColor="#10b981"
            onClick={() => navigate(`/properties/${highlights.lowestRisk?.id}`)}
          />
          <HighlightCard
            title="Needs Attention"
            subtitle="Lowest overall revenue"
            property={highlights.worstPerforming}
            valueLabel="Monthly Revenue"
            value={compactCurrency(highlights.worstPerforming?.monthlyRevenue ?? 0)}
            icon={TrendingDown}
            accentColor="#ef4444"
            onClick={() => navigate(`/properties/${highlights.worstPerforming?.id}`)}
          />
          <HighlightCard
            title="Highest Risk"
            subtitle="Most operational exposure"
            property={highlights.highestRisk}
            valueLabel="Risk Score"
            value={`${highlights.highestRisk?.riskScore ?? 0}/100`}
            icon={AlertTriangle}
            accentColor="#ef4444"
            onClick={() => navigate(`/properties/${highlights.highestRisk?.id}`)}
          />
        </div>
      </div>

      {/* Outlier callouts */}
      {outliers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-warning/70" />
              <CardTitle>Portfolio Outliers</CardTitle>
            </div>
            <span className="text-xs text-slate-500">{outliers.length} detected</span>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {outliers.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/properties/${p.id}`)}
                className="flex w-full items-start gap-4 px-5 py-3.5 hover:bg-surface-200/40 transition-colors text-left group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-xs font-bold text-slate-400">
                  {p.code.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors">{p.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.outlierReasons.map((r, i) => (
                      <span key={i} className="inline-flex rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] text-warning">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Full property comparison table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-400" />
            <CardTitle>Property Scorecards</CardTitle>
          </div>
          <span className="text-xs text-slate-500">Ranked by monthly revenue</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-400/30">
                {['#', 'Property', 'Revenue', 'MoM', 'NOI', 'Rev/Unit', 'Occupancy', 'Alerts', 'Expiring', 'Risk'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-400/20">
              {properties.map((p) => {
                const occupancyColor = p.occupancyRate >= 90 ? 'text-success' : p.occupancyRate >= 75 ? 'text-warning' : 'text-danger';
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-surface-200/30 cursor-pointer transition-colors group"
                    onClick={() => navigate(`/properties/${p.id}`)}
                  >
                    <td className="pl-5 pr-3 py-3">
                      <RankBadge rank={p.ranks.byRevenue} total={total} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-300 text-[10px] font-bold text-slate-400">
                          {p.code.slice(0, 3)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200 group-hover:text-brand-300 transition-colors whitespace-nowrap">{p.name}</p>
                          <p className="text-[10px] text-slate-600">{p.totalUnits} units</p>
                        </div>
                        {p.isOutlier && (
                          <span className="ml-1 inline-flex rounded-full bg-warning/10 border border-warning/20 px-1.5 py-0.5 text-[9px] font-bold text-warning">OUTLIER</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white tabular-nums whitespace-nowrap">
                      {compactCurrency(p.monthlyRevenue)}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {p.revenueDeltaPct != null ? (
                        <span className={`flex items-center gap-0.5 text-xs font-medium ${p.revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'}`}>
                          {p.revenueDeltaPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {Math.abs(p.revenueDeltaPct)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      <span className={p.noi >= 0 ? 'text-success font-medium' : 'text-danger font-medium'}>
                        {compactCurrency(p.noi)}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300 whitespace-nowrap">
                      {formatCurrency(p.revenuePerUnit)}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      <span className={`font-medium ${occupancyColor}`}>{p.occupancyRate}%</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.criticalAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-danger font-medium">
                          <AlertTriangle className="h-3 w-3" />{p.criticalAlerts}
                        </span>
                      ) : p.openAlerts > 0 ? (
                        <span className="text-xs text-warning">{p.openAlerts}</span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {p.expiringSoon > 0 ? (
                        <span className="text-xs text-warning font-medium">{p.expiringSoon} in 90d</span>
                      ) : (
                        <span className="text-xs text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <RiskBar score={p.riskScore} />
                        <span className="text-xs tabular-nums text-slate-400">{p.riskScore}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Portfolio average row */}
              <tr className="bg-surface-200/20 border-t border-surface-400/40">
                <td className="pl-5 pr-3 py-3 text-[10px] text-slate-600 font-semibold uppercase tracking-wider" colSpan={2}>
                  Portfolio avg
                </td>
                <td className="px-4 py-3 text-slate-500 tabular-nums text-sm">{compactCurrency(portfolioAverages.monthlyRevenue)}</td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums text-sm">{compactCurrency(portfolioAverages.noi)}</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums text-sm">{formatCurrency(portfolioAverages.revenuePerUnit)}</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums text-sm">{portfolioAverages.occupancyRate}%</td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3 text-slate-600">—</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <RiskBar score={portfolioAverages.riskScore} />
                    <span className="text-xs tabular-nums text-slate-500">{portfolioAverages.riskScore}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

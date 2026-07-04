import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Building2, ArrowUp, ArrowDown, CheckCircle2, ChevronRight, Calendar, Activity,
} from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { leasesService } from '@/services/leases.service';
import ExecutiveBriefCard from './ExecutiveBrief';
import HealthScoreCard from './HealthScoreCard';
import { WhatChangedPanel } from '@/features/changes/WhatChangedPanel';
import { TodayHub } from './TodayHub';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, compactCurrency, daysUntil, formatDate, monthLabelToRange } from '@/utils/format';
import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen';
import { OnboardingCard } from '@/features/onboarding/OnboardingCard';
import { usePlan } from '@/hooks/usePlan';
import { useChartColors } from '@/hooks/useChartColors';

const TREND_OPTIONS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];

type FeedItem = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  priority: number;
  message: string;
  context: string;
  href: string;
  value?: string;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { canAccess } = usePlan();
  const c = useChartColors();
  const [trendMonths, setTrendMonths] = useState(12);

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: analyticsService.getSummary,
  });

  const { data: trend } = useQuery({
    queryKey: ['analytics', 'revenue-trend', trendMonths],
    queryFn: () => analyticsService.getRevenueTrend(trendMonths),
  });

  const { data: distribution } = useQuery({
    queryKey: ['analytics', 'lease-distribution'],
    queryFn: analyticsService.getLeaseDistribution,
  });

  const { data: performance } = useQuery({
    queryKey: ['analytics', 'property-performance'],
    queryFn: analyticsService.getPropertyPerformance,
  });

  const { data: expiringLeases } = useQuery({
    queryKey: ['leases', 'expiring-90'],
    queryFn: () => leasesService.getLeases({ expiringWithinDays: 90, status: 'ACTIVE', limit: 6 }),
  });

  const { data: insights } = useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: analyticsService.getInsights,
    staleTime: 60_000,
  });

  const latestNOI = trend && trend.length > 0 ? trend[trend.length - 1].net : null;

  function drillToFinanceMonth(label?: string) {
    const range = label ? monthLabelToRange(label) : null;
    if (!range) { navigate('/finance'); return; }
    navigate(`/finance?period=${encodeURIComponent(range.period)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`);
  }

  const kpis = summary ? [
    {
      label: 'Active Properties',
      value: summary.properties.total,
      color: 'text-brand-400',
      trend: undefined as number | undefined,
      sub: undefined as string | undefined,
      subColor: undefined as string | undefined,
      href: '/properties',
    },
    {
      label: 'Active Leases',
      value: summary.leases.active,
      color: 'text-success',
      trend: undefined,
      sub: undefined,
      subColor: undefined,
      href: '/leases',
    },
    {
      label: 'Monthly Revenue',
      value: compactCurrency(summary.revenue.current),
      color: 'text-success',
      trend: summary.revenue.growthPct,
      sub: undefined,
      subColor: undefined,
      href: '/finance',
    },
    {
      label: 'Net Income',
      value: latestNOI != null ? compactCurrency(latestNOI) : '—',
      color: latestNOI != null && latestNOI >= 0 ? 'text-success' : 'text-danger',
      trend: undefined,
      sub: 'NOI this month',
      subColor: 'text-slate-500',
      href: '/finance',
    },
    {
      label: 'Occupancy Rate',
      value: `${summary.occupancy.rate}%`,
      color: summary.occupancy.rate >= 90 ? 'text-success' : summary.occupancy.rate >= 75 ? 'text-warning' : 'text-danger',
      trend: undefined,
      sub: `${summary.occupancy.occupied}/${summary.occupancy.total} units`,
      subColor: 'text-slate-500',
      href: '/properties?vacant=true',
    },
    {
      label: 'Open Alerts',
      value: summary.alerts.open,
      color: summary.alerts.critical > 0 ? 'text-danger' : summary.alerts.open > 0 ? 'text-warning' : 'text-success',
      trend: undefined,
      sub: summary.alerts.critical > 0 ? `${summary.alerts.critical} critical` : summary.alerts.open === 0 ? 'All clear' : 'No critical',
      subColor: summary.alerts.critical > 0 ? 'text-danger' : summary.alerts.open === 0 ? 'text-success' : 'text-slate-500',
      href: '/alerts',
    },
  ] : [];

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    if ((summary?.alerts.critical ?? 0) > 0) {
      items.push({
        id: 'crit-alerts',
        severity: 'critical',
        priority: 0,
        message: `${summary!.alerts.critical} critical alert${summary!.alerts.critical > 1 ? 's' : ''} need immediate attention`,
        context: 'Open Alerts',
        href: '/alerts',
      });
    }

    expiringLeases?.data
      .filter(l => daysUntil(l.endDate) <= 30)
      .forEach(l => {
        const d = daysUntil(l.endDate);
        items.push({
          id: `lease-${l.id}`,
          severity: d <= 7 ? 'critical' : 'warning',
          priority: d,
          message: `${l.tenant.name} lease expires in ${d} day${d !== 1 ? 's' : ''}`,
          context: l.property.name,
          href: `/leases/${l.id}`,
          value: compactCurrency(Number(l.baseRent)) + '/mo',
        });
      });

    insights
      ?.filter(i => i.severity === 'critical' || i.severity === 'warning')
      .forEach(i => items.push({
        id: i.id,
        severity: i.severity as 'critical' | 'warning',
        priority: i.severity === 'critical' ? 1 : 50,
        message: i.message,
        context: i.context,
        href: i.href,
        value: i.value,
      }));

    return items.sort((a, b) => a.priority - b.priority);
  }, [summary, expiringLeases, insights]);

  const renewals31to90 = useMemo(
    () => expiringLeases?.data.filter(l => {
      const d = daysUntil(l.endDate);
      return d > 30 && d <= 90;
    }) ?? [],
    [expiringLeases],
  );

  const totalRiskLeases = distribution?.byRisk.reduce((s, r) => s + r._count, 0) ?? 0;

  if (summaryLoading) return <PageLoader />;
  if (summaryError) return <ErrorState onRetry={() => refetchSummary()} />;

  const isEmpty = summary && summary.properties.total === 0 && summary.leases.active === 0;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">
      <OnboardingCard />

      {isEmpty && <WelcomeScreen />}

      {!isEmpty && <WhatChangedPanel />}

      {!isEmpty && <TodayHub />}

      {!isEmpty && canAccess('executive_brief') && <ExecutiveBriefCard />}

      {!isEmpty && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

          <div className="flex flex-col gap-4 min-w-0">

            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {kpis.map(kpi => (
                <button key={kpi.label} onClick={() => navigate(kpi.href)}
                  className="rounded-xl border border-surface-400/50 bg-surface-100 px-4 py-3 text-left hover:bg-surface-200/60 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xl font-bold tabular-nums leading-none ${kpi.color}`}>{kpi.value}</span>
                    {kpi.trend !== undefined && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${kpi.trend >= 0 ? 'text-success' : 'text-danger'}`}>
                        {kpi.trend >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                        {Math.abs(kpi.trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">{kpi.label}</p>
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-stretch divide-x divide-surface-400/40 rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
              {kpis.map(kpi => (
                <button key={kpi.label} onClick={() => navigate(kpi.href)}
                  className="flex flex-1 flex-col gap-0.5 px-4 py-3 hover:bg-surface-200/60 transition-colors min-w-0 text-left">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-lg font-bold tabular-nums leading-none truncate ${kpi.color}`}>{kpi.value}</span>
                    {kpi.trend !== undefined && (
                      <span className={`shrink-0 flex items-center gap-0.5 text-[10px] font-semibold ${kpi.trend >= 0 ? 'text-success' : 'text-danger'}`}>
                        {kpi.trend >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                        {Math.abs(kpi.trend).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 truncate">{kpi.label}</span>
                  {kpi.sub && <span className={`text-[10px] font-medium truncate ${kpi.subColor}`}>{kpi.sub}</span>}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden divide-y divide-surface-400/30">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-200/40">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-brand-400" />
                  <span className="text-xs font-semibold text-slate-300">Action Feed</span>
                  {feedItems.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {feedItems.length} item{feedItems.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/queue')}
                  className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Full queue →
                </button>
              </div>

              {feedItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <CheckCircle2 className="h-7 w-7 text-success/40" />
                  <p className="text-sm font-medium text-slate-400">All clear</p>
                  <p className="text-xs text-slate-600">No items requiring attention right now</p>
                </div>
              ) : (
                feedItems.map(item => {
                  const dot = item.severity === 'critical' ? 'bg-danger' : item.severity === 'warning' ? 'bg-warning' : 'bg-brand-400';
                  const border = item.severity === 'critical' ? 'border-l-danger' : item.severity === 'warning' ? 'border-l-warning' : 'border-l-brand-400';
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 border-l-2 text-left hover:bg-surface-200/40 transition-colors ${border}`}
                    >
                      <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 leading-snug">{item.message}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.context}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {item.value && (
                          <span className="text-xs font-bold tabular-nums text-slate-300">{item.value}</span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {renewals31to90.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-400" />
                    <CardTitle>Upcoming Renewals</CardTitle>
                  </div>
                  <button
                    onClick={() => navigate('/leases')}
                    className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
                  >
                    View all →
                  </button>
                </CardHeader>
                <div className="divide-y divide-surface-400/30">
                  {renewals31to90.slice(0, 5).map(lease => {
                    const days = daysUntil(lease.endDate);
                    const urgencyColor = days <= 60 ? 'text-warning' : 'text-slate-400';
                    const urgencyBg = days <= 60 ? 'bg-warning/10 border-warning/20' : 'bg-surface-300/50 border-surface-400/40';
                    return (
                      <button
                        key={lease.id}
                        onClick={() => navigate(`/leases/${lease.id}`)}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors group text-left"
                      >
                        <div className={`shrink-0 rounded-lg border px-2 py-1 text-center min-w-[44px] ${urgencyBg}`}>
                          <p className={`text-sm font-bold tabular-nums leading-none ${urgencyColor}`}>{days}</p>
                          <p className={`text-[10px] opacity-80 ${urgencyColor}`}>days</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors">
                            {lease.tenant.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{lease.property.name}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-slate-300 tabular-nums">{compactCurrency(Number(lease.baseRent))}/mo</p>
                          <p className="text-xs text-slate-500">{formatDate(lease.endDate)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {canAccess('health_score') && <HealthScoreCard />}

            {performance && performance.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-brand-400" />
                    <CardTitle>Property Performance</CardTitle>
                  </div>
                  <button
                    onClick={() => navigate('/properties')}
                    className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
                  >
                    View all →
                  </button>
                </CardHeader>
                <div className="divide-y divide-surface-400/30">
                  {performance.slice(0, 4).map(p => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/properties/${p.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors group"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-300 text-[10px] font-bold text-slate-400">
                        {p.code.slice(0, 3)}
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-medium text-slate-200 group-hover:text-brand-300 transition-colors">{p.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-400/40">
                            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500/70" style={{ width: `${p.occupancyRate}%` }} />
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">{p.occupancyRate}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-fg tabular-nums">{compactCurrency(p.monthlyRevenue)}</p>
                        <p className={`text-[10px] tabular-nums ${
                          p.revenueDeltaPct == null ? 'text-slate-500' : p.revenueDeltaPct >= 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {p.revenueDeltaPct == null
                            ? `${p.activeLeases} leases`
                            : `${p.revenueDeltaPct >= 0 ? '+' : ''}${p.revenueDeltaPct}%`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-0.5">
                  <CardTitle>Revenue Trend</CardTitle>
                  <span className="text-[10px] text-slate-600">Click a month to see its records</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366f1]" />Revenue
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#10b981]" />Net
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {TREND_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTrendMonths(opt.value)}
                      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        trendMonths === opt.value
                          ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                          : 'text-slate-500 border border-transparent hover:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardBody className="pt-2 pb-3 px-3">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={trend ?? []} margin={{ top: 8, right: 4, left: -20, bottom: 0 }} className="cursor-pointer" onClick={(s) => drillToFinanceMonth(s?.activeLabel)}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.brand} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={c.brand} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.success} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={c.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} strokeOpacity={0.7} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: c.axis, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      dy={4}
                    />
                    <YAxis
                      tick={{ fill: c.axis, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => compactCurrency(v)}
                      width={44}
                    />
                    <Tooltip
                      contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 10, fontSize: 11, color: c.tooltipText, padding: '8px 12px' }}
                      labelStyle={{ color: c.tooltipLabel, marginBottom: 4, fontWeight: 600 }}
                      formatter={(v: number, name: string) => [formatCurrency(v), name]}
                      cursor={{ stroke: c.brand, strokeWidth: 1, strokeDasharray: '4 2' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={c.brand} strokeWidth={2} fill="url(#revGrad)" name="Revenue" dot={false} activeDot={{ r: 4, fill: c.brand, stroke: c.tooltipBg, strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="net" stroke={c.success} strokeWidth={1.5} fill="url(#netGrad)" name="Net Income" dot={false} activeDot={{ r: 3, fill: c.success, stroke: c.tooltipBg, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {distribution && totalRiskLeases > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Lease Risk</CardTitle>
                  <span className="text-xs text-slate-500">{totalRiskLeases} active</span>
                </CardHeader>
                <CardBody className="flex flex-col gap-2.5">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(risk => {
                    const colorClass = risk === 'CRITICAL' ? 'text-danger' : risk === 'HIGH' ? 'text-warning' : risk === 'MEDIUM' ? 'text-yellow-400' : 'text-success';
                    const dotClass = risk === 'CRITICAL' ? 'bg-danger' : risk === 'HIGH' ? 'bg-warning' : risk === 'MEDIUM' ? 'bg-yellow-400' : 'bg-success';
                    const count = distribution.byRisk.find(r => r.renewalRisk === risk)?._count ?? 0;
                    const pct = totalRiskLeases > 0 ? Math.round((count / totalRiskLeases) * 100) : 0;
                    return (
                      <button
                        key={risk}
                        onClick={() => navigate(`/leases?risk=${risk}`)}
                        className="flex items-center justify-between rounded-lg px-1 py-0.5 hover:bg-surface-200/40 transition-colors"
                      >
                        <span className={`flex items-center gap-1.5 text-xs ${colorClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                          {risk}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">
                          {count} <span className="text-slate-600">({pct}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </CardBody>
              </Card>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

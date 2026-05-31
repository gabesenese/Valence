import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Building2, FileText, TrendingUp, AlertTriangle, DollarSign, Users,
  ArrowUp, ArrowDown, CheckCircle2, ChevronRight, Calendar, Activity,
  Zap,
} from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { alertsService } from '@/services/alerts.service';
import { leasesService } from '@/services/leases.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, compactCurrency, formatRelative, daysUntil, formatDate } from '@/utils/format';
import { useAuthStore } from '@/state/auth.store';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const TREND_OPTIONS = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];


export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [trendMonths, setTrendMonths] = useState(12);

  const { data: summary, isLoading: summaryLoading } = useQuery({
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

  const { data: alertsData } = useQuery({
    queryKey: ['alerts', { status: 'OPEN', limit: 5 }],
    queryFn: () => alertsService.getAlerts({ status: 'OPEN', limit: 5 }),
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

  if (summaryLoading) return <PageLoader />;

  const riskPieData = distribution?.byRisk.map((r) => ({
    name: r.renewalRisk,
    value: r._count,
  })) ?? [];

  const latestNOI = trend && trend.length > 0 ? trend[trend.length - 1].net : null;

  const kpis = summary
    ? [
        {
          label: 'Active Properties',
          value: summary.properties.total,
          icon: Building2,
          color: 'text-brand-400',
          bg: 'bg-brand-600/10',
          href: '/properties',
        },
        {
          label: 'Active Leases',
          value: summary.leases.active,
          icon: FileText,
          color: 'text-success',
          bg: 'bg-success/10',
          sub: summary.leases.expiringIn30 > 0
            ? `${summary.leases.expiringIn30} expiring in 30d`
            : summary.leases.expiringIn90 > 0
            ? `${summary.leases.expiringIn90} expiring in 90d`
            : 'All stable',
          subColor: summary.leases.expiringIn30 > 0 ? 'text-danger' : summary.leases.expiringIn90 > 0 ? 'text-warning' : 'text-success',
          href: '/leases',
        },
        {
          label: 'Monthly Revenue',
          value: compactCurrency(summary.revenue.current),
          icon: DollarSign,
          color: 'text-success',
          bg: 'bg-success/10',
          trend: summary.revenue.growthPct,
          href: '/finance',
        },
        {
          label: 'Net Income',
          value: latestNOI != null ? compactCurrency(latestNOI) : '—',
          icon: TrendingUp,
          color: latestNOI != null && latestNOI >= 0 ? 'text-success' : 'text-danger',
          bg: latestNOI != null && latestNOI >= 0 ? 'bg-success/10' : 'bg-danger/10',
          sub: 'This month (NOI)',
          subColor: 'text-slate-500',
          href: '/finance',
        },
        {
          label: 'Occupancy Rate',
          value: `${summary.occupancy.rate}%`,
          icon: Users,
          color: summary.occupancy.rate >= 90 ? 'text-success' : summary.occupancy.rate >= 75 ? 'text-warning' : 'text-danger',
          bg: summary.occupancy.rate >= 90 ? 'bg-success/10' : summary.occupancy.rate >= 75 ? 'bg-warning/10' : 'bg-danger/10',
          sub: `${summary.occupancy.occupied}/${summary.occupancy.total} units`,
          subColor: 'text-slate-500',
          href: '/properties',
        },
        {
          label: 'Open Alerts',
          value: summary.alerts.open,
          icon: AlertTriangle,
          color: summary.alerts.critical > 0 ? 'text-danger' : summary.alerts.open > 0 ? 'text-warning' : 'text-success',
          bg: summary.alerts.critical > 0 ? 'bg-danger/10' : summary.alerts.open > 0 ? 'bg-warning/10' : 'bg-success/10',
          sub: summary.alerts.critical > 0 ? `${summary.alerts.critical} critical` : summary.alerts.open === 0 ? 'All clear' : 'No critical',
          subColor: summary.alerts.critical > 0 ? 'text-danger' : summary.alerts.open === 0 ? 'text-success' : 'text-slate-500',
          href: '/alerts',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          {getGreeting()}, {user?.firstName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">Portfolio intelligence overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            hover
            onClick={() => navigate(kpi.href)}
            className="relative overflow-hidden group"
          >
            <CardBody className="p-4">
              <div className="flex items-start justify-between">
                <div className={`rounded-lg p-2 ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                {kpi.trend !== undefined && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${kpi.trend >= 0 ? 'text-success' : 'text-danger'}`}>
                    {kpi.trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(kpi.trend).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-white tabular-nums">{kpi.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{kpi.label}</p>
                {kpi.sub && (
                  <p className={`mt-1 text-xs font-medium ${kpi.subColor}`}>{kpi.sub}</p>
                )}
              </div>
              <ChevronRight className="absolute right-3 bottom-3 h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Operational Insights */}
      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" />
              <CardTitle>Operational Insights</CardTitle>
            </div>
            <span className="text-xs text-slate-500">{insights.length} active insight{insights.length !== 1 ? 's' : ''}</span>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {insights.map((insight) => {
              const severityLeft = insight.severity === 'critical'
                ? 'border-l-danger bg-danger/5'
                : insight.severity === 'warning'
                ? 'border-l-warning bg-warning/5'
                : 'border-l-info bg-info/5';
              const valueColor = insight.severity === 'critical' ? 'text-danger' : insight.severity === 'warning' ? 'text-warning' : 'text-info';
              return (
                <button
                  key={insight.id}
                  onClick={() => navigate(insight.href)}
                  className={`flex w-full items-start gap-4 border-l-2 px-5 py-3.5 hover:brightness-110 transition-[filter] text-left ${severityLeft}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100">{insight.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{insight.context}</p>
                  </div>
                  {insight.value && (
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${valueColor}`}>{insight.value}</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 mt-0.5" />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>Revenue & Expenses</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#6366f1]" />
                  <span className="text-xs text-slate-400">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-0 w-4 border-t-2 border-dashed border-[#ef4444]" />
                  <span className="text-xs text-slate-400">Expenses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#10b981]/70" />
                  <span className="text-xs text-slate-400">Net Income</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {TREND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTrendMonths(opt.value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    trendMonths === opt.value
                      ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="pt-3">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend ?? []} margin={{ top: 10, right: 8, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="60%" stopColor="#6366f1" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e3a" vertical={false} strokeOpacity={0.7} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compactCurrency(v)}
                  width={52}
                />
                <Tooltip
                  contentStyle={{ background: '#0f0f1a', border: '1px solid #2d2d50', borderRadius: 10, fontSize: 12, color: '#e2e8f0', padding: '10px 14px' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}
                  itemStyle={{ color: '#e2e8f0', padding: '2px 0' }}
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                  name="Revenue"
                  dot={false}
                  activeDot={{ r: 5, fill: '#6366f1', stroke: '#1e1e32', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  fill="url(#netGrad)"
                  name="Net Income"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', stroke: '#1e1e32', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="url(#expGrad)"
                  name="Expenses"
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444', stroke: '#1e1e32', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Renewal risk distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Renewal Risk</CardTitle>
            <span className="text-xs text-slate-500">Active leases</span>
          </CardHeader>
          <CardBody className="flex flex-col items-center gap-4 pb-5">
            <div className="relative w-full">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={98}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {riskPieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={RISK_COLORS[entry.name] ?? '#6b7280'}
                        opacity={0.92}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f0f1a', border: '1px solid #2d2d50', borderRadius: 10, fontSize: 12, color: '#e2e8f0', padding: '10px 14px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number, name: string) => {
                      const total = riskPieData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                      return [`${value} leases (${pct}%)`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-white tabular-nums leading-none">
                  {riskPieData.reduce((s, d) => s + d.value, 0)}
                </p>
                <p className="mt-1 text-xs text-slate-400 tracking-wide uppercase">leases</p>
              </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-x-6 gap-y-2.5 px-1">
              {riskPieData.map((entry) => {
                const total = riskPieData.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                return (
                  <button
                    key={entry.name}
                    onClick={() => navigate(`/leases?risk=${entry.name}`)}
                    className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: RISK_COLORS[entry.name] ?? '#6b7280' }}
                    />
                    <span className="flex-1 text-left text-xs text-slate-400">{entry.name}</span>
                    <span className="tabular-nums text-xs font-semibold text-white">{entry.value}</span>
                    <span className="w-8 text-right tabular-nums text-xs text-slate-500">{pct}%</span>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Bottom row — 3 cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upcoming Renewals */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-400" />
              <CardTitle>Upcoming Renewals</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/leases')}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
              >
                View all →
              </button>
            </div>
          </CardHeader>

          {/* 30 / 90 day bucket strip */}
          <div className="grid grid-cols-2 border-b border-surface-400/30 divide-x divide-surface-400/30">
            <div className="flex flex-col items-center py-3">
              <p className={`text-2xl font-bold tabular-nums ${
                (summary?.leases.expiringIn30 ?? 0) > 0 ? 'text-danger' : 'text-slate-500'
              }`}>
                {summary?.leases.expiringIn30 ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Expiring ≤ 30 days</p>
            </div>
            <div className="flex flex-col items-center py-3">
              <p className={`text-2xl font-bold tabular-nums ${
                (summary?.leases.expiringIn90 ?? 0) > 0 ? 'text-warning' : 'text-slate-500'
              }`}>
                {summary?.leases.expiringIn90 ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Expiring ≤ 90 days</p>
            </div>
          </div>

          <div className="divide-y divide-surface-400/30">
            {expiringLeases?.data.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-8">
                <CheckCircle2 className="h-7 w-7 text-success/50" />
                <p className="text-sm font-medium text-slate-400">No upcoming expirations</p>
                <p className="text-xs text-slate-600">All leases stable beyond 90 days</p>
              </div>
            ) : (
              expiringLeases?.data.map((lease) => {
                const days = daysUntil(lease.endDate);
                const urgencyColor = days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-slate-400';
                const urgencyBg = days <= 30 ? 'bg-danger/10 border-danger/20' : days <= 60 ? 'bg-warning/10 border-warning/20' : 'bg-surface-300/50 border-surface-400/40';
                return (
                  <button
                    key={lease.id}
                    onClick={() => navigate(`/leases/${lease.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors group text-left"
                  >
                    <div className={`shrink-0 rounded-lg border px-2 py-1 text-center min-w-[44px] ${urgencyBg}`}>
                      <p className={`text-sm font-bold tabular-nums leading-none ${urgencyColor}`}>{days}</p>
                      <p className={`text-[10px] ${urgencyColor} opacity-80`}>days</p>
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
              })
            )}
          </div>
        </Card>

        {/* Alert stream */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              <CardTitle>Active Alerts</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={summary && summary.alerts.critical > 0 ? 'danger' : 'warning'}>
                {summary?.alerts.open ?? 0} open
              </Badge>
              <button
                onClick={() => navigate('/alerts')}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
              >
                View all →
              </button>
            </div>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {alertsData?.data.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10">
                <CheckCircle2 className="h-8 w-8 text-success/50" />
                <p className="text-sm font-medium text-slate-400">All clear</p>
                <p className="text-xs text-slate-600">No open alerts at this time</p>
              </div>
            ) : (
              alertsData?.data.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => navigate('/alerts')}
                  className="flex w-full items-start gap-3 px-5 py-3.5 hover:bg-surface-200/40 transition-colors text-left"
                >
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'bg-danger' :
                    alert.severity === 'WARNING' ? 'bg-warning' : 'bg-info'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{alert.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{formatRelative(alert.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Property performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-400" />
              <CardTitle>Property Performance</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">This month</span>
              <button
                onClick={() => navigate('/properties')}
                className="text-xs text-slate-500 hover:text-brand-400 transition-colors"
              >
                View all →
              </button>
            </div>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {performance?.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/properties/${p.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-xs font-bold text-slate-400">
                  {p.code.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors">{p.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-400/40">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-500/70"
                        style={{ width: `${p.occupancyRate}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-slate-500 tabular-nums">{p.occupancyRate}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white tabular-nums">{compactCurrency(p.monthlyRevenue)}</p>
                  <p className="text-xs text-slate-500">{p.activeLeases} leases</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

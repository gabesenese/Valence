import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Building2, FileText, TrendingUp, AlertTriangle, DollarSign, Users,
  ArrowUp, ArrowDown, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { alertsService } from '@/services/alerts.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatPercent, compactCurrency, formatRelative } from '@/utils/format';
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

  if (summaryLoading) return <PageLoader />;

  const riskPieData = distribution?.byRisk.map((r) => ({
    name: r.renewalRisk,
    value: r._count,
  })) ?? [];

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
          sub: `${summary.leases.expiringIn30} expiring soon`,
          subColor: summary.leases.expiringIn30 > 0 ? 'text-warning' : 'text-slate-600',
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
          label: 'Occupancy Rate',
          value: `${summary.occupancy.rate}%`,
          icon: Users,
          color: 'text-brand-400',
          bg: 'bg-brand-600/10',
          sub: `${summary.occupancy.occupied}/${summary.occupancy.total} units`,
          subColor: 'text-slate-600',
          href: '/properties',
        },
        {
          label: 'Open Alerts',
          value: summary.alerts.open,
          icon: AlertTriangle,
          color: summary.alerts.critical > 0 ? 'text-danger' : 'text-warning',
          bg: summary.alerts.critical > 0 ? 'bg-danger/10' : 'bg-warning/10',
          sub: summary.alerts.critical > 0 ? `${summary.alerts.critical} critical` : 'No critical',
          subColor: summary.alerts.critical > 0 ? 'text-danger' : 'text-slate-600',
          href: '/alerts',
        },
        {
          label: 'Revenue Growth',
          value: formatPercent(summary.revenue.growthPct),
          icon: TrendingUp,
          color: summary.revenue.growthPct >= 0 ? 'text-success' : 'text-danger',
          bg: summary.revenue.growthPct >= 0 ? 'bg-success/10' : 'bg-danger/10',
          sub: 'vs last month',
          subColor: 'text-slate-600',
          href: '/analytics',
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
                  <p className={`mt-1 text-2xs ${kpi.subColor}`}>{kpi.sub}</p>
                )}
              </div>
              <ChevronRight className="absolute right-3 bottom-3 h-3.5 w-3.5 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardBody>
          </Card>
        ))}
      </div>

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
                  <span className="text-2xs text-slate-500">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-0 w-4 border-t-2 border-dashed border-[#ef4444]" />
                  <span className="text-2xs text-slate-500">Expenses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#10b981]/70" />
                  <span className="text-2xs text-slate-500">Net Income</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {TREND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTrendMonths(opt.value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
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
            <span className="text-xs text-slate-600">Active leases</span>
          </CardHeader>
          <CardBody className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {riskPieData.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {riskPieData.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => navigate(`/leases?risk=${entry.name}`)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <div className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[entry.name] ?? '#6b7280' }} />
                  <span className="text-2xs text-slate-500">{entry.name} <span className="text-slate-400 font-medium">{entry.value}</span></span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Alert stream */}
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={summary && summary.alerts.critical > 0 ? 'danger' : 'warning'}>
                {summary?.alerts.open ?? 0} open
              </Badge>
              <button
                onClick={() => navigate('/alerts')}
                className="text-2xs text-slate-600 hover:text-brand-400 transition-colors"
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
                  <span className="shrink-0 text-2xs text-slate-600">{formatRelative(alert.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Property performance */}
        <Card>
          <CardHeader>
            <CardTitle>Property Performance</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">This month</span>
              <button
                onClick={() => navigate('/properties')}
                className="text-2xs text-slate-600 hover:text-brand-400 transition-colors"
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
                className="flex w-full items-center gap-3 px-5 py-3 hover:bg-surface-200/40 transition-colors group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-xs font-bold text-slate-400">
                  {p.code.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-slate-200 group-hover:text-brand-300 transition-colors">{p.name}</p>
                  <p className="text-2xs text-slate-600">{p.occupancyRate}% occupied</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white tabular-nums">{compactCurrency(p.monthlyRevenue)}</p>
                  <p className="text-2xs text-slate-600">{p.activeLeases} leases</p>
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

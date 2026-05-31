import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Building2, FileText, TrendingUp, AlertTriangle, DollarSign, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { analyticsService } from '@/services/analytics.service';
import { alertsService } from '@/services/alerts.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatPercent, compactCurrency, formatRelative } from '@/utils/format';
import { useAuthStore } from '@/state/auth.store';

const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};


export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: analyticsService.getSummary,
  });

  const { data: trend } = useQuery({
    queryKey: ['analytics', 'revenue-trend'],
    queryFn: () => analyticsService.getRevenueTrend(12),
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
        },
        {
          label: 'Active Leases',
          value: summary.leases.active,
          icon: FileText,
          color: 'text-success',
          bg: 'bg-success/10',
          sub: `${summary.leases.expiringIn30} expiring soon`,
          subColor: summary.leases.expiringIn30 > 0 ? 'text-warning' : 'text-slate-600',
        },
        {
          label: 'Monthly Revenue',
          value: compactCurrency(summary.revenue.current),
          icon: DollarSign,
          color: 'text-success',
          bg: 'bg-success/10',
          trend: summary.revenue.growthPct,
        },
        {
          label: 'Occupancy Rate',
          value: `${summary.occupancy.rate}%`,
          icon: Users,
          color: 'text-brand-400',
          bg: 'bg-brand-600/10',
          sub: `${summary.occupancy.occupied}/${summary.occupancy.total} units`,
          subColor: 'text-slate-600',
        },
        {
          label: 'Open Alerts',
          value: summary.alerts.open,
          icon: AlertTriangle,
          color: summary.alerts.critical > 0 ? 'text-danger' : 'text-warning',
          bg: summary.alerts.critical > 0 ? 'bg-danger/10' : 'bg-warning/10',
          sub: summary.alerts.critical > 0 ? `${summary.alerts.critical} critical` : 'No critical',
          subColor: summary.alerts.critical > 0 ? 'text-danger' : 'text-slate-600',
        },
        {
          label: 'Revenue Growth',
          value: formatPercent(summary.revenue.growthPct),
          icon: TrendingUp,
          color: summary.revenue.growthPct >= 0 ? 'text-success' : 'text-danger',
          bg: summary.revenue.growthPct >= 0 ? 'bg-success/10' : 'bg-danger/10',
          sub: 'vs last month',
          subColor: 'text-slate-600',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Good morning, {user?.firstName}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">Portfolio intelligence overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="relative overflow-hidden">
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
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Expenses — 12 Months</CardTitle>
            <span className="text-xs text-slate-600">Net income trending</span>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => compactCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={1.5} fill="url(#expGrad)" name="Expenses" strokeDasharray="4 2" />
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
                <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {riskPieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[entry.name] ?? '#6b7280' }} />
                  <span className="text-2xs text-slate-500">{entry.name} <span className="text-slate-400 font-medium">{entry.value}</span></span>
                </div>
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
            <Badge variant={summary && summary.alerts.critical > 0 ? 'danger' : 'warning'}>
              {summary?.alerts.open ?? 0} open
            </Badge>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {alertsData?.data.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-600">No open alerts</p>
            )}
            {alertsData?.data.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-200/40 transition-colors">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                  alert.severity === 'CRITICAL' ? 'bg-danger' :
                  alert.severity === 'WARNING' ? 'bg-warning' : 'bg-info'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{alert.description}</p>
                </div>
                <span className="shrink-0 text-2xs text-slate-600">{formatRelative(alert.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Property performance */}
        <Card>
          <CardHeader>
            <CardTitle>Property Performance</CardTitle>
            <span className="text-xs text-slate-600">This month</span>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {performance?.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-200/40 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300 text-xs font-bold text-slate-400">
                  {p.code.slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{p.name}</p>
                  <p className="text-2xs text-slate-600">{p.occupancyRate}% occupied</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-white tabular-nums">{compactCurrency(p.monthlyRevenue)}</p>
                  <p className="text-2xs text-slate-600">{p.activeLeases} leases</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { analyticsService } from '@/services/analytics.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { compactCurrency, formatCurrency } from '@/utils/format';

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#6366f1', '#3b82f6'];

export default function AnalyticsPage() {
  const { data: trend, isLoading } = useQuery({
    queryKey: ['analytics', 'revenue-trend', 12],
    queryFn: () => analyticsService.getRevenueTrend(12),
  });

  const { data: performance } = useQuery({
    queryKey: ['analytics', 'property-performance'],
    queryFn: analyticsService.getPropertyPerformance,
  });

  const { data: distribution } = useQuery({
    queryKey: ['analytics', 'lease-distribution'],
    queryFn: analyticsService.getLeaseDistribution,
  });

  if (isLoading) return <PageLoader />;

  const statusPie = distribution?.byStatus.map(s => ({ name: s.status, value: s._count })) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Analytics</h1>
        <p className="mt-0.5 text-sm text-slate-500">Portfolio performance & operational intelligence</p>
      </div>

      {/* Revenue vs Net */}
      <Card>
        <CardHeader>
          <CardTitle>Net Income Trend — 12 Months</CardTitle>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
              <Tooltip
                contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Area type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} fill="url(#netGrad)" name="Net Income" />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Property performance bar */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Property Revenue Ranking</CardTitle></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={performance ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
                <YAxis type="category" dataKey="code" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="monthlyRevenue" name="Monthly Revenue" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Lease status distribution */}
        <Card>
          <CardHeader><CardTitle>Lease Status</CardTitle></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                  {statusPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {statusPie.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-2xs text-slate-500">{s.name} <span className="text-slate-400">{s.value}</span></span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Occupancy table */}
      {performance && (
        <Card>
          <CardHeader>
            <CardTitle>Occupancy by Property</CardTitle>
          </CardHeader>
          <div className="divide-y divide-surface-400/30">
            {performance.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-24 text-sm font-medium text-slate-400 font-mono">{p.code}</span>
                <span className="flex-1 truncate text-sm text-slate-300">{p.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-1.5 rounded-full bg-surface-400">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${Math.min(100, p.occupancyRate)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-white w-12 text-right tabular-nums">{p.occupancyRate}%</span>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums w-20 text-right">{compactCurrency(p.monthlyRevenue)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

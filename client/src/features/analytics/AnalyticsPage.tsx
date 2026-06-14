import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { analyticsService } from '@/services/analytics.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { PageLoader } from '@/components/ui/Spinner';
import { compactCurrency, formatCurrency } from '@/utils/format';

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

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
  const maxRevenue = Math.max(...(performance?.map(p => p.monthlyRevenue) ?? [1]));

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">

        {/* LEFT: main charts */}
        <div className="flex flex-col gap-4 min-w-0">

          {/* Net Income Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Net Income Trend</CardTitle>
              <span className="text-[10px] text-slate-500">12 months</span>
            </CardHeader>
            <CardBody className="pt-2 pb-3 px-3">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend ?? []} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactCurrency(v)} width={44} />
                  <Tooltip
                    contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }}
                    formatter={(v: number) => [formatCurrency(v), 'Net Income']}
                  />
                  <Area type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} fill="url(#netGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: '#1e1e32', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Occupancy by Property */}
          {performance && performance.length > 0 && (
            <div className="rounded-xl border border-surface-400/30 overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-400/40">
                <span className="text-sm font-semibold text-white">Occupancy by Property</span>
              </div>
              <div className="divide-y divide-surface-400/30">
                {performance.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                    <span className="hidden w-20 shrink-0 text-xs font-medium text-slate-500 font-mono truncate sm:block">{p.code}</span>
                    <span className="flex-1 truncate text-sm text-slate-300">{p.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden w-24 h-1.5 rounded-full bg-surface-400 sm:block">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-[width]"
                          style={{ width: `${Math.min(100, p.occupancyRate)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white w-10 text-right tabular-nums">{p.occupancyRate}%</span>
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums w-14 text-right shrink-0">{compactCurrency(p.monthlyRevenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: context sidebar */}
        <div className="flex flex-col gap-4">

          {/* Property Revenue Ranking — compact list */}
          {performance && performance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Ranking</CardTitle>
                <span className="text-[10px] text-slate-500">This month</span>
              </CardHeader>
              <div className="divide-y divide-surface-400/30">
                {performance.map((p, i) => {
                  const pct = maxRevenue > 0 ? (p.monthlyRevenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-4 shrink-0 text-[10px] font-bold text-slate-600 tabular-nums">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">{p.name}</p>
                        <div className="mt-1 h-1 rounded-full bg-surface-400/40 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500/70" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-white tabular-nums">{compactCurrency(p.monthlyRevenue)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Lease Status */}
          {statusPie.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lease Status</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col items-center gap-3 pb-4">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={statusPie} cx="50%" cy="50%" innerRadius={40} outerRadius={64} paddingAngle={3} dataKey="value" stroke="none">
                      {statusPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 11, color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full flex flex-col gap-1.5 px-1">
                  {statusPie.map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {s.name}
                      </span>
                      <span className="text-xs font-semibold text-white tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

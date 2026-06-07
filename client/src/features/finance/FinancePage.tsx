import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react';
import { financeService } from '@/services/finance.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency, formatDate, compactCurrency } from '@/utils/format';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  RECONCILED: 'success',
  PENDING: 'info',
  FLAGGED: 'danger',
  DISPUTED: 'warning',
  VOID: 'neutral',
};

export default function FinancePage() {
  const [recordsPage, setRecordsPage] = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => financeService.getSummary(),
  });

  const { data: trend } = useQuery({
    queryKey: ['finance', 'trend'],
    queryFn: () => financeService.getTrend(undefined, 12),
  });

  const { data: records } = useQuery({
    queryKey: ['finance', 'records', recordsPage],
    queryFn: () => financeService.getRecords({ limit: 20, page: recordsPage }),
    placeholderData: (prev) => prev,
  });

  if (summaryLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Financial Intelligence"
        description="Revenue tracking, expense monitoring & discrepancy detection"
      />

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: 'Total Revenue', value: compactCurrency(summary.totalRevenue), icon: DollarSign, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Total Expenses', value: compactCurrency(summary.totalExpenses), icon: TrendingDown, color: 'text-danger', bg: 'bg-danger/10' },
            { label: 'Net Income', value: compactCurrency(summary.netIncome), icon: TrendingUp, color: 'text-brand-400', bg: 'bg-brand-600/10' },
            { label: 'Flagged Records', value: summary.flaggedRecords, icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Pending Review', value: summary.pendingRecords, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <div className={`mb-3 w-fit rounded-lg p-2 ${k.bg}`}>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{k.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses — 12 Months</CardTitle>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e32" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => compactCurrency(v)} />
              <Tooltip
                contentStyle={{ background: '#13131e', border: '1px solid #252540', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
              <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* Records table */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Records</CardTitle>
          <span className="text-xs text-slate-600">{records?.meta.total ?? 0} total</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-400/40">
                {['Property', 'Type', 'Amount', 'Period', 'Due Date', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-400/30">
              {records?.data.map((r) => (
                <tr key={r.id} className="hover:bg-surface-200/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-300">{r.property.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.type === 'REVENUE' ? 'success' : 'danger'}>{r.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white tabular-nums">
                    <span className={r.type === 'EXPENSE' ? 'text-danger/90' : 'text-success'}>
                      {r.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(r.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(r.periodStart)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records && records.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-3">
            <p className="text-xs text-slate-600">{records.meta.total} total records</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                disabled={!records.meta.hasPrev}
                className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600">{recordsPage} / {records.meta.pages}</span>
              <button
                onClick={() => setRecordsPage((p) => p + 1)}
                disabled={!records.meta.hasNext}
                className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { financeService } from '@/services/finance.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, compactCurrency } from '@/utils/format';
import { useChartColors } from '@/hooks/useChartColors';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  RECONCILED: 'success',
  PENDING:    'info',
  FLAGGED:    'danger',
  DISPUTED:   'warning',
  VOID:       'neutral',
};

export default function FinancePage() {
  const c = useChartColors();
  const navigate = useNavigate();
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

  const netIncomeColor = summary && summary.netIncome >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

      {/* KPI Strip — grid on mobile, horizontal strip on sm+ */}
      {summary && (() => {
        const kpis = [
          { label: 'Total Revenue',   value: compactCurrency(summary.totalRevenue),  color: 'text-success' },
          { label: 'Total Expenses',  value: compactCurrency(summary.totalExpenses), color: 'text-danger'  },
          { label: 'Net Income',      value: compactCurrency(summary.netIncome),     color: netIncomeColor },
          { label: 'Flagged Records', value: summary.flaggedRecords,                 color: 'text-warning' },
          { label: 'Pending Review',  value: summary.pendingRecords,                 color: 'text-info'    },
        ];
        return (
          <>
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              {kpis.map((kpi, i) => (
                <div
                  key={kpi.label}
                  className={`rounded-xl border border-surface-400/50 bg-surface-100 px-4 py-3${i === kpis.length - 1 && kpis.length % 2 !== 0 ? ' col-span-2 max-w-[50%]' : ''}`}
                >
                  <p className={`text-xl font-bold tabular-nums leading-none ${kpi.color}`}>{kpi.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{kpi.label}</p>
                </div>
              ))}
            </div>
            <div className="hidden sm:flex items-stretch divide-x divide-surface-400/40 rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
              {kpis.map(kpi => (
                <div key={kpi.label} className="flex flex-1 flex-col gap-0.5 px-5 py-3 min-w-0">
                  <span className={`text-lg font-bold tabular-nums leading-none ${kpi.color}`}>{kpi.value}</span>
                  <span className="text-[10px] text-slate-500 truncate">{kpi.label}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Two-column body */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">

        {/* LEFT: Financial Records table */}
        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-400/40">
            <span className="text-sm font-semibold text-fg">Financial Records</span>
            <span className="text-xs text-slate-600">{records?.meta.total ?? 0} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Property', 'Type', 'Amount', 'Period', 'Due Date', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      {h}
                    </th>
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
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums">
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

            {records?.data.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-9 w-9 text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-300">No financial records yet</p>
                <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                  Once you have leases, log revenue and expenses here to unlock analytics and NOI tracking.
                </p>
                <button
                  onClick={() => navigate('/import')}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Import financial data
                </button>
              </div>
            )}
          </div>

          {records && records.meta.pages > 1 && (
            <div className="flex items-center justify-between border-t border-surface-400/40 px-5 py-3">
              <p className="text-xs text-slate-600">{records.meta.total} total records</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                  disabled={!records.meta.hasPrev}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-fg transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-600">{recordsPage} / {records.meta.pages}</span>
                <button
                  onClick={() => setRecordsPage((p) => p + 1)}
                  disabled={!records.meta.hasNext}
                  className="rounded px-3 py-1.5 text-xs text-slate-400 disabled:opacity-30 hover:bg-surface-300 hover:text-fg transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Revenue vs Expenses chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Revenue vs Expenses</CardTitle>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#6366f1]" />Revenue
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ef4444]" />Expenses
                </span>
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-2 pb-3 px-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend ?? []} margin={{ top: 5, right: 4, left: -20, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => compactCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 11, color: c.tooltipText }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="revenue" name="Revenue" fill={c.brand} radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="expenses" name="Expenses" fill={c.danger} radius={[3, 3, 0, 0]} maxBarSize={24} fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

      </div>
    </div>
  );
}

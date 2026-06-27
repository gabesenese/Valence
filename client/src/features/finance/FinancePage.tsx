import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FileText, Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { financeService, recordSourceLabel } from '@/services/finance.service';
import { RevenueAtRisk } from './RevenueAtRisk';
import { BudgetCard } from './BudgetCard';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, compactCurrency } from '@/utils/format';
import { useChartColors } from '@/hooks/useChartColors';
import { EXPENSE_CATEGORIES, categoryLabel } from '@valence/shared';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  RECONCILED: 'success',
  PENDING:    'info',
  FLAGGED:    'danger',
  DISPUTED:   'warning',
  VOID:       'neutral',
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabelToRange(label: string): { from: string; to: string } | null {
  const [mon, yearStr] = label.split(' ');
  const m = MONTH_ABBR.indexOf(mon);
  const year = Number(yearStr);
  if (m < 0 || !Number.isFinite(year)) return null;
  return {
    from: new Date(Date.UTC(year, m, 1, 0, 0, 0, 0)).toISOString(),
    to: new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999)).toISOString(),
  };
}

export default function FinancePage() {
  const c = useChartColors();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [recordsPage, setRecordsPage] = useState(1);

  const periodLabel = searchParams.get('period') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const category = searchParams.get('category') ?? undefined;

  function patchParams(patch: Record<string, string | undefined>) {
    setRecordsPage(1);
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  function selectMonth(label: string | undefined) {
    if (!label) return;
    const range = monthLabelToRange(label);
    if (!range) return;
    patchParams({ period: label, from: range.from, to: range.to });
  }

  function clearPeriod() {
    patchParams({ period: undefined, from: undefined, to: undefined });
  }

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => financeService.getSummary(),
  });

  const { data: trend } = useQuery({
    queryKey: ['finance', 'trend'],
    queryFn: () => financeService.getTrend(undefined, 12),
  });

  const { data: records } = useQuery({
    queryKey: ['finance', 'records', recordsPage, from, to, category],
    queryFn: () => financeService.getRecords({ limit: 20, page: recordsPage, from, to, category }),
    placeholderData: (prev) => prev,
  });

  const { data: breakdown } = useQuery({
    queryKey: ['finance', 'expense-breakdown', from, to],
    queryFn: () => financeService.getExpenseBreakdown({ from, to }),
  });

  const { data: expenseTrend } = useQuery({
    queryKey: ['finance', 'expense-trend'],
    queryFn: () => financeService.getExpenseTrend({ months: 6 }),
  });

  const { data: tenantProfit } = useQuery({
    queryKey: ['finance', 'tenant-profitability'],
    queryFn: () => financeService.getTenantProfitability(),
  });

  const { data: forecast } = useQuery({
    queryKey: ['finance', 'forecast'],
    queryFn: () => financeService.getNoiForecast({ months: 6 }),
  });

  if (summaryLoading) return <PageLoader />;

  const netIncomeColor = summary && summary.netIncome >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

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

      <RevenueAtRisk />

      {forecast && forecast.points.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>NOI Forecast</CardTitle>
              <span className="text-[10px] text-slate-600">
                Active-lease rent (steps down as leases expire) − {compactCurrency(forecast.monthlyExpense)}/mo average expenses
              </span>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold tabular-nums ${forecast.projectedAnnualNet >= 0 ? 'text-success' : 'text-danger'}`}>{compactCurrency(forecast.projectedAnnualNet)}</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">Projected annual NOI</p>
            </div>
          </CardHeader>
          <CardBody className="pt-2 pb-3 px-2">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forecast.points} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => compactCurrency(v)} />
                <Tooltip
                  contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 11, color: c.tooltipText }}
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                />
                <Bar dataKey="revenue" name="Revenue" fill={c.brand} radius={[3, 3, 0, 0]} maxBarSize={28} fillOpacity={0.35} />
                <Bar dataKey="net" name="Net (NOI)" fill={c.success} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">

        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-400/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fg">Financial Records</span>
              {periodLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-300">
                  {periodLabel}
                  <button onClick={clearPeriod} className="text-brand-300/70 hover:text-brand-200" aria-label="Clear period filter">×</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={category ?? ''}
                onChange={(e) => patchParams({ category: e.target.value || undefined })}
                className="rounded-lg border border-surface-400/40 bg-surface-200 px-2.5 py-1 text-xs text-slate-300 outline-none focus:border-brand-500/50 cursor-pointer"
                aria-label="Filter by expense category"
              >
                <option value="">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <span className="text-xs text-slate-600">{records?.meta.total ?? 0} total</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Property', 'Type', 'Category', 'Amount', 'Period', 'Due Date', 'Status'].map(h => (
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
                    <td className="px-4 py-3 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        {categoryLabel(r.category)}
                        {recordSourceLabel(r) && (
                          <span className="rounded border border-brand-500/25 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-300">
                            {recordSourceLabel(r)}
                          </span>
                        )}
                      </span>
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

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-0.5">
              <CardTitle>Revenue vs Expenses</CardTitle>
              <span className="text-[10px] text-slate-600">Click a month to see its records</span>
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
              <BarChart
                data={trend ?? []}
                margin={{ top: 5, right: 4, left: -20, bottom: 0 }}
                barGap={3}
                className="cursor-pointer"
                onClick={(s) => selectMonth(s?.activeLabel)}
              >
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

        {breakdown && breakdown.categories.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-0.5">
                <CardTitle>Expenses by Category</CardTitle>
                <span className="text-[10px] text-slate-600">Click a category to filter the records</span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-slate-400">{compactCurrency(breakdown.totalExpenses)}</span>
            </CardHeader>
            <CardBody className="flex flex-col gap-2 pb-3">
              {breakdown.categories.map((row) => {
                const pct = breakdown.totalExpenses > 0 ? Math.round((row.total / breakdown.totalExpenses) * 100) : 0;
                const active = category === row.category;
                const filterable = row.category !== 'UNCATEGORIZED';
                const inner = (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">{categoryLabel(row.category)}</span>
                      <span className="text-xs font-semibold tabular-nums text-slate-300">
                        {compactCurrency(row.total)} <span className="text-slate-600">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-400/40 overflow-hidden">
                      <div className="h-full rounded-full bg-danger/70" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                );
                return filterable ? (
                  <button
                    key={row.category}
                    onClick={() => patchParams({ category: active ? undefined : row.category })}
                    className={`flex flex-col gap-1 rounded-lg px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-surface-200/50 ${active ? 'bg-surface-200/60 ring-1 ring-brand-500/30' : ''}`}
                    title={`Filter records by ${categoryLabel(row.category)}`}
                  >
                    {inner}
                  </button>
                ) : (
                  <div key={row.category} className="flex flex-col gap-1 px-2 py-1.5 -mx-2">
                    {inner}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}

        {expenseTrend && expenseTrend.categories.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-0.5">
                <CardTitle>Expense Trends</CardTitle>
                <span className="text-[10px] text-slate-600">Last {expenseTrend.months.length} months · latest vs prior average</span>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 pb-3">
              {expenseTrend.categories.map((row) => {
                const max = Math.max(...row.totals, 1);
                const delta = row.deltaPct;
                const deltaColor = delta == null ? 'text-slate-600' : delta > 0 ? 'text-danger' : delta < 0 ? 'text-success' : 'text-slate-500';
                const lastBar = delta != null && delta > 0 ? 'bg-danger/70' : delta != null && delta < 0 ? 'bg-success/70' : 'bg-brand-500/70';
                return (
                  <div key={row.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">{categoryLabel(row.category)}</span>
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold tabular-nums text-slate-300">{compactCurrency(row.latest)}</span>
                        {delta != null && (
                          <span className={`tabular-nums ${deltaColor}`}>{delta > 0 ? '▲' : delta < 0 ? '▼' : ''}{Math.abs(delta)}%</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-end gap-0.5 h-6">
                      {row.totals.map((t, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm ${i === row.totals.length - 1 ? lastBar : 'bg-surface-400/60'}`}
                          style={{ height: `${Math.max(6, (t / max) * 100)}%` }}
                          title={`${expenseTrend.months[i]}: ${compactCurrency(t)}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
        )}

      </div>

      {tenantProfit && tenantProfit.tenants.length > 0 && (
        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="flex flex-col gap-1 border-b border-surface-400/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-sm font-semibold text-fg">Tenant Profitability</span>
            </div>
            <span className="text-[10px] text-slate-600">
              Operating costs allocated {tenantProfit.basis === 'sqft' ? 'by leased square-foot share' : tenantProfit.basis === 'equal' ? 'evenly across leases' : 'by square-foot share (evenly where sqft is missing)'} · {tenantProfit.monthsAveraged}-month average expenses
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {['Tenant', 'Leases', 'Rent / mo', 'Allocated Cost / mo', 'Net / mo', 'Margin'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/30">
                {tenantProfit.tenants.map((t) => (
                  <tr key={t.tenantId} className="hover:bg-surface-200/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">{t.tenantName}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">{t.leaseCount}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-success">{formatCurrency(t.monthlyRent)}</td>
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-danger/90">-{formatCurrency(t.allocatedCost)}</td>
                    <td className={`px-4 py-3 text-sm font-bold tabular-nums ${t.net >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(t.net)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold tabular-nums ${t.marginPct >= 50 ? 'text-success' : t.marginPct >= 20 ? 'text-warning' : 'text-danger'}`}>{t.marginPct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BudgetCard />

    </div>
  );
}

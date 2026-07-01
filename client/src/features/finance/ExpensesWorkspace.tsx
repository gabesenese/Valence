import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Receipt, ArrowRight, Check, Zap, TrendingUp, ChevronDown } from 'lucide-react';
import { financeService } from '@/services/finance.service';
import { integrationsService } from '@/services/integrations.service';
import { compactCurrency } from '@/utils/format';
import { CountUp } from '@/components/ui/CountUp';
import { categoryLabel } from '@valence/shared';

const SEGMENT = ['bg-brand-500', 'bg-brand-400/70', 'bg-slate-400', 'bg-slate-500', 'bg-slate-600', 'bg-slate-700/70'];

const UNLOCKS = ['Spending breakdown by category', 'Savings opportunities', 'Budget tracking', 'Vendor insights'];

const LIFT = 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-surface-400/80';

export function ExpensesWorkspace() {
  const navigate = useNavigate();
  const [showAnomalies, setShowAnomalies] = useState(false);
  const { data: breakdown } = useQuery({ queryKey: ['finance', 'expense-breakdown'], queryFn: () => financeService.getExpenseBreakdown() });
  const { data: trend } = useQuery({ queryKey: ['finance', 'expense-trend'], queryFn: () => financeService.getExpenseTrend({ months: 6 }) });
  const { data: budgets } = useQuery({ queryKey: ['finance', 'budgets'], queryFn: () => financeService.getBudgets() });
  const { data: forecast } = useQuery({ queryKey: ['finance', 'forecast'], queryFn: () => financeService.getNoiForecast({ months: 6 }) });
  const { data: integrations } = useQuery({ queryKey: ['integrations'], queryFn: () => integrationsService.list() });

  const qbo = integrations?.find((i) => i.id === 'quickbooks');
  const qboConnected = qbo?.connection?.status === 'CONNECTED';
  const { data: mappingQueue } = useQuery({
    queryKey: ['mapping-queue', 'quickbooks'],
    queryFn: () => integrationsService.mappingQueue('quickbooks'),
    enabled: qboConnected,
  });
  const pendingMappings = qboConnected ? mappingQueue?.pendingTotal ?? 0 : 0;

  if (!breakdown) return null;

  const categories = breakdown.categories;
  const total = breakdown.totalExpenses;
  const catCount = categories.length;
  const largest = categories[0];
  const largestPct = largest && total > 0 ? Math.round((largest.total / total) * 100) : 0;
  const rich = catCount > 1;

  const budgetItems = budgets?.items ?? [];
  const overBudget = budgetItems.filter((b) => b.status === 'over');
  const trendUp = rich ? (trend?.categories ?? []).filter((c) => c.comparable && c.deltaPct != null && c.deltaPct >= 15) : [];

  type Opp = { key: string; category: string; title: string; detail: string; annualSaving: number };
  const opps: Opp[] = overBudget
    .map((b) => ({ key: `b-${b.category}`, category: b.category, title: `Bring ${categoryLabel(b.category)} back to budget`, detail: `${b.variancePct ?? 0}% over budget this month`, annualSaving: Math.round(Math.max(0, b.variance) * 12) }))
    .sort((a, b) => b.annualSaving - a.annualSaving);
  const savingsAvailable = opps.length > 0;
  const totalSaving = opps.reduce((s, o) => s + o.annualSaving, 0);

  const annualOpex = Math.round((forecast?.monthlyExpense ?? 0) * 12);
  const changes = rich ? (trend?.categories ?? []).filter((c) => c.comparable && c.deltaPct != null && Math.abs(c.deltaPct) >= 8).sort((a, b) => Math.abs(b.deltaPct!) - Math.abs(a.deltaPct!)).slice(0, 5) : [];

  const plural = pendingMappings === 1 ? '' : 's';
  const connState: 'mapping' | 'connected' | 'disconnected' = pendingMappings > 0 ? 'mapping' : qboConnected ? 'connected' : 'disconnected';

  const emptyState =
    connState === 'mapping'
      ? {
          title: `${pendingMappings} expense${plural} waiting to be mapped`,
          body: `QuickBooks is connected. ${pendingMappings} synced expense${plural} ${pendingMappings === 1 ? 'needs' : 'need'} a property before ${pendingMappings === 1 ? 'it appears' : 'they appear'} here. Map a tag once and every future sync resolves automatically.`,
          showUnlocks: false,
          primary: { label: 'Open Mapping Center', to: '/integrations#mapping-center' },
          secondary: { label: 'Create budgets', to: '/finance?tab=budgets' },
        }
      : connState === 'connected'
        ? {
            title: 'Not enough categorized data yet',
            body: 'QuickBooks is connected. Categorized spending will appear here as expenses sync and get mapped to properties. You’ll unlock:',
            showUnlocks: true,
            primary: { label: 'Create budgets', to: '/finance?tab=budgets' },
            secondary: { label: 'View integration', to: '/integrations' },
          }
        : {
            title: 'Not enough categorized data yet',
            body: 'Connect QuickBooks or set category budgets to surface overspending and optimization opportunities. You’ll unlock:',
            showUnlocks: true,
            primary: { label: 'Connect QuickBooks', to: '/integrations' },
            secondary: { label: 'Create budgets', to: '/finance?tab=budgets' },
          };

  const breakdownNote =
    connState === 'mapping'
      ? `${pendingMappings} QuickBooks expense${plural} ${pendingMappings === 1 ? 'is' : 'are'} waiting to be mapped to properties — map ${pendingMappings === 1 ? 'it' : 'them'} to reveal your real category breakdown.`
      : connState === 'connected'
        ? 'Everything is currently one category. Categories will appear as QuickBooks expenses sync and get mapped.'
        : 'Everything is currently one category. Connect QuickBooks or assign categories for a real breakdown of where your money goes.';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* LEFT — summary + savings */}
        <div className="flex flex-col gap-4">

          <div className={`rounded-2xl border border-surface-400/60 bg-surface-100 p-8 ${LIFT}`}>
            <div className="flex items-center gap-2 text-slate-500">
              <Receipt className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">Expenses</span>
            </div>
            <CountUp value={total} className="mt-6 block text-6xl font-bold tabular-nums text-fg" />
            <p className="mt-2 text-sm text-slate-500">in operating expenses to date</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {rich ? `${categoryLabel(largest.category)} is your largest cost at ${largestPct}% of spend.` : 'All spending is currently categorized as Operations.'}
            </p>
            <div className="mt-7 grid grid-cols-3 gap-2.5">
              <div className="rounded-xl bg-surface-200/30 px-3 py-3.5 text-center">
                <p className="text-2xl font-bold tabular-nums text-fg">{catCount}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">Categories</p>
              </div>
              <div className="rounded-xl bg-surface-200/30 px-3 py-3.5 text-center">
                <p className={`text-2xl font-bold tabular-nums ${budgetItems.length ? 'text-fg' : 'text-slate-600'}`}>{budgetItems.length || '—'}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{budgetItems.length ? 'Budgets' : 'No budgets'}</p>
              </div>
              <button
                type="button"
                disabled={trendUp.length === 0}
                onClick={() => setShowAnomalies((v) => !v)}
                className={`rounded-xl px-3 py-3.5 text-center transition-colors duration-150 disabled:cursor-default ${trendUp.length ? 'bg-warning/[0.08] ring-1 ring-warning/20 hover:bg-warning/[0.14]' : 'bg-surface-200/30'}`}
                aria-expanded={showAnomalies}
              >
                <p className={`text-2xl font-bold tabular-nums ${trendUp.length ? 'text-warning' : 'text-slate-600'}`}>{trendUp.length || '—'}</p>
                <span className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Anomalies
                  {trendUp.length > 0 && <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${showAnomalies ? 'rotate-180' : ''}`} />}
                </span>
              </button>
            </div>

            {showAnomalies && trendUp.length > 0 && (
              <div className="mt-4 flex flex-col gap-1 border-t border-surface-400/30 pt-3">
                {trendUp.map((c) => (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => navigate(`/finance?tab=ledger&category=${encodeURIComponent(c.category)}`)}
                    className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-200/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{categoryLabel(c.category)}</p>
                      <p className="text-xs text-slate-500">{compactCurrency(c.latest)}/mo · above {compactCurrency(c.priorAvg)} average</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-warning">
                      +{compactCurrency(c.latest - c.priorAvg)}
                      <ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-brand-300" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {savingsAvailable ? (
            <div className={`rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden ${LIFT}`}>
              <div className="flex items-center gap-2 border-b border-surface-400/30 px-4 py-2.5 text-slate-500">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Savings opportunities</span>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {opps.map((o) => (
                  <button key={o.key} type="button" onClick={() => navigate(`/finance?tab=ledger&category=${encodeURIComponent(o.category)}`)} className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-200/40">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-success">{compactCurrency(o.annualSaving)}<span className="ml-1 text-xs font-normal text-slate-500">/yr</span></p>
                      <p className="truncate text-sm text-slate-400">{o.title} · {o.detail}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-brand-300">Review<ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" /></span>
                  </button>
                ))}
              </div>
            </div>
          ) : rich ? (
            <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-6 ${LIFT}`}>
              <div className="flex items-center gap-2 text-slate-500">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Savings opportunities</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-fg">Set budgets to track savings</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Your spending is categorized across {catCount} categories{trendUp.length ? `, and ${trendUp.length} ${trendUp.length === 1 ? 'category is' : 'categories are'} running above ${trendUp.length === 1 ? 'its' : 'their'} usual level` : ''}. Add budgets and Valence will flag overspend and quantify how much you could save each year.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate('/finance?tab=budgets')} className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500">Create budgets</button>
                <button type="button" onClick={() => navigate('/finance?tab=ledger')} className="rounded-lg border border-surface-400/50 px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-surface-200/50">Review ledger</button>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-6 ${LIFT}`}>
              <div className="flex items-center gap-2 text-slate-500">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Savings opportunities</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-fg">{emptyState.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{emptyState.body}</p>
              {emptyState.showUnlocks && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {UNLOCKS.map((u) => (
                    <li key={u} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="text-xs text-slate-400">{u}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate(emptyState.primary.to)} className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500">{emptyState.primary.label}</button>
                <button type="button" onClick={() => navigate(emptyState.secondary.to)} className="rounded-lg border border-surface-400/50 px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-surface-200/50">{emptyState.secondary.label}</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — where money goes + what's changing */}
        <div className="flex flex-col gap-4">

          <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-6 ${LIFT}`}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Spending breakdown</span>
            {total > 0 ? (
              <>
                <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-400/30">
                  {categories.map((cat, i) => (
                    <div key={cat.category} className={SEGMENT[i % SEGMENT.length]} style={{ width: `${(cat.total / total) * 100}%` }} title={`${categoryLabel(cat.category)} ${Math.round((cat.total / total) * 100)}%`} />
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-1.5">
                  {categories.map((cat, i) => (
                    <button key={cat.category} type="button" onClick={() => navigate(`/finance?tab=ledger&category=${encodeURIComponent(cat.category)}`)} className="group flex items-center gap-3 text-left">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT[i % SEGMENT.length]}`} />
                      <span className="flex-1 truncate text-sm text-slate-300 group-hover:text-brand-300">{categoryLabel(cat.category)}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-300">{compactCurrency(cat.total)}</span>
                      <span className="w-10 text-right text-xs tabular-nums text-slate-500">{Math.round((cat.total / total) * 100)}%</span>
                    </button>
                  ))}
                </div>
                {!rich && (
                  <p className="mt-4 border-t border-surface-400/30 pt-3 text-xs leading-relaxed text-slate-500">
                    {breakdownNote}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No expenses recorded yet.</p>
            )}
          </div>

          <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-6 ${LIFT}`}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">What’s changing</span>
            {changes.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3">
                {changes.map((c) => {
                  const up = (c.deltaPct ?? 0) > 0;
                  const delta = c.latest - c.priorAvg;
                  return (
                    <div key={c.category} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">{categoryLabel(c.category)}</p>
                        <p className="text-xs text-slate-500">{compactCurrency(c.latest)}/mo · {up ? 'above' : 'below'} {compactCurrency(c.priorAvg)} average</p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${up ? 'text-danger' : 'text-success'}`}>{up ? '+' : '−'}{compactCurrency(Math.abs(delta))}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Month-over-month spending shifts appear here once you have categorized expenses across several months.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CONCLUSION — potential annual savings, full width */}
      {savingsAvailable ? (
        <div className={`rounded-2xl border border-success/10 bg-success/[0.06] p-7 sm:p-8 ${LIFT} hover:shadow-success/10`}>
          <div className="flex items-center gap-2 text-success/80">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Potential annual savings</span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <CountUp value={totalSaving} className="text-5xl font-bold tabular-nums text-success sm:text-6xl" />
            <span className="text-sm text-slate-500">/year</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Operating expenses could fall from {compactCurrency(annualOpex)} to {compactCurrency(Math.max(0, annualOpex - totalSaving))} by acting on the opportunities above.
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border border-surface-400/50 bg-surface-100 p-7 sm:p-8 ${LIFT}`}>
          <div className="flex items-center gap-2 text-slate-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Potential annual savings</span>
          </div>
          <p className="mt-3 text-3xl font-bold text-fg">One step away</p>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {rich ? 'Create your first budget to unlock savings estimates.' : 'Add categorized spending and a budget to unlock savings estimates.'}
          </p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            Valence compares actual spending against your targets to estimate how much you could save each year.
          </p>
          <button
            type="button"
            onClick={() => navigate('/finance?tab=budgets')}
            className="group mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-500"
          >
            Create budget
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
}

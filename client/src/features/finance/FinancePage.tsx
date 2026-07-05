import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { financeService, type MetricDelta } from '@/services/finance.service';
import { FinancialIntelligence } from './FinancialIntelligence';
import { ForecastWorkspace } from './ForecastWorkspace';
import { ExpensesWorkspace } from './ExpensesWorkspace';
import { ProfitabilityWorkspace } from './ProfitabilityWorkspace';
import { LedgerWorkspace } from './LedgerWorkspace';
import { WhatChangedPanel } from '../changes/WhatChangedPanel';
import { BudgetCard } from './BudgetCard';
import { PageTip } from '../onboarding/PageTip';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { compactCurrency } from '@/utils/format';

type TabId = 'overview' | 'forecast' | 'ledger' | 'expenses' | 'profitability' | 'budgets';

const TAB_TIP: Partial<Record<TabId, string>> = {
  overview: 'finance',
  forecast: 'forecast',
  expenses: 'expenses',
  profitability: 'profitability',
  ledger: 'ledger',
  budgets: 'budgets',
};
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'budgets', label: 'Budgets' },
];

const KPI_STATUS_WORD: Record<'ok' | 'warn' | 'bad', string> = { ok: 'Healthy', warn: 'Watch', bad: 'Attention' };
const KPI_STATUS_COLOR: Record<'ok' | 'warn' | 'bad', string> = { ok: 'text-success', warn: 'text-warning', bad: 'text-danger' };

function DeltaChip({ delta }: { delta?: MetricDelta }) {
  if (!delta || !delta.comparable || delta.deltaPct == null || delta.direction === 'flat') return null;
  const color = delta.sentiment === 'good' ? 'text-success' : delta.sentiment === 'bad' ? 'text-danger' : 'text-slate-500';
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
      {delta.direction === 'up' ? '▲' : '▼'}{Math.abs(delta.deltaPct)}%
    </span>
  );
}


export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const tab = (searchParams.get('tab') as TabId) ?? 'overview';

  function setTab(id: TabId) {
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next);
  }

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => financeService.getSummary(),
  });

  const { data: intelligence } = useQuery({
    queryKey: ['finance', 'intelligence'],
    queryFn: () => financeService.getIntelligence(),
  });

  const { data: lateFee } = useQuery({
    queryKey: ['finance', 'late-fee-forecast'],
    queryFn: () => financeService.getLateFeeForecast(),
  });

  if (summaryLoading) return <PageLoader />;
  if (summaryError) return <ErrorState onRetry={() => refetchSummary()} />;

  const metricByKey = new Map((intelligence?.metrics ?? []).map((m) => [m.key, m]));
  const netIncomeColor = summary && summary.netIncome >= 0 ? 'text-success' : 'text-danger';

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

      <div className="flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-surface-400/40">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={tab === t.id ? activeTabRef : undefined}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-brand-500 text-fg'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {TAB_TIP[tab] && <PageTip key={tab} tipKey={TAB_TIP[tab]!} anchorRef={activeTabRef} />}

      {tab === 'overview' && (
        <>
          <FinancialIntelligence />

          {summary && (() => {
            const atRiskHighlight = intelligence?.highlights.find((h) => h.kind === 'REVENUE_AT_RISK');
            const reviewCount = summary.flaggedRecords + summary.pendingRecords;
            const atRiskCount = atRiskHighlight?.count ?? 0;
            const overdue = lateFee?.overdueBalance ?? 0;
            const fStatus = (k: string): 'ok' | 'warn' | 'bad' => intelligence?.health.factors.find((f) => f.key === k)?.status ?? 'ok';
            type KStatus = 'ok' | 'warn' | 'bad';
            const metrics: { label: string; value: string; color: string; status: KStatus; delta?: MetricDelta; sub?: string; to: TabId; action: string }[] = [
              { label: 'Net Income',      value: compactCurrency(summary.netIncome),            color: netIncomeColor, status: summary.netIncome >= 0 ? 'ok' : 'bad', delta: metricByKey.get('netIncome'),  sub: summary.revenueBasis === 'contract' ? 'contracted, no expenses yet' : undefined, to: 'forecast', action: 'View forecast' },
              { label: 'Revenue at Risk', value: compactCurrency(atRiskHighlight?.amount ?? 0), color: 'text-warning', status: fStatus('renewals'), sub: `${atRiskCount} lease${atRiskCount !== 1 ? 's' : ''}`, to: 'forecast', action: 'Review renewals' },
              { label: 'Cash Flow',       value: compactCurrency(overdue),                      color: overdue > 0 ? 'text-warning' : 'text-success', status: fStatus('cashFlow'), sub: overdue > 0 ? 'overdue' : 'on track', to: 'ledger', action: overdue > 0 ? 'Review collections' : 'View ledger' },
              { label: 'Revenue',         value: compactCurrency(summary.totalRevenue),         color: 'text-success', status: fStatus('revenue'),  delta: summary.revenueBasis === 'contract' ? undefined : metricByKey.get('revenue'),   sub: summary.revenueBasis === 'contract' ? 'contracted' : undefined, to: 'forecast', action: 'View forecast' },
              { label: 'Data Issues',     value: String(reviewCount),                           color: reviewCount > 0 ? 'text-info' : 'text-slate-300', status: reviewCount > 0 ? 'warn' : 'ok', sub: reviewCount > 0 ? 'to review' : undefined, to: 'ledger', action: 'Open ledger' },
            ];
            return (
              <div className="flex flex-col gap-2">
                <span className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Portfolio Signals</span>
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  {metrics.map((m) => (
                    <button key={m.label} type="button" onClick={() => setTab(m.to)} className="group rounded-xl border border-surface-400/50 bg-surface-100 px-4 py-3 text-left transition-colors hover:border-brand-600/40">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${KPI_STATUS_COLOR[m.status]}`}>{KPI_STATUS_WORD[m.status]}</p>
                      <p className="mt-0.5 flex items-baseline gap-1.5">
                        <span className={`text-xl font-bold tabular-nums leading-none ${m.color}`}>{m.value}</span>
                        <DeltaChip delta={m.delta} />
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{m.label}{m.sub ? ` · ${m.sub}` : ''}</p>
                    </button>
                  ))}
                </div>
                <div className="hidden sm:flex items-stretch divide-x divide-surface-400/40 rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
                  {metrics.map((m) => (
                    <button key={m.label} type="button" onClick={() => setTab(m.to)} className="group flex flex-1 flex-col gap-0.5 px-5 py-3 min-w-0 text-left transition-colors hover:bg-surface-200/40">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${KPI_STATUS_COLOR[m.status]}`}>{KPI_STATUS_WORD[m.status]}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-bold tabular-nums leading-none ${m.color}`}>{m.value}</span>
                        <DeltaChip delta={m.delta} />
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">{m.label}{m.sub ? ` · ${m.sub}` : ''}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-600 transition-colors group-hover:text-brand-300">
                        {m.action}<ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          <WhatChangedPanel />
        </>
      )}

      {tab === 'forecast' && <ForecastWorkspace />}

      {tab === 'ledger' && <LedgerWorkspace />}

      {tab === 'expenses' && <ExpensesWorkspace />}

      {tab === 'profitability' && <ProfitabilityWorkspace />}

      {tab === 'budgets' && <BudgetCard />}

    </div>
  );
}

import { Fragment, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote,
  Building2, Check, ChevronDown, ChevronRight, Landmark, Receipt, Shield, Wrench, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  financeService,
  sourceLabel,
  type FinancialActivityEvent,
  type ActivityActionType,
} from '@/services/finance.service';
import { formatCurrency, compactCurrency, formatDate } from '@/utils/format';
import { categoryLabel } from '@valence/shared';
import { LateFeePolicyPanel } from './LateFeePolicyPanel';
import { ResolveFlagWorkspace } from './ResolveFlagWorkspace';
import { CollectionsWorkspace } from './CollectionsWorkspace';

type LedgerFilter = 'all' | 'revenue' | 'expenses' | 'review' | 'quickbooks';
type ViewMode = 'feed' | 'audit';

const FILTER_QUERY: Record<LedgerFilter, Record<string, string>> = {
  all: {},
  revenue: { type: 'REVENUE' },
  expenses: { type: 'EXPENSE' },
  review: { status: 'FLAGGED' },
  quickbooks: { source: 'quickbooks' },
};

const FILTERS: { id: LedgerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'review', label: 'Needs review' },
  { id: 'quickbooks', label: 'QuickBooks' },
];

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const SELECTED_FILL = 'bg-yellow-400/15 ring-1 ring-inset ring-yellow-500/60';

function Counter({ value, format, className, duration = 460 }: { value: number; format: (n: number) => string; className?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { setDisplay(value); fromRef.current = value; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{format(display)}</span>;
}

function eventTitle(e: FinancialActivityEvent): string {
  const desc = e.description?.trim();
  if (desc) return desc;
  if (e.category) return categoryLabel(e.category);
  return e.type === 'REVENUE' ? 'Revenue' : 'Expense';
}

const ICON_BY_CATEGORY: Record<string, LucideIcon> = {
  RENT: Building2, UTILITIES: Zap, INSURANCE: Shield, PROPERTY_TAX: Landmark,
  MAINTENANCE: Wrench, REPAIRS: Wrench, HVAC: Wrench, CAPITAL_IMPROVEMENT: Wrench,
};

function eventIcon(e: FinancialActivityEvent): { Icon: LucideIcon; danger: boolean } {
  if (e.actionType === 'REVIEW' || e.actionType === 'COLLECT') return { Icon: AlertTriangle, danger: true };
  const byCat = e.category ? ICON_BY_CATEGORY[e.category] : undefined;
  if (byCat) return { Icon: byCat, danger: false };
  return { Icon: e.type === 'REVENUE' ? Banknote : Receipt, danger: false };
}

interface StatusMeta { pill: { label: string; cls: string } | null; }
function statusMeta(e: FinancialActivityEvent): StatusMeta {
  const action: ActivityActionType = e.actionType;
  if (action === 'REVIEW') return { pill: { label: 'Flagged', cls: 'bg-danger/10 text-danger' } };
  if (action === 'COLLECT') return { pill: { label: 'Overdue', cls: 'bg-danger/10 text-danger' } };
  if (action === 'RECONCILE') return { pill: { label: 'Pending', cls: 'bg-warning/10 text-warning' } };
  return { pill: null };
}

function Amount({ e, className = '' }: { e: FinancialActivityEvent; className?: string }) {
  const positive = e.type === 'REVENUE';
  return (
    <span className={`tabular-nums font-semibold ${positive ? 'text-success' : 'text-danger'} ${className}`}>
      {positive ? '+' : '−'}{formatCurrency(e.amount)}
    </span>
  );
}

function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(iso);
}

type Severity = 'CRITICAL' | 'REVIEW' | 'ACTION';
const SEV: Record<Severity, { tag: string; text: string; rail: string }> = {
  CRITICAL: { tag: 'Critical', text: 'text-danger',  rail: 'bg-danger' },
  REVIEW:   { tag: 'Review',   text: 'text-info',    rail: 'bg-info' },
  ACTION:   { tag: 'Action',   text: 'text-warning', rail: 'bg-warning' },
};

export function LedgerWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const historyRef = useRef<HTMLDivElement>(null);
  const workRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<ViewMode>('feed');
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [page, setPage] = useState(1);
  const [grown, setGrown] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [flagRecordId, setFlagRecordId] = useState<string | null>(null);
  const [collectLeaseId, setCollectLeaseId] = useState<string | null>(null);

  const { data: summary } = useQuery({ queryKey: ['finance', 'summary'], queryFn: () => financeService.getSummary() });
  const { data: lateFee } = useQuery({ queryKey: ['finance', 'late-fee-forecast'], queryFn: () => financeService.getLateFeeForecast() });
  const { data: recent } = useQuery({ queryKey: ['finance', 'records', 'recent'], queryFn: () => financeService.getRecords({ limit: 20 }) });
  const { data: history } = useQuery({
    queryKey: ['finance', 'records', 'history', page, filter, category],
    queryFn: () => financeService.getRecords({ limit: 20, page, ...FILTER_QUERY[filter], ...(category ? { category } : {}) }),
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!category) return;
    setView('audit');
    setPage(1);
    requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [category]);

  function clearCategory() {
    const next = new URLSearchParams(searchParams);
    next.delete('category');
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  if (!summary) return null;

  const now = new Date();
  const overdueBalance = lateFee?.overdueBalance ?? 0;
  const overdueCount = lateFee?.overdueCount ?? 0;
  const unconfigured = lateFee?.unconfiguredCount ?? 0;
  const topOverdue = lateFee?.topOverdue ?? null;
  const hasQuickBooks = (recent?.data ?? []).some((e) => e.source === 'quickbooks');
  const flaggedId = (recent?.data ?? []).find((e) => e.actionType === 'REVIEW')?.id ?? null;

  function goToHistory(f: LedgerFilter, mode: ViewMode = 'audit') {
    setFilter(f);
    setPage(1);
    setView(mode);
    requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  function selectEvent(e: FinancialActivityEvent) {
    const key = `history:${e.id}`;
    setSelectedKey((prev) => (prev === key ? null : key));
  }
  function openTask(e: FinancialActivityEvent) {
    if (e.actionType === 'REVIEW') setFlagRecordId(e.id);
    else if (e.actionType === 'COLLECT' && e.relatedLeaseId) setCollectLeaseId(e.relatedLeaseId);
    else selectEvent(e);
  }
  function activateEvent(e: FinancialActivityEvent) {
    if (e.kind === 'TASK') openTask(e); else selectEvent(e);
  }

  function eventActions(e: FinancialActivityEvent): { label: string; onClick: () => void }[] {
    const acts: { label: string; onClick: () => void }[] = [];
    if (e.actionType === 'REVIEW') acts.push({ label: 'Resolve flag', onClick: () => setFlagRecordId(e.id) });
    else if (e.actionType === 'COLLECT' && e.relatedLeaseId) acts.push({ label: 'Collect payment', onClick: () => setCollectLeaseId(e.relatedLeaseId) });
    else if (e.relatedLeaseId) {
      const leaseId = e.relatedLeaseId;
      const label = e.type === 'REVENUE' ? 'Review lease' : 'Open lease';
      acts.push({ label, onClick: () => navigate(`/leases/${leaseId}`) });
    }
    acts.push({ label: 'Open property', onClick: () => navigate(`/properties/${e.property.id}`) });
    return acts;
  }

  type Work = { sev: Severity; title: string; context: string; action?: { label: string; onClick: () => void } };
  const work: Work[] = [];
  if (overdueCount > 0) {
    const who = topOverdue ? `${formatCurrency(topOverdue.overdueAmount)} from ${topOverdue.tenantName}` : `${formatCurrency(overdueBalance)} in overdue rent`;
    const ctx = topOverdue
      ? `${topOverdue.daysLate} ${plural(topOverdue.daysLate, 'day')} past due${overdueCount > 1 ? ` · ${overdueCount} overdue ${plural(overdueCount, 'payment')}` : ''}`
      : `${overdueCount} overdue ${plural(overdueCount, 'payment')}`;
    work.push({
      sev: 'CRITICAL',
      title: `Collect ${who}`,
      context: ctx,
      action: { label: 'Collect payment', onClick: () => (topOverdue ? setCollectLeaseId(topOverdue.leaseId) : goToHistory('all')) },
    });
  }
  if (summary.flaggedRecords > 0) {
    work.push({
      sev: 'REVIEW',
      title: `Resolve ${summary.flaggedRecords} flagged ${plural(summary.flaggedRecords, 'transaction')}`,
      context: 'A transaction needs review before it reconciles.',
      action: { label: 'Resolve', onClick: () => (flaggedId ? setFlagRecordId(flaggedId) : goToHistory('review')) },
    });
  }
  if (unconfigured > 0) {
    work.push({
      sev: 'ACTION',
      title: 'Configure late-fee policy',
      context: `You're missing fees on ${unconfigured} overdue ${plural(unconfigured, 'lease')}.`,
      action: { label: 'Configure', onClick: () => setPolicyOpen(true) },
    });
  }
  const actionCount = work.length;

  const verdict = actionCount > 0
    ? `${actionCount} financial ${plural(actionCount, 'issue')} ${plural(actionCount, 'requires', 'require')} attention.`
    : 'Financial operations are healthy.';

  const maxFlow = Math.max(1, summary.totalRevenue, summary.totalExpenses);
  const netPositive = summary.netIncome >= 0;
  const inWidth = grown ? `${(summary.totalRevenue / maxFlow) * 100}%` : '0%';
  const outWidth = grown ? `${(summary.totalExpenses / maxFlow) * 100}%` : '0%';

  const groupsByLabel = new Map<string, FinancialActivityEvent[]>();
  for (const e of history?.data ?? []) {
    const label = dayLabel(e.date, now);
    const existing = groupsByLabel.get(label);
    if (existing) existing.push(e);
    else groupsByLabel.set(label, [e]);
  }
  const dayStart = (iso: string) => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const dayGroups = [...groupsByLabel.entries()]
    .map(([label, events]) => ({ label, events }))
    .sort((a, b) => dayStart(b.events[0].date) - dayStart(a.events[0].date));

  return (
    <div className="flex flex-col gap-4 animate-fade-in">

      <section className="rounded-2xl border border-surface-400/60 bg-surface-100 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-slate-500">
          <Activity className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Financial Summary</span>
        </div>
        {summary.totalEvents === 0 ? (
          <div className="mt-4">
            <p className="text-2xl font-bold leading-snug text-fg">No transactions yet</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Import a CSV or connect QuickBooks to track cash in and out.</p>
          </div>
        ) : (
          <>
            {actionCount > 0 ? (
              <button
                type="button"
                onClick={() => workRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="group mt-4 flex items-start gap-1.5 text-left"
              >
                <span className="text-2xl font-bold leading-snug text-warning underline-offset-4 group-hover:underline">{verdict}</span>
                <ChevronDown className="mt-1.5 h-5 w-5 shrink-0 text-warning/70 transition-transform group-hover:translate-y-0.5" />
              </button>
            ) : (
              <p className="mt-4 text-2xl font-bold leading-snug text-success">{verdict}</p>
            )}
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">In</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-300/60">
                  <div className="h-full rounded-full bg-success transition-[width] duration-500 ease-out" style={{ width: inWidth }} />
                </div>
                <Counter value={summary.totalRevenue} format={(n) => `+${compactCurrency(n)}`} className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-success" />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-[11px] font-medium uppercase tracking-wider text-slate-500">Out</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-300/60">
                  <div className="h-full rounded-full bg-danger transition-[width] duration-500 ease-out" style={{ width: outWidth }} />
                </div>
                <Counter value={summary.totalExpenses} format={(n) => `−${compactCurrency(n)}`} className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-danger" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-surface-400/30 pt-4">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Net cash</span>
              <span className={`flex items-center gap-1 text-xl font-bold tabular-nums ${netPositive ? 'text-success' : 'text-danger'}`}>
                {netPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                <Counter value={Math.abs(summary.netIncome)} format={(n) => `${netPositive ? '+' : '−'}${compactCurrency(n)}`} />
              </span>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
              <span>{summary.reconciledRecords}/{summary.totalEvents} reconciled</span>
              {hasQuickBooks && <><span className="text-slate-700">·</span><span className="flex items-center gap-1"><Check className="h-3 w-3 text-success" />QuickBooks synced</span></>}
            </p>
          </>
        )}
      </section>

      <section ref={workRef} className="scroll-mt-4 rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-surface-400/30 px-5 py-2.5 text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Today's Work</span>
          {actionCount > 0 && <span className="ml-auto text-[11px] text-slate-500">{actionCount} {plural(actionCount, 'item')}</span>}
        </div>
        <div className="divide-y divide-surface-400/30">
          {work.length === 0 && (
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10"><Check className="h-4 w-4 text-success" /></span>
              <div>
                <p className="text-sm font-semibold text-fg">All clear</p>
                <p className="text-xs text-slate-500">Nothing needs your attention right now.</p>
              </div>
            </div>
          )}
          {work.map((w) => {
            const s = SEV[w.sev];
            return (
              <div key={w.title} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-200/20">
                <span className={`h-9 w-1 shrink-0 rounded-full ${s.rail}`} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${s.text}`}>{s.tag}</span>
                    <span className="truncate text-sm font-semibold text-fg">{w.title}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{w.context}</p>
                </div>
                {w.action && (
                  <button type="button" onClick={w.action.onClick} className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-400/50 bg-surface-100 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-brand-500/60 hover:bg-surface-200/50 hover:text-brand-200 active:scale-[0.97]">
                    {w.action.label}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section ref={historyRef} className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-surface-400/30 px-5 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Financial History</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-surface-200/60 p-0.5">
            {(['feed', 'audit'] as ViewMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setView(m)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${view === m ? 'bg-surface-400/60 text-fg' : 'text-slate-500 hover:text-slate-300'}`}>
                {m === 'feed' ? 'Feed' : 'Audit'}
              </button>
            ))}
          </div>
        </div>

        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-surface-400/30 bg-surface-100/95 px-5 py-3 backdrop-blur">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => { setFilter(f.id); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors active:scale-[0.96] ${filter === f.id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-surface-200/50 hover:text-slate-300'}`}>
              {f.label}
            </button>
          ))}
          {category && (
            <button type="button" onClick={clearCategory}
              className="group inline-flex items-center gap-1.5 rounded-full bg-brand-600/15 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-inset ring-brand-500/40 transition-colors hover:bg-brand-600/25">
              {categoryLabel(category)}
              <X className="h-3 w-3 text-brand-300/70 transition-colors group-hover:text-brand-200" />
            </button>
          )}
        </div>

        {view === 'feed' ? (
          <div className="flex flex-col px-5 pb-4 pt-1">
            {dayGroups.map((g) => (
              <div key={g.label}>
                <p className="border-b border-surface-400/20 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{g.label}</p>
                {g.events.map((e) => {
                  const meta = statusMeta(e);
                  const src = sourceLabel(e.source);
                  const { Icon, danger } = eventIcon(e);
                  const sel = selectedKey === `history:${e.id}`;
                  return (
                    <div key={e.id} className={`border-b border-l-[3px] border-surface-400/10 transition-colors ${sel ? `border-l-yellow-500 ${SELECTED_FILL}` : 'border-l-transparent'}`}>
                      <button type="button" onClick={() => activateEvent(e)} className="flex w-full items-center gap-3 py-2.5 pl-2.5 pr-4 text-left transition-colors hover:bg-surface-200/30">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${danger ? 'bg-danger/10 text-danger' : 'bg-surface-200/70 text-slate-400'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-200">
                            {eventTitle(e)}
                            {meta.pill && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.pill.cls}`}>{meta.pill.label}</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">{e.property.name}{e.tenant ? ` · ${e.tenant.name}` : ''}{src ? ` · ${src}` : ''}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Amount e={e} className="text-sm" />
                          <p className="text-[10px] text-slate-600">{formatDate(e.date)}</p>
                        </div>
                      </button>
                      {sel && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2.5 pl-12 pr-1">
                          {eventActions(e).map((a) => (
                            <button key={a.label} type="button" onClick={a.onClick} className="group/act inline-flex items-center gap-1 text-xs font-medium text-brand-300 transition-colors hover:text-brand-200">
                              {a.label}<ArrowRight className="h-3 w-3 transition-transform group-hover/act:translate-x-0.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {dayGroups.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No transactions match this filter.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/30">
                  {['Transaction', 'Property', 'Type', 'Source', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/20">
                {(history?.data ?? []).map((e) => {
                  const meta = statusMeta(e);
                  const src = sourceLabel(e.source);
                  const sel = selectedKey === `history:${e.id}`;
                  return (
                    <Fragment key={e.id}>
                      <tr className={`cursor-pointer transition-colors hover:bg-surface-200/30 ${sel ? 'bg-yellow-400/20' : ''}`} onClick={() => selectEvent(e)}>
                        <td className={`border-l-[3px] px-4 py-2.5 text-sm text-slate-200 ${sel ? 'border-yellow-500' : 'border-transparent'}`}>{eventTitle(e)}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-400">{e.property.name}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-400">{e.type === 'REVENUE' ? 'Revenue' : 'Expense'}</td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{src ?? '—'}</td>
                        <td className="px-4 py-2.5 text-sm"><Amount e={e} className="text-sm" /></td>
                        <td className="px-4 py-2.5">
                          {meta.pill
                            ? <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.pill.cls}`}>{meta.pill.label}</span>
                            : <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-600" />Reconciled</span>}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-500">{formatDate(e.date)}</td>
                      </tr>
                      {sel && (
                        <tr className="bg-yellow-400/10">
                          <td colSpan={7} className="border-l-[3px] border-yellow-500 px-4 pb-3 pt-1">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                              {eventActions(e).map((a) => (
                                <button key={a.label} type="button" onClick={(ev) => { ev.stopPropagation(); a.onClick(); }} className="group/act inline-flex items-center gap-1 text-xs font-medium text-brand-300 transition-colors hover:text-brand-200">
                                  {a.label}<ArrowRight className="h-3 w-3 transition-transform group-hover/act:translate-x-0.5" />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {history && history.data.length === 0 && <p className="py-12 text-center text-sm text-slate-500">No transactions match this filter.</p>}
          </div>
        )}

        {history && history.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-400/30 px-5 py-3">
            <p className="text-xs text-slate-600">{history.meta.total} {plural(history.meta.total, 'transaction')}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!history.meta.hasPrev} className="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-surface-300 hover:text-fg disabled:opacity-30">
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />Previous
              </button>
              <span className="text-xs text-slate-600">{page} / {history.meta.pages}</span>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!history.meta.hasNext} className="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-surface-300 hover:text-fg disabled:opacity-30">
                Next<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      <LateFeePolicyPanel open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <ResolveFlagWorkspace open={!!flagRecordId} recordId={flagRecordId} onClose={() => setFlagRecordId(null)} />
      <CollectionsWorkspace open={!!collectLeaseId} leaseId={collectLeaseId} onClose={() => setCollectLeaseId(null)} />
    </div>
  );
}

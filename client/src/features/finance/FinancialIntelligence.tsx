import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import {
  financeService,
  type HealthBand,
  type Recommendation,
  type RecommendationAction,
} from '@/services/finance.service';
import { formatCurrency, compactCurrency } from '@/utils/format';

const BAND_META: Record<HealthBand, { label: string; text: string; outlook: string }> = {
  HEALTHY: { label: 'Healthy', text: 'text-success', outlook: 'Stable' },
  WATCH:   { label: 'Needs watching', text: 'text-warning', outlook: 'Watch' },
  AT_RISK: { label: 'At risk', text: 'text-danger', outlook: 'At risk' },
};

const SEVERITY_TEXT: Record<Recommendation['severity'], string> = { HIGH: 'text-danger', MEDIUM: 'text-warning', LOW: 'text-slate-300' };

const FACTOR_STATUS: Record<'ok' | 'warn' | 'bad', { word: string; text: string; good: boolean }> = {
  ok:   { word: 'Healthy',   text: 'text-success', good: true },
  warn: { word: 'Watch',     text: 'text-warning', good: false },
  bad:  { word: 'Attention', text: 'text-danger',  good: false },
};

const CATEGORY: Record<RecommendationAction, string> = {
  RENEW_LEASE: 'Revenue',
  COLLECT: 'Collections',
  REVIEW_BUDGET: 'Spending',
  SET_LATE_FEE_POLICY: 'Configuration',
};
const CATEGORY_ORDER = ['Revenue', 'Collections', 'Spending', 'Configuration'];

const ACTION_CTA: Record<RecommendationAction, string> = {
  RENEW_LEASE: 'Review renewal',
  COLLECT: 'Collect payment',
  REVIEW_BUDGET: 'Review budget',
  SET_LATE_FEE_POLICY: 'Configure policy',
};

const CONF_COLOR: Record<string, string> = { HIGH: 'text-success/80', MEDIUM: 'text-warning/80', LOW: 'text-slate-500' };
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function priorityHeadline(rec: Recommendation): string {
  const i = rec.impact;
  if (!i) return rec.title;
  if (i.unit === 'PER_MONTH') return `${formatCurrency(i.value * 12)} annual NOI at risk`;
  if (i.unit === 'ONCE') return `${formatCurrency(i.value)} overdue`;
  if (i.unit === 'PERCENT') return `${i.value >= 0 ? '+' : ''}${i.value}% over budget`;
  return rec.title;
}

function PriorityItem({ rec, isTop, navigate }: { rec: Recommendation; isTop: boolean; navigate: (to: string) => void }) {
  const headline = priorityHeadline(rec);
  const hasMoney = Boolean(rec.impact);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-base font-bold tabular-nums ${SEVERITY_TEXT[rec.severity]}`}>{headline}</p>
          {isTop && (
            <span className="shrink-0 rounded-full border border-brand-500/30 bg-brand-500/[0.08] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-300">
              Highest impact
            </span>
          )}
        </div>
        {hasMoney && <p className="mt-0.5 text-sm font-medium text-slate-200">{rec.title}</p>}
        <p className="mt-0.5 text-xs text-slate-500">{rec.description}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate(rec.deepLink)}
        className="group flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-brand-300"
      >
        {ACTION_CTA[rec.action]}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function FinancialIntelligence() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['finance', 'intelligence'], queryFn: () => financeService.getIntelligence() });
  const { data: outlook } = useQuery({ queryKey: ['finance', 'forecast-outlook'], queryFn: () => financeService.getForecastOutlook() });

  if (!data) return null;

  const band = BAND_META[data.health.band];
  const factors = data.health.factors;
  const conf = data.health.confidence;
  const provisional = conf.level !== 'HIGH';
  const basisLower = conf.basis ? conf.basis.charAt(0).toLowerCase() + conf.basis.slice(1) : '';
  const groups = CATEGORY_ORDER
    .map((label) => ({ label, recs: data.recommendations.filter((r) => CATEGORY[r.action] === label) }))
    .filter((g) => g.recs.length > 0);
  const topRecId = data.recommendations[0]?.id;

  const totalAnnual = data.recommendations.reduce(
    (s, r) => s + (r.impact?.unit === 'PER_MONTH' ? r.impact.value * 12 : r.impact?.unit === 'ONCE' ? r.impact.value : 0),
    0,
  );

  const nearTerm = outlook ? outlook.timeline.slice(0, 2).reduce((s, m) => s + m.revenueAtRisk, 0) : 0;
  const atRiskHighlight = data.highlights.find((h) => h.kind === 'REVENUE_AT_RISK');

  const riskText = nearTerm > 0
    ? `Renewals over the next 60 days may reduce annual NOI by ${compactCurrency(nearTerm * 12)}.`
    : atRiskHighlight ? `${atRiskHighlight.count} lease${atRiskHighlight.count !== 1 ? 's are' : ' is'} approaching renewal.` : 'No material financial risks on the horizon.';
  const aheadText = nearTerm > 0 ? 'Revenue expected to soften over the next quarter.' : 'Revenue expected to hold steady over the next quarter.';
  const outlookSections = [
    { label: 'Biggest risk ahead', value: riskText },
    { label: 'Looking ahead', value: aheadText },
  ];

  const confItems = [
    { label: 'Forecast', conf: outlook?.confidence },
    { label: 'Revenue', conf: data.metrics.find((m) => m.key === 'revenue')?.confidence },
    { label: 'Expenses', conf: data.metrics.find((m) => m.key === 'expenses')?.confidence },
  ].filter((c) => Boolean(c.conf));

  return (
    <div className="flex flex-col gap-3">

      <div className="rounded-xl border border-surface-400/50 bg-surface-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Portfolio Outlook</span>
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${band.text}`}>
            {data.health.band === 'HEALTHY'
              ? <Check className="h-4 w-4" />
              : <AlertTriangle className="h-4 w-4" />}
            {band.outlook}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 border-t border-surface-400/30 pt-3 sm:grid-cols-2">
          {outlookSections.map((s) => (
            <div key={s.label}>
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="rounded-2xl border border-surface-400/60 bg-surface-100 overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-surface-400/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today’s Priorities</span>
            <span className="text-[11px] text-slate-500">
              {data.recommendations.length} action{data.recommendations.length !== 1 ? 's' : ''}
              {totalAnnual > 0 && <span className="ml-1.5 font-semibold text-slate-400">· {compactCurrency(totalAnnual)}/yr at stake</span>}
            </span>
          </div>
          <div className="divide-y divide-surface-400/30">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="bg-surface-200/30 px-5 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</span>
                  <span className="ml-1.5 text-[10px] text-slate-600">· {group.recs.length} item{group.recs.length !== 1 ? 's' : ''}</span>
                </div>
                {group.recs.map((rec) => (
                  <PriorityItem key={rec.id} rec={rec} isTop={rec.id === topRecId} navigate={navigate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-400/60 bg-surface-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-400/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today’s Priorities</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-slate-200">No urgent actions right now.</p>
            {provisional ? (
              <>
                <p className="mt-0.5 text-[11px] text-slate-500">Add a little more to sharpen your intelligence:</p>
                <div className="mt-3 flex flex-col gap-2">
                  {[
                    { label: 'Import your expenses', desc: 'Unlock profitability & margins', to: '/import' },
                    { label: 'Connect QuickBooks', desc: 'Auto-sync operating costs', to: '/integrations' },
                  ].map((s) => (
                    <button
                      key={s.to}
                      type="button"
                      onClick={() => navigate(s.to)}
                      className="group flex items-center gap-3 rounded-xl border border-surface-400/40 bg-surface-200/40 px-4 py-2.5 text-left transition-colors hover:border-brand-500/40 hover:bg-brand-600/10"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-200">{s.label}</p>
                        <p className="text-[11px] text-slate-500">{s.desc}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-brand-300" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-500">You’re on top of it — nothing needs attention today.</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-surface-400/50 bg-surface-100 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Portfolio Health</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tabular-nums ${band.text}`}>{data.health.score}</span>
            <span className="text-[11px] text-slate-500">/ 100</span>
            <span className={`text-sm font-semibold ${band.text}`}>{band.label}</span>
          </div>
        </div>
        {provisional && (
          <button
            type="button"
            onClick={() => navigate('/import')}
            className="group mt-1.5 flex w-full items-center gap-1.5 text-left text-[11px] text-slate-500 transition-colors hover:text-brand-300"
          >
            <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
            <span>Provisional{basisLower ? ` — ${basisLower}` : ''}. Add your data to sharpen it.</span>
            <ArrowRight className="ml-auto h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <p className="mt-2 text-[11px] text-slate-500">What’s driving the score</p>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-surface-400/30 pt-3 sm:grid-cols-2">
          {factors.map((f) => {
            const meta = FACTOR_STATUS[f.status];
            return (
              <div key={f.key} className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300">{f.label}</span>
                <span className={`flex items-center gap-1 text-[11px] font-semibold ${meta.text}`}>
                  {meta.good
                    ? <Check className="h-3 w-3 shrink-0" />
                    : <AlertTriangle className="h-3 w-3 shrink-0" />}
                  {meta.word}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-600">
        <span className="font-medium uppercase tracking-wider text-slate-500">Data confidence</span>
        {confItems.map((c) => (
          <span key={c.label} title={c.conf!.basis}>
            {c.label} <span className={`font-semibold ${CONF_COLOR[c.conf!.level]}`}>{titleCase(c.conf!.level)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

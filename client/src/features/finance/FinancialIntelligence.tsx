import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import {
  financeService,
  type HealthBand,
  type Recommendation,
  type RecommendationAction,
  type FinancialIntelligence as FinancialIntelligenceData,
} from '@/services/finance.service';
import { formatCurrency, compactCurrency } from '@/utils/format';

const BAND_META: Record<HealthBand, { label: string; text: string; outlook: string }> = {
  HEALTHY: { label: 'Healthy', text: 'text-success', outlook: 'Stable' },
  WATCH:   { label: 'Needs watching', text: 'text-warning', outlook: 'Watch' },
  AT_RISK: { label: 'At risk', text: 'text-danger', outlook: 'At risk' },
};

const SEVERITY_TEXT: Record<Recommendation['severity'], string> = { HIGH: 'text-danger', MEDIUM: 'text-warning', LOW: 'text-slate-300' };

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

interface Driver { positive: boolean; label: string; to?: string; }

function buildDrivers(data: FinancialIntelligenceData): Driver[] {
  const drivers: Driver[] = [];
  const factor = (k: string) => data.health.factors.find((f) => f.key === k);
  if (factor('revenue')?.status === 'ok') drivers.push({ positive: true, label: 'Revenue stable' });
  if (factor('expenses')?.status === 'ok') drivers.push({ positive: true, label: 'Expenses within budget' });
  if (factor('cashFlow')?.status === 'ok') drivers.push({ positive: true, label: 'Cash flow healthy' });

  const atRisk = data.highlights.find((h) => h.kind === 'REVENUE_AT_RISK');
  if (atRisk) drivers.push({ positive: false, label: `${atRisk.count} lease${atRisk.count !== 1 ? 's' : ''} nearing renewal`, to: '/finance?tab=forecast' });
  const collect = data.recommendations.find((r) => r.action === 'COLLECT');
  if (collect?.impact) drivers.push({ positive: false, label: `${formatCurrency(collect.impact.value)} overdue rent`, to: '/finance?tab=ledger' });
  const policy = data.recommendations.find((r) => r.action === 'SET_LATE_FEE_POLICY');
  if (policy) drivers.push({ positive: false, label: 'No late-fee policy on overdue lease', to: '/finance?tab=ledger' });
  if (factor('dataQuality')?.status !== 'ok') drivers.push({ positive: false, label: `Data confidence ${data.health.confidence.level.toLowerCase()}`, to: '/finance?tab=ledger' });

  return drivers;
}

function priorityHeadline(rec: Recommendation): string {
  const i = rec.impact;
  if (!i) return rec.title;
  if (i.unit === 'PER_MONTH') return `${formatCurrency(i.value * 12)} annual NOI at risk`;
  if (i.unit === 'ONCE') return `${formatCurrency(i.value)} overdue`;
  if (i.unit === 'PERCENT') return `${i.value >= 0 ? '+' : ''}${i.value}% over budget`;
  return rec.title;
}

function PriorityItem({ rec, navigate }: { rec: Recommendation; navigate: (to: string) => void }) {
  const headline = priorityHeadline(rec);
  const hasMoney = Boolean(rec.impact);
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className={`text-base font-bold tabular-nums ${SEVERITY_TEXT[rec.severity]}`}>{headline}</p>
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
  const [showHealthy, setShowHealthy] = useState(false);
  const { data } = useQuery({ queryKey: ['finance', 'intelligence'], queryFn: () => financeService.getIntelligence() });
  const { data: outlook } = useQuery({ queryKey: ['finance', 'forecast-outlook'], queryFn: () => financeService.getForecastOutlook() });

  if (!data) return null;

  const band = BAND_META[data.health.band];
  // Exceptions first, and assume the working items — they read quieter (and collapse).
  const drivers = buildDrivers(data).sort((a, b) => Number(a.positive) - Number(b.positive));
  const negatives = drivers.filter((d) => !d.positive);
  const positives = drivers.filter((d) => d.positive);
  const groups = CATEGORY_ORDER
    .map((label) => ({ label, recs: data.recommendations.filter((r) => CATEGORY[r.action] === label) }))
    .filter((g) => g.recs.length > 0);

  const totalAnnual = data.recommendations.reduce(
    (s, r) => s + (r.impact?.unit === 'PER_MONTH' ? r.impact.value * 12 : r.impact?.unit === 'ONCE' ? r.impact.value : 0),
    0,
  );

  const nearTerm = outlook ? outlook.timeline.slice(0, 2).reduce((s, m) => s + m.revenueAtRisk, 0) : 0;
  const collectRec = data.recommendations.find((r) => r.action === 'COLLECT');
  const policyRec = data.recommendations.find((r) => r.action === 'SET_LATE_FEE_POLICY');
  const atRiskHighlight = data.highlights.find((h) => h.kind === 'REVENUE_AT_RISK');

  const oppText = collectRec?.impact
    ? `Collect ${formatCurrency(collectRec.impact.value)} overdue rent`
    : policyRec ? 'Enable late-fee collection on overdue leases' : 'Portfolio is fully optimized today';
  const riskText = nearTerm > 0
    ? `Renewals over the next 60 days may reduce annual NOI by ${compactCurrency(nearTerm * 12)}.`
    : atRiskHighlight ? `${atRiskHighlight.count} lease${atRiskHighlight.count !== 1 ? 's are' : ' is'} approaching renewal.` : 'No material financial risks on the horizon.';
  const aheadText = nearTerm > 0 ? 'Revenue expected to soften over the next quarter.' : 'Revenue expected to hold steady over the next quarter.';
  const outlookSections = [
    { label: 'Best opportunity today', value: oppText },
    { label: 'Biggest financial risk', value: riskText },
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
        <div className="mt-3 grid grid-cols-1 gap-4 border-t border-surface-400/30 pt-3 sm:grid-cols-3">
          {outlookSections.map((s) => (
            <div key={s.label}>
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {groups.length > 0 && (
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
                  <PriorityItem key={rec.id} rec={rec} navigate={navigate} />
                ))}
              </div>
            ))}
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
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-surface-400/30 pt-3 sm:grid-cols-2">
          {negatives.length === 0 && !showHealthy && (
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="text-xs text-slate-300">All clear — nothing needs attention</span>
            </div>
          )}
          {(showHealthy ? drivers : negatives).map((d) =>
            d.to ? (
              <button
                key={d.label}
                type="button"
                onClick={() => navigate(d.to!)}
                className="group flex items-center gap-2 text-left transition-colors"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="text-xs text-slate-200 group-hover:text-brand-300">{d.label}</span>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-slate-600 transition-colors group-hover:text-brand-300" />
              </button>
            ) : (
              <div key={d.label} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="text-xs text-slate-500">{d.label}</span>
              </div>
            ),
          )}
        </div>
        {positives.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHealthy((v) => !v)}
            className="mt-2.5 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            {showHealthy ? 'Hide healthy' : `Show ${positives.length} healthy`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-600">
        <span className="font-medium uppercase tracking-wider text-slate-500">Confidence</span>
        {confItems.map((c) => (
          <span key={c.label} title={c.conf!.basis}>
            {c.label} <span className={`font-semibold ${CONF_COLOR[c.conf!.level]}`}>{titleCase(c.conf!.level)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowRight, ChevronDown, Check, TrendingDown, TrendingUp, Clock, Zap } from 'lucide-react';
import { financeService, type Recommendation, type RecommendationAction } from '@/services/finance.service';
import { formatCurrency, compactCurrency } from '@/utils/format';
import { useChartColors } from '@/hooks/useChartColors';
import { CountUp } from '@/components/ui/CountUp';
import { RenewalWorkspace } from './RenewalWorkspace';

const ACTION_CTA: Record<RecommendationAction, string> = {
  RENEW_LEASE: 'Renew lease',
  COLLECT: 'Open collection',
  REVIEW_BUDGET: 'Open budget',
  SET_LATE_FEE_POLICY: 'Configure policy',
};

const IMPACT_BADGE: Record<Recommendation['severity'], { label: string; cls: string }> = {
  HIGH:   { label: 'High', cls: 'bg-danger/10 text-danger' },
  MEDIUM: { label: 'Med', cls: 'bg-warning/10 text-warning' },
  LOW:    { label: 'Low', cls: 'bg-surface-300 text-slate-400' },
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const daysUntil = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));

function actionHeadline(rec: Recommendation): { text: string; tone: string } {
  if (rec.action === 'RENEW_LEASE' && rec.impact) return { text: `Protect ${compactCurrency(rec.impact.value * 12)}`, tone: 'text-success' };
  if (rec.action === 'COLLECT' && rec.impact) return { text: `Recover ${compactCurrency(rec.impact.value)}`, tone: 'text-success' };
  if (rec.action === 'SET_LATE_FEE_POLICY') return { text: 'Prevent future loss', tone: 'text-slate-200' };
  return { text: rec.title, tone: 'text-slate-200' };
}

const actionWeight = (rec: Recommendation): number =>
  !rec.impact ? 0 : rec.impact.unit === 'PER_MONTH' ? rec.impact.value * 12 : rec.impact.value;

export function ForecastWorkspace() {
  const c = useChartColors();
  const navigate = useNavigate();
  const [showChart, setShowChart] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [renewalLeaseId, setRenewalLeaseId] = useState<string | null>(null);

  function openAction(a: Recommendation) {
    if (a.action === 'RENEW_LEASE') {
      const m = a.deepLink.match(/\/leases\/([^/?]+)/);
      if (m) { setRenewalLeaseId(m[1]); return; }
    }
    navigate(a.deepLink);
  }

  const { data: outlook } = useQuery({ queryKey: ['finance', 'forecast-outlook'], queryFn: () => financeService.getForecastOutlook() });
  const { data: forecast } = useQuery({ queryKey: ['finance', 'forecast'], queryFn: () => financeService.getNoiForecast({ months: 6 }) });
  const { data: intelligence } = useQuery({ queryKey: ['finance', 'intelligence'], queryFn: () => financeService.getIntelligence() });

  if (!outlook) return null;

  const expiring = outlook.timeline
    .flatMap((m) => m.leases)
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  const leaseCount = expiring.length;
  const atRiskAnnual = outlook.totalRevenueAtRisk * 12;
  const baseNOI = forecast?.projectedAnnualNet ?? 0;
  const recoveredNOI = baseNOI + atRiskAnnual;

  const topLease = expiring.reduce<typeof expiring[number] | null>((m, l) => (!m || l.monthlyRent > m.monthlyRent ? l : m), null);
  const topShare = topLease && atRiskAnnual > 0 ? Math.round(((topLease.monthlyRent * 12) / atRiskAnnual) * 100) : 0;
  const confColor = outlook.confidence.level === 'HIGH' ? 'text-success' : outlook.confidence.level === 'MEDIUM' ? 'text-warning' : 'text-slate-400';

  const actions = (intelligence?.recommendations ?? [])
    .filter((r) => r.action === 'RENEW_LEASE' || r.action === 'SET_LATE_FEE_POLICY' || r.action === 'COLLECT')
    .sort((a, b) => actionWeight(b) - actionWeight(a));

  const appliedProtection = actions
    .filter((a) => applied.has(a.id) && a.action === 'RENEW_LEASE' && a.impact)
    .reduce((s, a) => s + a.impact!.value * 12, 0);
  const remainingLoss = Math.max(0, atRiskAnnual - appliedProtection);
  const fullyProtected = atRiskAnnual > 0 && remainingLoss === 0;

  // Hover-preview: hovering a not-yet-planned renewal projects its impact onto the outcome.
  const hoverAction = hoverId ? actions.find((a) => a.id === hoverId) : null;
  const hoverProtection = hoverAction && hoverAction.action === 'RENEW_LEASE' && hoverAction.impact && !applied.has(hoverAction.id) ? hoverAction.impact.value * 12 : 0;
  const effectiveProtection = Math.min(atRiskAnnual, appliedProtection + hoverProtection);
  const projectedDisplay = baseNOI + effectiveProtection;
  const effectiveProgress = atRiskAnnual > 0 ? Math.min(100, Math.round((effectiveProtection / atRiskAnnual) * 100)) : 0;

  const toggle = (id: string) =>
    setApplied((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* LEFT — prediction (hero) + action (decisions) */}
        <div className="flex flex-col gap-4">

          <div className="rounded-2xl border border-surface-400/60 bg-surface-100 p-8">
            <div className="flex items-center gap-2 text-slate-500">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">Forecast</span>
            </div>
            {leaseCount === 0 ? (
              <p className="mt-6 text-xl font-semibold leading-snug text-fg">
                Projected NOI holds steady for the next {outlook.horizonMonths} months — no lease expirations on the horizon.
              </p>
            ) : (
              <>
                <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-slate-500">{appliedProtection > 0 ? 'Remaining at risk' : 'Without intervention'}</p>
                <CountUp value={remainingLoss} className={`mt-1 block text-6xl font-bold tabular-nums ${fullyProtected ? 'text-success' : 'text-danger'}`} />
                <p className="mt-2 text-xs text-slate-500">Annual revenue {fullyProtected ? 'protected' : 'at risk'} · next {outlook.horizonMonths} months</p>
                {appliedProtection > 0 && !fullyProtected && (
                  <p className="mt-3 text-sm font-medium text-success">✓ {compactCurrency(appliedProtection)} protected in your plan</p>
                )}
                {!fullyProtected && (
                  <div className="mt-6 grid grid-cols-2 gap-4 border-t border-surface-400/30 pt-5">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Largest driver</p>
                      {topLease && (
                        <>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-200">{topLease.tenantName}</p>
                          <p className="text-xs text-slate-500">{topShare}% of the decline</p>
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Confidence</p>
                      <p className={`mt-1 text-sm font-semibold ${confColor}`}>{titleCase(outlook.confidence.level)}</p>
                      <p className="text-xs text-slate-500">{outlook.confidence.basis.replace(/^Projected from /, '').replace(/^Based on /, '')}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {actions.length > 0 && (
            <div className="rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-surface-400/30 px-4 py-2.5 text-slate-500">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">Highest-impact decisions</span>
                <span className="ml-auto text-[11px] text-slate-500">Tap to model</span>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {actions.map((a) => {
                  const head = actionHeadline(a);
                  const on = applied.has(a.id);
                  const badge = IMPACT_BADGE[a.severity];
                  return (
                    <div key={a.id} onMouseEnter={() => setHoverId(a.id)} onMouseLeave={() => setHoverId(null)} className={`group flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 transition-colors duration-150 ease-out ${on ? 'border-success/50 bg-success/[0.07]' : 'border-transparent hover:border-brand-500/50 hover:bg-surface-200/40'}`}>
                      <button type="button" onClick={() => toggle(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${on ? 'border-success bg-success/20' : 'border-surface-400 group-hover:border-slate-400'}`}>
                          {on && <Check className="h-2.5 w-2.5 text-success" />}
                        </span>
                        <span className="min-w-0">
                          <span className={`text-sm font-bold ${on ? 'text-success' : head.tone}`}>{on ? 'Planned' : head.text}</span>
                          <span className="ml-2 text-xs text-slate-500">{a.title}</span>
                        </span>
                      </button>
                      <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline ${badge.cls}`}>{badge.label}</span>
                      <button type="button" onClick={() => openAction(a)} className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-brand-300">
                        {ACTION_CTA[a.action]}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out group-hover:translate-x-1" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — secondary (the timeline), stretches to span the left stack */}
        {expiring.length > 0 && (
          <div className="rounded-xl border border-surface-400/50 bg-surface-100 p-6">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-widest">Expiration timeline</span>
            </div>
            <div className="mt-5 flex flex-col">
              <div className="flex gap-4">
                <div className="flex w-3 flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
                  <span className="w-px flex-1 bg-surface-400/40" />
                </div>
                <p className="pb-7 text-xs font-semibold uppercase tracking-wider text-slate-400">Today</p>
              </div>
              {expiring.map((l, i) => {
                const days = daysUntil(l.endDate);
                const dot = days <= 30 ? 'bg-danger' : days <= 60 ? 'bg-warning' : 'bg-slate-500';
                const last = i === expiring.length - 1;
                return (
                  <button key={l.leaseId} type="button" onClick={() => setRenewalLeaseId(l.leaseId)} className="group flex gap-4 text-left">
                    <div className="flex w-3 flex-col items-center">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                      {!last && <span className="w-px flex-1 bg-surface-400/40" />}
                    </div>
                    <div className={last ? '' : 'pb-7'}>
                      <p className="text-sm font-bold tabular-nums text-slate-300">{days} days</p>
                      <p className="text-sm font-medium text-slate-200 group-hover:text-brand-300">{l.tenantName}</p>
                      <p className="text-xs font-semibold tabular-nums text-danger">−{compactCurrency(l.monthlyRent * 12)} <span className="font-normal text-slate-600">annual revenue</span></p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CONCLUSION — outcome spans the full width */}
      {leaseCount > 0 && atRiskAnnual > 0 && baseNOI > 0 && (
        <div className="rounded-2xl bg-success/[0.06] p-7 sm:p-8">
          <div className="flex items-center gap-2 text-success/80">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Projected outcome</span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <CountUp value={projectedDisplay} className="text-5xl font-bold tabular-nums text-success sm:text-6xl" />
            <span className="text-sm text-slate-500">of {compactCurrency(recoveredNOI)} potential</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Current forecast {compactCurrency(baseNOI)} · hover a decision to preview its impact</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-400/40">
            <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${effectiveProgress}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-success">
            {fullyProtected
              ? '✓ Full recovery — every expiring lease protected'
              : appliedProtection > 0
                ? `✓ ${compactCurrency(appliedProtection)} secured · ${compactCurrency(remainingLoss)} to go`
                : `+${compactCurrency(atRiskAnnual)} recoverable by acting on the priorities`}
          </p>
        </div>
      )}

      {/* Supporting evidence — full width, progressive disclosure */}
      {forecast && forecast.points.length > 0 && (
        <div className="rounded-xl border border-surface-400/50 bg-surface-100">
          <button type="button" onClick={() => setShowChart((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-left">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Forecast assumptions</span>
            <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${showChart ? 'rotate-180' : ''}`} />
          </button>
          {showChart && (
            <div className="px-2 pb-3 pt-0">
              <p className="px-3 pb-2 text-[11px] text-slate-500">
                Active-lease rent stepping down as leases expire, minus a {compactCurrency(forecast.monthlyExpense)}/mo expense run-rate.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={forecast.points} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: c.axis, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => compactCurrency(v)} />
                  <Tooltip
                    contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 11, color: c.tooltipText }}
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill={c.brand} radius={[3, 3, 0, 0]} maxBarSize={28} fillOpacity={0.35} />
                  <Bar dataKey="net" name="Net (NOI)" fill={c.success} radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <RenewalWorkspace open={!!renewalLeaseId} leaseId={renewalLeaseId} onClose={() => setRenewalLeaseId(null)} />
    </div>
  );
}

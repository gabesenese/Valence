import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trophy, Layers, AlertTriangle, ShieldCheck, ChevronRight, ArrowRight, Building2 } from 'lucide-react';
import { financeService, type TenantRenewalRisk } from '@/services/finance.service';
import { compactCurrency, formatCurrency, formatDateShort, formatNumber } from '@/utils/format';
import { CountUp } from '@/components/ui/CountUp';

const LIFT = 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-surface-400/80';
const MEDALS = ['🥇', '🥈', '🥉'];

const RISK_TONE: Record<TenantRenewalRisk, { text: string; label: string }> = {
  CRITICAL: { text: 'text-danger', label: 'Critical' },
  HIGH:     { text: 'text-danger', label: 'High' },
  MEDIUM:   { text: 'text-warning', label: 'Medium' },
  LOW:      { text: 'text-slate-400', label: 'Low' },
};

type Chip = { label: string; className: string };

type Insight = { tone: 'good' | 'warn' | 'bad'; icon: typeof ShieldCheck; label: string; headline: string; detail: string; cta?: string; onClick: () => void };

const TONE_DOT: Record<Insight['tone'], string> = { good: 'bg-success', warn: 'bg-warning', bad: 'bg-danger' };
const TONE_ICON: Record<Insight['tone'], string> = { good: 'text-success', warn: 'text-warning', bad: 'text-danger' };

function Tile({ value, label, sub, tone = 'default', valueSize = 'text-2xl' }: { value: string; label: string; sub?: string; tone?: 'default' | 'good'; valueSize?: string }) {
  return (
    <div className="rounded-xl bg-surface-200/30 px-4 py-4">
      <p className={`${valueSize} font-bold tabular-nums ${tone === 'good' ? 'text-success' : 'text-fg'}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-400" title={sub}>{sub}</p>}
    </div>
  );
}

function Detail({ label, value, valueClass = 'text-slate-200' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function ProfitabilityWorkspace() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: report } = useQuery({ queryKey: ['finance', 'tenant-profitability'], queryFn: () => financeService.getTenantProfitability() });

  if (!report) return null;
  const tenants = report.tenants;

  if (tenants.length === 0) {
    return (
      <p className="rounded-xl border border-surface-400/40 bg-surface-100 px-5 py-8 text-center text-sm text-slate-500">
        No tenant profitability data yet — add leases with rent and operating expenses to see who makes you money.
      </p>
    );
  }

  const totalRev = tenants.reduce((s, t) => s + t.monthlyRent, 0);
  const totalNet = tenants.reduce((s, t) => s + t.net, 0);
  const annualNoi = totalNet * 12;
  const avgMargin = totalRev > 0 ? Math.round((totalNet / totalRev) * 100) : 0;

  const top = tenants[0];
  const lowestNoi = tenants[tenants.length - 1];
  const maxNet = Math.max(...tenants.map((t) => t.net));
  const top3Net = tenants.slice(0, 3).reduce((s, t) => s + t.net, 0);
  const concentrationPct = totalNet > 0 ? Math.round((top3Net / totalNet) * 100) : 0;
  const topSharePct = totalNet > 0 ? Math.round((top.net / totalNet) * 100) : 0;
  const top2Pct = totalNet > 0 && tenants.length > 1 ? Math.round(((tenants[0].net + tenants[1].net) / totalNet) * 100) : topSharePct;

  const margins = tenants.map((t) => t.marginPct);
  const minMargin = Math.min(...margins);
  const maxMargin = Math.max(...margins);
  const marginSpread = maxMargin - minMargin;
  const belowAvg = tenants.filter((t) => t.marginPct < avgMargin);

  const marginLeaders = [...tenants].sort((a, b) => b.marginPct - a.marginPct).slice(0, 3);
  const highestCost = [...tenants].reduce((a, b) => (b.allocatedCost > a.allocatedCost ? b : a));
  const costReason = report.basis === 'sqft' ? 'Largest leased footprint' : report.basis === 'equal' ? 'Most leases on the books' : 'Largest cost share';

  const exposure = tenants
    .filter((t) => t.daysToExpiry != null && t.daysToExpiry <= 90)
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
  const topExposure = exposure.find((t) => t.renewalRisk === 'CRITICAL' || t.renewalRisk === 'HIGH') ?? exposure[0] ?? null;

  const verdict = avgMargin >= 75 ? 'Portfolio is healthy.' : avgMargin >= 50 ? 'Portfolio is stable.' : 'Portfolio is under pressure.';
  const caveat =
    concentrationPct >= 35
      ? `However, ${concentrationPct}% of annual NOI depends on just three tenants.`
      : topExposure
        ? `However, ${topExposure.tenantName} — ${compactCurrency(topExposure.net)}/mo of NOI — expires in ${topExposure.daysToExpiry} days.`
        : `NOI is well diversified across your ${tenants.length} tenants.`;

  const insights: Insight[] = [
    marginSpread <= 8
      ? { tone: 'good', icon: ShieldCheck, label: 'Strength', headline: `Margins are consistent at ${minMargin}–${maxMargin}%`, detail: `All ${tenants.length} tenants run within a tight ${marginSpread}-point band — predictable NOI.`, cta: 'See distribution', onClick: () => scrollTo('distribution') }
      : { tone: 'warn', icon: Layers, label: 'Spread', headline: `Margins range from ${minMargin}% to ${maxMargin}%`, detail: `${belowAvg.length} tenant${belowAvg.length === 1 ? '' : 's'} run below your ${avgMargin}% average.`, cta: 'See distribution', onClick: () => scrollTo('distribution') },
    {
      tone: concentrationPct >= 50 ? 'bad' : concentrationPct >= 35 ? 'warn' : 'good',
      icon: Layers,
      label: 'Concentration',
      headline: `Top 3 tenants generate ${concentrationPct}% of NOI`,
      detail: `${top.tenantName} alone drives ${topSharePct}%. ${concentrationPct >= 35 ? 'Losing one would meaningfully dent profit.' : 'NOI is well spread across the portfolio.'}`,
      cta: 'See dependence',
      onClick: () => scrollTo('dependence'),
    },
    topExposure
      ? {
          tone: topExposure.renewalRisk === 'CRITICAL' || topExposure.renewalRisk === 'HIGH' ? 'bad' : 'warn',
          icon: AlertTriangle,
          label: 'Renewal exposure',
          headline: `${topExposure.tenantName} expires in ${topExposure.daysToExpiry} days`,
          detail: `${compactCurrency(topExposure.net)}/mo of NOI is up for renewal${topExposure.renewalRisk ? ` · ${RISK_TONE[topExposure.renewalRisk].label.toLowerCase()} risk` : ''}.`,
          cta: 'Open forecast',
          onClick: () => navigate('/finance?tab=forecast'),
        }
      : { tone: 'good', icon: ShieldCheck, label: 'Renewal exposure', headline: 'No leases expiring in 90 days', detail: 'Near-term NOI is secure across every active lease.', cta: 'Open forecast', onClick: () => navigate('/finance?tab=forecast') },
  ];

  const consistencyClause = marginSpread <= 8 ? `Margins are consistent (${minMargin}–${maxMargin}%)` : `Margins range from ${minMargin}% to ${maxMargin}%`;
  const concentrationClause =
    concentrationPct >= 35
      ? `NOI is concentrated — ${tenants[0].tenantName}${tenants.length > 1 ? ` and ${tenants[1].tenantName}` : ''} alone drive ${top2Pct}% of it`
      : `NOI is well distributed across your ${tenants.length} tenants`;
  const observation = `${consistencyClause}. ${concentrationClause}.`;

  const basisNote = `Operating costs allocated ${report.basis === 'sqft' ? 'by leased square-foot share' : report.basis === 'equal' ? 'evenly across leases' : 'by square-foot share (evenly where sqft is missing)'} · ${report.monthsAveraged}-month average`;

  const marginSorted = [...tenants].sort((a, b) => b.marginPct - a.marginPct);

  function buildChips(rank: number, t: typeof tenants[number]): Chip[] {
    const chips: Chip[] = [];
    if (rank === 0) chips.push({ label: 'Top performer', className: 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' });
    if (t.renewalRisk === 'CRITICAL') chips.push({ label: 'Critical', className: 'bg-red-500/15 text-red-700 dark:bg-danger/10 dark:text-danger' });
    else if (t.daysToExpiry != null && t.daysToExpiry <= 90 && (t.renewalRisk === 'HIGH' || t.renewalRisk === 'MEDIUM')) chips.push({ label: 'Expires soon', className: 'bg-amber-500/15 text-amber-700 dark:bg-warning/10 dark:text-warning' });
    if (t.marginPct < avgMargin) chips.push({ label: 'Below avg margin', className: 'bg-amber-500/15 text-amber-700 dark:bg-warning/10 dark:text-warning' });
    if (t.leaseCount > 1) chips.push({ label: 'Multi-lease', className: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' });
    if (chips.length === 0) chips.push({ label: 'Stable', className: 'bg-emerald-500/15 text-emerald-700 dark:bg-success/10 dark:text-success' });
    return chips.slice(0, 3);
  }

  return (
    <div className="flex flex-col gap-5">

      {/* HERO — summarize */}
      <div className={`rounded-2xl border border-surface-400/60 bg-surface-100 p-7 sm:p-8 ${LIFT}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <Trophy className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Portfolio Profitability</span>
        </div>
        <p className="mt-4 text-base font-semibold text-success">{verdict}</p>
        <p className="mt-1 max-w-3xl text-2xl font-bold leading-snug text-fg sm:text-3xl">{caveat}</p>
        <div className="mt-7 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Tile value={`${avgMargin}%`} label="Average margin" valueSize="text-lg" />
          <div className="rounded-xl bg-brand-500/[0.07] px-4 py-4 ring-1 ring-brand-500/15">
            <CountUp value={annualNoi} className="text-3xl font-bold tabular-nums text-fg" />
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Annual Net NOI</p>
          </div>
          <Tile value={`+${compactCurrency(top.net)}/mo`} label="Top performer" sub={top.tenantName} tone="good" />
          <Tile value={`+${compactCurrency(lowestNoi.net)}/mo`} label="Lowest NOI" sub={lowestNoi.tenantName} />
        </div>
      </div>

      {/* OPERATIONAL INSIGHTS — explain */}
      <div>
        <h3 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Operational Insights</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {insights.map((ins) => {
            const Icon = ins.icon;
            return (
              <button key={ins.label} type="button" onClick={ins.onClick} className={`rounded-xl border border-surface-400/50 bg-surface-100 p-5 text-left ${LIFT}`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${TONE_DOT[ins.tone]}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{ins.label}</span>
                  <Icon className={`ml-auto h-4 w-4 ${TONE_ICON[ins.tone]}`} />
                </div>
                <p className="mt-3 text-sm font-semibold leading-snug text-fg">{ins.headline}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.detail}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand-300">{ins.cta}<ArrowRight className="h-3 w-3" /></span>
              </button>
            );
          })}
        </div>
      </div>

      {/* LEADERBOARDS — compare */}
      <div>
        <h3 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Leaderboards</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

          <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-5 ${LIFT}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Top NOI contributors</span>
            <div className="mt-3 flex flex-col gap-2.5">
              {tenants.slice(0, 3).map((t, i) => (
                <div key={t.tenantId} className="flex items-center gap-3">
                  <span className="text-lg leading-none">{MEDALS[i]}</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-200">{t.tenantName}</span>
                  <span className="text-sm font-bold tabular-nums text-success">+{compactCurrency(t.net)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-5 ${LIFT}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Margin leaders</span>
            <div className="mt-3 flex flex-col gap-2.5">
              {marginLeaders.map((t) => (
                <div key={t.tenantId} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-bold tabular-nums text-brand-300">{t.marginPct}%</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-200">{t.tenantName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl border border-surface-400/50 bg-surface-100 p-5 ${LIFT}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Highest cost allocation</span>
            <p className="mt-3 truncate text-sm font-medium text-slate-200">{highestCost.tenantName}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-fg">{formatCurrency(highestCost.allocatedCost)}<span className="ml-1 text-xs font-normal text-slate-500">/mo</span></p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <Building2 className="h-3.5 w-3.5" />
              <span>{costReason}{highestCost.leasedSqft ? ` · ${formatNumber(highestCost.leasedSqft)} sqft` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PORTFOLIO DEPENDENCE — visualize concentration */}
      <div id="dependence" className={`scroll-mt-4 rounded-2xl border border-surface-400/50 bg-surface-100 p-7 ${LIFT}`}>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Portfolio Dependence</span>
        <p className="mt-2 text-sm text-slate-400">Top 3 tenants carry <span className="font-semibold text-fg">{concentrationPct}%</span> of monthly NOI. Each bar is a tenant's share.</p>
        <div className="mt-5 flex flex-col gap-2">
          {tenants.map((t, i) => (
            <div key={t.tenantId} className={`flex items-center gap-3 transition-opacity ${i >= 5 ? 'opacity-40' : ''}`}>
              <span className="w-36 shrink-0 truncate text-xs text-slate-400">{t.tenantName}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-400/30">
                <div className={`h-full rounded-full ${i < 3 ? 'bg-brand-500' : 'bg-slate-500/60'}`} style={{ width: `${maxNet > 0 ? (t.net / maxNet) * 100 : 0}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-300">{totalNet > 0 ? Math.round((t.net / totalNet) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* TENANT RANKING — investigate */}
      <div id="ranking" className="scroll-mt-4 rounded-xl border border-surface-400/50 bg-surface-100 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-surface-400/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-fg">Tenant Ranking</span>
          <span className="text-[10px] text-slate-600">{basisNote}</span>
        </div>
        <div className="flex flex-col divide-y divide-surface-400/20">
          {tenants.map((t, rank) => {
            const isOpen = expanded === t.tenantId;
            const chips = buildChips(rank, t);
            return (
              <div key={t.tenantId}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : t.tenantId)}
                  className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-surface-200/30"
                >
                  <span className="w-6 shrink-0 text-center text-sm">{rank < 3 ? MEDALS[rank] : <span className="text-xs font-medium text-slate-500">{rank + 1}</span>}</span>
                  <Building2 className="h-4 w-4 shrink-0 text-slate-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{t.tenantName}</span>
                  <span className="hidden items-center gap-1.5 sm:flex">
                    {chips.map((c) => (
                      <span key={c.label} className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.className}`}>{c.label}</span>
                    ))}
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-brand-300">{t.marginPct}%</span>
                  <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-success">+{compactCurrency(t.net)}/mo</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                {isOpen && (
                  <div className="bg-surface-200/20 px-5 pb-4 pt-1">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      <Detail label="Rent / mo" value={formatCurrency(t.monthlyRent)} />
                      <Detail label="Allocated cost / mo" value={`−${formatCurrency(t.allocatedCost)}`} valueClass="text-slate-300" />
                      <Detail label="Net NOI / mo" value={formatCurrency(t.net)} valueClass="text-success" />
                      <Detail label="Margin" value={`${t.marginPct}%`} />
                      <Detail label="Leases" value={String(t.leaseCount)} />
                      <Detail label="Leased area" value={t.leasedSqft ? `${formatNumber(t.leasedSqft)} sqft` : '—'} />
                      <Detail label="Next lease ends" value={t.nextLeaseEnd ? `${formatDateShort(t.nextLeaseEnd)}${t.daysToExpiry != null ? ` · ${t.daysToExpiry}d` : ''}` : '—'} />
                      <Detail label="Renewal risk" value={t.renewalRisk ? RISK_TONE[t.renewalRisk].label : '—'} valueClass={t.renewalRisk ? RISK_TONE[t.renewalRisk].text : undefined} />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/tenants?search=${encodeURIComponent(t.tenantName)}&open=${t.tenantId}`)}
                      className="group mt-4 inline-flex items-center gap-1.5 rounded-lg border border-surface-400/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-surface-200/50"
                    >
                      Review tenant
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PORTFOLIO OBSERVATION — conclude */}
      <div id="distribution" className={`scroll-mt-4 rounded-2xl border border-surface-400/50 bg-surface-100 p-7 ${LIFT}`}>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Portfolio Observation</span>
        <p className="mt-3 max-w-3xl text-base font-medium leading-relaxed text-slate-200">{observation}</p>
        <div className="mt-6 flex flex-col gap-2">
          {marginSorted.map((t) => (
            <div key={t.tenantId} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-xs text-slate-400">{t.tenantName}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-400/30">
                <div className={`h-full rounded-full ${t.marginPct > avgMargin ? 'bg-success/80' : t.marginPct === avgMargin ? 'bg-sky-500/80' : 'bg-warning/80'}`} style={{ width: `${t.marginPct}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-300">{t.marginPct}%</span>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-surface-400/30 pt-3 text-[10px] text-slate-600">{basisNote}</p>
      </div>
    </div>
  );
}

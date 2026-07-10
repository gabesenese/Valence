import { useState } from 'react';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { ActivationShell } from './ActivationShell';
import type { AnalysisResult, FindingSeverity } from './activation.types';

const TONE: Record<FindingSeverity, { dot: string; text: string; glow: string }> = {
  critical: { dot: 'bg-danger', text: 'text-danger', glow: '0 0 100px -46px rgba(239,68,68,0.24)' },
  warning: { dot: 'bg-warning', text: 'text-warning', glow: '0 0 100px -46px rgba(245,158,11,0.20)' },
  info: { dot: 'bg-brand-400', text: 'text-brand-400', glow: '0 0 100px -46px rgba(129,140,248,0.20)' },
  positive: { dot: 'bg-success', text: 'text-success', glow: '0 0 100px -46px rgba(16,185,129,0.16)' },
};

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export function InsightScreen({
  result,
  onNavigate,
}: {
  result: AnalysisResult;
  onNavigate: (path: string) => void;
}) {
  const first = useAuthStore((s) => s.user?.firstName?.trim());
  const [ledger, setLedger] = useState(false);

  const top = result.findings[0];
  const rest = result.findings.slice(1);
  const severity = top?.severity ?? 'positive';
  const tone = TONE[severity];
  const hasTask = Boolean(result.directiveDeepLink);
  const impact = result.directiveImpact;
  const reasons = result.directive ? result.directive.split(' · ').map((r) => r.trim()).filter(Boolean) : [];

  const headline =
    severity === 'critical' ? 'one thing needs you today.'
    : severity === 'warning' ? 'a couple of things to look at.'
    : severity === 'positive' ? 'your portfolio is in good shape.'
    : 'here’s where to focus.';

  return (
    <ActivationShell status="analysis complete" statusTone="text-success" pulseLogo>
      <div className="px-9 pb-10 pt-8">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-500/70 mb-4 motion-safe:animate-rise-in">Today’s focus</p>
        <h1
          className="text-[38px] leading-[1.08] font-semibold tracking-[-0.025em] text-fg mb-8 motion-safe:animate-rise-in"
          style={{ animationDelay: '70ms' }}
        >
          {first ? `${first}, ${headline}` : headline.charAt(0).toUpperCase() + headline.slice(1)}
        </h1>

        {/* the signature: the one thing to do first — lit, not bordered */}
        {top && (
          <div
            className="relative rounded-[20px] bg-white/[0.03] p-6 ring-1 ring-white/[0.06] motion-safe:animate-rise-in"
            style={{ animationDelay: '140ms', boxShadow: tone.glow }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${tone.text}`}>Highest priority</span>
              {result.directiveHorizonDays != null && (
                <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums">{result.directiveHorizonDays} days out</span>
              )}
            </div>

            <h2 className="text-[17px] font-semibold text-fg leading-snug mb-3">{top.title}</h2>

            {impact ? (
              <>
                <div className="mb-4">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
                    {impact.frame === 'annual' ? 'Annual revenue at risk' : 'Overdue right now'}
                  </p>
                  <p className={`text-[30px] font-semibold tracking-tight tabular-nums ${tone.text}`}>{usd(impact.amount)}</p>
                </div>
                {reasons.length > 0 && (
                  <ul className="mb-5 space-y-1">
                    {reasons.map((r) => (
                      <li key={r} className="text-[13.5px] leading-relaxed text-slate-400/90">{r}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              result.directive && <p className="text-[15px] text-slate-400/90 leading-relaxed mb-5">{result.directive}</p>
            )}

            <button
              type="button"
              onClick={() => onNavigate(hasTask ? result.directiveDeepLink! : '/queue')}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 h-12 text-[15px] font-semibold text-surface-0 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
            >
              {hasTask ? result.directiveAction ?? 'Start now' : 'Open Work Queue'}
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* the sentence that explains the entire product — real, gated on a real horizon */}
        {result.directiveHorizonDays != null && (
          <p
            className="mt-6 text-[14px] leading-relaxed text-slate-400/80 motion-safe:animate-rise-in"
            style={{ animationDelay: '210ms' }}
          >
            Without Valence, this renewal was <span className="text-slate-200">{result.directiveHorizonDays} days</span> from slipping by unnoticed. Now it’s on your radar.
          </p>
        )}

        {/* everything else we noticed — never repeats the directive, stays light */}
        {rest.length > 0 && (
          <div className="mt-7 motion-safe:animate-rise-in" style={{ animationDelay: '260ms' }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500/70 mb-3.5">Also found</p>
            <div className="space-y-2.5">
              {rest.map((f) => (
                <div key={f.title} className="flex items-center gap-3">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full opacity-70 ${TONE[f.severity].dot}`} />
                  <span className="text-[14px] text-slate-300">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* trust: show exactly what Valence read */}
        <div className="mt-8 motion-safe:animate-rise-in" style={{ animationDelay: '300ms' }}>
          <button
            type="button"
            onClick={() => setLedger((v) => !v)}
            className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ledger ? 'rotate-180' : ''}`} />
            See how this was found
          </button>
          {ledger && (
            <div className="mt-4 grid grid-cols-2 gap-y-2.5 gap-x-6 motion-safe:animate-fade-in">
              {[
                [`${result.propertyCount}`, `propert${result.propertyCount === 1 ? 'y' : 'ies'}`],
                [`${result.leaseCount}`, `lease${result.leaseCount === 1 ? '' : 's'}`],
                [`${result.tenantCount}`, `tenant${result.tenantCount === 1 ? '' : 's'}`],
                [usd(result.annualRevenue), 'annual rent'],
                [`${result.opportunityCount}`, `opportunit${result.opportunityCount === 1 ? 'y' : 'ies'}`],
              ].map(([n, label]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Check className="h-3.5 w-3.5 text-success shrink-0" strokeWidth={2} />
                  <span className="text-[13px] text-slate-300"><span className="font-medium text-fg tabular-nums">{n}</span> {label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* the promise — closure, value not software */}
        <p className="mt-8 border-t border-white/[0.05] pt-6 text-[13.5px] leading-relaxed text-slate-500 motion-safe:animate-rise-in" style={{ animationDelay: '340ms' }}>
          Your portfolio is now being monitored — Valence watches all {result.leaseCount} lease{result.leaseCount === 1 ? '' : 's'} so you don’t have to.
        </p>

        {hasTask && (
          <button
            type="button"
            onClick={() => onNavigate('/queue')}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Continue to Work Queue
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </ActivationShell>
  );
}

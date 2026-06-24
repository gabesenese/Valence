import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, ArrowDown, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { billingService } from '@/services/billing.service';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth.store';
import type { Plan } from '@/state/auth.store';


interface Tier {
  name: string;
  transformation: string;
  outcome: string;
  description: string;
  includes: string;
  limitNote: string;
  plan: Plan | null;
  price: number;
  cta: string;
  featured?: boolean;
}

interface UsageLine {
  name: string;
  essentials: string;
  professional: string;
  executive: string;
}


const TIERS: Tier[] = [
  {
    name: 'Free',
    transformation: 'Try Valence',
    outcome: 'Organize everything.',
    description: 'Keep your properties, leases, and tenants in one place.',
    includes: 'Properties · Leases · Tenants',
    limitNote: 'Up to 3 properties',
    plan: 'FREE',
    price: 0,
    cta: 'Start free',
  },
  {
    name: 'Essentials',
    transformation: 'Get Control',
    outcome: 'Stop managing from spreadsheets.',
    description: 'See revenue, lease activity, and operational issues across your portfolio.',
    includes: 'Revenue · Leases · Alerts',
    limitNote: 'Up to 25 properties',
    plan: 'ESSENTIALS',
    price: 149,
    cta: 'Get Essentials',
  },
  {
    name: 'Professional',
    transformation: 'Protect Revenue',
    outcome: 'Know what\'s about to cost you money.',
    description: 'Valence surfaces expiring leases, revenue risk, and operational issues before they become problems.',
    includes: 'Daily Brief · Revenue at Risk · Automation',
    limitNote: 'Up to 150 properties',
    plan: 'PROFESSIONAL',
    price: 499,
    cta: 'Get Professional',
    featured: true,
  },
  {
    name: 'Executive',
    transformation: 'Lead With Confidence',
    outcome: 'See what\'s coming before everyone else.',
    description: 'Forecast revenue, evaluate risk, and understand the future of your portfolio before you act.',
    includes: 'Revenue Forecasting · Portfolio Intelligence · AI Analyst',
    limitNote: 'Unlimited properties',
    plan: null,
    price: 1499,
    cta: 'Get Executive',
  },
];

const USAGE_LINES: UsageLine[] = [
  { name: 'Contract Processing', essentials: '100 / month',  professional: '1,000 / month', executive: 'Unlimited' },
  { name: 'AI Analysis Runs',    essentials: '500 / month',  professional: '5,000 / month', executive: 'Unlimited' },
  { name: 'Impact Simulations',  essentials: '100 / month',  professional: '500 / month',   executive: 'Unlimited' },
];


function TierCard({ tier, onSelect, loading }: { tier: Tier; onSelect: () => void; loading: boolean }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all ${
        tier.featured
          ? 'border-2 border-brand-500 bg-gradient-to-b from-brand-600/8 to-surface-100 shadow-glow-brand lg:-translate-y-3'
          : 'border border-surface-400/40 bg-surface-100'
      }`}
    >
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-glow-brand">
            <Zap className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tier.name}</p>
      <h3 className={`mt-2 text-xl font-bold tracking-tight ${tier.featured ? 'text-brand-300' : 'text-fg'}`}>
        {tier.transformation}
      </h3>
      <p className="mt-2 text-base font-semibold text-fg leading-snug">{tier.outcome}</p>
      <p className="mt-2 flex-1 text-xs text-slate-500 leading-relaxed">{tier.description}</p>

      <div className="mt-6 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-fg tabular-nums">${tier.price.toLocaleString()}</span>
        <span className="text-sm text-slate-500">/ month</span>
      </div>

      <button
        onClick={onSelect}
        disabled={loading}
        className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
          tier.featured
            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow-brand'
            : 'border border-surface-400 bg-surface-100 hover:bg-surface-200 text-slate-200'
        }`}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {tier.cta}
      </button>

      <p className="mt-4 text-[11px] text-slate-500">Includes <span className="text-slate-400">{tier.includes}</span></p>
      <p className="mt-1 text-[11px] text-slate-500">{tier.limitNote}</p>
    </div>
  );
}


export default function PricingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);
  const [trialClaiming, setTrialClaiming] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const handleSelect = async (tier: Tier) => {
    if (!isAuthenticated) { navigate('/auth/register'); return; }
    if (tier.plan === 'FREE') { navigate('/queue'); return; } // Free is the signup default — just enter the app
    if (!tier.plan) { navigate('/auth/register'); return; } // Executive: routed to contact/registration until self-serve checkout exists
    setCheckoutLoading(tier.plan);
    try {
      const url = await billingService.createCheckout(tier.plan);
      window.location.href = url;
    } catch {
      setCheckoutLoading(null);
    }
  };

  const handleGetStarted = async () => {
    if (!isAuthenticated) { navigate('/auth/register'); return; }
    if (user?.trialEndsAt) {
      setTrialError('This account has already used the 7-day free trial. Choose a plan to continue.');
      return;
    }
    setTrialClaiming(true);
    setTrialError(null);
    try {
      const result = await authService.claimTrial();
      setAuth(result.user, result.tokens.accessToken, result.tokens.refreshToken);
      navigate('/queue');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setTrialError('This account has already used the 7-day free trial. Choose a plan to continue.');
      } else {
        setTrialError('Something went wrong. Please try again.');
      }
    } finally {
      setTrialClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-fg">
      <header className="flex items-center justify-between border-b border-surface-400/30 px-8 py-4">
        <button
          onClick={() => navigate('/queue')}
          className="flex items-center gap-2.5 text-sm font-bold text-fg hover:text-brand-300 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-glow-brand">
            <Zap className="h-4 w-4 text-fg" />
          </div>
          Valence
        </button>
        {isAuthenticated ? (
          <button
            onClick={() => navigate('/queue')}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Go to dashboard →
          </button>
        ) : (
          <button
            onClick={() => navigate('/auth/login')}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign in →
          </button>
        )}
      </header>

      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Outcome-first hero */}
        <div className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-fg tracking-tight leading-[1.1]">
            Fewer surprises. Protected revenue.<br />Better decisions.
          </h1>
          <p className="mt-5 text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
            Choose where your portfolio is today. Valence grows with you.
          </p>
        </div>

        {/* Point the eye at Professional */}
        <div className="flex items-center justify-center gap-2 mb-10 text-sm">
          <span className="text-slate-400">Most teams choose</span>
          <span className="font-semibold text-brand-400">Protect Revenue</span>
          <ArrowDown className="h-4 w-4 text-brand-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch mb-12">
          {TIERS.map(tier => (
            <TierCard
              key={tier.name}
              tier={tier}
              loading={tier.plan !== null && checkoutLoading === tier.plan}
              onSelect={() => handleSelect(tier)}
            />
          ))}
        </div>

        <div className="text-center mb-16">
          <a
            href="#compare"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
          >
            Compare every feature
            <ChevronDown className="h-4 w-4" />
          </a>
        </div>

        <div id="compare" className="scroll-mt-8 rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden mb-16">
          <div className="px-6 py-5 border-b border-surface-400/30">
            <h2 className="text-sm font-semibold text-fg">What's included in every plan</h2>
            <p className="mt-1 text-xs text-slate-500">
              No surprise overages. Each plan comes with a fixed monthly allowance.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-400/20">
                  <th className="px-6 py-3 text-left font-medium text-slate-500 w-1/2" />
                  {(['Essentials', 'Professional', 'Executive'] as const).map(col => (
                    <th key={col} className={`px-4 py-3 text-center font-semibold ${col === 'Professional' ? 'text-brand-300' : 'text-slate-300'}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-400/20">
                {USAGE_LINES.map(line => (
                  <tr key={line.name}>
                    <td className="px-6 py-3.5 text-slate-300 font-medium">{line.name}</td>
                    <td className="px-4 py-3.5 text-center text-slate-400">{line.essentials}</td>
                    <td className="px-4 py-3.5 text-center text-slate-300">{line.professional}</td>
                    <td className="px-4 py-3.5 text-center font-semibold text-brand-300">{line.executive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trial CTA */}
        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/5 to-surface-100 p-8 text-center">
          <h2 className="text-xl font-bold text-fg mb-2">Try Professional free for 7 days</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Start every morning knowing exactly what needs your attention — no credit card required.
          </p>
          <button
            onClick={handleGetStarted}
            disabled={trialClaiming || checkoutLoading !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-6 py-3 text-sm font-semibold text-white transition-colors shadow-glow-brand"
          >
            {trialClaiming && <Loader2 className="h-4 w-4 animate-spin" />}
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </button>
          {trialError ? (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {trialError}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">No credit card required · Cancel anytime</p>
          )}
        </div>
      </div>
    </div>
  );
}

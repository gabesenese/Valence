import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Shield, Eye, TrendingUp, ArrowRight, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { billingService } from '@/services/billing.service';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/state/auth.store';
import type { Plan } from '@/state/auth.store';


interface Tier {
  name: string;
  transformation: string;
  audience: string;
  plan: Plan | null;
  price: number;
  description: string;
  outcomes: string[];
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
    audience: 'For exploring Valence',
    plan: 'FREE',
    price: 0,
    description: 'Store and organize your portfolio.',
    outcomes: ['Properties', 'Leases', 'Tenants'],
    cta: 'Start free',
  },
  {
    name: 'Essentials',
    transformation: 'Get Control',
    audience: 'For owner-operators',
    plan: 'ESSENTIALS',
    price: 149,
    description: 'Monitor revenue, leases, and operational risk.',
    outcomes: ['Revenue Tracking', 'Lease Monitoring', 'Payment Alerts'],
    cta: 'Start with Essentials',
  },
  {
    name: 'Professional',
    transformation: 'Protect Revenue',
    audience: 'For growing teams',
    plan: 'PROFESSIONAL',
    price: 499,
    description: 'Know what needs attention before it costs you money.',
    outcomes: ['Daily Brief', 'Revenue At Risk', 'Automation'],
    cta: 'Start with Professional',
    featured: true,
  },
  {
    name: 'Executive',
    transformation: 'Lead With Confidence',
    audience: 'For portfolio leadership',
    plan: null,
    price: 1499,
    description: 'Make better portfolio decisions with forecasting and intelligence.',
    outcomes: ['Revenue Forecasting', 'Portfolio Intelligence', 'AI Analyst'],
    cta: 'Talk to us',
  },
];

const UPGRADE_TRIGGERS = ['Revenue tracking', 'Portfolio alerts', 'Financial monitoring', 'Operational workflows'];

const USAGE_LINES: UsageLine[] = [
  { name: 'Contract Processing', essentials: '100 / month',  professional: '1,000 / month', executive: 'Unlimited' },
  { name: 'AI Analysis Runs',    essentials: '500 / month',  professional: '5,000 / month', executive: 'Unlimited' },
  { name: 'Impact Simulations',  essentials: '100 / month',  professional: '500 / month',   executive: 'Unlimited' },
];

const VALUE_PROPS = [
  {
    icon: Eye,
    color: 'text-brand-400',
    bg: 'bg-brand-600/10',
    title: 'Visibility',
    description: 'Every property, lease, tenant, and financial in one place — always current.',
  },
  {
    icon: Shield,
    color: 'text-success',
    bg: 'bg-success/10',
    title: 'Protection',
    description: 'Detect revenue risk before it becomes revenue loss.',
  },
  {
    icon: TrendingUp,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: 'Decisions',
    description: 'Turn portfolio data into clear priorities and strategic decisions.',
  },
];


function TierCard({ tier, onSelect, loading }: { tier: Tier; onSelect: () => void; loading: boolean }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        tier.featured
          ? 'border-brand-500/50 bg-brand-600/5 ring-1 ring-brand-500/20 shadow-glow-brand'
          : 'border-surface-400/40 bg-surface-100'
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

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tier.name}</p>
        <h3 className={`mt-1 text-2xl font-bold tracking-tight ${tier.featured ? 'text-brand-300' : 'text-fg'}`}>
          {tier.transformation}
        </h3>
        {tier.featured && <p className="mt-1 text-[11px] font-medium text-brand-400">{tier.audience}</p>}
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold text-fg tabular-nums">${tier.price.toLocaleString()}</span>
          <span className="text-sm text-slate-500">/ month</span>
        </div>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">{tier.description}</p>
      </div>

      <ul className="flex flex-col gap-3 flex-1">
        {tier.outcomes.map((outcome, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${tier.featured ? 'bg-brand-600/30' : 'bg-surface-300/60'}`}>
              <Check className={`h-2.5 w-2.5 ${tier.featured ? 'text-brand-300' : 'text-slate-400'}`} />
            </div>
            <span className="text-xs font-medium text-slate-300">{outcome}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        disabled={loading}
        className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 ${
          tier.featured
            ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow-brand'
            : 'bg-surface-300/60 hover:bg-surface-300 text-slate-200'
        }`}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {tier.cta}
      </button>
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
    if (!tier.plan) { navigate('/auth/register'); return; } // Executive: contact us
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
        <div className="text-center mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-400">Operational Intelligence Platform</p>
          <h1 className="text-4xl font-bold text-fg tracking-tight">
            Priced for outcomes,<br />not features
          </h1>
          <p className="mt-4 text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Valence is not property management software. It's not a CRM.
            It's the command center that turns portfolio data into daily decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-16">
          {VALUE_PROPS.map(({ icon: Icon, color, bg, title, description }) => (
            <div key={title} className="flex items-start gap-4 rounded-xl border border-surface-400/30 bg-surface-100 p-5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-4.5 w-4.5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-16">
          {TIERS.map(tier => (
            <TierCard
              key={tier.name}
              tier={tier}
              loading={tier.plan !== null && checkoutLoading === tier.plan}
              onSelect={() => handleSelect(tier)}
            />
          ))}
        </div>

        <div className="mb-16 rounded-2xl border border-brand-500/20 bg-brand-600/5 p-6 sm:p-7">
          <p className="text-sm font-semibold text-fg">Most owners upgrade from Free when they need:</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {UPGRADE_TRIGGERS.map(trigger => (
              <div key={trigger} className="flex items-center gap-2.5 rounded-xl border border-surface-400/40 bg-surface-100 px-3.5 py-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-600/15">
                  <ArrowUpRight className="h-2.5 w-2.5 text-brand-400" />
                </span>
                <span className="text-xs font-medium text-slate-300">{trigger}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden mb-16">
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

        {/* CTA */}
        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/5 to-surface-100 p-8 text-center">
          <h2 className="text-xl font-bold text-fg mb-2">Most customers land on Professional</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Once your team uses Valence every morning to manage their work queue,
            it becomes operationally critical — and the ROI is obvious.
          </p>
          <button
            onClick={handleGetStarted}
            disabled={trialClaiming || checkoutLoading !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-6 py-3 text-sm font-semibold text-white transition-colors shadow-glow-brand"
          >
            {trialClaiming && <Loader2 className="h-4 w-4 animate-spin" />}
            Get started
            <ArrowRight className="h-4 w-4" />
          </button>
          {trialError ? (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {trialError}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-600">No credit card required · 7-day free trial</p>
          )}
        </div>
      </div>
    </div>
  );
}

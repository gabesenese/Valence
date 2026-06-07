import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Shield, Eye, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import { billingService } from '@/services/billing.service';
import { useAuthStore } from '@/state/auth.store';
import type { Plan } from '@/state/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tier {
  name: string;
  plan: Plan | null;
  price: number;
  tagline: string;
  description: string;
  limit: string;
  outcomes: string[];
  cta: string;
  featured?: boolean;
}

interface UsageLine {
  name: string;
  included: string;
  overage: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TIERS: Tier[] = [
  {
    name: 'Essentials',
    plan: 'ESSENTIALS',
    price: 149,
    tagline: 'Full visibility into your portfolio',
    description: 'For operators who need a single source of truth across properties, leases, and tenants.',
    limit: 'Up to 25 properties · 500 leases',
    outcomes: [
      'Know every lease status, payment, and expiration date at a glance',
      'Catch payment issues before they become revenue losses',
      'Track financial performance across every property',
      'Get instant alerts when something needs attention',
    ],
    cta: 'Start with Essentials',
  },
  {
    name: 'Professional',
    plan: 'PROFESSIONAL',
    price: 499,
    tagline: 'Protect revenue. Stay ahead of risk.',
    description: 'For growing portfolios where every lease matters and daily operations need a command center.',
    limit: 'Up to 150 properties · 5,000 leases',
    outcomes: [
      'Start every morning knowing exactly what to work on',
      'Get AI-generated briefs on your portfolio\'s biggest risks',
      'Automated monitoring flags lease expirations 90 days out',
      'See which properties are underperforming and why',
      'Build workflows that escalate problems before they become crises',
    ],
    cta: 'Start with Professional',
    featured: true,
  },
  {
    name: 'Executive',
    plan: null,
    price: 1499,
    tagline: 'AI intelligence for large portfolios',
    description: 'For portfolio owners managing institutional-scale assets who need a permanent AI analyst.',
    limit: 'Unlimited properties and leases',
    outcomes: [
      'Model financial impact of any decision before you commit',
      'Extract key terms and obligations from contracts automatically',
      'Forecast revenue for the next 12 months across your portfolio',
      'Executive reporting built for board-level conversations',
      'Full AI operations analyst available on demand',
    ],
    cta: 'Talk to us',
  },
];

const USAGE_LINES: UsageLine[] = [
  { name: 'Contract Processing',  included: '100 / month included',  overage: '$0.50 per lease' },
  { name: 'AI Analysis Runs',     included: '500 / month included',  overage: '$0.02 per run'   },
  { name: 'Impact Simulations',   included: '100 / month included',  overage: '$0.25 each'      },
];

const VALUE_PROPS = [
  {
    icon: Eye,
    color: 'text-brand-400',
    bg: 'bg-brand-600/10',
    title: 'Visibility',
    description: 'Know what\'s happening across every property, lease, and tenant — without digging through spreadsheets.',
  },
  {
    icon: Shield,
    color: 'text-success',
    bg: 'bg-success/10',
    title: 'Protection',
    description: 'Prevent revenue loss before it happens. Automated monitoring catches lease risk, overdue payments, and vacancy exposure early.',
  },
  {
    icon: TrendingUp,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: 'Decisions',
    description: 'Know what to do next. AI-generated briefings turn portfolio data into specific, prioritized actions every morning.',
  },
];

// ─── Tier card ────────────────────────────────────────────────────────────────

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold text-white shadow-glow-brand">
            <Zap className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{tier.name}</h3>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold text-white tabular-nums">${tier.price.toLocaleString()}</span>
          <span className="text-sm text-slate-500">/ month</span>
        </div>
        <p className={`mt-2 text-sm font-semibold ${tier.featured ? 'text-brand-300' : 'text-slate-300'}`}>
          {tier.tagline}
        </p>
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{tier.description}</p>
        <p className="mt-3 text-[11px] text-slate-600">{tier.limit}</p>
      </div>

      <ul className="flex flex-col gap-3 flex-1">
        {tier.outcomes.map((outcome, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${tier.featured ? 'bg-brand-600/30' : 'bg-surface-300/60'}`}>
              <Check className={`h-2.5 w-2.5 ${tier.featured ? 'text-brand-300' : 'text-slate-400'}`} />
            </div>
            <span className="text-xs text-slate-400 leading-relaxed">{outcome}</span>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [checkoutLoading, setCheckoutLoading] = useState<Plan | null>(null);

  const handleSelect = async (tier: Tier) => {
    if (!isAuthenticated) { navigate('/auth/register'); return; }
    if (!tier.plan) { navigate('/auth/register'); return; } // Executive: contact us
    setCheckoutLoading(tier.plan);
    try {
      const url = await billingService.createCheckout(tier.plan);
      window.location.href = url;
    } catch {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      {/* Nav */}
      <header className="flex items-center justify-between border-b border-surface-400/30 px-8 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-sm font-bold text-white hover:text-brand-300 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-glow-brand">
            <Zap className="h-4 w-4 text-white" />
          </div>
          Valence
        </button>
        <button
          onClick={() => navigate('/auth/login')}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Sign in →
        </button>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-400">Operational Intelligence Platform</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Priced for outcomes,<br />not features
          </h1>
          <p className="mt-4 text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
            Valence is not property management software. It's not a CRM.
            It's the command center that turns portfolio data into daily decisions.
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-16">
          {VALUE_PROPS.map(({ icon: Icon, color, bg, title, description }) => (
            <div key={title} className="flex items-start gap-4 rounded-xl border border-surface-400/30 bg-surface-100 p-5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-4.5 w-4.5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-16">
          {TIERS.map(tier => (
            <TierCard
              key={tier.name}
              tier={tier}
              loading={checkoutLoading === tier.plan}
              onSelect={() => handleSelect(tier)}
            />
          ))}
        </div>

        {/* Usage */}
        <div className="rounded-2xl border border-surface-400/40 bg-surface-100 overflow-hidden mb-16">
          <div className="px-6 py-5 border-b border-surface-400/30">
            <h2 className="text-sm font-semibold text-white">Usage-based add-ons</h2>
            <p className="mt-1 text-xs text-slate-500">
              Each plan includes generous usage limits. Overages are billed monthly.
            </p>
          </div>
          <div className="divide-y divide-surface-400/20">
            {USAGE_LINES.map(line => (
              <div key={line.name} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">{line.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{line.included}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-400">{line.overage}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">above included limit</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/5 to-surface-100 p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Most customers land on Professional</h2>
          <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
            Once your team uses Valence every morning to manage their work queue,
            it becomes operationally critical — and the ROI is obvious.
          </p>
          <button
            onClick={() => handleSelect(TIERS[1])}
            disabled={checkoutLoading !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-6 py-3 text-sm font-semibold text-white transition-colors shadow-glow-brand"
          >
            {checkoutLoading === 'PROFESSIONAL' && <Loader2 className="h-4 w-4 animate-spin" />}
            Get started
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-xs text-slate-600">No credit card required · 14-day free trial</p>
        </div>
      </div>
    </div>
  );
}

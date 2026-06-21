import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Building2, FileText, Users, Bell, Inbox,
  ChevronRight, CheckCircle2,
  Cpu, BarChart3, Shield, Zap, Play, Loader2, BookOpen, Lock, Database,
} from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';
import { eventService } from '@/services/event.service';
import { cn } from '@/utils/cn';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';

const QUEUE_ITEMS = [
  {
    id: 1,
    severity: 'critical' as const,
    icon: FileText,
    title: 'Marina Bay Complex — Lease expires in 12 days',
    meta: 'Suite 4B · $8,400 / mo · Tenant has not responded',
    action: 'Send Renewal Offer',
  },
  {
    id: 2,
    severity: 'critical' as const,
    icon: FileText,
    title: 'Pacific Heights Office — Lease expires in 18 days',
    meta: 'Unit 12 · $5,100 / mo · Renewal risk: high',
    action: 'Schedule Call',
  },
  {
    id: 3,
    severity: 'warning' as const,
    icon: Bell,
    title: 'Riverfront Tower — Overdue payment $4,200',
    meta: '22 days past due · 3rd notice sent',
    action: 'Escalate to Collections',
  },
  {
    id: 4,
    severity: 'warning' as const,
    icon: Building2,
    title: 'Oakwood Plaza — Occupancy at 68%',
    meta: 'Below 75% threshold · 3 units vacant 60+ days',
    action: 'Review Pricing Strategy',
  },
];

function QueueMock() {
  return (
    <div className="w-full rounded-2xl border border-surface-400/40 bg-surface-100 shadow-[0_32px_80px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* Chrome bar */}
      <div className="flex items-center justify-between gap-3 border-b border-surface-400/30 bg-surface-200/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-danger/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
        </div>
        <div className="flex-1 mx-6">
          <div className="mx-auto h-5 max-w-xs rounded-md border border-surface-400/30 bg-surface-300/40 flex items-center justify-center">
            <span className="text-[10px] text-slate-600">app.valence.com</span>
          </div>
        </div>
        <div className="w-14" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-400/20 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-semibold text-fg">Work Queue</span>
            <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] font-bold text-danger">4 urgent</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Items ranked by revenue impact</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Portfolio health</p>
          <div className="mt-1 flex items-center gap-1.5 justify-end">
            <div className="h-1.5 w-16 rounded-full bg-surface-400/60 overflow-hidden">
              <div className="h-full w-[64%] rounded-full bg-warning" />
            </div>
            <span className="text-xs font-semibold text-warning">64%</span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-surface-400/20">
        {QUEUE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-200/40 transition-colors">
              <div className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                item.severity === 'critical' ? 'bg-danger/10' : 'bg-warning/10',
              )}>
                <Icon className={cn('h-3.5 w-3.5', item.severity === 'critical' ? 'text-danger' : 'text-warning')} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{item.meta}</p>
              </div>
              <button className="shrink-0 rounded-md border border-surface-500/60 bg-surface-300/40 px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:border-brand-500/40 hover:text-brand-300 transition-colors whitespace-nowrap">
                {item.action}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer strip */}
      <div className="flex items-center justify-between border-t border-surface-400/20 bg-surface-200/30 px-5 py-3">
        <span className="text-[11px] text-slate-600">2 critical · 2 warning · $12,600 at risk</span>
        <span className="text-[11px] text-brand-400">View all items →</span>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, title, body }: { n: number; icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-500/30 bg-brand-600/10">
          <Icon className="h-6 w-6 text-brand-400" />
        </div>
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{n}</span>
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function Persona({
  icon: Icon, title, tagline, points,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  points: string[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-surface-400/40 bg-surface-100 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/10">
        <Icon className="h-5 w-5 text-brand-400" />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 text-xs text-brand-300/80">{tagline}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span className="text-xs leading-snug text-slate-400">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  const user    = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/queue', { replace: true });
  }, [user, navigate]);

  useEffect(() => { eventService.track('visitor'); }, []);

  if (user) return null;

  async function handleDemo() {
    setDemoLoading(true);
    try {
      const { user: u, tokens } = await authService.demoLogin();
      setAuth(u, tokens.accessToken, tokens.refreshToken);
      navigate('/queue', { replace: true });
    } catch {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 text-fg">
      {/* Ambient glow — hidden on mobile, too expensive to rasterize on phone GPUs */}
      <div className="pointer-events-none fixed inset-0 hidden overflow-hidden md:block">
        <div className="absolute -top-48 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-600/8 blur-[120px]" />
        <div className="absolute top-1/3 -right-48 h-96 w-96 rounded-full bg-brand-800/6 blur-[100px]" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <PublicHeader />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-600/10 px-4 py-1.5 text-xs font-semibold text-brand-300 mb-6">
          <Cpu className="h-3 w-3" />
          Commercial Real Estate Operating System
        </div>

        <h1 className="text-5xl font-bold leading-[1.12] tracking-tight text-fg md:text-6xl lg:text-7xl">
          Protect Revenue<br />
          <span className="text-brand-400">Across Your Portfolio</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
          Know which leases, properties, and risks require attention before they become problems.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/auth/register"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500 transition-colors"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={handleDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-500 bg-surface-100 px-6 py-3 text-sm font-semibold text-slate-300 hover:border-brand-500/50 hover:text-fg transition-colors disabled:opacity-60"
          >
            {demoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-brand-400" />}
            {demoLoading ? 'Loading demo…' : 'Explore Demo Portfolio'}
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600">No credit card required · 7-day free trial · Cancel any time</p>
      </section>

      {/* ── Work Queue Visual ────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
        <QueueMock />
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-surface-400/20 bg-surface-50/40 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-2">How It Works</p>
            <h2 className="text-3xl font-bold text-fg">From spreadsheet chaos<br />to operational clarity</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Connector lines */}
            <div className="absolute top-7 left-[calc(16.66%+1.75rem)] right-[calc(16.66%+1.75rem)] hidden h-px bg-gradient-to-r from-brand-500/40 via-brand-400/60 to-brand-500/40 md:block" />

            <Step
              n={1}
              icon={Building2}
              title="Import Your Portfolio"
              body="Upload properties, leases, and tenants in minutes. CSV, manual entry, or direct import."
            />
            <Step
              n={2}
              icon={Bell}
              title="Valence Identifies Risks"
              body="Automated monitoring flags lease expirations, payment gaps, and vacancy exposure — ranked by revenue impact."
            />
            <Step
              n={3}
              icon={Inbox}
              title="Take Action"
              body="Your Work Queue tells you exactly what to do next. Every item, every day, ordered by what matters most."
            />
          </div>
        </div>
      </section>

      {/* ── Built For ───────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-2">Built For</p>
            <h2 className="text-3xl font-bold text-fg">Every role in your organization</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Persona
              icon={Building2}
              title="Portfolio Managers"
              tagline="Full control across every asset"
              points={[
                'Single view of all properties, leases, and tenants',
                'Work Queue surfaces daily priorities automatically',
                'Catch lease expirations 90+ days before they hit',
                'Track every task and escalation with full history',
              ]}
            />
            <Persona
              icon={BarChart3}
              title="Asset Managers"
              tagline="NOI visibility and revenue protection"
              points={[
                'Real-time revenue and expense tracking per property',
                'Occupancy trends and underperformance alerts',
                'Lease renewal risk scored and ranked',
                'Impact simulations before you commit to a decision',
              ]}
            />
            <Persona
              icon={Zap}
              title="Executives"
              tagline="Strategic intelligence, not noise"
              points={[
                'Morning brief surfaces your biggest risks daily',
                'Portfolio health score across every KPI',
                'Board-ready reporting without manual aggregation',
                'Escalation visibility — nothing slips through',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Feature Strip ────────────────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-surface-400/20 bg-surface-50/40 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FileText,
                color: 'text-brand-400',
                bg: 'bg-brand-600/10',
                title: 'Lease Intelligence',
                body: 'Expiration monitoring, renewal tracking, and tenant communication history — all in one place.',
              },
              {
                icon: Shield,
                color: 'text-success',
                bg: 'bg-success/10',
                title: 'Revenue Protection',
                body: 'Payment alerts, delinquency prevention, and overdue escalation before a dollar is lost.',
              },
              {
                icon: Users,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                title: 'Team Accountability',
                body: 'Assign, track, and close operational tasks. Every action logged with full audit trail.',
              },
            ].map((f) => (
              <div key={f.title} className="flex flex-col gap-3 rounded-2xl border border-surface-400/40 bg-surface-100 p-5">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', f.bg)}>
                  <f.icon className={cn('h-4 w-4', f.color)} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-2">About Valence</p>
            <h2 className="text-3xl font-bold text-fg">Built with intention.<br />Operated with trust.</h2>
            <p className="mt-4 mx-auto max-w-lg text-sm leading-relaxed text-slate-500">
              We built Valence because commercial real estate operators deserve better than spreadsheets and inboxes.
              Here's what drives us, and how we handle your data.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: BookOpen,
                iconColor: 'text-brand-400',
                iconBg: 'bg-brand-600/10',
                eyebrow: 'Mission & Story',
                heading: 'Why we built Valence',
                body: 'Revenue slips through the cracks when no one has a clear picture. Valence exists to give operators the one answer that matters: what to do today.',
                href: '/about/mission',
                linkLabel: 'Read our story',
              },
              {
                icon: Lock,
                iconColor: 'text-violet-400',
                iconBg: 'bg-violet-500/10',
                eyebrow: 'Privacy & Terms',
                heading: 'How we handle your data',
                body: 'We collect only what we need to run the product, never sell it, and give you clear rights to access, export, or delete it at any time.',
                href: '/about/privacy',
                linkLabel: 'Read privacy terms',
              },
              {
                icon: Database,
                iconColor: 'text-success',
                iconBg: 'bg-success/10',
                eyebrow: 'Data Controls',
                heading: 'You control your data',
                body: 'Export everything in one click, set retention policies, and manage team access. Your portfolio data belongs to you — not us.',
                href: '/about/data-controls',
                linkLabel: 'View data controls',
              },
            ].map((card) => (
              <div key={card.heading} className="flex flex-col rounded-2xl border border-surface-400/40 bg-surface-100 p-6">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl mb-4', card.iconBg)}>
                  <card.icon className={cn('h-4 w-4', card.iconColor)} />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">{card.eyebrow}</p>
                <h3 className="text-sm font-semibold text-fg">{card.heading}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 flex-1">{card.body}</p>
                <Link
                  to={card.href}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors group"
                >
                  {card.linkLabel}
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo CTA ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-1.5 text-xs font-semibold text-success mb-6">
            <CheckCircle2 className="h-3 w-3" /> Interactive Demo — No Setup Required
          </div>
          <h2 className="text-4xl font-bold text-fg">
            See it live.<br />
            <span className="text-brand-400">Decide in minutes.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-400">
            Our demo portfolio loads instantly with real properties, leases, alerts, and Work Queue items — fully functional, no account needed.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleDemo}
              disabled={demoLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500 transition-colors disabled:opacity-60"
            >
              {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {demoLoading ? 'Loading demo…' : 'Explore Demo Portfolio'}
            </button>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-surface-500 bg-surface-100 px-6 py-3 text-sm font-semibold text-slate-300 hover:border-brand-500/50 transition-colors"
            >
              View Pricing <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <PublicFooter />
    </div>
  );
}

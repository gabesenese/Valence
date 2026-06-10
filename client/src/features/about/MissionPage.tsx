import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AboutLayout, Section } from './AboutLayout';

export default function MissionPage() {
  return (
    <AboutLayout
      eyebrow="Mission & Story"
      title="Revenue should never slip through the cracks"
      intro="Valence exists because the most expensive problems in commercial real estate are the ones nobody saw coming — an expiring lease, a quietly delinquent tenant, a property drifting below break-even. We turn portfolio data into the one thing operators actually need: a clear answer to “what should I do today?”"
    >
      <Section heading="Why we built it">
        <p>
          Commercial portfolios still run on spreadsheets, inboxes, and memory. The information needed to
          protect revenue exists — it's just scattered across files, people, and systems that don't talk to
          each other. By the time a risk surfaces, it has usually already cost money.
        </p>
        <p>
          We started Valence to close that gap: to give portfolio, asset, and executive teams a single
          source of truth that doesn't just store data, but actively watches it and tells you where to look.
        </p>
      </Section>

      <Section heading="What we believe">
        <p>
          <span className="text-slate-200 font-medium">Operations beat dashboards.</span> A chart that looks
          good in a board deck rarely tells you what to do on a Tuesday morning. We optimize for action, not
          decoration.
        </p>
        <p>
          <span className="text-slate-200 font-medium">Software should earn its place daily.</span> The tools
          worth paying for are the ones your team opens every morning. Everything we build has to increase
          activation, daily usage, or retention — or it doesn't ship.
        </p>
        <p>
          <span className="text-slate-200 font-medium">Your data is yours.</span> We are custodians, not
          owners. That principle shapes how we handle privacy, retention, and security across the product.
        </p>
      </Section>

      <Section heading="Where we're going">
        <p>
          The Work Queue is the heart of Valence today — every risk across your portfolio, ranked by revenue
          impact, in one prioritized list. From there we're building toward forecasting, automated escalation,
          and portfolio-wide contract intelligence, so the system doesn't just surface problems but helps you
          resolve them.
        </p>
      </Section>

      <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/5 to-surface-100 p-8">
        <h2 className="text-xl font-bold text-white">See it on your own portfolio</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Explore the demo portfolio — no account required — or start a free trial and import your own.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/auth/register"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500 transition-colors"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-surface-500 bg-surface-100 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:border-brand-500/50 hover:text-white transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </div>
    </AboutLayout>
  );
}

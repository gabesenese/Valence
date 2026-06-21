import { Download, Clock, Trash2, MapPin } from 'lucide-react';
import { AboutLayout, Section } from './AboutLayout';

const CONTROLS = [
  {
    icon: Download,
    title: 'Export anytime',
    body: 'Export your properties, leases, tenants, and financials to CSV whenever you want. Your data is never locked in, and export does not require contacting support.',
  },
  {
    icon: Clock,
    title: 'Retention you control',
    body: 'Active data is retained for as long as your account is open. You decide what stays — archive records you no longer need without deleting the history behind them.',
  },
  {
    icon: Trash2,
    title: 'Deletion on request',
    body: 'Close your account and request full deletion, and we remove your portfolio data from production systems, with backups purged on a rolling 30-day cycle.',
  },
  {
    icon: MapPin,
    title: 'Know where it lives',
    body: 'Your data is stored with reputable cloud infrastructure providers under contractual data-protection terms. We tell you which subprocessors are involved.',
  },
];

export default function DataControlsPage() {
  return (
    <AboutLayout
      eyebrow="Data Controls"
      title="Your data, your control"
      intro="Valence is the system of record for your portfolio — which means you should be able to get your data out, keep it as long as you need, and remove it when you don't. Here's exactly how that works."
      updated="June 2026"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTROLS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-3 rounded-2xl border border-surface-400/40 bg-surface-100 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/10">
              <Icon className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <Section heading="Ownership">
        <p>
          You own the data you put into Valence. We act as a custodian to provide the service — we don't sell
          it, and we don't use your portfolio data to train third-party AI models.
        </p>
      </Section>

      <Section heading="AI processing">
        <p>
          When you use AI features, the relevant data is sent to our AI subprocessor solely to generate your
          result and is not retained for training. You can operate Valence's core operational features without
          AI; the AI capabilities are a separate, optional layer.
        </p>
      </Section>

      <Section heading="Access & permissions">
        <p>
          Within your organization, role-based permissions control who can see and change what. Every
          meaningful action is captured in an audit trail, so data access inside your team is accountable and
          reviewable.
        </p>
      </Section>

      <Section heading="Requesting an export or deletion">
        <p>
          Most exports are self-serve from within the app. For a full account export or a deletion request,
          email{' '}
          <a href="mailto:support@valenceos.ca" className="text-brand-300 hover:text-brand-200 transition-colors">
            support@valenceos.ca
          </a>{' '}
          from your account address and we'll process it promptly.
        </p>
      </Section>
    </AboutLayout>
  );
}

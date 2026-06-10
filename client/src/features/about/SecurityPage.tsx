import { Lock, KeyRound, ScrollText, ServerCog } from 'lucide-react';
import { AboutLayout, Section } from './AboutLayout';

const PILLARS = [
  {
    icon: Lock,
    title: 'Encryption everywhere',
    body: 'Data is encrypted in transit with TLS and at rest in our databases and backups. Credentials are hashed, never stored in plain text.',
  },
  {
    icon: KeyRound,
    title: 'Access control',
    body: 'Role-based permissions scope every user to exactly what they need. Sessions are token-based with refresh rotation and expiry.',
  },
  {
    icon: ScrollText,
    title: 'Audit trail',
    body: 'Meaningful actions across the platform are logged with full history, so you can see who did what and when.',
  },
  {
    icon: ServerCog,
    title: 'Hardened infrastructure',
    body: 'We run on reputable cloud providers with isolated environments, least-privilege service access, and regular dependency patching.',
  },
];

export default function SecurityPage() {
  return (
    <AboutLayout
      eyebrow="Security"
      title="Built to protect your portfolio"
      intro="Valence holds sensitive operational and financial data, so security isn't a feature bolted on at the end — it's part of how the product is designed, built, and run."
      updated="June 2026"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-3 rounded-2xl border border-surface-400/40 bg-surface-100 p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
              <Icon className="h-4 w-4 text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <Section heading="Data isolation">
        <p>
          Each organization's data is logically isolated and scoped to its account. Application-level checks
          ensure users can only ever reach records belonging to their own organization.
        </p>
      </Section>

      <Section heading="Responsible practices">
        <p>
          We follow least-privilege access for our own team, keep dependencies patched, and limit who can
          touch production. AI subprocessors receive only the data needed to fulfill a request and don't
          retain it for training.
        </p>
      </Section>

      <Section heading="Reporting a vulnerability">
        <p>
          Found something that looks off? We appreciate responsible disclosure. Email{' '}
          <a href="mailto:security@valenceos.ca" className="text-brand-300 hover:text-brand-200 transition-colors">
            security@valenceos.ca
          </a>{' '}
          with the details and we'll respond quickly. Please give us a reasonable window to remediate before
          any public disclosure.
        </p>
      </Section>
    </AboutLayout>
  );
}

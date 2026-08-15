import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, Scale } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const SUPPORT_EMAIL = 'support@valenceos.ca';

interface Column {
  title: string;
  links: { label: string; href: string }[];
}

const COLUMNS: Column[] = [
  {
    title: 'Product',
    links: [
      { label: 'Work Queue',      href: '#queue' },
      { label: 'Leases',          href: '#leases' },
      { label: 'Finance',         href: '#finance' },
      { label: 'Impact Analysis', href: '#simulator' },
      { label: 'Pricing',         href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Mission & Story', href: '/mission' },
      { label: 'Security',        href: '/security' },
      { label: 'Contact',         href: `mailto:${SUPPORT_EMAIL}` },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy & Terms', href: '/privacy' },
      { label: 'Data Controls',   href: '/data-controls' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Start free trial', href: '/auth/register' },
      { label: 'Sign in',          href: '/auth/login' },
      { label: 'FAQ',              href: '#faq' },
    ],
  },
];

const COMMITMENTS = [
  { label: 'TLS in transit',      icon: Lock,        href: '/security' },
  { label: 'Encrypted at rest',   icon: ShieldCheck, href: '/security' },
  { label: 'GDPR & CCPA rights',  icon: Scale,       href: '/privacy' },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  const className = 'text-sm text-slate-400 transition-colors duration-200 hover:text-fg';
  if (href.startsWith('#') || href.startsWith('mailto:')) {
    return <a href={href} className={className}>{label}</a>;
  }
  return <Link to={href} className={className}>{label}</Link>;
}

export function LandingFooter() {
  const [email, setEmail] = useState('');

  const subscribeHref =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent('Product updates')}` +
    `&body=${encodeURIComponent(`Please add ${email || 'my address'} to the Valence product update list.`)}`;

  return (
    <footer className="border-t border-surface-400 bg-surface-50">
      <div className="mx-auto max-w-[70rem] px-6 py-20">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5" aria-label="Valence home">
              <Logo className="h-7 w-5" />
              <span className="text-[0.9375rem] font-semibold tracking-tight text-fg">Valence</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              The operating layer for commercial real estate. Every risk ranked, every action logged.
            </p>

            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = subscribeHref;
              }}
            >
              <label htmlFor="footer-email" className="landing-eyebrow block text-slate-500">
                Product updates
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  id="footer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-surface-400 bg-surface-100 px-3 text-sm text-fg outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-brand-500"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-surface-400 bg-surface-100 px-3.5 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-brand-500 hover:text-fg"
                >
                  Notify me
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2.5 text-xs leading-5 text-slate-500">
                Opens your mail app so the request comes from you. Occasional notes on what shipped, nothing else.
              </p>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="landing-eyebrow text-slate-500">{col.title}</p>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {col.links.map((l) => (
                    <li key={l.label}><FooterLink {...l} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-surface-400 pt-8 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-wrap items-center gap-2.5">
            {COMMITMENTS.map((c) => (
              <li key={c.label}>
                <Link
                  to={c.href}
                  className="inline-flex items-center gap-2 rounded-lg border border-surface-400 px-3 py-1.5 text-xs text-slate-400 transition-colors duration-200 hover:border-surface-500 hover:text-fg"
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-5">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              aria-label={`Email ${SUPPORT_EMAIL}`}
              className="text-slate-500 transition-colors duration-200 hover:text-fg"
            >
              <Mail className="h-4 w-4" />
            </a>
            <p className="text-xs text-slate-500">© {new Date().getFullYear()} Valence</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

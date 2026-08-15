import {
  AlertTriangle, CalendarClock, Banknote, Scale, Building2, ShieldAlert, FileWarning,
} from 'lucide-react';
import { PLAN_LIMITS } from '@valence/shared';

/*
 * Every figure and label on the marketing page resolves to something the product
 * actually enforces: the AlertType enum, the 90-day work-queue horizon, and the
 * Professional plan allowances in @valence/shared. Nothing here is illustrative.
 */

export const EXPIRY_HORIZON_DAYS = 90;

export interface Signal {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SIGNALS: Signal[] = [
  { label: 'Lease expiration',      icon: CalendarClock },
  { label: 'Renewal risk',          icon: AlertTriangle },
  { label: 'Payment anomaly',       icon: Banknote },
  { label: 'Financial discrepancy', icon: Scale },
  { label: 'Occupancy change',      icon: Building2 },
  { label: 'Compliance flag',       icon: ShieldAlert },
  { label: 'Data missing',          icon: FileWarning },
];

export interface Shot {
  dark: string;
  light: string;
}

export interface Feature {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  bullets: string[];
  shot: Shot;
  alt: string;
  demoPath: string;
  linkLabel: string;
}

export const WORK_QUEUE_SHOT: Shot = {
  dark:  '/product-shots/dark/work-queue.png',
  light: '/product-shots/light/work-queue.png',
};

export const FEATURES: Feature[] = [
  {
    id: 'queue',
    eyebrow: 'Work Queue',
    headline: 'Ranked. Not listed.',
    body: 'Your portfolio arrives every morning as an ordered list of decisions, heaviest dollar impact first. Each item carries the single action that closes it.',
    bullets: [
      'Every open risk scored by revenue at stake',
      'One action per item, taken without leaving the queue',
      'Snooze and reschedule, items resurface on their due date',
      'Assign to a teammate and watch it through to closed',
    ],
    shot: WORK_QUEUE_SHOT,
    alt: 'The Valence Work Queue, showing portfolio risks ordered by revenue impact',
    demoPath: '/queue',
    linkLabel: 'Open the Work Queue',
  },
  {
    id: 'leases',
    eyebrow: 'Leases',
    headline: 'Expiries. Caught early.',
    body: `Every active lease is watched against a ${EXPIRY_HORIZON_DAYS}-day horizon, so a renewal window opens as a task on your list instead of closing as a vacancy on your rent roll.`,
    bullets: [
      `Expirations surface ${EXPIRY_HORIZON_DAYS} days out, automatically`,
      'Renewal risk scored per lease, not per building',
      'Full lifecycle from draft to signed, in one record',
      'Tenant contact history attached to the lease it belongs to',
    ],
    shot: { dark: '/product-shots/dark/leases.png', light: '/product-shots/light/leases.png' },
    alt: 'The Valence lease register with renewal risk scoring',
    demoPath: '/leases',
    linkLabel: 'Open the lease register',
  },
  {
    id: 'finance',
    eyebrow: 'Finance',
    headline: 'Leaks. Found first.',
    body: 'Revenue is derived from the leases you already keep current, so overdue rent, thinning margin, and mispriced units read as flags to work, not columns to reconcile.',
    bullets: [
      'Revenue derived from live lease terms, never re-keyed',
      'Overdue balances escalated before they age out',
      'Expenses attributed to the property that incurred them',
      'Budgets set once, tracked every month after',
    ],
    shot: { dark: '/product-shots/dark/finance.png', light: '/product-shots/light/finance.png' },
    alt: 'The Valence finance workspace showing revenue at risk and margin',
    demoPath: '/finance',
    linkLabel: 'Open the finance workspace',
  },
  {
    id: 'simulator',
    eyebrow: 'Impact Analysis',
    headline: 'Model. Then commit.',
    body: 'Test a vacancy, a rent change, or an acquisition against your real portfolio before it is real. You get the revenue and NOI effect, plus the reasoning that produced it.',
    bullets: [
      'Runs against your actual leases and expenses',
      'Revenue and NOI impact shown side by side',
      'Assumptions stated, so the number can be argued with',
      'Save a scenario and revisit it when terms change',
    ],
    shot: { dark: '/product-shots/dark/impact-analysis.png', light: '/product-shots/light/impact-analysis.png' },
    alt: 'The Valence impact analysis screen modelling a portfolio scenario',
    demoPath: '/simulator',
    linkLabel: 'Open impact analysis',
  },
];

export interface Stat {
  value: number;
  display: (n: number) => string;
  label: string;
  note: string;
}

export const STATS: Stat[] = [
  {
    value: EXPIRY_HORIZON_DAYS,
    display: (n) => String(n),
    label: 'Days of expiry lead time',
    note: 'Every active lease, continuously',
  },
  {
    value: SIGNALS.length,
    display: (n) => String(n),
    label: 'Risk signals monitored',
    note: 'Across leases, payments, and occupancy',
  },
  {
    value: PLAN_LIMITS.PROFESSIONAL.leases,
    display: (n) => n.toLocaleString('en-US'),
    label: 'Leases per portfolio',
    note: 'Professional plan allowance',
  },
  {
    value: PLAN_LIMITS.PROFESSIONAL.simulations,
    display: (n) => n.toLocaleString('en-US'),
    label: 'Impact runs per month',
    note: 'Professional plan allowance',
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'What does Valence actually do?',
    a: 'It watches the operational side of a commercial portfolio and tells you what to work on today. Leases, rent, occupancy, and compliance are monitored continuously, and anything that puts revenue at risk becomes a ranked item with an action attached. It is an operations layer, not an accounting system, and it does not replace your general ledger.',
  },
  {
    q: 'Do I have to migrate off the system I use now?',
    a: 'No. Most portfolios start by importing properties, leases, and tenants from a spreadsheet or a set of lease PDFs, which takes minutes and leaves your existing system untouched. Direct connectors are being built, starting with QuickBooks Online for expenses. The rest of the connector list is on the roadmap, not shipped.',
  },
  {
    q: 'Can I see it before I sign up for anything?',
    a: 'Yes. The demo button on this page signs you into a fully populated portfolio in one click, with no account, no card, and no sales call. Every screen you see here is the same product running on that portfolio.',
  },
  {
    q: 'How does the free trial work?',
    a: 'Seven days on the Professional plan, no card required to start. At the end you pick a plan or the account drops to the Free tier. Nothing is charged automatically.',
  },
  {
    q: 'What size portfolio is this built for?',
    a: `Essentials covers ${PLAN_LIMITS.ESSENTIALS.properties} properties and ${PLAN_LIMITS.ESSENTIALS.leases.toLocaleString('en-US')} leases, Professional covers ${PLAN_LIMITS.PROFESSIONAL.properties} properties and ${PLAN_LIMITS.PROFESSIONAL.leases.toLocaleString('en-US')} leases, and Executive is unlimited. These are the limits the product enforces, not guidance.`,
  },
  {
    q: 'Where does my data live, and who can reach it?',
    a: 'Data is encrypted in transit with TLS and at rest in our databases and backups, and credentials are hashed rather than stored. Every query is scoped to your account. You can export everything or delete it at any time, and we honour the access, correction, and erasure rights under GDPR and CCPA.',
  },
];

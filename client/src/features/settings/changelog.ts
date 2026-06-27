export type ChangeType = 'added' | 'improved' | 'fixed';

export interface ChangelogEntry {
  date: string;
  title: string;
  changes: { type: ChangeType; text: string }[];
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  added:    'New',
  improved: 'Improved',
  fixed:    'Fixed',
};

// Newest first. User-facing release notes — keep the language plain and benefit-led.
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: 'June 26, 2026',
    title: 'Drill into your revenue trends',
    changes: [
      { type: 'added', text: 'Click any month on the Revenue Trend (dashboard) or Net Income Trend (analytics) charts to jump straight to that month’s financial records.' },
    ],
  },
  {
    date: 'June 25, 2026',
    title: 'Documents, late fees, and integrations',
    changes: [
      { type: 'added', text: 'Attach documents to any lease — agreements, amendments, insurance certificates, inspection reports — right from the lease page.' },
      { type: 'added', text: 'Configure late fees per lease (flat amount or % of rent, grace period, interest) with a live estimate of the fee on a missed payment.' },
      { type: 'added', text: 'A new Integrations area to request connections with your property management software (AppFolio, Buildium, Yardi, Rent Manager, MRI).' },
      { type: 'added', text: "This \"What's New\" page, so you can follow every update we ship." },
    ],
  },
  {
    date: 'June 25, 2026',
    title: 'Click any chart to see what is behind the number',
    changes: [
      { type: 'added', text: 'Lease Status, Lease Risk and Revenue at Risk now drill straight into the matching leases when you click them.' },
      { type: 'added', text: 'A "Vacant only" filter on Properties, and the Occupancy tile on the dashboard opens your properties with available units.' },
      { type: 'added', text: 'Click a month on the Revenue vs Expenses chart to see the financial records for that month.' },
      { type: 'fixed', text: 'Lease status chart labels are now readable in dark mode.' },
    ],
  },
  {
    date: 'June 24, 2026',
    title: 'Pricing you can trust',
    changes: [
      { type: 'fixed', text: 'Plan allowances shown on the pricing page now match exactly what each plan actually includes.' },
      { type: 'improved', text: 'Each plan now enforces a clear monthly allowance — no surprise overages.' },
    ],
  },
];

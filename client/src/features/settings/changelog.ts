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

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
    title: 'Connect QuickBooks and sync your expenses automatically',
    changes: [
      { type: 'added', text: 'Connect QuickBooks and pull your expenses straight into Valence — no more re-typing them by hand.' },
      { type: 'added', text: 'Every imported expense is matched to the right property automatically — by property code or name, or the Class, Location or Customer it carries in QuickBooks.' },
      { type: 'added', text: "A Mapping Center for anything that can't be matched automatically. Map a QuickBooks tag to a property once and every future sync resolves it for you — no guessing." },
      { type: 'added', text: 'Synced expenses are labelled with their source in Financial Records, so you always know what came from QuickBooks versus what you entered.' },
      { type: 'added', text: 'A sync history and health view for each connection — success rate, last sync, next scheduled sync and records imported — so you can trust the numbers.' },
      { type: 'improved', text: 'After a sync, Valence tells you exactly how many expenses still need a property and takes you straight to the Mapping Center.' },
      { type: 'added', text: 'Integrations now has its own place in the sidebar, with QuickBooks ready to connect on the Professional plan.' },
    ],
  },
  {
    date: 'June 26, 2026',
    title: 'See where every dollar goes',
    changes: [
      { type: 'added', text: 'Expenses by Category — a clear breakdown of where your money goes, with click-to-filter on the records below.' },
      { type: 'added', text: 'Expense Trends — see which cost categories are rising or falling month over month.' },
      { type: 'added', text: 'Tenant Profitability — rent against allocated operating costs per tenant, with margins, so you can see who is actually profitable.' },
      { type: 'added', text: 'NOI Forecast — projected net operating income for the months ahead as leases roll off.' },
      { type: 'added', text: 'Budgets — set a monthly budget per category and track actual against budget at a glance.' },
      { type: 'added', text: 'Import expenses and financial data from Excel (.xlsx) and text files, not just CSV.' },
      { type: 'fixed', text: "Clicking a month on the Revenue vs Expenses chart now shows that month's expenses as well as its revenue." },
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

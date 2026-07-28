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
    date: 'July 24, 2026',
    title: 'A simulator you can trust, numbers that agree everywhere',
    changes: [
      { type: 'improved', text: 'The Impact Simulator now shows its work: every result lists the assumptions and estimates it rests on, baselines come from your trailing three complete months (so results don’t swing with the calendar day), and confidence reflects how much real data sits behind the number.' },
      { type: 'added',    text: 'Choose the scope of any simulation — your entire portfolio, a single property, or one specific lease for rent increases — and the result always states which scope it covers.' },
      { type: 'added',    text: 'Modeling an acquisition? Start from a property you already own — its unit count and trailing revenue and expenses pre-fill the form as a realistic template you can adjust.' },
      { type: 'improved', text: 'Simulator results now state where their guidance comes from — analysis written by AI from your computed figures, or standard guidance — and are clearly marked as informational, not financial advice.' },
      { type: 'improved', text: 'Money fields now read like money — amounts group with thousands separators as you type.' },
      { type: 'fixed',    text: 'Items sitting in the Trash no longer count toward your metrics. Occupancy, health score, analytics, anomaly scans and tenant counts now agree on every page, even with trashed leases or properties.' },
      { type: 'improved', text: 'Backups are sturdier: a pre-import snapshot is always completed before the import touches your data, and older snapshots are pruned automatically so they don’t pile up.' },
      { type: 'improved', text: 'The team list now shows only your own organization’s members, and owners can remove a member in place.' },
    ],
  },
  {
    date: 'July 12, 2026',
    title: 'Smoother motion, truer signals',
    changes: [
      { type: 'improved', text: 'The whole app moves more smoothly — modals, dropdowns and tab switches animate in and out, stats count up, and Work Queue items cascade into place.' },
      { type: 'improved', text: 'Occupancy now shows on a continuous color scale — the closer to full, the greener — instead of three flat color buckets.' },
      { type: 'fixed',    text: 'A property’s page now shows only that property’s alerts — alerts from your other properties and leases no longer leak in.' },
      { type: 'fixed',    text: 'The lease countdown now tracks the expiry date, matching the risk badge next to it — setting a near renewal date no longer makes a healthy lease look urgent.' },
      { type: 'fixed',    text: 'The Email Tenant window no longer renders its content flush against the edges.' },
    ],
  },
  {
    date: 'July 11, 2026',
    title: 'Sharper signals, direct action',
    changes: [
      { type: 'improved', text: 'Alert badges on renewal cards now show the alert title and severity on hover — see what needs attention without leaving the board.' },
      { type: 'improved', text: 'Clicking Review on any alert takes you directly to the relevant section of the record — renewal stage, compliance, ledger, occupancy — with it highlighted so you see it immediately.' },
      { type: 'added',    text: 'Email a tenant from the lease page. Choose a template (renewal reminder, payment reminder, document request, and more), review the pre-filled message with their real details, and send. Each message is logged to their CRM timeline automatically.' },
      { type: 'improved', text: 'Every kanban stage move and every field edit now appears in the Audit Log with exactly what changed — previous and new stage, or the specific fields with their before and after values.' },
    ],
  },
  {
    date: 'July 10, 2026',
    title: '30-day sessions, smarter work queue, and alert emails',
    changes: [
      { type: 'fixed',    text: 'Valence now keeps you signed in for a full 30 days as promised — a bug was logging accounts out after 7 days.' },
      { type: 'added',    text: 'Email an alert to a teammate directly from the Alert Center. For critical deadline alerts, opt into automatic notifications in Settings → Preferences.' },
      { type: 'improved', text: 'The Work Queue opens with your critical work visible immediately — Critical Today is now expanded by default.' },
      { type: 'improved', text: 'The "N financial issues require attention" summary on Finance is now a link that jumps to the issues below it.' },
      { type: 'added',    text: 'Share a one-click trial link (valenceos.ca/try) with a prospect — they register and land in Valence with a 7-day trial ready to go.' },
      { type: 'fixed',    text: 'Amounts under $1,000 now display as clean whole dollars throughout Finance.' },
    ],
  },
  {
    date: 'July 7, 2026',
    title: 'Documents are durable, Finance starts on day one',
    changes: [
      { type: 'improved', text: 'Documents attached to leases are now stored durably — uploads persist and are accessible across sessions.' },
      { type: 'improved', text: 'Finance shows contract run-rate revenue from your active leases immediately, even before expenses are imported, so the page is useful from day one.' },
      { type: 'improved', text: 'Account owners can now delete their own documents, edit automation rules, and update organization settings.' },
    ],
  },
  {
    date: 'July 5, 2026',
    title: 'A smoother start, a clearer Finance, and a sturdier platform',
    changes: [
      { type: 'added', text: 'A guided first run for new accounts — get your portfolio in and see what Valence flags for you, without sitting through a long tour.' },
      { type: 'added', text: 'Contextual tips that teach one operating habit per page — how to think about your portfolio, not where the buttons are. Each shows once and stays gone once you dismiss it.' },
      { type: 'added', text: 'Once your real data is in, a gentle prompt to invite a teammate so your team shares the same view.' },
      { type: 'improved', text: 'Every panel on the Finance Overview now answers one question — Priorities (what to do), Health (what’s driving your score) and Outlook (what’s coming) — so the same numbers aren’t repeated across the page and what needs doing stands out.' },
      { type: 'improved', text: 'Your portfolio health score now reflects how much data it’s based on: when data is still thin it reads as a provisional estimate instead of a falsely perfect 100.' },
      { type: 'improved', text: 'The Organization page is rebuilt as a calm administration workspace — a Today’s Work inbox surfaces what needs attention (pending invites, unused seats, an incomplete profile), with a clearer team roster and a focused panel to manage each member’s role and access in place.' },
      { type: 'improved', text: 'A calmer sidebar: Organization and Integrations now live inside Account, so the navigation stays focused on daily work.' },
      { type: 'improved', text: 'Behind the scenes: your audit log and documents are strictly scoped to your own account, uploads are checked for safe file types, and rate limits are per-user so normal work is never throttled.' },
      { type: 'fixed', text: 'If something fails to load, the page now offers a “Try again” instead of going blank.' },
      { type: 'fixed', text: 'Lease-expiration reminders no longer pile up as duplicates — you get one clear alert per lease.' },
      { type: 'fixed', text: 'Leases can no longer be saved with an end date that falls before the start date.' },
      { type: 'fixed', text: 'Property codes are kept unique within your account, even when two are added at the same moment.' },
    ],
  },
  {
    date: 'June 30, 2026',
    title: 'Finance now tells you what to do, not just what happened',
    changes: [
      { type: 'added', text: 'A new Finance Overview that reads your portfolio for you: an executive health score, the risks that need attention, and a ranked list of what to do today — each with the dollars at stake.' },
      { type: 'added', text: 'Finance is now organized around the question each page answers — Overview (how healthy am I?), Forecast (what’s about to happen?), Expenses (where is money leaking?), Profitability (who makes me money?), Ledger (what needs attention today?) and Budgets (what limits have I set?).' },
      { type: 'added', text: 'A Forecast that shows where your NOI is heading if nothing changes, the leases driving it, and the exact renewals that protect it — apply an action and watch the projected outcome update live.' },
      { type: 'added', text: 'Tenant Profitability with a Portfolio Dependence view: see who creates value, your margin leaders, and how much of your NOI rides on your top few tenants.' },
      { type: 'added', text: 'Expense intelligence that surfaces your largest costs, flags categories running above their usual level, and quantifies how much you could save each year.' },
      { type: 'added', text: 'Work gets done in place: renewals, collections, flagged transactions and late-fee policies each open a focused workspace with a recommendation already prepared — resolve it and the page updates itself.' },
      { type: 'improved', text: 'Every metric now carries context and a way to drill in — trends versus last month, and one click from a portfolio number down to the leases, tenants and records behind it.' },
    ],
  },
  {
    date: 'June 27, 2026',
    title: 'Smarter leases and late-fee revenue',
    changes: [
      { type: 'added', text: 'After Valence reads a signed lease, you can apply the extracted terms straight to the lease record — rent, dates, escalation, deposit, square footage and more — instead of retyping them.' },
      { type: 'added', text: 'A Late Fee Forecast on the Finance page: see the late-fee revenue you can collect on overdue rent, based on each lease’s policy (flat or % of balance, plus interest past the grace period).' },
      { type: 'improved', text: 'Overdue leases with no late-fee policy are flagged, so you can set one and start capturing that revenue.' },
    ],
  },
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

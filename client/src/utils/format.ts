import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

let _orgCurrency = 'USD';
export function setOrgCurrency(currency: string) { _orgCurrency = currency; }

function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
}

export function formatCurrency(amount: number, currency = _orgCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy');
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MM/dd/yy');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(d, new Date());
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Revenue trend charts label points "MMM yy" or "MMM yyyy" (e.g. "Jun 26" / "Jun 2026").
// Map a clicked label to that month's [from, to] range so Finance can filter its records.
export function monthLabelToRange(label: string): { period: string; from: string; to: string } | null {
  const [mon, yearStr] = label.trim().split(/\s+/);
  const m = MONTH_ABBR.indexOf(mon);
  const yr = Number(yearStr);
  if (m < 0 || !Number.isFinite(yr)) return null;
  const year = yr < 100 ? 2000 + yr : yr;
  return {
    period: `${mon} ${year}`,
    from: new Date(year, m, 1, 0, 0, 0, 0).toISOString(),
    to: new Date(year, m + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

export function compactCurrency(amount: number, currency = _orgCurrency): string {
  const sym = currencySymbol(currency);
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(0)}K`;
  return `${sym}${amount}`;
}

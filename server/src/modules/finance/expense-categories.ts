// Server copy of the operating-expense category codes. Kept in sync with the
// shared list (@valence/shared) by a drift-guard test — the server's tsconfig
// rootDir prevents importing the shared package from source, same as PLAN_LIMITS.
export const EXPENSE_CATEGORY_VALUES: string[] = [
  'MAINTENANCE',
  'REPAIRS',
  'HVAC',
  'UTILITIES',
  'CLEANING',
  'LANDSCAPING',
  'INSURANCE',
  'PROPERTY_TAX',
  'CAPITAL_IMPROVEMENT',
  'VENDOR',
  'MANAGEMENT',
  'OTHER',
];

// Best-effort mapping of an external accounting "expense account" name (e.g. from
// QuickBooks) to a Valence expense category. Falls back to OTHER.
export function mapAccountNameToCategory(accountName: string | undefined | null): string {
  const n = (accountName ?? '').toLowerCase();
  if (!n) return 'OTHER';
  if (/hvac|heating|cooling|air.?condition/.test(n)) return 'HVAC';
  if (/repair/.test(n)) return 'REPAIRS';
  if (/maintenance|maint\b/.test(n)) return 'MAINTENANCE';
  if (/utilit|electric|water|hydro|sewer|\bgas\b|power/.test(n)) return 'UTILITIES';
  if (/clean|janitor/.test(n)) return 'CLEANING';
  if (/landscap|lawn|snow|grounds/.test(n)) return 'LANDSCAPING';
  if (/insurance/.test(n)) return 'INSURANCE';
  if (/tax/.test(n)) return 'PROPERTY_TAX';
  if (/improvement|capital|renovat/.test(n)) return 'CAPITAL_IMPROVEMENT';
  if (/management|mgmt|property manager/.test(n)) return 'MANAGEMENT';
  if (/vendor|supplies|materials/.test(n)) return 'VENDOR';
  return 'OTHER';
}

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

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  MAINTENANCE:         'Maintenance',
  REPAIRS:             'Repairs',
  HVAC:                'HVAC',
  UTILITIES:           'Utilities',
  CLEANING:            'Cleaning',
  LANDSCAPING:         'Landscaping',
  INSURANCE:           'Insurance',
  PROPERTY_TAX:        'Property Taxes',
  CAPITAL_IMPROVEMENT: 'Capital Improvement',
  VENDOR:              'Vendor Invoice',
  MANAGEMENT:          'Management Fees',
  OTHER:               'Other',
};

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  if (value === 'RENT') return 'Rent';
  if (value === 'UNCATEGORIZED') return 'Uncategorized';
  return EXPENSE_CATEGORY_LABEL[value] ?? value;
}

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

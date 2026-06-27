export interface ExpenseCategory {
  value: string;
  label: string;
}

// Canonical operating-expense categories, single-sourced for the finance filter,
// the records table, and (later) expense import + NOI breakdowns.
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { value: 'MAINTENANCE',         label: 'Maintenance' },
  { value: 'REPAIRS',             label: 'Repairs' },
  { value: 'HVAC',                label: 'HVAC' },
  { value: 'UTILITIES',           label: 'Utilities' },
  { value: 'CLEANING',            label: 'Cleaning' },
  { value: 'LANDSCAPING',         label: 'Landscaping' },
  { value: 'INSURANCE',           label: 'Insurance' },
  { value: 'PROPERTY_TAX',        label: 'Property Taxes' },
  { value: 'CAPITAL_IMPROVEMENT', label: 'Capital Improvement' },
  { value: 'VENDOR',              label: 'Vendor Invoice' },
  { value: 'MANAGEMENT',          label: 'Management Fees' },
  { value: 'OTHER',               label: 'Other' },
];

export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value);

const EXPENSE_LABEL_BY_VALUE = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

// Display label for a stored category code. 'RENT' is the auto-generated revenue
// category; anything unknown falls back to the raw value.
export function categoryLabel(value: string | null | undefined): string {
  if (!value) return '—';
  if (value === 'RENT') return 'Rent';
  return EXPENSE_LABEL_BY_VALUE.get(value) ?? value;
}

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

/**
 * Canadian tenancy jurisdiction rules — single source of truth.
 *
 * ⚠️ NOT LEGAL ADVICE. This table is a scaffold for *advisory* signals only.
 * Canadian residential tenancy law is provincial and changes (rent-increase
 * guidelines are reset every year). Two hard rules govern this file:
 *
 *   1. Never fabricate a legal value. Yearly-variable numbers (rent-increase
 *      cap, notice days) stay `null` until a human verifies them against the
 *      province's current published source. `null` means "no assertion".
 *   2. A row only drives an assertive, customer-facing statement once
 *      `verifiedAsOf` is set (by a human, ideally with counsel sign-off).
 *      Until then, callers must stay advisory ("verify with counsel").
 *
 * The drift-guard test (server/src/test/jurisdiction.test.ts) enforces shape
 * completeness and catches fabricated numbers on unverified rows.
 */

export type Province =
  | 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS'
  | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';

export const PROVINCES: readonly Province[] = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

export type PropertyClass = 'RESIDENTIAL' | 'COMMERCIAL';

/**
 * How up-front tenant money is treated.
 * - LAST_MONTH_ONLY: no damage/security deposit; last-month's-rent only (ON).
 * - SECURITY_ALLOWED: a damage/security deposit is permitted (usually capped).
 * - NONE: no deposit of any kind may be required (QC residential).
 * - null: not yet verified — do not assert.
 */
export type DepositRule = 'LAST_MONTH_ONLY' | 'SECURITY_ALLOWED' | 'NONE';

export interface JurisdictionRule {
  province: Province;
  propertyClass: PropertyClass;

  /** Structural facts (change rarely). `null` = not yet verified. */
  rentControlled: boolean | null;        // is there a government cap on annual increase?
  lateFeesPermitted: boolean | null;     // may a landlord charge a late-payment fee?
  depositRule: DepositRule | null;
  depositInterestPayable: boolean | null;

  /** Yearly-variable — NEVER fabricate. `null` until verified for the year. */
  rentIncreaseCapPct: number | null;
  rentIncreaseNoticeDays: number | null;
  minMonthsBetweenIncreases: number | null;

  /** ISO date a human last verified this row. `null` => advisory only. */
  verifiedAsOf: string | null;
  /** Public sources used at verification time. */
  sources?: string[];
  notes?: string;
}

const UNKNOWN = {
  rentControlled: null,
  lateFeesPermitted: null,
  depositRule: null,
  depositInterestPayable: null,
  rentIncreaseCapPct: null,
  rentIncreaseNoticeDays: null,
  minMonthsBetweenIncreases: null,
  verifiedAsOf: null,
} as const;

/**
 * Commercial leasing is freedom of contract across Canada — no rent control,
 * late fees and deposits are whatever the lease says. These are structural and
 * stable, so encoded, but still `verifiedAsOf: null` pending counsel sign-off.
 */
function commercial(province: Province): JurisdictionRule {
  return {
    province,
    propertyClass: 'COMMERCIAL',
    rentControlled: false,
    lateFeesPermitted: true,
    depositRule: 'SECURITY_ALLOWED',
    depositInterestPayable: null,
    rentIncreaseCapPct: null,
    rentIncreaseNoticeDays: null,
    minMonthsBetweenIncreases: null,
    verifiedAsOf: null,
    notes: 'Commercial tenancies are governed by the lease + provincial commercial tenancy act — freedom of contract.',
  };
}

function residential(province: Province, overrides: Partial<JurisdictionRule>): JurisdictionRule {
  return { province, propertyClass: 'RESIDENTIAL', ...UNKNOWN, ...overrides };
}

/**
 * Only genuinely stable, textbook structural facts are encoded below.
 * Everything numeric (caps, notice days) is intentionally left `null`.
 * verifiedAsOf stays `null` everywhere until a human signs off.
 */
const RESIDENTIAL_RULES: Record<Province, JurisdictionRule> = {
  ON: residential('ON', {
    rentControlled: true,             // annual guideline; units first occupied after 2018-11-15 are exempt
    lateFeesPermitted: false,         // RTA does not permit late-payment fees
    depositRule: 'LAST_MONTH_ONLY',   // no damage deposit; last-month's-rent only
    depositInterestPayable: true,     // LMR interest at the guideline rate
    notes: 'No damage deposit (LMR only, interest payable). No late fees under the RTA. Post-2018-11-15 units exempt from the rent-increase guideline.',
  }),
  QC: residential('QC', {
    rentControlled: true,             // TAL calculation method; tenant-contestable
    lateFeesPermitted: false,
    depositRule: 'NONE',              // no deposit of any kind may be required
    depositInterestPayable: false,
    notes: 'No deposits permitted (not even last month). Rent increases follow the TAL method and are contestable.',
  }),
  BC: residential('BC', {
    rentControlled: true,             // annual allowable increase set yearly
    depositRule: 'SECURITY_ALLOWED',  // damage deposit + pet deposit, each capped ~½ month
    depositInterestPayable: true,
    notes: 'Rent-controlled. Security + pet deposits allowed (each capped). Cap % and notice period vary yearly — verify.',
  }),
  MB: residential('MB', {
    rentControlled: true,
    notes: 'Rent-controlled (annual guideline with some exemptions). Verify current values.',
  }),
  PE: residential('PE', {
    rentControlled: true,
    notes: 'Rent-controlled (annual allowable increase). Verify current values.',
  }),
  NS: residential('NS', {
    rentControlled: true,             // temporary rent cap in effect in recent years
    notes: 'Temporary rent cap in effect in recent years — verify whether still active and its value.',
  }),
  AB: residential('AB', {
    rentControlled: false,            // no cap on amount; frequency + notice still apply
    notes: 'No rent-control cap on the amount. Increase frequency (once/12mo) and notice still apply — verify.',
  }),
  SK: residential('SK', {
    rentControlled: false,
    notes: 'No rent-control cap on the amount. Notice requirements still apply — verify.',
  }),
  // Structural stance not confidently known here — left fully unverified.
  NB: residential('NB', { notes: 'Not yet verified.' }),
  NL: residential('NL', { notes: 'Not yet verified.' }),
  NT: residential('NT', { notes: 'Not yet verified.' }),
  NU: residential('NU', { notes: 'Not yet verified.' }),
  YT: residential('YT', { notes: 'Not yet verified.' }),
};

const COMMERCIAL_RULES: Record<Province, JurisdictionRule> = Object.fromEntries(
  PROVINCES.map((p) => [p, commercial(p)]),
) as Record<Province, JurisdictionRule>;

export const JURISDICTION_RULES: Record<PropertyClass, Record<Province, JurisdictionRule>> = {
  RESIDENTIAL: RESIDENTIAL_RULES,
  COMMERCIAL: COMMERCIAL_RULES,
};

/** Map an app PropertyType to the two regulatory classes. MIXED_USE → residential (stricter). */
export function toPropertyClass(type: string): PropertyClass {
  return type === 'COMMERCIAL' || type === 'RETAIL' || type === 'OFFICE' || type === 'INDUSTRIAL'
    ? 'COMMERCIAL'
    : 'RESIDENTIAL';
}

/** Look up the rule row for a province + class. Returns null for an unknown province. */
export function jurisdictionRules(province: string, propertyClass: PropertyClass): JurisdictionRule | null {
  const p = province?.toUpperCase() as Province;
  if (!PROVINCES.includes(p)) return null;
  return JURISDICTION_RULES[propertyClass][p];
}

/** A row is safe to assert from only once a human has verified it. */
export function isRuleVerified(rule: JurisdictionRule | null): boolean {
  return Boolean(rule?.verifiedAsOf);
}

export const JURISDICTION_DISCLAIMER =
  'Advisory only, not legal advice. Verify against current provincial rules and, where it matters, with counsel.';

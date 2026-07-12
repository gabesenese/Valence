import { describe, it, expect } from 'vitest';
import {
  PROVINCES,
  JURISDICTION_RULES,
  jurisdictionRules,
  toPropertyClass,
  isRuleVerified,
  type JurisdictionRule,
} from '@valence/shared';

const allRows: JurisdictionRule[] = [
  ...PROVINCES.map((p) => JURISDICTION_RULES.RESIDENTIAL[p]),
  ...PROVINCES.map((p) => JURISDICTION_RULES.COMMERCIAL[p]),
];

describe('jurisdiction rules table', () => {
  it('covers every province for both residential and commercial', () => {
    for (const p of PROVINCES) {
      expect(JURISDICTION_RULES.RESIDENTIAL[p]?.province).toBe(p);
      expect(JURISDICTION_RULES.COMMERCIAL[p]?.province).toBe(p);
    }
  });

  it('lookup is case-insensitive and rejects unknown provinces', () => {
    expect(jurisdictionRules('on', 'RESIDENTIAL')?.province).toBe('ON');
    expect(jurisdictionRules('ZZ', 'RESIDENTIAL')).toBeNull();
  });

  it('maps app property types to the stricter regulatory class', () => {
    expect(toPropertyClass('RESIDENTIAL')).toBe('RESIDENTIAL');
    expect(toPropertyClass('MIXED_USE')).toBe('RESIDENTIAL');
    expect(toPropertyClass('COMMERCIAL')).toBe('COMMERCIAL');
    expect(toPropertyClass('RETAIL')).toBe('COMMERCIAL');
  });

  // No Placeholder Data guard: an UNVERIFIED row must never carry fabricated
  // yearly-variable legal numbers. Numbers may only appear once verifiedAsOf is set.
  it('never asserts numeric legal values on unverified rows', () => {
    for (const rule of allRows) {
      if (!isRuleVerified(rule)) {
        expect(rule.rentIncreaseCapPct, `${rule.province}/${rule.propertyClass} cap`).toBeNull();
        expect(rule.rentIncreaseNoticeDays, `${rule.province}/${rule.propertyClass} notice`).toBeNull();
        expect(rule.minMonthsBetweenIncreases, `${rule.province}/${rule.propertyClass} interval`).toBeNull();
      }
    }
  });

  // Staleness guard: any row a human HAS verified must be re-checked yearly,
  // since rent-increase guidelines reset annually.
  it('flags verified rows older than 12 months for re-verification', () => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    for (const rule of allRows) {
      if (rule.verifiedAsOf) {
        expect(
          new Date(rule.verifiedAsOf).getTime(),
          `${rule.province}/${rule.propertyClass} verifiedAsOf is stale — re-verify against current provincial guidance`,
        ).toBeGreaterThan(cutoff.getTime());
      }
    }
  });

  it('commercial is freedom-of-contract everywhere (no rent control)', () => {
    for (const p of PROVINCES) {
      expect(JURISDICTION_RULES.COMMERCIAL[p].rentControlled).toBe(false);
    }
  });
});

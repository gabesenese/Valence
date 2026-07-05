import { describe, it, expect } from 'vitest';
import { computeHealthScore, type HealthInput } from '../modules/finance/intelligence/financial-health.service';

/**
 * Guards the confidence cap on the portfolio health score: a clean portfolio can
 * only claim a perfect 100 when the underlying data is HIGH confidence. Otherwise
 * the score must sit below 100 so it never contradicts a flagged Data Quality
 * factor (no false precision — see the "no placeholder data" rule).
 */

const clean: HealthInput = {
  monthlyRevenue: 10_000,
  netCurrent: 5_000,
  revenueDeltaPct: 0,
  expenseDeltaPct: 0,
  expensesComparable: true,
  atRisk: { totalAtRisk: 0, leaseCount: 0, highRiskCount: 0, renewalsNotStarted: 0 },
  overBudgetCount: 0,
  worstBudgetVariancePct: null,
  overdueBalance: 0,
  flaggedRecords: 0,
  confidence: { level: 'HIGH', basis: 'complete data' },
};

const dq = (r: ReturnType<typeof computeHealthScore>) => r.factors.find((f) => f.key === 'dataQuality')!;

describe('computeHealthScore — confidence cap', () => {
  it('a clean portfolio with HIGH confidence scores a perfect 100', () => {
    const r = computeHealthScore(clean);
    expect(r.score).toBe(100);
    expect(dq(r).status).toBe('ok');
  });

  it('LOW confidence caps the score below 100 while Data Quality reads bad (no contradiction)', () => {
    const r = computeHealthScore({ ...clean, confidence: { level: 'LOW', basis: 'thin history' } });
    expect(dq(r).status).toBe('bad');
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeLessThanOrEqual(85);
    expect(r.reasons).toContain('Limited data — health is a provisional estimate');
  });

  it('MEDIUM confidence caps at 95 with Data Quality on watch', () => {
    const r = computeHealthScore({ ...clean, confidence: { level: 'MEDIUM', basis: 'partial' } });
    expect(r.score).toBe(95);
    expect(dq(r).status).toBe('warn');
  });

  it('the cap only lowers a top score — it never penalizes an already-struggling one twice', () => {
    const struggling: HealthInput = { ...clean, netCurrent: -2_000, confidence: { level: 'LOW', basis: 'thin' } };
    const capped = computeHealthScore(struggling).score;
    const uncapped = computeHealthScore({ ...struggling, confidence: { level: 'HIGH', basis: 'x' } }).score;
    expect(capped).toBe(uncapped);
  });
});

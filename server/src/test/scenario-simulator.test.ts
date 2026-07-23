import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The simulator must never present an invented number as recorded data.
 * These tests pin: the disclosed expense estimate, category-aware expense
 * increases, multi-lease tenant departures with portfolio-scale occupancy
 * deltas, clamped occupancy drops, input validation, and confidence
 * capping by data quality. GROQ is unset in tests, so the deterministic
 * fallback analysis path runs.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    property: { findMany: vi.fn(), findFirst: vi.fn() },
    financialRecord: { aggregate: vi.fn() },
    lease: { aggregate: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { runSimulation } from '../modules/ai/scenario-simulator.service';

const USER = 'user-1';

/** 10 units, 4 occupied; rent roll $40k across 4 leases. */
function seedPortfolio(opts: { revenue3mo?: number; expenses3mo?: number; categorySum?: number } = {}) {
  prismaMock.property.findMany.mockResolvedValue([
    { totalUnits: 6, _count: { leases: 2 } },
    { totalUnits: 4, _count: { leases: 2 } },
  ]);
  prismaMock.lease.aggregate.mockResolvedValue({ _sum: { baseRent: 40_000 }, _count: 4 });
  prismaMock.financialRecord.aggregate.mockImplementation((args: { where: Record<string, unknown> }) => {
    const w = args.where as { type: string; periodStart: { lt?: Date }; category?: unknown };
    if (w.category) return Promise.resolve({ _sum: { amount: opts.categorySum ?? 0 } });
    const trailing = Boolean(w.periodStart.lt);
    if (w.type === 'REVENUE') return Promise.resolve({ _sum: { amount: trailing ? (opts.revenue3mo ?? 0) : 0 } });
    return Promise.resolve({ _sum: { amount: trailing ? (opts.expenses3mo ?? 0) : 0 } });
  });
}

beforeEach(() => vi.clearAllMocks());

describe('expense increase — honest baselines', () => {
  it('discloses the estimated expense baseline and caps confidence at low when no records exist', async () => {
    seedPortfolio(); // no financial records at all -> rent roll revenue, estimated expenses
    const res = await runSimulation({ scenario: 'expense_increase', params: { percentageIncrease: 10 } }, USER);

    // base = 40k rent roll * 0.35 = 14k; +10% => +1,400/mo expense change
    expect(res.impact.expenseChange).toBe(1400);
    expect(res.current.monthlyExpenses).toBe(14_000); // shown, not hidden
    expect(res.assumptions.join(' ')).toMatch(/estimated/i);
    expect(res.assumptions.join(' ')).toMatch(/rent roll/i);
    expect(res.analysis.confidence).toBe('low');
    // no "$0 revenue" finding for a pure expense scenario
    expect(res.analysis.findings.join(' ')).not.toMatch(/revenue by \$0/);
  });

  it('uses trailing 3-month category records when a category is given', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000, categorySum: 9_000 });
    const res = await runSimulation(
      { scenario: 'expense_increase', params: { percentageIncrease: 10, category: 'Utilities' } }, USER);
    // category base = 9000/3 = 3000; +10% => 300/mo
    expect(res.impact.expenseChange).toBe(300);
    expect(res.assumptions.join(' ')).toMatch(/Utilities/);
    expect(res.analysis.confidence).toBe('high');
  });

  it('falls back to total expenses with disclosure when the category has no records', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000, categorySum: 0 });
    const res = await runSimulation(
      { scenario: 'expense_increase', params: { percentageIncrease: 10, category: 'Landscaping' } }, USER);
    expect(res.impact.expenseChange).toBe(3000); // 30k/mo total * 10%
    expect(res.assumptions.join(' ')).toMatch(/No expense records found in category 'Landscaping'/);
  });
});

describe('tenant departure — every lease counts', () => {
  it('sums all active leases and scales occupancy at the portfolio level', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000 });
    prismaMock.lease.findMany.mockResolvedValue([
      { baseRent: 5_000, tenant: { name: 'Acme Corp' } },
      { baseRent: 3_000, tenant: { name: 'Acme Corp' } },
    ]);
    const res = await runSimulation({ scenario: 'tenant_departure', params: { tenantId: 't1' } }, USER);
    expect(res.impact.revenueChange).toBe(-8_000);
    // 2 leases lost / 10 total units = -20pp, not -(1/propertyUnits)
    expect(res.impact.occupancyChange).toBe(-20);
    expect(res.assumptions.join(' ')).toMatch(/2 active leases/);
  });

  it('rejects a tenant with no active leases instead of returning a zero-impact result', async () => {
    seedPortfolio({ revenue3mo: 300_000 });
    prismaMock.lease.findMany.mockResolvedValue([]);
    await expect(
      runSimulation({ scenario: 'tenant_departure', params: { tenantId: 'ghost' } }, USER),
    ).rejects.toThrow(/no active leases/i);
  });
});

describe('occupancy drop — cannot lose more than you have', () => {
  it('clamps lost units to occupied units and discloses the cap', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000 }); // 4 occupied of 10
    const res = await runSimulation({ scenario: 'occupancy_drop', params: { percentageDrop: 80 } }, USER);
    // requested 8 units, only 4 occupied -> lose 4 * (100k avg rent/lease... rev 100k/mo / 4 leases = 25k) = -100k
    expect(res.impact.revenueChange).toBe(-100_000);
    expect(res.projected.monthlyRevenue).toBeGreaterThanOrEqual(0);
    expect(res.impact.occupancyChange).toBe(-40); // 4/10 units
    expect(res.assumptions.join(' ')).toMatch(/capped at full vacancy/i);
  });
});

describe('input validation — garbage never burns a metered credit', () => {
  it.each([
    [{ scenario: 'occupancy_drop', params: { percentageDrop: -5 } }],
    [{ scenario: 'occupancy_drop', params: { percentageDrop: Number.NaN } }],
    [{ scenario: 'expense_increase', params: { percentageIncrease: 0 } }],
    [{ scenario: 'rent_increase', params: { percentageIncrease: 5000 } }],
    [{ scenario: 'tenant_departure', params: {} }],
    [{ scenario: 'time_travel', params: {} }],
  ])('rejects %j', async (req) => {
    seedPortfolio();
    await expect(runSimulation(req as never, USER)).rejects.toThrow();
    expect(prismaMock.financialRecord.aggregate).not.toHaveBeenCalled();
  });
});

describe('rent increase — the upside scenario', () => {
  it('projects portfolio-wide growth with churn disclosure and explicit scope', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000 });
    const res = await runSimulation({ scenario: 'rent_increase', params: { percentageIncrease: 3 } }, USER);
    expect(res.impact.revenueChange).toBe(3000); // 100k/mo * 3%
    expect(res.impact.estimatedAnnualImpact).toBe(36_000);
    expect(res.assumptions.join(' ')).toMatch(/churn/i);
    expect(res.assumptions[0]).toMatch(/entire portfolio/i);
  });

  it('scopes to a single lease when leaseId is given', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000 });
    prismaMock.lease.findFirst.mockResolvedValue({ baseRent: 5_000, tenant: { name: 'Acme Corp' } });
    const res = await runSimulation({ scenario: 'rent_increase', params: { percentageIncrease: 3, leaseId: 'l1' } }, USER);
    expect(res.impact.revenueChange).toBe(150); // 5k * 3%
    expect(res.assumptions.join(' ')).toMatch(/single lease/i);
    expect(res.assumptions.join(' ')).toMatch(/Acme Corp/);
  });

  it('rejects a lease that is missing or not owned by the caller', async () => {
    seedPortfolio({ revenue3mo: 300_000 });
    prismaMock.lease.findFirst.mockResolvedValue(null);
    await expect(
      runSimulation({ scenario: 'rent_increase', params: { percentageIncrease: 3, leaseId: 'other-org-lease' } }, USER),
    ).rejects.toThrow(/not found or is not active/i);
  });
});

describe('property scoping — explicit in every result', () => {
  it('names the property in the scope assumption and rejects unowned properties', async () => {
    seedPortfolio({ revenue3mo: 300_000, expenses3mo: 90_000 });
    prismaMock.property.findFirst.mockResolvedValue({ name: 'Riverside Plaza' });
    const res = await runSimulation(
      { scenario: 'expense_increase', params: { percentageIncrease: 10, propertyId: 'p1' } }, USER);
    expect(res.assumptions[0]).toBe('Scope: Riverside Plaza only.');

    prismaMock.property.findFirst.mockResolvedValue(null);
    await expect(
      runSimulation({ scenario: 'expense_increase', params: { percentageIncrease: 10, propertyId: 'stolen' } }, USER),
    ).rejects.toThrow(/not found/i);
  });
});

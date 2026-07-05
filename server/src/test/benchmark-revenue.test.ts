import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Guard for the thin-data revenue fix (#164). Property scorecard revenue must
 * derive from active leases' baseRent (contract run-rate), so a lease-only
 * account with zero FinancialRecord history still shows real revenue — not $0.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    property: { findMany: vi.fn() },
    lease: { groupBy: vi.fn(), count: vi.fn() },
    financialRecord: { aggregate: vi.fn() },
    alert: { groupBy: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getBenchmarks } from '../modules/analytics/benchmark.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.property.findMany.mockResolvedValue([
    { id: 'p1', name: 'Maple Towers', code: 'MAP', totalUnits: 10, totalSqft: 5000, _count: { leases: 2 } },
  ]);
  prismaMock.lease.groupBy.mockResolvedValue([{ propertyId: 'p1', _sum: { baseRent: 3000 } }]);
  prismaMock.financialRecord.aggregate.mockResolvedValue({ _sum: { amount: null } });
  prismaMock.alert.groupBy.mockResolvedValue([]);
  prismaMock.lease.count.mockResolvedValue(0);
});

describe('benchmarks — revenue derives from leases on thin data (#164)', () => {
  it('reports contract revenue from baseRent when there are no financial records', async () => {
    const report = await getBenchmarks('user-A');
    const card = report.properties[0];
    expect(card.monthlyRevenue).toBe(3000);
    expect(card.noi).toBe(3000);
    expect(card.revenuePerUnit).toBe(300);
    expect(report.portfolioAverages.monthlyRevenue).toBe(3000);
  });

  it('leaves revenue growth null when there is no recorded actuals history', async () => {
    const report = await getBenchmarks('user-A');
    expect(report.properties[0].revenueDeltaPct).toBeNull();
  });

  it('scopes the contract-revenue query to the owner', async () => {
    await getBenchmarks('user-A');
    expect(prismaMock.lease.groupBy.mock.calls[0][0].where).toMatchObject({
      status: 'ACTIVE',
      deletedAt: null,
      property: { ownerId: 'user-A' },
    });
  });
});

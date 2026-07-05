import { describe, it, expect } from 'vitest';
import { deriveObservations, type ObservationSources } from '../modules/ai-platform/copilot-observations.service';
import type { MetricDelta } from '../modules/finance/intelligence/intelligence.types';
import type { ForecastOutlook } from '../modules/finance/intelligence/forecast-outlook.service';
import type { TenantProfitability } from '../modules/finance/tenant-profitability.service';

function metric(key: MetricDelta['key'], current: number, deltaPct: number | null, direction: MetricDelta['direction'], comparable = true): MetricDelta {
  return {
    key,
    label: key,
    current,
    previous: 0,
    deltaAbs: 0,
    deltaPct,
    direction,
    sentiment: 'neutral',
    comparable,
    confidence: { level: 'HIGH', basis: 'test' },
  };
}

function forecast(overrides: Partial<ForecastOutlook> = {}): ForecastOutlook {
  return {
    horizonMonths: 6,
    totalRevenueAtRisk: 0,
    timeline: [],
    confidence: { level: 'HIGH', basis: 'test' },
    confidenceScore: 100,
    ...overrides,
  };
}

function tenant(tenantId: string, tenantName: string, monthlyRent: number): TenantProfitability {
  return { tenantId, tenantName, monthlyRent, net: monthlyRent, marginPct: 100 } as TenantProfitability;
}

const empty: ObservationSources = {
  metrics: [],
  forecast: forecast(),
  tenants: [],
  flaggedRecords: 0,
  generatedAt: '2026-07-02T00:00:00.000Z',
};

describe('cross-tab observations', () => {
  it('flags margin compression when expenses outrun revenue', () => {
    const { observations } = deriveObservations({
      ...empty,
      metrics: [metric('revenue', 40000, 1, 'up'), metric('expenses', 30000, 18, 'up')],
    });
    const margin = observations.find((o) => o.id === 'margin-compression');
    expect(margin).toBeDefined();
    expect(margin!.severity).toBe('HIGH');
    expect(margin!.evidence.map((e) => e.factId)).toEqual(['metric.revenue', 'metric.expenses']);
    expect(margin!.action?.deepLink).toBe('/finance?tab=expenses');
  });

  it('does not flag margin compression when revenue outpaces expenses', () => {
    const { observations } = deriveObservations({
      ...empty,
      metrics: [metric('revenue', 40000, 20, 'up'), metric('expenses', 30000, 6, 'up')],
    });
    expect(observations.find((o) => o.id === 'margin-compression')).toBeUndefined();
  });

  it('ignores non-comparable months (incomplete current period)', () => {
    const { observations } = deriveObservations({
      ...empty,
      metrics: [metric('revenue', 40000, 1, 'flat'), metric('expenses', 30000, 40, 'up', false)],
    });
    expect(observations.find((o) => o.id === 'margin-compression')).toBeUndefined();
  });

  it('flags a renewal cliff when one month concentrates expiring rent', () => {
    const { observations } = deriveObservations({
      ...empty,
      forecast: forecast({
        totalRevenueAtRisk: 10000,
        timeline: [
          { month: 'Jul 2026', expiringCount: 1, revenueAtRisk: 2000, leases: [] },
          { month: 'Aug 2026', expiringCount: 3, revenueAtRisk: 8000, leases: [] },
        ],
      }),
    });
    const cliff = observations.find((o) => o.id === 'renewal-cliff');
    expect(cliff).toBeDefined();
    expect(cliff!.title).toContain('Aug 2026');
    expect(cliff!.severity).toBe('HIGH');
  });

  it('does not flag a cliff when expirations are spread out', () => {
    const { observations } = deriveObservations({
      ...empty,
      forecast: forecast({
        totalRevenueAtRisk: 10000,
        timeline: [
          { month: 'Jul 2026', expiringCount: 2, revenueAtRisk: 5000, leases: [] },
          { month: 'Aug 2026', expiringCount: 2, revenueAtRisk: 5000, leases: [] },
        ],
      }),
    });
    expect(observations.find((o) => o.id === 'renewal-cliff')).toBeUndefined();
  });

  it('flags tenant concentration above 30% of the rent roll', () => {
    const { observations } = deriveObservations({
      ...empty,
      tenants: [tenant('t1', 'Anchor Co', 6000), tenant('t2', 'B', 2000), tenant('t3', 'C', 2000)],
    });
    const conc = observations.find((o) => o.id === 'tenant-concentration');
    expect(conc).toBeDefined();
    expect(conc!.title).toContain('Anchor Co');
    expect(conc!.severity).toBe('HIGH');
    expect(conc!.evidence[0].value).toContain('60%');
  });

  it('surfaces the ledger-trust caveat when records are flagged, ranked below risks', () => {
    const { observations } = deriveObservations({
      ...empty,
      metrics: [metric('revenue', 40000, 1, 'flat'), metric('expenses', 30000, 18, 'up')],
      flaggedRecords: 4,
    });
    const ledger = observations.find((o) => o.id === 'ledger-trust');
    expect(ledger).toBeDefined();
    expect(ledger!.severity).toBe('LOW');
    expect(observations[observations.length - 1].id).toBe('ledger-trust');
  });

  it('returns nothing for a clean portfolio', () => {
    expect(deriveObservations(empty).observations).toHaveLength(0);
  });
});

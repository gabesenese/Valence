import { describe, it, expect } from 'vitest';
import { alertDestination } from './alertDestination';

const base = { property: undefined, lease: undefined } as const;

describe('alertDestination', () => {
  it('routes lease alerts to the lease with renewal focus', () => {
    for (const type of ['LEASE_EXPIRATION', 'RENEWAL_RISK']) {
      expect(alertDestination({ ...base, type, propertyId: 'p1', leaseId: 'l1' }))
        .toEqual({ to: '/leases/l1?focus=renewal', label: 'Review renewal' });
    }
  });

  it('routes occupancy / data / compliance to the property with matching focus', () => {
    expect(alertDestination({ ...base, type: 'OCCUPANCY_CHANGE', propertyId: 'p1' }))
      .toEqual({ to: '/properties/p1?focus=occupancy', label: 'Review occupancy' });
    expect(alertDestination({ ...base, type: 'DATA_MISSING', propertyId: 'p1' })!.to)
      .toBe('/properties/p1?focus=missing-data');
    expect(alertDestination({ ...base, type: 'COMPLIANCE_FLAG', propertyId: 'p1' })!.to)
      .toBe('/properties/p1?focus=compliance');
  });

  it('routes finance alerts to finance surfaces (no entity id required)', () => {
    expect(alertDestination({ ...base, type: 'PAYMENT_ANOMALY' })!.to)
      .toBe('/finance?tab=ledger&focus=transaction');
    expect(alertDestination({ ...base, type: 'FINANCIAL_DISCREPANCY' })!.to)
      .toBe('/finance?tab=ledger&focus=revenue');
  });

  it('returns null when the linked entity is missing (deleted/archived)', () => {
    expect(alertDestination({ ...base, type: 'LEASE_EXPIRATION' })).toBeNull();
    expect(alertDestination({ ...base, type: 'OCCUPANCY_CHANGE' })).toBeNull();
  });

  it('prefers the included relation id over the raw foreign key', () => {
    expect(alertDestination({ ...base, type: 'RENEWAL_RISK', lease: { id: 'lease-rel', leaseNumber: 'L-9' } })!.to)
      .toBe('/leases/lease-rel?focus=renewal');
  });
});

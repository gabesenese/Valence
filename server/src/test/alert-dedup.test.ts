import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addDays } from 'date-fns';

/**
 * Regression guard for the lease-alert de-duplication fix (#130). An unresolved
 * lease-expiration condition must be represented by a SINGLE open alert: the
 * daily scan must not keep inserting duplicate records, and a change in the
 * condition (severity escalation) updates the existing alert in place.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    lease: { findMany: vi.fn() },
    alert: { create: vi.fn(), update: vi.fn() },
    alertActivity: { create: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/changes/changes.service', () => ({ recordChange: vi.fn() }));

import { generateLeaseExpirationAlerts } from '../modules/alerts/alerts.service';

function lease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1', leaseNumber: 'L-1', endDate: addDays(new Date(), 20), propertyId: 'p1',
    property: { id: 'p1', name: 'Tower', code: 'TWR' },
    tenant: { name: 'Acme' },
    alerts: [] as unknown[],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.alert.create.mockResolvedValue({ id: 'a1', title: 'Lease expiring', severity: 'CRITICAL' });
  prismaMock.alert.update.mockResolvedValue({ id: 'a1' });
  prismaMock.alertActivity.create.mockResolvedValue({});
});

describe('lease expiration alerts — de-duplication (#130)', () => {
  it('creates a single alert when none exists', async () => {
    prismaMock.lease.findMany.mockResolvedValue([lease()]);
    const n = await generateLeaseExpirationAlerts();
    expect(prismaMock.alert.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.alert.update).not.toHaveBeenCalled();
    expect(n).toBe(1);
  });

  it('does NOT create a duplicate when an open alert already exists', async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      lease({ alerts: [{ id: 'a1', severity: 'CRITICAL', metadata: { daysLeft: 20 } }] }),
    ]);
    const n = await generateLeaseExpirationAlerts();
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });

  it('updates the existing alert in place when severity escalates (no new record)', async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      lease({ alerts: [{ id: 'a1', severity: 'INFO', metadata: { daysLeft: 85 } }] }),
    ]);
    await generateLeaseExpirationAlerts();
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
    expect(prismaMock.alert.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.alert.update.mock.calls[0][0].data.severity).toBe('CRITICAL');
  });
});

import { describe, it, expect, vi } from 'vitest';

/**
 * "Don't just import data. Help users fix it." — analyzeImportHealth is a
 * read-only, portfolio-wide second pass (not scoped to a single import run,
 * since duplicates and gaps often span separate uploads) that surfaces
 * suggestions, never blocks anything.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    tenant: { findMany: vi.fn(() => Promise.resolve([])) },
    property: { findMany: vi.fn(() => Promise.resolve([])) },
    lease: { findMany: vi.fn(() => Promise.resolve([])) },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { analyzeImportHealth } from '../modules/import/import-intelligence.service';

describe('analyzeImportHealth', () => {
  it('flags tenants sharing the same phone number as possible duplicates', async () => {
    prismaMock.tenant.findMany.mockResolvedValueOnce([
      { id: 't1', name: 'Jane Doe', phone: '(555) 123-4567', email: null },
      { id: 't2', name: 'J. Doe', phone: '555-123-4567', email: null },
      { id: 't3', name: 'Someone Else', phone: '555-000-0000', email: null },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.duplicateTenants).toHaveLength(1);
    expect(report.duplicateTenants[0].detail).toMatch(/Jane Doe/);
    expect(report.duplicateTenants[0].detail).toMatch(/J\. Doe/);
  });

  it('flags a tenant with overlapping leases at two different properties', async () => {
    prismaMock.tenant.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Jane Doe', phone: null, email: null }] as never);
    prismaMock.property.findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'Tower A', code: 'A1', totalUnits: 10 },
      { id: 'p2', name: 'Tower B', code: 'B1', totalUnits: 10 },
    ] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([
      { id: 'l1', leaseNumber: 'L1', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), tenantId: 't1', propertyId: 'p1' },
      { id: 'l2', leaseNumber: 'L2', status: 'ACTIVE', startDate: new Date('2026-06-01'), endDate: new Date('2027-06-01'), tenantId: 't1', propertyId: 'p2' },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.overlappingLeases).toHaveLength(1);
    expect(report.overlappingLeases[0].detail).toMatch(/Tower A/);
    expect(report.overlappingLeases[0].detail).toMatch(/Tower B/);
  });

  it('does not flag two leases for the same tenant at different properties when the dates do not overlap', async () => {
    prismaMock.tenant.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Jane Doe', phone: null, email: null }] as never);
    prismaMock.property.findMany.mockResolvedValueOnce([
      { id: 'p1', name: 'Tower A', code: 'A1', totalUnits: 10 },
      { id: 'p2', name: 'Tower B', code: 'B1', totalUnits: 10 },
    ] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([
      { id: 'l1', leaseNumber: 'L1', status: 'EXPIRED', startDate: new Date('2024-01-01'), endDate: new Date('2025-01-01'), tenantId: 't1', propertyId: 'p1' },
      { id: 'l2', leaseNumber: 'L2', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), tenantId: 't1', propertyId: 'p2' },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.overlappingLeases).toHaveLength(0);
  });

  it('flags a lease that already ended but is still marked Active', async () => {
    prismaMock.property.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Tower A', code: 'A1', totalUnits: 10 }] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([
      { id: 'l1', leaseNumber: 'L1', status: 'ACTIVE', startDate: new Date('2020-01-01'), endDate: new Date('2021-01-01'), tenantId: 't1', propertyId: 'p1' },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.expiredActiveLeases).toHaveLength(1);
    expect(report.expiredActiveLeases[0].label).toMatch(/L1/);
  });

  it('flags a property with zero leases', async () => {
    prismaMock.property.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Empty Tower', code: 'E1', totalUnits: 10 }] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([]);
    const report = await analyzeImportHealth('user-1');
    expect(report.propertiesWithNoLeases).toHaveLength(1);
    expect(report.propertiesWithNoLeases[0].label).toMatch(/Empty Tower/);
  });

  it('flags a property with more active leases than units', async () => {
    prismaMock.property.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Small Building', code: 'S1', totalUnits: 1 }] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([
      { id: 'l1', leaseNumber: 'L1', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), tenantId: 't1', propertyId: 'p1' },
      { id: 'l2', leaseNumber: 'L2', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), tenantId: 't2', propertyId: 'p1' },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.overLeasedProperties).toHaveLength(1);
    expect(report.overLeasedProperties[0].label).toMatch(/2 active leases but only 1 units/);
  });

  it('returns an empty, all-clear report for a clean portfolio', async () => {
    prismaMock.tenant.findMany.mockResolvedValueOnce([{ id: 't1', name: 'Jane Doe', phone: '555-1234', email: null }] as never);
    prismaMock.property.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Tower A', code: 'A1', totalUnits: 10 }] as never);
    prismaMock.lease.findMany.mockResolvedValueOnce([
      { id: 'l1', leaseNumber: 'L1', status: 'ACTIVE', startDate: new Date('2026-01-01'), endDate: new Date('2027-01-01'), tenantId: 't1', propertyId: 'p1' },
    ] as never);
    const report = await analyzeImportHealth('user-1');
    expect(report.totalFindings).toBe(0);
  });
});

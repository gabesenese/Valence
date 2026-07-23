import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Trashed (soft-deleted) rows keep their previous status, so any metric
 * query filtering on status alone silently includes deleted data. These
 * tests pin the canonical filters and scan the source tree so the bug
 * class cannot quietly return.
 */

vi.mock('../infrastructure/database', () => ({ prisma: {} }));

import {
  ACTIVE_LEASE_WHERE,
  ACTIVE_PROPERTY_WHERE,
  ACTIVE_LEASE_COUNT,
  computeOccupancy,
  expiringLeaseWhere,
} from '../modules/metrics/portfolio-metrics';

describe('portfolio-metrics — canonical filters', () => {
  it('active-lease and active-property filters exclude soft-deleted rows', () => {
    expect(ACTIVE_LEASE_WHERE).toEqual({ status: 'ACTIVE', deletedAt: null });
    expect(ACTIVE_PROPERTY_WHERE).toEqual({ status: 'ACTIVE', deletedAt: null });
    expect(ACTIVE_LEASE_COUNT.select.leases.where).toEqual({ status: 'ACTIVE', deletedAt: null });
  });

  it('expiring-lease clause excludes trashed leases and trashed properties', () => {
    const from = new Date('2026-07-01T00:00:00Z');
    const where = expiringLeaseWhere('user-1', 30, from);
    expect(where.deletedAt).toBeNull();
    expect(where.status).toBe('ACTIVE');
    expect(where.property).toEqual({ ownerId: 'user-1', deletedAt: null });
    expect(where.endDate.gte).toEqual(from);
    expect(where.endDate.lte.toISOString()).toBe('2026-07-31T00:00:00.000Z');
  });

  it('computeOccupancy aggregates units and rates correctly', () => {
    expect(computeOccupancy([])).toEqual({ totalUnits: 0, occupiedUnits: 0, occupancyRate: 0 });
    const snap = computeOccupancy([
      { totalUnits: 10, _count: { leases: 9 } },
      { totalUnits: 10, _count: { leases: 6 } },
    ]);
    expect(snap.totalUnits).toBe(20);
    expect(snap.occupiedUnits).toBe(15);
    expect(snap.occupancyRate).toBe(75);
  });

  it('computeOccupancy ignores zero-unit portfolios without dividing by zero', () => {
    expect(computeOccupancy([{ totalUnits: 0, _count: { leases: 0 } }]).occupancyRate).toBe(0);
  });
});

describe('portfolio-metrics — source tripwire', () => {
  /**
   * Fails if any service reintroduces a lease count/filter on status
   * ACTIVE without also excluding soft-deleted leases. If this fires,
   * use ACTIVE_LEASE_WHERE / ACTIVE_LEASE_COUNT from
   * modules/metrics/portfolio-metrics instead of an inline literal.
   */
  const BAD_PATTERN = /leases:\s*\{\s*where:\s*\{\s*status:\s*'ACTIVE'\s*\}\s*\}/;

  function walk(dir: string, hits: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, hits);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        if (BAD_PATTERN.test(fs.readFileSync(full, 'utf8'))) hits.push(full);
      }
    }
  }

  it('no service counts or filters leases on status alone', () => {
    const hits: string[] = [];
    walk(path.resolve(__dirname, '../modules'), hits);
    expect(hits).toEqual([]);
  });
});

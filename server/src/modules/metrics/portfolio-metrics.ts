import { addDays } from 'date-fns';
import { prisma } from '../../infrastructure/database';

/**
 * Canonical filters and calculations for portfolio-level metrics.
 *
 * Every module that reports occupancy, active-lease counts, or expiring
 * leases must use these definitions so numbers agree on every page.
 *
 * Soft-deleted (trashed) rows keep their previous `status`, so a lease
 * sitting in the trash still has `status: 'ACTIVE'`. Any query that
 * filters on status alone silently includes trashed data — `deletedAt:
 * null` is therefore mandatory, and encoding it here once makes the bug
 * unrepresentable at call sites.
 */

/** A lease that actually occupies a unit and counts toward revenue. */
export const ACTIVE_LEASE_WHERE = { status: 'ACTIVE', deletedAt: null } as const;

/** A property that participates in portfolio metrics. */
export const ACTIVE_PROPERTY_WHERE = { status: 'ACTIVE', deletedAt: null } as const;

/** `_count` select fragment for occupied units on a property. */
export const ACTIVE_LEASE_COUNT = { select: { leases: { where: ACTIVE_LEASE_WHERE } } } as const;

export interface OccupancySnapshot {
  totalUnits: number;
  occupiedUnits: number;
  /** Percentage in the 0–100 range, unrounded. Callers apply display rounding. */
  occupancyRate: number;
}

/** Pure occupancy calculation over rows selected with ACTIVE_LEASE_COUNT. */
export function computeOccupancy(
  properties: Array<{ totalUnits: number; _count: { leases: number } }>,
): OccupancySnapshot {
  const totalUnits = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p._count.leases, 0);
  return {
    totalUnits,
    occupiedUnits,
    occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
  };
}

/** Portfolio-wide occupancy for one owner. */
export async function getOccupancy(userId: string): Promise<OccupancySnapshot> {
  const properties = await prisma.property.findMany({
    where: { ...ACTIVE_PROPERTY_WHERE, ownerId: userId },
    select: { totalUnits: true, _count: ACTIVE_LEASE_COUNT },
  });
  return computeOccupancy(properties);
}

/**
 * Canonical where-clause for "active leases expiring within N days".
 * Excludes trashed leases and leases on trashed properties.
 */
export function expiringLeaseWhere(userId: string, horizonDays: number, from: Date = new Date()) {
  return {
    ...ACTIVE_LEASE_WHERE,
    property: { ownerId: userId, deletedAt: null },
    endDate: { gte: from, lte: addDays(from, horizonDays) },
  };
}

export async function countExpiringLeases(
  userId: string,
  horizonDays: number,
  from: Date = new Date(),
): Promise<number> {
  return prisma.lease.count({ where: expiringLeaseWhere(userId, horizonDays, from) });
}

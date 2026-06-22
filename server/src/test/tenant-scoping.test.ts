import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for multi-tenant data isolation.
 *
 * The dashboard's Executive Brief, Portfolio Health Score, and Benchmarks once
 * queried the entire database with no owner filter, so every user saw every
 * other tenant's leases, revenue, and risk. This test mocks Prisma, drives each
 * entrypoint with a known userId, and asserts that EVERY query it issues is
 * scoped to that user — either directly via `ownerId` or indirectly via a
 * propertyId that belongs to the user's owned set. Remove a filter and a query
 * goes global; this test fails.
 */

const USER = 'user-A';
const OWNED_PROPERTY_IDS = ['p1'];

const { calls, prismaMock } = vi.hoisted(() => {
  const calls: Array<{ model: string; method: string; where: unknown }> = [];

  const record = (model: string, method: string) =>
    vi.fn(async (args?: { where?: unknown }) => {
      calls.push({ model, method, where: args?.where });
      switch (method) {
        case 'aggregate': return { _sum: { amount: null, baseRent: null } };
        case 'count':     return 0;
        case 'groupBy':   return [];
        case 'findUnique':return null;
        case 'findMany':
          if (model === 'property') {
            return [{ id: 'p1', name: 'P1', code: 'P1', totalUnits: 10, _count: { leases: 5 } }];
          }
          return [];
        default: return [];
      }
    });

  const model = (name: string) => ({
    findMany:   record(name, 'findMany'),
    findUnique: record(name, 'findUnique'),
    aggregate:  record(name, 'aggregate'),
    count:      record(name, 'count'),
    groupBy:    record(name, 'groupBy'),
  });

  const prismaMock = {
    property:        model('property'),
    lease:           model('lease'),
    financialRecord: model('financialRecord'),
    alert:           model('alert'),
  };

  return { calls, prismaMock };
});

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

// Imported AFTER the mock is registered.
import { generateExecutiveBrief } from '../modules/ai/executive-brief.service';
import { computeHealthScore } from '../modules/ai/health-score.service';
import { getBenchmarks } from '../modules/analytics/benchmark.service';

/** Deep-search a Prisma `where` tree for `ownerId === userId`. */
function hasOwnerScope(node: unknown, userId: string): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasOwnerScope(n, userId));
  for (const [key, value] of Object.entries(node)) {
    if (key === 'ownerId' && value === userId) return true;
    if (hasOwnerScope(value, userId)) return true;
  }
  return false;
}

/** Deep-search for a `propertyId` filter constrained to the user's owned set. */
function hasOwnedPropertyScope(node: unknown, ownedIds: string[]): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => hasOwnedPropertyScope(n, ownedIds));
  for (const [key, value] of Object.entries(node)) {
    if (key === 'propertyId') {
      if (typeof value === 'string' && ownedIds.includes(value)) return true;
      if (value && typeof value === 'object' && Array.isArray((value as { in?: unknown }).in)
          && (value as { in: unknown[] }).in.every((id) => typeof id === 'string' && ownedIds.includes(id))) {
        return true;
      }
    }
    if (hasOwnedPropertyScope(value, ownedIds)) return true;
  }
  return false;
}

function isTenantScoped(where: unknown): boolean {
  return hasOwnerScope(where, USER) || hasOwnedPropertyScope(where, OWNED_PROPERTY_IDS);
}

describe('tenant scoping — dashboard intelligence endpoints', () => {
  beforeEach(() => {
    calls.length = 0;
    delete process.env.GROQ_API_KEY; // force deterministic, network-free fallback path
  });

  it('Executive Brief scopes every query to the requesting user', async () => {
    await generateExecutiveBrief(USER);
    assertAllScoped();
  });

  it('Portfolio Health Score scopes every query to the requesting user', async () => {
    await computeHealthScore(USER);
    assertAllScoped();
  });

  it('Benchmarks scopes every query to the requesting user', async () => {
    await getBenchmarks(USER);
    assertAllScoped();
  });

  function assertAllScoped() {
    const queried = calls.filter((c) => c.where !== undefined);
    expect(queried.length, 'expected the entrypoint to issue at least one DB query').toBeGreaterThan(0);
    for (const call of queried) {
      expect(
        isTenantScoped(call.where),
        `UNSCOPED QUERY → ${call.model}.${call.method} ran without an owner filter: ${JSON.stringify(call.where)}`,
      ).toBe(true);
    }
  }
});

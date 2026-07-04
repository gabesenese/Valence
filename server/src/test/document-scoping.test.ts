import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the document-list tenant-isolation fix (#147). The list
 * must always be scoped to documents the caller owns (uploaded, or attached to
 * a property/lease/tenant they own) — never other accounts' documents.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    document: { findMany: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getDocuments } from '../modules/documents/documents.service';

const OWNER = 'user-A';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.document.findMany.mockResolvedValue([]);
});

describe('documents — account scoping (tenant isolation, #147)', () => {
  it('always scopes the list to documents the account owns', async () => {
    await getDocuments({}, OWNER);
    const where = prismaMock.document.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { uploadedById: OWNER },
      { property: { ownerId: OWNER } },
      { lease: { property: { ownerId: OWNER } } },
      { tenant: { ownerId: OWNER } },
    ]);
  });

  it('keeps caller-supplied filters alongside the ownership scope', async () => {
    await getDocuments({ type: 'LEASE', propertyId: 'p1' }, OWNER);
    const where = prismaMock.document.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(4);
    expect(where.type).toBe('LEASE');
    expect(where.propertyId).toBe('p1');
  });
});

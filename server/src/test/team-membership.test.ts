import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Team lists must be scoped to the viewer's organization and exclude demo
 * accounts — a SUPER_ADMIN viewing their team must not receive every user
 * on the platform. Removal must free the seat without deleting the
 * account, and must refuse self-removal and Super Admin removal.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(() => Promise.resolve([])),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'target', email: 't@x.com', firstName: 'T', lastName: 'U', role: 'ANALYST', isActive: false, ...args.data })),
    },
    organization: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { deleteMany: vi.fn(() => Promise.resolve({ count: 1 })) },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/audit/audit.service', () => ({ logAudit: vi.fn() }));
vi.mock('../lib/email', () => ({ sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock('../modules/demo/demo.factory', () => ({ DemoPortfolioFactory: class {} }));
vi.mock('../modules/analytics/funnel.service', () => ({ trackEvent: vi.fn(), trackReturnVisit: vi.fn() }));

import { listUsers, removeMember } from '../modules/auth/auth.service';

const VIEWER = { id: 'viewer-1', role: 'SUPER_ADMIN' as const };

beforeEach(() => {
  vi.clearAllMocks();
  // viewer already belongs to org-1
  prismaMock.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
});

describe('listUsers — organization scoping', () => {
  it('scopes to the viewer organization and excludes demo accounts, even for SUPER_ADMIN', async () => {
    await listUsers(VIEWER);
    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: 'org-1', isDemo: false });
  });

  it('self-heals membership for legacy accounts before listing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ organizationId: null });
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'org-legacy', ownerId: VIEWER.id });
    await listUsers(VIEWER);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: VIEWER.id }, data: { organizationId: 'org-legacy' } }),
    );
    const where = prismaMock.user.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-legacy');
  });
});

describe('removeMember — guards and semantics', () => {
  it('refuses self-removal', async () => {
    await expect(removeMember(VIEWER.id, { id: VIEWER.id })).rejects.toThrow(/yourself/i);
  });

  it('refuses removing a member outside the actor organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(removeMember('stranger', { id: VIEWER.id })).rejects.toThrow();
    const where = prismaMock.user.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ id: 'stranger', organizationId: 'org-1' });
  });

  it('refuses removing a Super Admin', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'boss', email: 'b@x.com', role: 'SUPER_ADMIN' });
    await expect(removeMember('boss', { id: VIEWER.id })).rejects.toThrow(/Super Admin/i);
  });

  it('clears membership, deactivates, and revokes sessions — never deletes', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'target', email: 't@x.com', role: 'ANALYST' });
    await removeMember('target', { id: VIEWER.id });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'target' }, data: { organizationId: null, isActive: false } }),
    );
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'target' } });
  });
});

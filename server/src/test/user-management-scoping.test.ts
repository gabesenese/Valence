import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the account-management tenant-isolation fix. role /
 * active / plan mutations must refuse a target outside the actor's own
 * organization, mirroring removeMember. Platform staff (isPlatformStaff) act
 * across organizations by design.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'target', email: 't@x.com', firstName: 'T', lastName: 'U', role: 'ANALYST', isActive: true, ...args.data })),
    },
    organization: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/audit/audit.service', () => ({ logAudit: vi.fn() }));
vi.mock('../lib/email', () => ({ sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock('../modules/demo/demo.factory', () => ({ DemoPortfolioFactory: class {} }));
vi.mock('../modules/analytics/funnel.service', () => ({ trackEvent: vi.fn(), trackReturnVisit: vi.fn() }));

import { updateUserRole, setUserActive, setPlan } from '../modules/auth/auth.service';
import { NotFoundError } from '../utils/errors';

const OWNER = { id: 'owner-A', isPlatformStaff: false };
const STAFF = { id: 'staff', isPlatformStaff: true };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ organizationId: 'org-1' });
});

describe('account-management mutations — organization scoping', () => {
  it('refuses a role change on a user outside the actor organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(updateUserRole('stranger', 'ADMIN', OWNER)).rejects.toThrow(NotFoundError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'stranger', organizationId: 'org-1' });
  });

  it('allows a role change on a member of the actor organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'target' });
    await updateUserRole('target', 'ADMIN', OWNER);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'target' }, data: { role: 'ADMIN' } }),
    );
  });

  it('refuses deactivating a user outside the actor organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(setUserActive('stranger', false, OWNER)).rejects.toThrow(NotFoundError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('refuses a plan change on a user outside the actor organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(setPlan('stranger', 'PROFESSIONAL', OWNER)).rejects.toThrow(NotFoundError);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('lets platform staff act across organizations without an org membership check', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await updateUserRole('any-user', 'ADMIN', STAFF);
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});

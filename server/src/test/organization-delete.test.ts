import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for self-service organization deletion. Must refuse a
 * mismatched confirmation email, refuse a non-owner, and refuse deletion
 * while other active members remain — only then does it wipe the portfolio,
 * cancel billing, deactivate the account, and revoke sessions.
 */

const { prismaMock, resetMock, cancelSubscriptionMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
    },
    organization: { findUnique: vi.fn() },
    refreshToken: { updateMany: vi.fn(() => Promise.resolve({ count: 0 })) },
  },
  resetMock: vi.fn(() => Promise.resolve()),
  cancelSubscriptionMock: vi.fn(() => Promise.resolve()),
  logAuditMock: vi.fn(),
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/demo/demo.factory', () => ({
  DemoPortfolioFactory: class { reset = resetMock; },
}));
vi.mock('../modules/billing/billing.service', () => ({ cancelSubscription: cancelSubscriptionMock }));
vi.mock('../modules/audit/audit.service', () => ({ logAudit: logAuditMock }));

import { deleteOrganization } from '../modules/organization/organization.service';

const OWNER_ID = 'owner-1';
const ORG_ID = 'org-1';
const EMAIL = 'owner@example.com';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ email: EMAIL, organizationId: ORG_ID });
  prismaMock.organization.findUnique.mockResolvedValue({ ownerId: OWNER_ID });
  prismaMock.user.count.mockResolvedValue(0);
});

describe('deleteOrganization', () => {
  it('rejects a confirmation email that does not match the account', async () => {
    await expect(deleteOrganization(OWNER_ID, 'wrong@example.com')).rejects.toThrow(/does not match/i);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('rejects a caller who is not the organization owner', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ ownerId: 'someone-else' });
    await expect(deleteOrganization(OWNER_ID, EMAIL)).rejects.toThrow(/only the organization owner/i);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('refuses deletion while other active members exist', async () => {
    prismaMock.user.count.mockResolvedValue(1);
    await expect(deleteOrganization(OWNER_ID, EMAIL)).rejects.toThrow(/remove your team members/i);
    expect(resetMock).not.toHaveBeenCalled();
  });

  it('wipes data, cancels billing, deactivates, and revokes sessions when allowed', async () => {
    await deleteOrganization(OWNER_ID, EMAIL);
    expect(resetMock).toHaveBeenCalledWith(OWNER_ID);
    expect(cancelSubscriptionMock).toHaveBeenCalledWith(expect.objectContaining({ id: OWNER_ID, email: EMAIL }));
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OWNER_ID }, data: { isActive: false } }),
    );
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: OWNER_ID, revokedAt: null } }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER_ID, action: 'DELETE', entity: 'organization' }),
    );
  });

  it('is case-insensitive when matching the confirmation email', async () => {
    await expect(deleteOrganization(OWNER_ID, EMAIL.toUpperCase())).resolves.toBeUndefined();
  });
});

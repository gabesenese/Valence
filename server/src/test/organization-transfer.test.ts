import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for organization-ownership transfer. The caller must
 * actually be the current owner — resolveOrganizationId only resolves the
 * caller's own org membership, not whether they own it, so without an
 * explicit ownerId check any ADMIN-level teammate could hand ownership to
 * someone else.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { transferOwnership } from '../modules/organization/organization.service';

const OWNER_ID = 'owner-1';
const ORG_ID = 'org-1';
const NEW_OWNER_ID = 'member-2';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ organizationId: ORG_ID });
  prismaMock.organization.findUnique.mockResolvedValue({ ownerId: OWNER_ID });
  prismaMock.user.findFirst.mockResolvedValue({ id: NEW_OWNER_ID, isActive: true });
});

describe('transferOwnership', () => {
  it('rejects transferring to yourself', async () => {
    await expect(transferOwnership(OWNER_ID, OWNER_ID)).rejects.toThrow(/yourself/i);
  });

  it('rejects a caller who is not the current owner', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ ownerId: 'someone-else' });
    await expect(transferOwnership(OWNER_ID, NEW_OWNER_ID)).rejects.toThrow(/only the organization owner/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a recipient outside the organization', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(transferOwnership(OWNER_ID, NEW_OWNER_ID)).rejects.toThrow();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an inactive recipient', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: NEW_OWNER_ID, isActive: false });
    await expect(transferOwnership(OWNER_ID, NEW_OWNER_ID)).rejects.toThrow(/inactive/i);
  });

  it('transfers ownership when the caller is the real owner', async () => {
    await transferOwnership(OWNER_ID, NEW_OWNER_ID);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ORG_ID }, data: { ownerId: NEW_OWNER_ID } }),
    );
  });
});

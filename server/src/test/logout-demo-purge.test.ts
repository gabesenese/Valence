import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * A demo account is a disposable, one-shot artifact — nobody signs back into
 * it. Signing out of one must purge it immediately (portfolio + tokens +
 * usage + audit rows + the user row itself) rather than waiting for the
 * hourly cleanup cron. A real (non-demo) account must only have its
 * refresh token revoked, same as before.
 */

const { prismaMock, resetMock } = vi.hoisted(() => ({
  prismaMock: {
    refreshToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    usageRecord: { deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    auditLog: { deleteMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    user: { delete: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
  resetMock: vi.fn(() => Promise.resolve()),
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/demo/demo.factory', () => ({
  DemoPortfolioFactory: class { reset = resetMock; },
}));

import { logout } from '../modules/auth/auth.service';

beforeEach(() => vi.clearAllMocks());

describe('logout — demo account purge', () => {
  it('purges a demo account entirely instead of just revoking the token', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ userId: 'demo-user', user: { isDemo: true } });
    await logout('demo-token');
    expect(resetMock).toHaveBeenCalledWith('demo-user');
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'demo-user' } });
    expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('only revokes the token for a real account, leaving it untouched', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ userId: 'real-user', user: { isDemo: false } });
    await logout('real-token');
    expect(resetMock).not.toHaveBeenCalled();
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'real-token', revokedAt: null } }),
    );
  });

  it('falls back to revoking the token if the purge itself fails', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue({ userId: 'demo-user', user: { isDemo: true } });
    resetMock.mockRejectedValueOnce(new Error('boom'));
    await logout('demo-token');
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('revokes normally when the token is unknown', async () => {
    prismaMock.refreshToken.findUnique.mockResolvedValue(null);
    await logout('unknown-token');
    expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'unknown-token', revokedAt: null } }),
    );
  });
});

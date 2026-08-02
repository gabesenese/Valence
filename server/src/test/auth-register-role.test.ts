import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * A fresh signup owns their own organization from the moment it's lazily
 * created, so they must register as ADMIN (not the schema default ANALYST)
 * to ever invite a teammate or manage their org. Only the configured
 * OWNER_EMAIL account should still become SUPER_ADMIN + platform staff.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'new-user', email: args.data.email, firstName: args.data.firstName, lastName: args.data.lastName,
          role: args.data.role, plan: 'FREE', addons: [], trialEndsAt: null, emailVerifiedAt: null,
          mfaEnabled: false, isDemo: false, alertEmailOptIn: false, isPlatformStaff: args.data.isPlatformStaff ?? false,
        })),
    },
    refreshToken: { create: vi.fn(() => Promise.resolve({ token: 'refresh-token' })) },
    emailVerificationToken: {
      deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../lib/email', () => ({ sendPasswordResetEmail: vi.fn(), sendVerificationEmail: vi.fn() }));
vi.mock('../modules/analytics/funnel.service', () => ({ trackEvent: vi.fn(), trackReturnVisit: vi.fn() }));

import { register } from '../modules/auth/auth.service';

beforeEach(() => vi.clearAllMocks());

describe('register — default role', () => {
  it('registers a normal signup as ADMIN, not the schema-default ANALYST', async () => {
    const { user } = await register({
      email: 'founder@example.com', password: 'Passw0rd1!', firstName: 'F', lastName: 'O',
    });
    expect(user.role).toBe('ADMIN');
    const createArgs = prismaMock.user.create.mock.calls[0][0];
    expect(createArgs.data.isPlatformStaff).toBeUndefined();
  });
});

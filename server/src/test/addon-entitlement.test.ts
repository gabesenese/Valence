import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Guards the add-on entitlement primitives (Phase 0A, #123): hasAddon reflects
 * the user's stored add-ons, and setAddons de-duplicates so a repeated grant
 * (e.g. a re-fired Stripe webhook) can't record the same add-on twice.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getAddons, hasAddon, setAddons } from '../modules/plans/plans.service';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.update.mockResolvedValue({});
});

describe('add-on entitlement (#123 Phase 0A)', () => {
  it('hasAddon reflects the stored add-ons', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ addons: ['valence_copilot'] });
    expect(await hasAddon('u1', 'valence_copilot')).toBe(true);

    prismaMock.user.findUnique.mockResolvedValue({ addons: [] });
    expect(await hasAddon('u1', 'valence_copilot')).toBe(false);

    prismaMock.user.findUnique.mockResolvedValue(null);
    expect(await getAddons('u1')).toEqual([]);
  });

  it('setAddons de-duplicates', async () => {
    await setAddons('u1', ['valence_copilot', 'valence_copilot']);
    expect(prismaMock.user.update.mock.calls[0][0].data.addons).toEqual(['valence_copilot']);
  });
});

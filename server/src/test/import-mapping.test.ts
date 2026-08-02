import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Column-mapping memory: a returning user's CSV rarely changes shape month
 * to month, so remembering the mapping they already confirmed once removes
 * a repeated chore instead of asking them to re-map every time.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    importMapping: {
      findUnique: vi.fn(() => Promise.resolve(null)),
      upsert: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getImportMapping, saveImportMapping } from '../modules/import/import-mapping.service';

beforeEach(() => vi.clearAllMocks());

describe('import mapping memory', () => {
  it('returns null when no mapping has been saved yet', async () => {
    const result = await getImportMapping('user-1', 'leases');
    expect(result).toBeNull();
  });

  it('returns the saved mapping and defaults', async () => {
    prismaMock.importMapping.findUnique.mockResolvedValueOnce({
      columnMap: { 'Rent Amount': 'baseRent' }, defaults: { country: 'CA' },
    } as never);
    const result = await getImportMapping('user-1', 'leases');
    expect(result).toEqual({ columnMap: { 'Rent Amount': 'baseRent' }, defaults: { country: 'CA' } });
  });

  it('upserts keyed on userId + importType', async () => {
    await saveImportMapping('user-1', 'leases', { 'Rent Amount': 'baseRent' }, { country: 'CA' });
    expect(prismaMock.importMapping.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_importType: { userId: 'user-1', importType: 'leases' } },
    }));
  });

  it('does not save an empty mapping', async () => {
    await saveImportMapping('user-1', 'leases', {});
    expect(prismaMock.importMapping.upsert).not.toHaveBeenCalled();
  });
});

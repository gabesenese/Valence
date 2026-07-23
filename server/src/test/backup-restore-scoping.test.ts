import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the backup-restore tenant-isolation fix. A backup
 * snapshot is user-editable, so restore must never upsert a row whose id
 * already belongs to another account (which would re-parent/overwrite it).
 */

const OWNER = 'owner-1';

const txMock = {
  property: {
    findMany: vi.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        where.ownerId
          ? [{ id: 'own-prop' }]
          : [{ id: 'foreign-prop', ownerId: 'someone-else' }, { id: 'own-prop', ownerId: OWNER }],
      ),
    ),
    upsert: vi.fn(() => Promise.resolve({})),
  },
  tenant: { findMany: vi.fn(() => Promise.resolve([])), upsert: vi.fn(() => Promise.resolve({})) },
  lease: { findMany: vi.fn(() => Promise.resolve([])), upsert: vi.fn(() => Promise.resolve({})) },
  financialRecord: { findMany: vi.fn(() => Promise.resolve([])), upsert: vi.fn(() => Promise.resolve({})) },
};

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    backup: {
      findFirst: vi.fn(),
      // restoreBackup takes a pre-restore safety snapshot via createBackup
      create: vi.fn(() => Promise.resolve({ id: 'safety-backup', label: '', trigger: 'automated', sizeBytes: 0, createdAt: new Date() })),
    },
    property: { findMany: vi.fn(() => Promise.resolve([])) },
    tenant: { findMany: vi.fn(() => Promise.resolve([])) },
    lease: { findMany: vi.fn(() => Promise.resolve([])) },
    financialRecord: { findMany: vi.fn(() => Promise.resolve([])) },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(txMock)),
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));
vi.mock('../modules/audit/audit.service', () => ({ logAudit: vi.fn() }));

import { restoreBackup } from '../modules/backup/backup.service';

const prop = (id: string) => ({
  id, name: 'P', code: 'P', type: 'RESIDENTIAL', status: 'ACTIVE',
  address: 'a', city: 'c', state: 'ON', zipCode: 'z', totalUnits: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  txMock.property.upsert.mockClear();
  prismaMock.backup.findFirst.mockResolvedValue({
    snapshot: { version: '1', data: { properties: [prop('foreign-prop'), prop('own-prop')], tenants: [], leases: [], financialRecords: [] } },
  });
});

describe('backup restore — account scoping', () => {
  it('skips a property whose id belongs to another account, restores only owned ids', async () => {
    const result = await restoreBackup('backup-1', OWNER);
    const upsertedIds = txMock.property.upsert.mock.calls.map((c) => (c[0] as { where: { id: string } }).where.id);
    expect(upsertedIds).toEqual(['own-prop']);
    expect(upsertedIds).not.toContain('foreign-prop');
    expect(result.properties).toBe(1);
    expect(result.skipped.properties).toBe(1);
  });

  it('takes a pre-restore safety snapshot before mutating data', async () => {
    await restoreBackup('backup-1', OWNER);
    expect(prismaMock.backup.create).toHaveBeenCalledTimes(1);
    const createOrder = prismaMock.backup.create.mock.invocationCallOrder[0];
    const txOrder = prismaMock.$transaction.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(txOrder);
  });
});

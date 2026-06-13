import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';

const MAX_AUTOMATED_BACKUPS = 30;
export const MAX_MANUAL_BACKUPS = 10;

interface BackupSnapshot {
  version: string;
  exportedAt: string;
  data: {
    properties: Record<string, unknown>[];
    tenants: Record<string, unknown>[];
    leases: Record<string, unknown>[];
    financialRecords: Record<string, unknown>[];
  };
}

async function buildSnapshot(userId: string): Promise<BackupSnapshot> {
  const [properties, tenants, leases, financialRecords] = await Promise.all([
    prisma.property.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.tenant.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' } }),
    prisma.lease.findMany({ where: { property: { ownerId: userId } }, orderBy: { createdAt: 'asc' } }),
    prisma.financialRecord.findMany({ where: { property: { ownerId: userId } }, orderBy: { createdAt: 'asc' } }),
  ]);

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      properties: properties as unknown as Record<string, unknown>[],
      tenants: tenants as unknown as Record<string, unknown>[],
      leases: leases as unknown as Record<string, unknown>[],
      financialRecords: financialRecords as unknown as Record<string, unknown>[],
    },
  };
}

export async function createBackup(userId: string, label: string, trigger: 'manual' | 'automated' = 'manual') {
  const snapshot = await buildSnapshot(userId);
  const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');

  return prisma.backup.create({
    data: { userId, label, trigger, sizeBytes, snapshot: snapshot as object },
    select: { id: true, label: true, trigger: true, sizeBytes: true, createdAt: true },
  });
}

export async function listBackups(userId: string) {
  return prisma.backup.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, trigger: true, sizeBytes: true, createdAt: true },
  });
}

export async function getBackup(id: string, userId: string) {
  const backup = await prisma.backup.findFirst({ where: { id, userId } });
  if (!backup) throw new Error('Backup not found');
  return backup;
}

export async function deleteBackup(id: string, userId: string) {
  const backup = await prisma.backup.findFirst({ where: { id, userId } });
  if (!backup) throw new Error('Backup not found');
  await prisma.backup.delete({ where: { id } });
}

export async function restoreBackup(id: string, userId: string) {
  const backup = await getBackup(id, userId);
  const snapshot = backup.snapshot as unknown as BackupSnapshot;
  if (!snapshot?.data) throw new Error('Invalid backup snapshot');

  const { properties, tenants, leases, financialRecords } = snapshot.data;
  const restored = { properties: 0, tenants: 0, leases: 0, financialRecords: 0 };

  // Properties and tenants are independent — restore in parallel
  await Promise.all([
    ...properties.map((p) =>
      prisma.property.upsert({
        where: { id: p.id as string },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: { ...(p as any), ownerId: userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: { ...(p as any), ownerId: userId },
      }).then(() => { restored.properties++; })
    ),
    ...tenants.map((t) =>
      prisma.tenant.upsert({
        where: { id: t.id as string },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: { ...(t as any), ownerId: userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: { ...(t as any), ownerId: userId },
      }).then(() => { restored.tenants++; })
    ),
  ]);

  // Leases depend on properties + tenants existing first
  for (const l of leases) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.lease.upsert({ where: { id: l.id as string }, create: l as any, update: l as any });
    restored.leases++;
  }

  // Financial records depend on properties + leases
  for (const f of financialRecords) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.financialRecord.upsert({ where: { id: f.id as string }, create: f as any, update: f as any });
    restored.financialRecords++;
  }

  return restored;
}

export async function runScheduledBackups(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true, isDemo: false },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const label = `Automated — ${new Date().toLocaleDateString('en-CA')}`;
      await createBackup(user.id, label, 'automated');

      // Prune automated backups beyond retention window
      const automated = await prisma.backup.findMany({
        where: { userId: user.id, trigger: 'automated' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (automated.length > MAX_AUTOMATED_BACKUPS) {
        const toDelete = automated.slice(MAX_AUTOMATED_BACKUPS).map((b) => b.id);
        await prisma.backup.deleteMany({ where: { id: { in: toDelete } } });
      }
    } catch (err) {
      logger.warn(`Scheduled backup failed for user ${user.id}`, { error: err });
    }
  }
}

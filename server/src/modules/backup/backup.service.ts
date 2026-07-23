import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';
import { logAudit } from '../audit/audit.service';

const MAX_AUTOMATED_BACKUPS = 30;
export const MAX_MANUAL_BACKUPS = 10;
const MAX_IMPORT_BACKUPS = 10;

const BACKUP_JOB_LOCK_ID = 'scheduled_backups';
const BACKUP_JOB_LOCK_MS = 30 * 60 * 1000;


interface SnapshotProperty {
  id: string; name: string; code: string; type: string; status: string;
  address: string; city: string; state: string; zipCode: string; country: string;
  totalUnits: number; totalSqft?: unknown; yearBuilt?: number | null;
  purchaseDate?: string | null; purchasePrice?: unknown; currentValue?: unknown;
  deletedAt?: string | null; metadata?: unknown;
}

interface SnapshotTenant {
  id: string; name: string; email?: string | null; phone?: string | null;
  company?: string | null; creditScore?: number | null; notes?: string | null;
  isActive?: boolean; deletedAt?: string | null;
}

interface SnapshotLease {
  id: string; leaseNumber: string; propertyId: string; tenantId: string;
  unitNumber?: string | null; type: string; status: string; renewalRisk: string;
  startDate: string; endDate: string; baseRent: unknown; rentEscalation?: unknown;
  securityDeposit?: unknown; sqft?: unknown; notes?: string | null;
  deletedAt?: string | null;
}

interface SnapshotFinancialRecord {
  id: string; propertyId: string; leaseId?: string | null; type: string;
  status: string; amount: unknown; currency: string;
  periodStart: string; periodEnd: string; dueDate?: string | null;
  paidDate?: string | null; description?: string | null; category?: string | null;
}

interface BackupSnapshot {
  version: string;
  exportedAt: string;
  data: {
    properties: SnapshotProperty[];
    tenants: SnapshotTenant[];
    leases: SnapshotLease[];
    financialRecords: SnapshotFinancialRecord[];
  };
}

function isBackupSnapshot(v: unknown): v is BackupSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as BackupSnapshot;
  return typeof s.version === 'string' && !!s.data && Array.isArray(s.data.properties);
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
      properties: properties as unknown as SnapshotProperty[],
      tenants: tenants as unknown as SnapshotTenant[],
      leases: leases as unknown as SnapshotLease[],
      financialRecords: financialRecords as unknown as SnapshotFinancialRecord[],
    },
  };
}


async function pruneBackups(userId: string, trigger: string, keep: number): Promise<void> {
  const backups = await prisma.backup.findMany({
    where: { userId, trigger },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (backups.length > keep) {
    const toDelete = backups.slice(keep).map((b) => b.id);
    await prisma.backup.deleteMany({ where: { id: { in: toDelete } } });
  }
}

export async function createBackup(userId: string, label: string, trigger: 'manual' | 'automated' | 'import' = 'manual') {
  const snapshot = await buildSnapshot(userId);
  const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');

  const backup = await prisma.backup.create({
    data: { userId, label, trigger, sizeBytes, snapshot: snapshot as object },
    select: { id: true, label: true, trigger: true, sizeBytes: true, createdAt: true },
  });

  // Import-triggered backups are created automatically on every CSV import and
  // previously had no retention cap, so they accumulated without bound.
  if (trigger === 'import') {
    await pruneBackups(userId, 'import', MAX_IMPORT_BACKUPS).catch((err) =>
      logger.warn(`Import backup pruning failed for user ${userId}`, { error: err }),
    );
  }

  return backup;
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
  const raw = backup.snapshot as unknown;

  if (!isBackupSnapshot(raw)) throw new Error('Invalid or corrupted backup snapshot');

  // Safety net: capture current state before mutating anything, so a restore
  // that turns out to be a mistake is itself reversible. Counts toward the
  // automated retention cap, so these prune themselves over time.
  await createBackup(userId, `Pre-restore safety — ${new Date().toLocaleDateString('en-CA')}`, 'automated');

  const { properties, tenants, leases, financialRecords } = raw.data;
  const restored = { properties: 0, tenants: 0, leases: 0, financialRecords: 0 };
  const skipped = { properties: 0, tenants: 0, leases: 0, financialRecords: 0 };

  await prisma.$transaction(async (tx) => {
    /*
     * A backup snapshot is user-editable JSON, so its ids and FKs are untrusted.
     * Never touch a row that already belongs to another account, and never
     * attach a lease/record to a property/tenant/lease the caller doesn't own —
     * otherwise a tampered snapshot could re-parent or overwrite another
     * tenant's data by id.
     */
    const [xProps, xTenants, xLeases, xRecords, ownProps, ownTenants, ownLeases] = await Promise.all([
      tx.property.findMany({ where: { id: { in: properties.map((p) => p.id) } }, select: { id: true, ownerId: true } }),
      tx.tenant.findMany({ where: { id: { in: tenants.map((t) => t.id) } }, select: { id: true, ownerId: true } }),
      tx.lease.findMany({ where: { id: { in: leases.map((l) => l.id) } }, select: { id: true, property: { select: { ownerId: true } } } }),
      tx.financialRecord.findMany({ where: { id: { in: financialRecords.map((f) => f.id) } }, select: { id: true, property: { select: { ownerId: true } } } }),
      tx.property.findMany({ where: { ownerId: userId }, select: { id: true } }),
      tx.tenant.findMany({ where: { ownerId: userId }, select: { id: true } }),
      tx.lease.findMany({ where: { property: { ownerId: userId } }, select: { id: true } }),
    ]);
    const foreignProp = new Set(xProps.filter((r) => r.ownerId !== userId).map((r) => r.id));
    const foreignTenant = new Set(xTenants.filter((r) => r.ownerId !== userId).map((r) => r.id));
    const foreignLease = new Set(xLeases.filter((r) => r.property?.ownerId !== userId).map((r) => r.id));
    const foreignRecord = new Set(xRecords.filter((r) => r.property?.ownerId !== userId).map((r) => r.id));
    const callerPropIds = new Set([...ownProps.map((p) => p.id), ...properties.filter((p) => !foreignProp.has(p.id)).map((p) => p.id)]);
    const callerTenantIds = new Set([...ownTenants.map((t) => t.id), ...tenants.filter((t) => !foreignTenant.has(t.id)).map((t) => t.id)]);
    const callerLeaseIds = new Set([...ownLeases.map((l) => l.id), ...leases.filter((l) => !foreignLease.has(l.id) && callerPropIds.has(l.propertyId) && callerTenantIds.has(l.tenantId)).map((l) => l.id)]);

    await Promise.all([
      ...properties.map(async (p) => {
        if (foreignProp.has(p.id)) { skipped.properties++; return; }
        await tx.property.upsert({
          where: { id: p.id },
          create: {
            id: p.id, name: p.name, code: p.code,
            type: p.type as never, status: (p.status ?? 'ACTIVE') as never,
            address: p.address, city: p.city, state: p.state,
            zipCode: p.zipCode, country: p.country ?? 'CA',
            totalUnits: Number(p.totalUnits),
            totalSqft: p.totalSqft as never,
            yearBuilt: p.yearBuilt ?? undefined,
            purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : undefined,
            purchasePrice: p.purchasePrice as never,
            currentValue: p.currentValue as never,
            deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
            metadata: (p.metadata ?? undefined) as never,
            ownerId: userId,
          },
          update: {
            name: p.name, code: p.code,
            type: p.type as never, status: (p.status ?? 'ACTIVE') as never,
            address: p.address, city: p.city, state: p.state,
            zipCode: p.zipCode, country: p.country ?? 'CA',
            totalUnits: Number(p.totalUnits),
            totalSqft: p.totalSqft as never,
            yearBuilt: p.yearBuilt ?? undefined,
            purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : undefined,
            purchasePrice: p.purchasePrice as never,
            currentValue: p.currentValue as never,
            deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
            metadata: (p.metadata ?? undefined) as never,
            ownerId: userId,
          },
        });
        restored.properties++;
      }),
      ...tenants.map(async (t) => {
        if (foreignTenant.has(t.id)) { skipped.tenants++; return; }
        await tx.tenant.upsert({
          where: { id: t.id },
          create: {
            id: t.id, name: t.name, email: t.email ?? undefined,
            phone: t.phone ?? undefined, company: t.company ?? undefined,
            creditScore: t.creditScore ?? undefined, notes: t.notes ?? undefined,
            isActive: t.isActive ?? true,
            deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
            ownerId: userId,
          },
          update: {
            name: t.name, email: t.email ?? undefined,
            phone: t.phone ?? undefined, company: t.company ?? undefined,
            creditScore: t.creditScore ?? undefined, notes: t.notes ?? undefined,
            isActive: t.isActive ?? true,
            deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
            ownerId: userId,
          },
        });
        restored.tenants++;
      }),
    ]);

    await Promise.all(leases.map(async (l) => {
      if (foreignLease.has(l.id) || !callerPropIds.has(l.propertyId) || !callerTenantIds.has(l.tenantId)) { skipped.leases++; return; }
      await tx.lease.upsert({
        where: { id: l.id },
        create: {
          id: l.id, leaseNumber: l.leaseNumber,
          propertyId: l.propertyId, tenantId: l.tenantId,
          unitNumber: l.unitNumber ?? undefined,
          type: (l.type ?? 'GROSS') as never,
          status: (l.status ?? 'ACTIVE') as never,
          renewalRisk: (l.renewalRisk ?? 'LOW') as never,
          startDate: new Date(l.startDate), endDate: new Date(l.endDate),
          baseRent: l.baseRent as never,
          rentEscalation: (l.rentEscalation ?? 0) as never,
          securityDeposit: l.securityDeposit as never,
          sqft: l.sqft as never,
          notes: l.notes ?? undefined,
          deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
        },
        update: {
          unitNumber: l.unitNumber ?? undefined,
          type: (l.type ?? 'GROSS') as never,
          status: (l.status ?? 'ACTIVE') as never,
          renewalRisk: (l.renewalRisk ?? 'LOW') as never,
          startDate: new Date(l.startDate), endDate: new Date(l.endDate),
          baseRent: l.baseRent as never,
          rentEscalation: (l.rentEscalation ?? 0) as never,
          securityDeposit: l.securityDeposit as never,
          sqft: l.sqft as never,
          notes: l.notes ?? undefined,
          deletedAt: l.deletedAt ? new Date(l.deletedAt) : null,
        },
      });
      restored.leases++;
    }));

    await Promise.all(financialRecords.map(async (f) => {
      if (foreignRecord.has(f.id) || !callerPropIds.has(f.propertyId) || (f.leaseId && !callerLeaseIds.has(f.leaseId))) { skipped.financialRecords++; return; }
      await tx.financialRecord.upsert({
        where: { id: f.id },
        create: {
          id: f.id, propertyId: f.propertyId, leaseId: f.leaseId ?? undefined,
          type: f.type as never, status: (f.status ?? 'PENDING') as never,
          amount: f.amount as never, currency: f.currency ?? 'USD',
          periodStart: new Date(f.periodStart), periodEnd: new Date(f.periodEnd),
          dueDate: f.dueDate ? new Date(f.dueDate) : undefined,
          paidDate: f.paidDate ? new Date(f.paidDate) : undefined,
          description: f.description ?? undefined, category: f.category ?? undefined,
        },
        update: {
          type: f.type as never, status: (f.status ?? 'PENDING') as never,
          amount: f.amount as never, currency: f.currency ?? 'USD',
          periodStart: new Date(f.periodStart), periodEnd: new Date(f.periodEnd),
          dueDate: f.dueDate ? new Date(f.dueDate) : undefined,
          paidDate: f.paidDate ? new Date(f.paidDate) : undefined,
          description: f.description ?? undefined, category: f.category ?? undefined,
        },
      });
      restored.financialRecords++;
    }));
  }, {
    // Large portfolios mean hundreds of upserts in one transaction; the
    // Prisma default of 5s aborts restores for exactly the users who need
    // them most.
    maxWait: 10_000,
    timeout: 60_000,
  });

  void logAudit({ userId, action: 'RESTORE', entity: 'backup', entityId: id, meta: { ...restored, skipped } });
  return { ...restored, skipped };
}


async function tryAcquireBackupLock(): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + BACKUP_JOB_LOCK_MS);

  const updated = await prisma.jobLock.updateMany({
    where: { id: BACKUP_JOB_LOCK_ID, lockedUntil: { lt: now } },
    data: { lockedAt: now, lockedUntil: until },
  });
  if (updated.count > 0) return true;

  try {
    await prisma.jobLock.create({ data: { id: BACKUP_JOB_LOCK_ID, lockedAt: now, lockedUntil: until } });
    return true;
  } catch {
    return false; // unique constraint — another instance holds the lock
  }
}

async function releaseBackupLock(): Promise<void> {
  await prisma.jobLock.deleteMany({ where: { id: BACKUP_JOB_LOCK_ID } });
}

export async function runScheduledBackups(): Promise<void> {
  if (!(await tryAcquireBackupLock())) {
    logger.info('Scheduled backups skipped — another instance holds the lock');
    return;
  }

  try {
    await runScheduledBackupsInner();
  } finally {
    await releaseBackupLock().catch((err) => logger.warn('Backup lock release failed', { error: err }));
  }
}

async function runScheduledBackupsInner(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true, isDemo: false },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const label = `Automated — ${new Date().toLocaleDateString('en-CA')}`;
      await createBackup(user.id, label, 'automated');

      await pruneBackups(user.id, 'automated', MAX_AUTOMATED_BACKUPS);
    } catch (err) {
      logger.warn(`Scheduled backup failed for user ${user.id}`, { error: err });
    }
  }
}

import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';
import { logAudit } from '../audit/audit.service';

const MAX_AUTOMATED_BACKUPS = 30;
export const MAX_MANUAL_BACKUPS = 10;

// ─── Snapshot types ───────────────────────────────────────────────────────────

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

// ─── Snapshot builder ─────────────────────────────────────────────────────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createBackup(userId: string, label: string, trigger: 'manual' | 'automated' | 'import' = 'manual') {
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

// ─── Restore ─────────────────────────────────────────────────────────────────

export async function restoreBackup(id: string, userId: string) {
  const backup = await getBackup(id, userId);
  const raw = backup.snapshot as unknown;

  if (!isBackupSnapshot(raw)) throw new Error('Invalid or corrupted backup snapshot');

  const { properties, tenants, leases, financialRecords } = raw.data;
  const restored = { properties: 0, tenants: 0, leases: 0, financialRecords: 0 };

  await prisma.$transaction(async (tx) => {
    // Properties and tenants are independent — restore in parallel
    await Promise.all([
      ...properties.map(async (p) => {
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

    // Leases depend on properties + tenants
    await Promise.all(leases.map(async (l) => {
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

    // Financial records depend on properties + leases
    await Promise.all(financialRecords.map(async (f) => {
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
  });

  void logAudit({ userId, action: 'RESTORE', entity: 'backup', entityId: id, meta: { ...restored } });
  return restored;
}

// ─── Scheduled backups ────────────────────────────────────────────────────────

export async function runScheduledBackups(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { isActive: true, isDemo: false },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const label = `Automated — ${new Date().toLocaleDateString('en-CA')}`;
      await createBackup(user.id, label, 'automated');

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

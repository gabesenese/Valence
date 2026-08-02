import { prisma } from '../../infrastructure/database';

export interface HealthFinding {
  id: string;
  label: string;
  detail: string;
}

export interface ImportHealthReport {
  duplicateTenants: HealthFinding[];
  overlappingLeases: HealthFinding[];
  expiredActiveLeases: HealthFinding[];
  propertiesWithNoLeases: HealthFinding[];
  overLeasedProperties: HealthFinding[];
  totalFindings: number;
}

const MAX_PER_CATEGORY = 25;

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// A read-only "second pair of eyes" pass over the whole portfolio (not just
// the rows from the last import — duplicates and gaps often span separate
// import runs). Every finding here is a suggestion to review, never a block.
export async function analyzeImportHealth(userId: string): Promise<ImportHealthReport> {
  const [tenants, properties, leases] = await Promise.all([
    prisma.tenant.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, name: true, phone: true, email: true },
    }),
    prisma.property.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, name: true, code: true, totalUnits: true },
    }),
    prisma.lease.findMany({
      where: { property: { ownerId: userId, deletedAt: null }, deletedAt: null },
      select: {
        id: true, leaseNumber: true, status: true, startDate: true, endDate: true,
        tenantId: true, propertyId: true,
      },
    }),
  ]);

  const duplicateTenants: HealthFinding[] = [];
  const byPhone = new Map<string, typeof tenants>();
  for (const t of tenants) {
    if (!t.phone?.trim()) continue;
    const key = t.phone.replace(/\D/g, '');
    if (!key) continue;
    byPhone.set(key, [...(byPhone.get(key) ?? []), t]);
  }
  for (const [phone, group] of byPhone) {
    if (group.length < 2) continue;
    duplicateTenants.push({
      id: phone,
      label: `${group.length} tenants share the phone number ${group[0].phone}`,
      detail: group.map((t) => t.name).join(', '),
    });
    if (duplicateTenants.length >= MAX_PER_CATEGORY) break;
  }

  const leasesByTenant = new Map<string, typeof leases>();
  for (const l of leases) {
    leasesByTenant.set(l.tenantId, [...(leasesByTenant.get(l.tenantId) ?? []), l]);
  }
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const overlappingLeases: HealthFinding[] = [];
  for (const [tenantId, group] of leasesByTenant) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length && overlappingLeases.length < MAX_PER_CATEGORY; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.propertyId === b.propertyId) continue;
        if (!rangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) continue;
        const tenantName = tenantById.get(tenantId)?.name ?? 'Unknown tenant';
        const propA = propertyById.get(a.propertyId)?.name ?? a.propertyId;
        const propB = propertyById.get(b.propertyId)?.name ?? b.propertyId;
        overlappingLeases.push({
          id: `${a.id}:${b.id}`,
          label: `${tenantName} has overlapping leases at two properties`,
          detail: `${propA} (${a.leaseNumber}) and ${propB} (${b.leaseNumber}) overlap`,
        });
        break;
      }
    }
  }

  const now = new Date();
  const expiredActiveLeases: HealthFinding[] = leases
    .filter((l) => l.status === 'ACTIVE' && l.endDate < now)
    .slice(0, MAX_PER_CATEGORY)
    .map((l) => ({
      id: l.id,
      label: `Lease ${l.leaseNumber} ended ${l.endDate.toLocaleDateString('en-CA')} but is still marked Active`,
      detail: propertyById.get(l.propertyId)?.name ?? l.propertyId,
    }));

  const leaseCountByProperty = new Map<string, number>();
  const activeLeaseCountByProperty = new Map<string, number>();
  for (const l of leases) {
    leaseCountByProperty.set(l.propertyId, (leaseCountByProperty.get(l.propertyId) ?? 0) + 1);
    if (l.status === 'ACTIVE' || l.status === 'RENEWED') {
      activeLeaseCountByProperty.set(l.propertyId, (activeLeaseCountByProperty.get(l.propertyId) ?? 0) + 1);
    }
  }

  const propertiesWithNoLeases: HealthFinding[] = properties
    .filter((p) => !leaseCountByProperty.get(p.id))
    .slice(0, MAX_PER_CATEGORY)
    .map((p) => ({
      id: p.id,
      label: `${p.name} (${p.code}) has no leases yet`,
      detail: 'Import or add leases to unlock renewal forecasting and revenue tracking for this property',
    }));

  const overLeasedProperties: HealthFinding[] = properties
    .filter((p) => (activeLeaseCountByProperty.get(p.id) ?? 0) > p.totalUnits)
    .slice(0, MAX_PER_CATEGORY)
    .map((p) => ({
      id: p.id,
      label: `${p.name} (${p.code}) has ${activeLeaseCountByProperty.get(p.id)} active leases but only ${p.totalUnits} units`,
      detail: 'Check for a duplicate lease or an outdated unit count',
    }));

  const totalFindings =
    duplicateTenants.length + overlappingLeases.length + expiredActiveLeases.length +
    propertiesWithNoLeases.length + overLeasedProperties.length;

  return { duplicateTenants, overlappingLeases, expiredActiveLeases, propertiesWithNoLeases, overLeasedProperties, totalFindings };
}

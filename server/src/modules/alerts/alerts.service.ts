import { Prisma, AlertType, AlertSeverity } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import { addDays } from 'date-fns';
import { computeRenewalRisk } from '../leases/leases.service';

export async function getAlerts(query: {
  page: number;
  limit: number;
  type?: AlertType;
  severity?: AlertSeverity;
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
  propertyId?: string;
}) {
  const { page = 1, limit = 20, type, severity, status, propertyId } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AlertWhereInput = {
    ...(type && { type }),
    ...(severity && { severity }),
    ...(status && { status }),
    ...(propertyId && { propertyId }),
  };

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: {
        property: { select: { id: true, name: true, code: true } },
        lease: { select: { id: true, leaseNumber: true } },
      },
    }),
    prisma.alert.count({ where }),
  ]);

  return { alerts, total };
}

export async function acknowledgeAlert(id: string, userId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  return prisma.alert.update({
    where: { id },
    data: { status: 'ACKNOWLEDGED', resolvedBy: userId },
  });
}

export async function resolveAlert(id: string, userId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  return prisma.alert.update({
    where: { id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: userId },
  });
}

export async function generateLeaseExpirationAlerts(): Promise<number> {
  const thresholds = [
    { days: 30, severity: 'CRITICAL' as AlertSeverity },
    { days: 60, severity: 'WARNING' as AlertSeverity },
    { days: 90, severity: 'INFO' as AlertSeverity },
  ];

  let created = 0;

  for (const { days, severity } of thresholds) {
    const expiringLeases = await prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: addDays(new Date(), days), gte: new Date() },
        alerts: {
          none: {
            type: 'LEASE_EXPIRATION',
            status: { in: ['OPEN', 'ACKNOWLEDGED'] },
            createdAt: { gte: addDays(new Date(), -1) },
          },
        },
      },
      include: { property: true, tenant: true },
    });

    for (const lease of expiringLeases) {
      const risk = computeRenewalRisk(lease.endDate);
      const daysLeft = Math.ceil((lease.endDate.getTime() - Date.now()) / 86400000);

      await prisma.alert.create({
        data: {
          type: 'LEASE_EXPIRATION',
          severity,
          title: `Lease expiring in ${daysLeft} days`,
          description: `Lease ${lease.leaseNumber} for ${lease.tenant.name} at ${lease.property.name} expires in ${daysLeft} days.`,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          metadata: { leaseNumber: lease.leaseNumber, daysLeft, renewalRisk: risk },
        },
      });
      created++;
    }
  }

  return created;
}

export async function getAlertSummary() {
  const [total, bySeverity, byType, byStatus] = await Promise.all([
    prisma.alert.count({ where: { status: 'OPEN' } }),
    prisma.alert.groupBy({ by: ['severity'], where: { status: 'OPEN' }, _count: true }),
    prisma.alert.groupBy({ by: ['type'], where: { status: 'OPEN' }, _count: true }),
    prisma.alert.groupBy({ by: ['status'], _count: true }),
  ]);

  return { openTotal: total, bySeverity, byType, byStatus };
}

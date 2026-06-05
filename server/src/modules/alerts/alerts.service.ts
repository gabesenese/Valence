import { Prisma, AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import { addDays } from 'date-fns';
import { computeRenewalRisk } from '../leases/leases.service';

const ALERT_INCLUDE = {
  property: { select: { id: true, name: true, code: true } },
  lease: { select: { id: true, leaseNumber: true } },
  assignee: { select: { id: true, firstName: true, lastName: true } },
  acknowledgedByUser: { select: { id: true, firstName: true, lastName: true } },
  dismissedByUser: { select: { id: true, firstName: true, lastName: true } },
  resolvedByUser: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function logAlertActivity(
  alertId: string,
  action: string,
  actorUserId?: string,
  metadata?: Record<string, unknown>,
) {
  return prisma.alertActivity.create({
    data: { alertId, action, actorUserId: actorUserId ?? null, metadata: (metadata ?? undefined) as Prisma.InputJsonObject | undefined },
  });
}

export async function getAlerts(query: {
  page: number;
  limit: number;
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  statuses?: AlertStatus[];
  propertyId?: string;
  leaseId?: string;
}) {
  const { page = 1, limit = 20, type, severity, status, statuses, propertyId, leaseId } = query;
  const skip = (page - 1) * limit;

  const statusFilter: Prisma.AlertWhereInput =
    statuses && statuses.length > 0
      ? { status: { in: statuses } }
      : status
      ? { status }
      : {};

  const where: Prisma.AlertWhereInput = {
    ...statusFilter,
    ...(type && { type }),
    ...(severity && { severity }),
    ...(propertyId && { propertyId }),
    ...(leaseId && { leaseId }),
  };

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      include: ALERT_INCLUDE,
    }),
    prisma.alert.count({ where }),
  ]);

  return { alerts, total };
}

export async function acknowledgeAlert(id: string, userId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
    include: ALERT_INCLUDE,
  });
  await logAlertActivity(id, 'ACKNOWLEDGED', userId);
  return updated;
}

export async function progressAlert(id: string, userId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const data: Prisma.AlertUpdateInput = { status: 'IN_PROGRESS' };
  // Carry forward acknowledgedAt/By if not already set (direct OPEN→IN_PROGRESS)
  if (!alert.acknowledgedAt) {
    data.acknowledgedAt = new Date();
    data.acknowledgedById = userId;
  }

  const updated = await prisma.alert.update({ where: { id }, data, include: ALERT_INCLUDE });
  await logAlertActivity(id, 'PROGRESSED', userId);
  return updated;
}

export async function resolveAlert(id: string, userId: string, note?: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: userId,
      ...(note && { resolutionNote: note }),
    },
    include: ALERT_INCLUDE,
  });
  await logAlertActivity(id, 'RESOLVED', userId, note ? { note } : undefined);
  return updated;
}

export async function dismissAlert(id: string, userId: string, note?: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'DISMISSED',
      dismissedAt: new Date(),
      dismissedById: userId,
      ...(note && { resolutionNote: note }),
    },
    include: ALERT_INCLUDE,
  });
  await logAlertActivity(id, 'DISMISSED', userId, note ? { note } : undefined);
  return updated;
}

export async function assignAlert(id: string, assigneeUserId: string, actorUserId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const updated = await prisma.alert.update({
    where: { id },
    data: { assigneeUserId, status: alert.status === 'OPEN' ? 'IN_PROGRESS' : alert.status },
    include: ALERT_INCLUDE,
  });
  await logAlertActivity(id, 'ASSIGNED', actorUserId, { assigneeUserId });
  return updated;
}

export async function reopenAlert(id: string, userId: string) {
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) throw new NotFoundError('Alert');

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      status: 'OPEN',
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      acknowledgedAt: null,
      acknowledgedById: null,
      dismissedAt: null,
      dismissedById: null,
    },
    include: ALERT_INCLUDE,
  });
  await logAlertActivity(id, 'REOPENED', userId);
  return updated;
}

export async function getAlertActivity(alertId: string) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError('Alert');

  return prisma.alertActivity.findMany({
    where: { alertId },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getAlertSummary() {
  const [openTotal, acknowledgedTotal, bySeverity, byType, byStatus] = await Promise.all([
    prisma.alert.count({ where: { status: 'OPEN' } }),
    prisma.alert.count({ where: { status: 'ACKNOWLEDGED' } }),
    prisma.alert.groupBy({ by: ['severity'], where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, _count: true }),
    prisma.alert.groupBy({ by: ['type'], where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, _count: true }),
    prisma.alert.groupBy({ by: ['status'], _count: true }),
  ]);

  return { openTotal, acknowledgedTotal, bySeverity, byType, byStatus };
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
            status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] },
            createdAt: { gte: addDays(new Date(), -1) },
          },
        },
      },
      include: { property: true, tenant: true },
    });

    for (const lease of expiringLeases) {
      const risk = computeRenewalRisk(lease.endDate);
      const daysLeft = Math.ceil((lease.endDate.getTime() - Date.now()) / 86400000);

      const alert = await prisma.alert.create({
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
      await logAlertActivity(alert.id, 'SCAN_CREATED', undefined, { source: 'anomaly_scan', daysLeft });
      created++;
    }
  }

  return created;
}

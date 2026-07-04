import { Prisma, AlertType, AlertSeverity, AlertStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import { addDays } from 'date-fns';
import { computeRenewalRisk } from '../leases/leases.service';
import { recordChange } from '../changes/changes.service';

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
}, userId: string) {
  const { page = 1, limit = 20, type, severity, status, statuses, propertyId, leaseId } = query;
  const skip = (page - 1) * limit;

  const statusFilter: Prisma.AlertWhereInput =
    statuses && statuses.length > 0
      ? { status: { in: statuses } }
      : status
      ? { status }
      : {};

  const ownerFilter: Prisma.AlertWhereInput = {
    OR: [
      { property: { ownerId: userId } },
      { lease: { property: { ownerId: userId } } },
      { createdById: userId },
    ],
  };

  const where: Prisma.AlertWhereInput = {
    ...ownerFilter,
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

  const data: Prisma.AlertUncheckedUpdateInput = { status: 'IN_PROGRESS' };
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

export async function dismissAllAlerts(userId: string): Promise<number> {
  const now = new Date();
  const { count } = await prisma.alert.updateMany({
    where: {
      status: 'OPEN',
      OR: [
        { property: { ownerId: userId } },
        { assigneeUserId: userId },
      ],
    },
    data: { status: 'DISMISSED', dismissedAt: now, dismissedById: userId },
  });
  return count;
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

export async function getAlertSummary(userId: string) {
  const owned: Prisma.AlertWhereInput = {
    OR: [
      { property: { ownerId: userId } },
      { lease: { property: { ownerId: userId } } },
      { createdById: userId },
    ],
  };
  const [openTotal, acknowledgedTotal, bySeverity, byType, byStatus] = await Promise.all([
    prisma.alert.count({ where: { ...owned, status: 'OPEN' } }),
    prisma.alert.count({ where: { ...owned, status: 'ACKNOWLEDGED' } }),
    prisma.alert.groupBy({ by: ['severity'], where: { ...owned, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, _count: true }),
    prisma.alert.groupBy({ by: ['type'], where: { ...owned, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, _count: true }),
    prisma.alert.groupBy({ by: ['status'], where: owned, _count: true }),
  ]);

  return { openTotal, acknowledgedTotal, bySeverity, byType, byStatus };
}

export async function generateLeaseExpirationAlerts(): Promise<number> {
  const now = new Date();
  let created = 0;

  const leases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: addDays(now, 90) },
    },
    include: {
      property: true,
      tenant: true,
      alerts: {
        where: {
          type: 'LEASE_EXPIRATION',
          status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  for (const lease of leases) {
    const daysLeft = Math.ceil((lease.endDate.getTime() - now.getTime()) / 86400000);
    const severity: AlertSeverity = daysLeft <= 30 ? 'CRITICAL' : daysLeft <= 60 ? 'WARNING' : 'INFO';
    const risk = computeRenewalRisk(lease.endDate);
    const title = `Lease expiring in ${daysLeft} days`;
    const description = `Lease ${lease.leaseNumber} for ${lease.tenant.name} at ${lease.property.name} expires in ${daysLeft} days.`;
    const metadata = { leaseNumber: lease.leaseNumber, daysLeft, renewalRisk: risk };

    const existing = lease.alerts[0];

    if (!existing) {
      const alert = await prisma.alert.create({
        data: {
          type: 'LEASE_EXPIRATION',
          severity,
          title,
          description,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          metadata,
        },
      });
      await logAlertActivity(alert.id, 'SCAN_CREATED', undefined, { source: 'anomaly_scan', daysLeft });
      void recordChange({
        type: 'ALERT_CREATED',
        entityType: 'alert',
        entityId: alert.id,
        title: alert.title,
        detail: `${lease.tenant.name} · ${lease.property.name}`,
        severity: String(severity).toLowerCase(),
        leaseId: lease.id,
        propertyId: lease.propertyId,
      });
      created++;
      continue;
    }

    const prevDaysLeft = (existing.metadata as { daysLeft?: number } | null)?.daysLeft;
    const severityChanged = existing.severity !== severity;
    if (severityChanged || prevDaysLeft !== daysLeft) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { severity, title, description, metadata },
      });
      if (severityChanged) {
        await logAlertActivity(existing.id, 'SCAN_ESCALATED', undefined, {
          source: 'anomaly_scan',
          daysLeft,
          from: existing.severity,
          to: severity,
        });
      }
    }
  }

  return created;
}

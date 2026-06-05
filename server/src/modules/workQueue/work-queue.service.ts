import { prisma } from '../../infrastructure/database';
import { differenceInDays } from 'date-fns';

export type WorkItemSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type WorkItemStatus = 'OPEN' | 'IN_PROGRESS';

export interface WorkItem {
  id: string;
  source: 'alert' | 'lease';
  alertId: string | null;
  leaseId: string | null;
  type: string;
  severity: WorkItemSeverity;
  status: WorkItemStatus;
  title: string;
  description: string;
  priorityScore: number;
  monthlyRisk: number;
  daysUntilExpiry: number | null;
  property: { id: string; name: string; code: string } | null;
  lease: { id: string; leaseNumber: string; tenantName: string; baseRent: number } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  createdAt: Date;
}

const SEVERITY_BASE: Record<WorkItemSeverity, number> = {
  CRITICAL: 1000,
  WARNING: 500,
  INFO: 100,
};

function score(item: Pick<WorkItem, 'severity' | 'daysUntilExpiry' | 'monthlyRisk' | 'createdAt'>): number {
  const base = SEVERITY_BASE[item.severity];
  const urgency =
    item.daysUntilExpiry !== null
      ? Math.max(0, Math.floor(((90 - Math.max(0, item.daysUntilExpiry)) / 90) * 500))
      : 0;
  const rent = Math.min(300, Math.floor(item.monthlyRisk / 200));
  const daysOpen = differenceInDays(new Date(), item.createdAt);
  const age = Math.min(100, daysOpen * 5);
  return base + urgency + rent + age;
}

export async function getWorkQueue(options: { assignedToUserId?: string } = {}) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 86400000);
  const { assignedToUserId } = options;

  const alerts = await prisma.alert.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      ...(assignedToUserId ? { assigneeUserId: assignedToUserId } : {}),
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      lease: {
        select: {
          id: true,
          leaseNumber: true,
          baseRent: true,
          endDate: true,
          tenant: { select: { name: true } },
        },
      },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });

  // Leases with active alerts — already covered above
  const coveredLeaseIds = new Set(
    alerts.map((a) => a.leaseId).filter((id): id is string => id !== null),
  );

  // Active leases expiring within 90d not yet backed by any active alert (safety net)
  const uncoveredLeases = assignedToUserId
    ? []
    : await prisma.lease.findMany({
        where: {
          status: 'ACTIVE',
          endDate: { gte: now, lte: ninetyDaysOut },
          ...(coveredLeaseIds.size > 0 ? { id: { notIn: [...coveredLeaseIds] } } : {}),
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
        },
        include: {
          property: { select: { id: true, name: true, code: true } },
          tenant: { select: { name: true } },
        },
      });

  const alertItems: WorkItem[] = alerts.map((alert) => {
    const daysUntilExpiry = alert.lease?.endDate
      ? differenceInDays(alert.lease.endDate, now)
      : null;
    const monthlyRisk = alert.lease ? Number(alert.lease.baseRent) : 0;

    const item: WorkItem = {
      id: `alert:${alert.id}`,
      source: 'alert',
      alertId: alert.id,
      leaseId: alert.leaseId,
      type: alert.type,
      severity: alert.severity as WorkItemSeverity,
      status: alert.status as WorkItemStatus,
      title: alert.title,
      description: alert.description,
      priorityScore: 0,
      monthlyRisk,
      daysUntilExpiry,
      property: alert.property,
      lease: alert.lease
        ? {
            id: alert.lease.id,
            leaseNumber: alert.lease.leaseNumber,
            tenantName: alert.lease.tenant.name,
            baseRent: Number(alert.lease.baseRent),
          }
        : null,
      assignee: alert.assignee,
      createdAt: alert.createdAt,
    };

    item.priorityScore = score(item);
    return item;
  });

  const leaseItems: WorkItem[] = uncoveredLeases.map((lease) => {
    const daysUntilExpiry = differenceInDays(lease.endDate, now);
    const severity: WorkItemSeverity =
      daysUntilExpiry <= 30 ? 'CRITICAL' : daysUntilExpiry <= 60 ? 'WARNING' : 'INFO';
    const monthlyRisk = Number(lease.baseRent);

    const item: WorkItem = {
      id: `lease:${lease.id}`,
      source: 'lease',
      alertId: null,
      leaseId: lease.id,
      type: 'LEASE_EXPIRATION',
      severity,
      status: 'OPEN',
      title: `Lease expiring in ${daysUntilExpiry} days`,
      description: `${lease.tenant.name} at ${lease.property.name} — no renewal started.`,
      priorityScore: 0,
      monthlyRisk,
      daysUntilExpiry,
      property: lease.property,
      lease: {
        id: lease.id,
        leaseNumber: lease.leaseNumber,
        tenantName: lease.tenant.name,
        baseRent: monthlyRisk,
      },
      assignee: null,
      createdAt: lease.createdAt,
    };

    item.priorityScore = score(item);
    return item;
  });

  const items = [...alertItems, ...leaseItems].sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    items,
    summary: {
      total: items.length,
      critical: items.filter((i) => i.severity === 'CRITICAL').length,
      warning: items.filter((i) => i.severity === 'WARNING').length,
      info: items.filter((i) => i.severity === 'INFO').length,
      inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    },
  };
}

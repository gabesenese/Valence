import { prisma } from '../../infrastructure/database';
import { differenceInDays } from 'date-fns';

export type WorkItemSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type WorkItemStatus = 'OPEN' | 'IN_PROGRESS';
export type WorkItemSource = 'alert' | 'lease' | 'finance';

export interface WorkItem {
  id: string;
  source: WorkItemSource;
  alertId: string | null;
  leaseId: string | null;
  financialRecordId: string | null;
  type: string;
  severity: WorkItemSeverity;
  status: WorkItemStatus;
  title: string;
  description: string;
  suggestedAction: string;
  priorityScore: number;
  monthlyRisk: number;
  daysUntilExpiry: number | null;
  property: { id: string; name: string; code: string } | null;
  lease: { id: string; leaseNumber: string; tenantName: string; baseRent: number } | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  createdAt: Date;
}

// ─── Priority scoring ─────────────────────────────────────────────────────────

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

// ─── Suggested actions ────────────────────────────────────────────────────────

function suggestAction(
  type: string,
  daysUntilExpiry: number | null,
  tenantName?: string,
  propertyName?: string,
): string {
  const tenant = tenantName ? `${tenantName}` : 'tenant';
  const property = propertyName ? `${propertyName}` : 'property';

  switch (type) {
    case 'LEASE_EXPIRATION':
      if (daysUntilExpiry !== null && daysUntilExpiry <= 30)
        return `Contact ${tenant} immediately — confirm renewal intent or begin unit marketing`;
      if (daysUntilExpiry !== null && daysUntilExpiry <= 60)
        return `Schedule renewal discussion with ${tenant} and prepare draft terms`;
      return `Begin renewal outreach — send initial proposal to ${tenant}`;

    case 'RENEWAL_RISK':
      return `Meet with ${tenant} to assess renewal probability and address concerns directly`;

    case 'PAYMENT_ANOMALY':
      return `Audit ${property} revenue records and contact tenant if payment is missing`;

    case 'FINANCIAL_DISCREPANCY':
      return `Reconcile flagged record at ${property} and document corrective action`;

    case 'OCCUPANCY_CHANGE':
      return `Brief leasing team on vacant units at ${property} and activate marketing`;

    case 'DATA_MISSING':
      return `Locate and enter missing lease data to maintain record accuracy`;

    case 'COMPLIANCE_FLAG':
      return `Review compliance issue at ${property} and file corrective action`;

    case 'OVERDUE_INVOICE':
      return `Collect overdue payment from ${tenant} — send reminder or escalate to collections`;

    default:
      return `Review and take action on this item`;
  }
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function getWorkQueue(options: { assignedToUserId?: string } = {}) {
  const now = new Date();
  const ninetyDaysOut = new Date(now.getTime() + 90 * 86400000);
  const { assignedToUserId } = options;

  // ── 1. Alerts ────────────────────────────────────────────────────────────────
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

  const coveredLeaseIds = new Set(
    alerts.map((a) => a.leaseId).filter((id): id is string => id !== null),
  );

  // ── 2. Uncovered expiring leases (safety net) ────────────────────────────────
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

  // ── 3. Overdue invoices (unpaid revenue past due date) ───────────────────────
  // Only add when no open PAYMENT_ANOMALY alert already covers the same lease
  const coveredByPaymentAlert = new Set(
    alerts
      .filter((a) => a.type === 'PAYMENT_ANOMALY' && a.leaseId)
      .map((a) => a.leaseId as string),
  );

  const overdueInvoices = assignedToUserId
    ? []
    : await prisma.financialRecord.findMany({
        where: {
          type: 'REVENUE',
          status: 'PENDING',
          dueDate: { lt: now },
          ...(coveredByPaymentAlert.size > 0
            ? { leaseId: { notIn: [...coveredByPaymentAlert] } }
            : {}),
        },
        include: {
          property: { select: { id: true, name: true, code: true } },
          lease: {
            select: {
              id: true,
              leaseNumber: true,
              baseRent: true,
              tenant: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      });

  // ── Build WorkItem arrays ────────────────────────────────────────────────────

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
      financialRecordId: null,
      type: alert.type,
      severity: alert.severity as WorkItemSeverity,
      status: alert.status as WorkItemStatus,
      title: alert.title,
      description: alert.description,
      suggestedAction: suggestAction(
        alert.type,
        daysUntilExpiry,
        alert.lease?.tenant.name,
        alert.property?.name,
      ),
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
      financialRecordId: null,
      type: 'LEASE_EXPIRATION',
      severity,
      status: 'OPEN',
      title: `Lease expiring in ${daysUntilExpiry} days`,
      description: `${lease.tenant.name} at ${lease.property.name} — no renewal started.`,
      suggestedAction: suggestAction('LEASE_EXPIRATION', daysUntilExpiry, lease.tenant.name, lease.property.name),
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

  const invoiceItems: WorkItem[] = overdueInvoices.map((record) => {
    const daysOverdue = differenceInDays(now, record.dueDate!);
    const severity: WorkItemSeverity =
      daysOverdue >= 30 ? 'CRITICAL' : daysOverdue >= 14 ? 'WARNING' : 'INFO';
    const amount = Number(record.amount);

    const item: WorkItem = {
      id: `finance:${record.id}`,
      source: 'finance',
      alertId: null,
      leaseId: record.leaseId,
      financialRecordId: record.id,
      type: 'OVERDUE_INVOICE',
      severity,
      status: 'OPEN',
      title: `Overdue invoice — $${amount.toLocaleString()} (${daysOverdue}d past due)`,
      description: record.lease
        ? `${record.lease.tenant.name} at ${record.property.name} has an unpaid revenue record of $${amount.toLocaleString()} due ${daysOverdue} days ago.`
        : `Unpaid revenue record of $${amount.toLocaleString()} at ${record.property.name} is ${daysOverdue} days overdue.`,
      suggestedAction: suggestAction('OVERDUE_INVOICE', null, record.lease?.tenant.name, record.property.name),
      priorityScore: 0,
      monthlyRisk: amount,
      daysUntilExpiry: null,
      property: record.property,
      lease: record.lease
        ? {
            id: record.lease.id,
            leaseNumber: record.lease.leaseNumber,
            tenantName: record.lease.tenant.name,
            baseRent: Number(record.lease.baseRent),
          }
        : null,
      assignee: null,
      createdAt: record.createdAt,
    };

    item.priorityScore = score(item);
    return item;
  });

  const items = [...alertItems, ...leaseItems, ...invoiceItems].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );

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

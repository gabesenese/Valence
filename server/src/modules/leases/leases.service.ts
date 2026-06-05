import { Prisma, RenewalRisk, RenewalStage } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { NotFoundError } from '../../utils/errors';
import type { CreateLeaseInput, UpdateLeaseInput, LeaseQuery, BulkActionInput, AddNoteInput } from './leases.schemas';
import { addDays, differenceInDays, parseISO } from 'date-fns';

export function computeRenewalRisk(endDate: Date): RenewalRisk {
  const daysUntilExpiry = differenceInDays(endDate, new Date());
  if (daysUntilExpiry <= 30) return 'CRITICAL';
  if (daysUntilExpiry <= 60) return 'HIGH';
  if (daysUntilExpiry <= 90) return 'MEDIUM';
  return 'LOW';
}

// ─── Priority scoring ─────────────────────────────────────────────────────────

const RISK_WEIGHT: Record<string, number> = {
  CRITICAL: 400,
  HIGH: 200,
  MEDIUM: 80,
  LOW: 0,
};

const STAGE_MULTIPLIER: Record<string, number> = {
  NOT_STARTED: 1.5,
  CONTACTED: 1.2,
  NEGOTIATING: 1.0,
  DRAFT_SENT: 0.8,
  LEGAL_REVIEW: 0.65,
  SCHEDULED_RENEWAL: 0.5,
  SIGNED: 0.1,
};

interface PriorityInput {
  endDate: Date;
  renewalDate: Date | null;
  renewalScheduledAt: Date | null;
  renewalStage: RenewalStage;
  renewalRisk: RenewalRisk;
  baseRent: Prisma.Decimal;
  openAlertCount: number;
}

export function computePriorityScore(input: PriorityInput): { score: number; why: string } {
  const daysToExpiry = differenceInDays(input.endDate, new Date());
  // Urgency: 0–1000 linearly over 180-day window; anything beyond 180d scores 0
  const urgencyScore = Math.max(0, Math.min(1000, (180 - Math.max(0, daysToExpiry)) * (1000 / 180)));
  const noRenewalMultiplier = !input.renewalDate && !input.renewalScheduledAt ? 2.0 : 1.0;
  const stageMultiplier = STAGE_MULTIPLIER[input.renewalStage] ?? 1.0;
  const riskScore = RISK_WEIGHT[input.renewalRisk] ?? 0;
  // Normalize monthly rent contribution: $50k/mo → 200 pts
  const rentScore = Math.min(200, (Number(input.baseRent) / 50000) * 200);
  const alertScore = input.openAlertCount * 100;

  const score = Math.round(
    urgencyScore * noRenewalMultiplier * stageMultiplier + riskScore + rentScore + alertScore,
  );

  const reasons: string[] = [];
  if (daysToExpiry <= 30) reasons.push(`expires in ${daysToExpiry}d`);
  else if (daysToExpiry <= 90) reasons.push(`${daysToExpiry}d to expiry`);
  if (!input.renewalDate && !input.renewalScheduledAt) reasons.push('no renewal scheduled');
  if (input.renewalStage === 'NOT_STARTED') reasons.push('renewal not started');
  if (input.renewalRisk === 'CRITICAL') reasons.push('critical risk');
  else if (input.renewalRisk === 'HIGH') reasons.push('high risk');
  if (input.openAlertCount > 0)
    reasons.push(`${input.openAlertCount} open alert${input.openAlertCount > 1 ? 's' : ''}`);

  return { score, why: reasons.length > 0 ? reasons.join(' · ') : 'standard monitoring' };
}

// ─── Activity logging ─────────────────────────────────────────────────────────

async function logActivity(
  leaseId: string,
  actionType: string,
  actorUserId?: string | null,
  metadata?: Record<string, unknown>,
) {
  return prisma.leaseActivity.create({
    data: {
      leaseId,
      actionType,
      actorUserId: actorUserId ?? null,
      metadata: metadata ? (metadata as Prisma.InputJsonObject) : undefined,
    },
  });
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function getLeases(query: LeaseQuery) {
  const { page, limit, status, renewalRisk, renewalStage, propertyId, tenantId, ownerUserId,
    expiringWithinDays, search, sortBy, sortOrder, hasAlerts } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeaseWhereInput = {
    ...(status && { status }),
    ...(renewalRisk && { renewalRisk }),
    ...(renewalStage && { renewalStage }),
    ...(propertyId && { propertyId }),
    ...(tenantId && { tenantId }),
    ...(ownerUserId && { ownerUserId }),
    ...(expiringWithinDays && {
      endDate: { gte: new Date(), lte: addDays(new Date(), expiringWithinDays) },
      ...(!status && { status: 'ACTIVE' }),
    }),
    ...(hasAlerts !== undefined && {
      alerts: hasAlerts
        ? { some: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }
        : { none: { status: { in: ['OPEN', 'IN_PROGRESS'] } } },
    }),
    ...(search && {
      OR: [
        { leaseNumber: { contains: search, mode: 'insensitive' } },
        { tenant: { name: { contains: search, mode: 'insensitive' } } },
        { property: { name: { contains: search, mode: 'insensitive' } } },
        { unitNumber: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const order = sortOrder ?? 'asc';
  const orderBy: Prisma.LeaseOrderByWithRelationInput =
    sortBy === 'baseRent' ? { baseRent: order } :
    sortBy === 'createdAt' ? { createdAt: order } :
    { endDate: order };

  const [leases, total] = await Promise.all([
    prisma.lease.findMany({
      where, skip, take: limit, orderBy,
      include: {
        property: { select: { id: true, name: true, code: true } },
        tenant: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        alerts: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true, title: true, severity: true, type: true },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        },
      },
    }),
    prisma.lease.count({ where }),
  ]);

  return { leases, total };
}

export async function getPriorityQueue() {
  const now = new Date();

  const candidates = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      alerts: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true, title: true, severity: true, type: true },
        orderBy: [{ severity: 'desc' as const }, { createdAt: 'desc' as const }],
      },
    },
  });

  return candidates
    .map((lease) => {
      const { score, why } = computePriorityScore({
        endDate: lease.endDate,
        renewalDate: lease.renewalDate,
        renewalScheduledAt: lease.renewalScheduledAt,
        renewalStage: lease.renewalStage,
        renewalRisk: lease.renewalRisk,
        baseRent: lease.baseRent,
        openAlertCount: lease.alerts.length,
      });
      return { ...lease, priorityScore: score, whyThisIsHere: why };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);
}

export async function getLeaseById(id: string) {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      property: true,
      tenant: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
      financialRecords: { orderBy: { periodStart: 'desc' }, take: 12 },
      alerts: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED'] } },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true, type: true, severity: true, status: true,
          title: true, description: true, createdAt: true,
        },
      },
    },
  });
  if (!lease) throw new NotFoundError('Lease');
  return lease;
}

export async function getLeasePreview(id: string) {
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      alerts: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      },
      financialRecords: {
        where: { type: 'REVENUE' },
        orderBy: { periodStart: 'asc' },
        take: 12,
        select: { periodStart: true, amount: true, status: true },
      },
    },
  });
  if (!lease) throw new NotFoundError('Lease');

  const paymentSeries = lease.financialRecords.map((r) => ({
    period: r.periodStart.toISOString().slice(0, 7),
    amount: Number(r.amount),
    status: r.status,
  }));

  const { score, why } = computePriorityScore({
    endDate: lease.endDate,
    renewalDate: lease.renewalDate,
    renewalScheduledAt: lease.renewalScheduledAt,
    renewalStage: lease.renewalStage,
    renewalRisk: lease.renewalRisk,
    baseRent: lease.baseRent,
    openAlertCount: lease.alerts.length,
  });

  return { lease, paymentSeries, priorityScore: score, whyThisIsHere: why };
}

export async function getLeaseActivity(id: string) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  return prisma.leaseActivity.findMany({
    where: { leaseId: id },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getLeaseNotes(id: string) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  return prisma.leaseNote.findMany({
    where: { leaseId: id },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function startRenewal(id: string, userId: string) {
  const lease = await prisma.lease.findUnique({ where: { id }, select: { id: true, renewalStage: true } });
  if (!lease) throw new NotFoundError('Lease');
  const updated = await prisma.lease.update({
    where: { id },
    data: {
      renewalStage: lease.renewalStage === 'NOT_STARTED' ? 'CONTACTED' : lease.renewalStage,
      lastContactedAt: new Date(),
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  await logActivity(id, 'RENEWAL_STARTED', userId);
  return updated;
}

export async function setRenewalDateAction(id: string, userId: string, renewalDate: string) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  const parsed = parseISO(renewalDate);
  const updated = await prisma.lease.update({
    where: { id },
    data: {
      renewalDate: parsed,
      renewalScheduledAt: parsed,
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });
  // Auto-resolve any open RENEWAL_RISK alerts for this lease
  await prisma.alert.updateMany({
    where: { leaseId: id, type: 'RENEWAL_RISK', status: { in: ['OPEN', 'IN_PROGRESS'] } },
    data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy: userId },
  });
  await logActivity(id, 'RENEWAL_DATE_SET', userId, { renewalDate });
  return updated;
}

export async function assignOwner(id: string, actorUserId: string, ownerUserId: string) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  const updated = await prisma.lease.update({
    where: { id },
    data: { ownerUserId },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  await logActivity(id, 'OWNER_ASSIGNED', actorUserId, { ownerUserId });
  return updated;
}

export async function markContacted(id: string, userId: string) {
  const lease = await prisma.lease.findUnique({ where: { id }, select: { id: true, renewalStage: true } });
  if (!lease) throw new NotFoundError('Lease');
  const updated = await prisma.lease.update({
    where: { id },
    data: {
      lastContactedAt: new Date(),
      renewalStage:
        lease.renewalStage === 'NOT_STARTED' ? 'CONTACTED' : lease.renewalStage,
    },
  });
  await logActivity(id, 'TENANT_CONTACTED', userId);
  return updated;
}

export async function snoozeLease(id: string, userId: string, days = 7) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  const snoozedUntil = addDays(new Date(), days);
  const updated = await prisma.lease.update({ where: { id }, data: { snoozedUntil } });
  await logActivity(id, 'SNOOZED', userId, { days, snoozedUntil: snoozedUntil.toISOString() });
  return updated;
}

export async function clearRenewalDate(id: string, userId: string) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  const updated = await prisma.lease.update({
    where: { id },
    data: { renewalDate: null, renewalScheduledAt: null },
  });
  await logActivity(id, 'RENEWAL_DATE_CLEARED', userId);
  return updated;
}

export async function advanceRenewalStage(id: string, userId: string, stage: RenewalStage) {
  const lease = await prisma.lease.findUnique({ where: { id }, select: { id: true, renewalStage: true } });
  if (!lease) throw new NotFoundError('Lease');
  const updated = await prisma.lease.update({ where: { id }, data: { renewalStage: stage } });
  await logActivity(id, 'STAGE_ADVANCED', userId, { newStage: stage, previousStage: lease.renewalStage });
  return updated;
}

export async function addLeaseNote(id: string, authorUserId: string, input: AddNoteInput) {
  const exists = await prisma.lease.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Lease');
  const note = await prisma.leaseNote.create({
    data: { leaseId: id, authorUserId, body: input.body },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  await logActivity(id, 'NOTE_ADDED', authorUserId, { noteId: note.id });
  return note;
}

export async function editLeaseNote(leaseId: string, noteId: string, body: string) {
  const note = await prisma.leaseNote.findUnique({ where: { id: noteId } });
  if (!note || note.leaseId !== leaseId) throw new NotFoundError('Note');
  return prisma.leaseNote.update({
    where: { id: noteId },
    data: { body },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function deleteLeaseNote(leaseId: string, noteId: string, userId: string) {
  const note = await prisma.leaseNote.findUnique({ where: { id: noteId } });
  if (!note || note.leaseId !== leaseId) throw new NotFoundError('Note');
  await prisma.leaseNote.delete({ where: { id: noteId } });
  await logActivity(leaseId, 'NOTE_DELETED', userId, { noteId });
  return { deleted: true };
}

export async function bulkAction(input: BulkActionInput, userId: string) {
  const { ids, action, ownerUserId, note } = input;

  if (action === 'exportCsv') {
    const leases = await prisma.lease.findMany({
      where: { id: { in: ids } },
      include: {
        property: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });
    const header = 'Lease #,Tenant,Property,Status,Risk,Stage,End Date,Rent/mo';
    const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = leases.map((l) =>
      [
        l.leaseNumber,
        csvEscape(l.tenant.name),
        csvEscape(l.property.name),
        l.status,
        l.renewalRisk,
        l.renewalStage,
        l.endDate.toISOString().slice(0, 10),
        Number(l.baseRent),
      ].join(','),
    );
    return { csv: [header, ...rows].join('\n') };
  }

  const results: Array<{ id: string; success: boolean }> = [];
  for (const id of ids) {
    try {
      if (action === 'assignOwner' && ownerUserId) {
        await assignOwner(id, userId, ownerUserId);
      } else if (action === 'startRenewal') {
        await startRenewal(id, userId);
      } else if (action === 'markReviewed') {
        await prisma.lease.update({ where: { id }, data: { reviewedAt: new Date() } });
        await logActivity(id, 'REVIEWED', userId);
      } else if (action === 'addNote' && note) {
        await addLeaseNote(id, userId, { body: note });
      }
      results.push({ id, success: true });
    } catch {
      results.push({ id, success: false });
    }
  }
  return { results };
}

// ─── Legacy CRUD ──────────────────────────────────────────────────────────────

export async function createLease(input: CreateLeaseInput) {
  const endDate = parseISO(input.endDate);
  const renewalRisk = computeRenewalRisk(endDate);
  const leaseNumber = `LSE-${Date.now().toString(36).toUpperCase()}`;

  return prisma.lease.create({
    data: {
      leaseNumber,
      renewalRisk,
      propertyId: input.propertyId,
      tenantId: input.tenantId,
      unitNumber: input.unitNumber,
      type: input.type,
      baseRent: input.baseRent,
      rentEscalation: input.rentEscalation,
      securityDeposit: input.securityDeposit,
      sqft: input.sqft,
      notes: input.notes,
      startDate: parseISO(input.startDate),
      endDate,
      renewalDate: input.renewalDate ? parseISO(input.renewalDate) : undefined,
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateLease(id: string, input: UpdateLeaseInput) {
  await getLeaseById(id);
  const { startDate, endDate: endDateStr, renewalDate, propertyId, tenantId, terms, ...rest } = input;
  const endDate = endDateStr ? parseISO(endDateStr) : undefined;
  const renewalRisk = endDate ? computeRenewalRisk(endDate) : rest.renewalRisk;

  return prisma.lease.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate && { startDate: parseISO(startDate) }),
      ...(endDate && { endDate }),
      ...(renewalDate && { renewalDate: parseISO(renewalDate) }),
      ...(renewalRisk && { renewalRisk }),
    },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deleteLease(id: string) {
  await getLeaseById(id);
  return prisma.lease.delete({ where: { id } });
}

export async function getLeaseStats() {
  const now = new Date();
  const [byStatus, byRisk, expiringIn30, expiringIn90, totalActive] = await Promise.all([
    prisma.lease.groupBy({ by: ['status'], _count: true }),
    prisma.lease.groupBy({ by: ['renewalRisk'], where: { status: 'ACTIVE' }, _count: true }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 30) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 90) } } }),
    prisma.lease.count({ where: { status: 'ACTIVE' } }),
  ]);
  return { byStatus, byRisk, expiringIn30, expiringIn90, totalActive };
}

const KANBAN_STAGES: RenewalStage[] = [
  'NOT_STARTED',
  'CONTACTED',
  'NEGOTIATING',
  'DRAFT_SENT',
  'LEGAL_REVIEW',
  'SCHEDULED_RENEWAL',
  'SIGNED',
];

export async function getKanban() {
  const leases = await prisma.lease.findMany({
    where: { status: 'ACTIVE' },
    include: {
      property: { select: { id: true, name: true, code: true } },
      tenant: { select: { id: true, name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      alerts: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true, severity: true },
      },
    },
    orderBy: { endDate: 'asc' },
  });

  return KANBAN_STAGES.map((stage) => {
    const items = leases.filter((l) => l.renewalStage === stage);
    return {
      stage,
      count: items.length,
      totalRent: items.reduce((s, l) => s + Number(l.baseRent), 0),
      leases: items.map((l) => ({
        id: l.id,
        leaseNumber: l.leaseNumber,
        tenantName: l.tenant.name,
        propertyName: l.property.name,
        unitNumber: l.unitNumber,
        endDate: l.endDate.toISOString(),
        renewalRisk: l.renewalRisk as string,
        renewalStage: l.renewalStage,
        baseRent: Number(l.baseRent),
        owner: l.owner,
        openAlerts: l.alerts.length,
        criticalAlerts: l.alerts.filter((a) => a.severity === 'CRITICAL').length,
      })),
    };
  });
}

export async function refreshRenewalRisks(): Promise<number> {
  const activeLeases = await prisma.lease.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, endDate: true },
  });
  let updated = 0;
  for (const lease of activeLeases) {
    const newRisk = computeRenewalRisk(lease.endDate);
    await prisma.lease.update({ where: { id: lease.id }, data: { renewalRisk: newRisk } });
    updated++;
  }
  return updated;
}

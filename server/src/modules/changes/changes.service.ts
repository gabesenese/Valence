import { ChangeEventType } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';

const WINDOW_DAYS = 30;
const MAX_EVENTS = 200;

interface RecordChangeInput {
  type: ChangeEventType;
  entityType: 'lease' | 'task' | 'financial_record' | 'alert';
  entityId: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  severity?: string | null;
  actorUserId?: string | null;
  ownerUserId?: string | null;
  leaseId?: string | null;
  propertyId?: string | null;
}

async function resolveOwner(input: RecordChangeInput): Promise<string | null> {
  if (input.ownerUserId) return input.ownerUserId;
  if (input.propertyId) {
    const p = await prisma.property.findUnique({ where: { id: input.propertyId }, select: { ownerId: true } });
    if (p?.ownerId) return p.ownerId;
  }
  if (input.leaseId) {
    const l = await prisma.lease.findUnique({ where: { id: input.leaseId }, select: { property: { select: { ownerId: true } } } });
    if (l?.property?.ownerId) return l.property.ownerId;
  }
  return null;
}

// Fire-and-forget: an emit failure must never break the action that triggered it.
export async function recordChange(input: RecordChangeInput): Promise<void> {
  try {
    const ownerUserId = await resolveOwner(input);
    if (!ownerUserId) return; // skip null-owner / orphaned entities
    await prisma.changeEvent.create({
      data: {
        ownerUserId,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        detail: input.detail ?? null,
        amount: input.amount ?? null,
        severity: input.severity ?? null,
      },
    });
  } catch (err) {
    logger.warn('recordChange failed', { type: input.type, entityId: input.entityId, error: err instanceof Error ? err.message : String(err) });
  }
}

export interface ChangeGroup {
  kind: 'risk' | 'tasks' | 'revenue' | 'alerts';
  pill: string;
  title: string;
  detail?: string;
}

export interface ChangesSummary {
  asOf: string;
  firstVisit: boolean;
  total: number;
  groups: ChangeGroup[];
}

export async function getChangesSince(userId: string): Promise<ChangesSummary> {
  const asOf = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastChangesSeenAt: true } });

  // First-ever visit: show nothing rather than dumping all history.
  if (!user?.lastChangesSeenAt) {
    return { asOf: asOf.toISOString(), firstVisit: true, total: 0, groups: [] };
  }

  const windowFloor = new Date(asOf.getTime() - WINDOW_DAYS * 86400000);
  const floor = user.lastChangesSeenAt > windowFloor ? user.lastChangesSeenAt : windowFloor;

  const events = await prisma.changeEvent.findMany({
    where: {
      ownerUserId: userId,
      createdAt: { gt: floor, lte: asOf },
      // exclude self-caused, but keep system events (actorUserId = null)
      OR: [{ actorUserId: null }, { actorUserId: { not: userId } }],
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_EVENTS,
  });

  const groups: ChangeGroup[] = [];

  const riskUp = events.filter((e) => e.type === 'LEASE_RISK_UP');
  if (riskUp.length) {
    groups.push({ kind: 'risk', pill: '↑ risk', title: `${riskUp.length} lease${riskUp.length > 1 ? 's' : ''} moved up in risk`, detail: riskUp[0].title });
  }

  const taskEvents = events.filter((e) => e.type === 'TASK_COMPLETED');
  if (taskEvents.length) {
    const actorIds = [...new Set(taskEvents.map((e) => e.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true } })
      : [];
    const nameById = new Map(actors.map((a) => [a.id, a.firstName]));
    const byActor = new Map<string | null, number>();
    for (const t of taskEvents) byActor.set(t.actorUserId, (byActor.get(t.actorUserId) ?? 0) + 1);
    for (const [actorId, count] of byActor) {
      const who = actorId ? (nameById.get(actorId) ?? 'A teammate') : 'Valence';
      groups.push({ kind: 'tasks', pill: 'done', title: `${who} closed ${count} task${count > 1 ? 's' : ''}`, detail: taskEvents.find((t) => t.actorUserId === actorId)?.title ?? undefined });
    }
  }

  const revEvents = events.filter((e) => e.type === 'REVENUE_RECONCILED');
  if (revEvents.length) {
    const sum = revEvents.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    groups.push({ kind: 'revenue', pill: 'revenue', title: `Collected revenue +$${Math.round(sum).toLocaleString()}`, detail: `${revEvents.length} record${revEvents.length > 1 ? 's' : ''} reconciled` });
  }

  const alertEvents = events.filter((e) => e.type === 'ALERT_CREATED');
  if (alertEvents.length) {
    groups.push({ kind: 'alerts', pill: 'alert', title: `${alertEvents.length} new alert${alertEvents.length > 1 ? 's' : ''}`, detail: alertEvents[0].title });
  }

  return { asOf: asOf.toISOString(), firstVisit: false, total: events.length, groups };
}

export async function markChangesSeen(userId: string, asOf?: string): Promise<void> {
  const now = new Date();
  const parsed = asOf ? new Date(asOf) : now;
  const seenAt = Number.isNaN(parsed.getTime()) || parsed > now ? now : parsed;
  await prisma.user.update({ where: { id: userId }, data: { lastChangesSeenAt: seenAt } });
}

import { prisma } from '../../infrastructure/database';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'PLAN_CHANGE' | 'ROLE_CHANGE' | 'RESTORE' | 'IMPERSONATE' | 'STAGE_CHANGE';

export interface LogAuditInput {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export function diffRecords(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(patch)) {
    const bv = before[key];
    const pv = patch[key];
    if (String(bv) !== String(pv)) changes[key] = { from: bv ?? null, to: pv };
  }
  return changes;
}

export async function logAudit(input: LogAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      entityName: input.entityName,
      changes: input.changes as never,
      meta: input.meta as never,
      ...(input.userId ? { user: { connect: { id: input.userId } } } : {}),
    },
  });
}

export async function getEntityActivity(entity: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function getAuditLogs(
  accountUserId: string,
  query: {
    entity?: string;
    action?: string;
    page?: number;
    limit?: number;
  },
) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where = {
    userId: accountUserId,
    ...(query.entity && { entity: query.entity }),
    ...(query.action && { action: query.action }),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

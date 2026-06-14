import { prisma } from '../../infrastructure/database';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'PLAN_CHANGE' | 'ROLE_CHANGE' | 'RESTORE';

export interface LogAuditInput {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  entityName?: string;
  changes?: Record<string, unknown>;
  meta?: Record<string, unknown>;
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

export async function getAuditLogs(query: {
  entity?: string;
  userId?: string;
  action?: string;
  page?: number;
  limit?: number;
}) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where = {
    ...(query.entity && { entity: query.entity }),
    ...(query.userId && { userId: query.userId }),
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

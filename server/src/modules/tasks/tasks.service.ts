import { prisma } from '../../infrastructure/database';
import { recordChange } from '../changes/changes.service';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  alertId: true,
  leaseId: true,
  propertyId: true,
  completedAt: true,
  completionNote: true,
  dueAt: true,
  createdAt: true,
  assignee:    { select: { id: true, firstName: true, lastName: true } },
  createdBy:   { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { id: true, firstName: true, lastName: true } },
  alert:       { select: { id: true, title: true, severity: true } },
  lease:       { select: { id: true, leaseNumber: true, tenant: { select: { name: true } } } },
  property:    { select: { id: true, name: true, code: true } },
} as const;

export async function getTasksForItem(filter: {
  alertId?: string;
  leaseId?: string;
  propertyId?: string;
}) {
  return prisma.task.findMany({
    where: { ...filter, deletedAt: null },
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export async function listAllTasks(filter: {
  status?: TaskStatus | TaskStatus[];
  assigneeUserId?: string;
  propertyId?: string;
  leaseId?: string;
  unassigned?: boolean;
}) {
  const { status, assigneeUserId, propertyId, leaseId, unassigned } = filter;

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }
  if (assigneeUserId) {
    where.assigneeUserId = assigneeUserId;
  } else if (unassigned) {
    where.assigneeUserId = null;
  }
  if (propertyId) where.propertyId = propertyId;
  if (leaseId)    where.leaseId    = leaseId;

  return prisma.task.findMany({
    where,
    select: taskSelect,
    orderBy: [
      { status: 'asc' },
      { dueAt: 'asc' },
      { createdAt: 'desc' },
    ],
  });
}

export async function createTask(data: {
  title: string;
  description?: string;
  alertId?: string;
  leaseId?: string;
  propertyId?: string;
  assigneeUserId?: string;
  dueAt?: Date;
  createdById?: string;
}) {
  return prisma.task.create({
    data,
    select: taskSelect,
  });
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    assigneeUserId?: string | null;
    dueAt?: Date | null;
  },
) {
  return prisma.task.update({
    where: { id },
    data,
    select: taskSelect,
  });
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  userId: string,
  completionNote?: string,
) {
  const isCompleting = status === 'COMPLETED';

  const task = await prisma.task.update({
    where: { id },
    data: {
      status,
      ...(isCompleting
        ? {
            completedAt: new Date(),
            completedById: userId,
            completionNote: completionNote ?? null,
          }
        : {}),
    },
    select: taskSelect,
  });

  if (isCompleting) {
    void recordChange({
      type: 'TASK_COMPLETED',
      entityType: 'task',
      entityId: task.id,
      title: `Task completed: ${task.title}`,
      actorUserId: userId,
      leaseId: task.leaseId,
      propertyId: task.propertyId,
    });
  }

  return task;
}

export async function deleteTask(id: string) {
  return prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}

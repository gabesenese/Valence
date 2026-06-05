import { prisma } from '../../infrastructure/database';

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
} as const;

export async function getTasksForItem(filter: {
  alertId?: string;
  leaseId?: string;
  propertyId?: string;
}) {
  return prisma.task.findMany({
    where: filter,
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
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

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  userId: string,
  completionNote?: string,
) {
  const isCompleting = status === 'COMPLETED';

  return prisma.task.update({
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
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the task-list tenant-isolation fix. Both the global list
 * and the per-item list must be scoped to tasks the caller owns (created,
 * assigned to, or attached to a property/lease/alert they own) — never every
 * account's tasks. Previously `GET /tasks` returned all tenants' tasks.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    task: { findMany: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { listAllTasks, getTasksForItem } from '../modules/tasks/tasks.service';

const OWNER = 'user-A';

const EXPECTED_OR = [
  { createdById: OWNER },
  { assigneeUserId: OWNER },
  { property: { ownerId: OWNER } },
  { lease: { property: { ownerId: OWNER } } },
  { alert: { property: { ownerId: OWNER } } },
  { alert: { lease: { property: { ownerId: OWNER } } } },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.task.findMany.mockResolvedValue([]);
});

describe('tasks — account scoping (tenant isolation)', () => {
  it('scopes the global task list to tasks the caller owns', async () => {
    await listAllTasks({}, OWNER);
    expect(prismaMock.task.findMany.mock.calls[0][0].where.OR).toEqual(EXPECTED_OR);
  });

  it('keeps caller filters alongside the ownership scope', async () => {
    await listAllTasks({ status: 'OPEN', propertyId: 'p1' }, OWNER);
    const where = prismaMock.task.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(EXPECTED_OR);
    expect(where.status).toBe('OPEN');
    expect(where.propertyId).toBe('p1');
  });

  it('scopes the per-item task list to tasks the caller owns', async () => {
    await getTasksForItem({ leaseId: 'l1' }, OWNER);
    const where = prismaMock.task.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(EXPECTED_OR);
    expect(where.leaseId).toBe('l1');
    expect(where.deletedAt).toBeNull();
  });
});

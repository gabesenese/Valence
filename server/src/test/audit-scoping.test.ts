import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the audit-log tenant-isolation fix (#129). The audit log
 * list must ALWAYS be scoped to the authenticated account's userId, and a
 * client-supplied filter must never let it read another account's history.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getAuditLogs } from '../modules/audit/audit.service';

const OWNER = 'user-A';
const OTHER = 'user-B';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.findMany.mockResolvedValue([]);
  prismaMock.auditLog.count.mockResolvedValue(0);
});

describe('audit log — account scoping (tenant isolation)', () => {
  it('always filters both the list and the count by the authenticated account userId', async () => {
    await getAuditLogs(OWNER, {});
    expect(prismaMock.auditLog.findMany.mock.calls[0][0].where.userId).toBe(OWNER);
    expect(prismaMock.auditLog.count.mock.calls[0][0].where.userId).toBe(OWNER);
  });

  it('keeps entity/action filters but cannot escape the account scope', async () => {
    await getAuditLogs(OWNER, { entity: 'property', action: 'DELETE' });
    expect(prismaMock.auditLog.findMany.mock.calls[0][0].where).toMatchObject({
      userId: OWNER,
      entity: 'property',
      action: 'DELETE',
    });
  });

  it('a client-supplied userId cannot override the account scope', async () => {
    await getAuditLogs(OWNER, { userId: OTHER } as never);
    expect(prismaMock.auditLog.findMany.mock.calls[0][0].where.userId).toBe(OWNER);
  });
});

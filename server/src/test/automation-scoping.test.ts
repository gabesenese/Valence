import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the automation tenant-isolation fix. Rules and their logs
 * must be scoped to the account that created them; mutations must reject a rule
 * the caller does not own. SUPER_ADMIN (platform staff) sees across accounts.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    automationRule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    automationLog: { findMany: vi.fn() },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { getRules, updateRule, deleteRule, getAutomationLogs } from '../modules/automation/automation.service';
import { NotFoundError } from '../utils/errors';

const OWNER = { id: 'user-A', role: 'ANALYST' as const };
const STAFF = { id: 'staff', role: 'SUPER_ADMIN' as const };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.automationRule.findMany.mockResolvedValue([]);
  prismaMock.automationRule.update.mockResolvedValue({});
  prismaMock.automationRule.delete.mockResolvedValue({});
  prismaMock.automationLog.findMany.mockResolvedValue([]);
});

describe('automation — account scoping (tenant isolation)', () => {
  it('scopes the rule list to the caller for a non-staff viewer', async () => {
    await getRules(OWNER);
    expect(prismaMock.automationRule.findMany.mock.calls[0][0].where).toEqual({ createdById: OWNER.id });
  });

  it('does not scope the rule list for SUPER_ADMIN staff', async () => {
    await getRules(STAFF);
    expect(prismaMock.automationRule.findMany.mock.calls[0][0].where).toEqual({});
  });

  it('rejects updating a rule the caller does not own', async () => {
    prismaMock.automationRule.findUnique.mockResolvedValue({ createdById: 'someone-else' });
    await expect(updateRule('rule-1', { name: 'x' }, OWNER)).rejects.toThrow(NotFoundError);
    expect(prismaMock.automationRule.update).not.toHaveBeenCalled();
  });

  it('allows updating a rule the caller owns', async () => {
    prismaMock.automationRule.findUnique.mockResolvedValue({ createdById: OWNER.id });
    await updateRule('rule-1', { name: 'x' }, OWNER);
    expect(prismaMock.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rule-1' } }),
    );
  });

  it('rejects deleting a rule the caller does not own', async () => {
    prismaMock.automationRule.findUnique.mockResolvedValue({ createdById: 'someone-else' });
    await expect(deleteRule('rule-1', OWNER)).rejects.toThrow(NotFoundError);
    expect(prismaMock.automationRule.delete).not.toHaveBeenCalled();
  });

  it('scopes automation logs to rules the caller owns', async () => {
    await getAutomationLogs(OWNER);
    expect(prismaMock.automationLog.findMany.mock.calls[0][0].where).toEqual({ rule: { createdById: OWNER.id } });
  });

  it('does not scope automation logs for SUPER_ADMIN staff', async () => {
    await getAutomationLogs(STAFF, 'rule-1');
    expect(prismaMock.automationLog.findMany.mock.calls[0][0].where).toEqual({ ruleId: 'rule-1' });
  });
});

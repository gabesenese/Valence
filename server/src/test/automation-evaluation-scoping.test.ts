import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the automation evaluation tenant-isolation fix. Running
 * a rule must only ever read and act on the rule owner's own records: every
 * evaluation query carries an owner predicate, and a rule with no owner does
 * nothing rather than fanning out across the whole platform.
 */

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    automationRule: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(() => Promise.resolve({})),
    },
    automationLog: { create: vi.fn(() => Promise.resolve({})) },
    lease: { findMany: vi.fn(() => Promise.resolve([])) },
    task: { create: vi.fn(() => Promise.resolve({})) },
  },
}));

vi.mock('../infrastructure/database', () => ({ prisma: prismaMock }));

import { runRule } from '../modules/automation/automation.service';

const OWNER = { id: 'owner-A', isPlatformStaff: false };

const renewalRule = {
  id: 'rule-1',
  createdById: 'owner-A',
  trigger: 'LEASE_DAYS_REMAINING',
  conditions: { daysRemaining: 90 },
  action: 'CREATE_TASK',
  actionConfig: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('automation evaluation — owner scoping', () => {
  it('scopes the lease query to the rule owner when running a rule', async () => {
    prismaMock.automationRule.findUnique.mockResolvedValue({ createdById: 'owner-A' });
    prismaMock.automationRule.findUniqueOrThrow.mockResolvedValue(renewalRule);

    await runRule('rule-1', OWNER);

    const where = prismaMock.lease.findMany.mock.calls[0][0].where;
    expect(where.property).toEqual({ ownerId: 'owner-A' });
  });

  it('does nothing for a rule with no owner instead of scanning every organization', async () => {
    prismaMock.automationRule.findUnique.mockResolvedValue({ createdById: null });
    prismaMock.automationRule.findUniqueOrThrow.mockResolvedValue({ ...renewalRule, createdById: null });

    const result = await runRule('rule-1', { id: 'staff', isPlatformStaff: true });

    expect(prismaMock.lease.findMany).not.toHaveBeenCalled();
    expect(result.tasksCreated).toBe(0);
  });
});

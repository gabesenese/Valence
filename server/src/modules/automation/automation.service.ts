import { prisma } from '../../infrastructure/database';
import { ACTIVE_LEASE_COUNT, ACTIVE_PROPERTY_WHERE } from '../metrics/portfolio-metrics';
import { resolveOrganizationId } from '../organization/organization.service';
import { differenceInDays } from 'date-fns';
import type { AutomationTrigger, AutomationAction } from '@prisma/client';
import { NotFoundError } from '../../utils/errors';

export type RuleViewer = { id: string; isPlatformStaff: boolean };

function ruleOwnerScope(viewer: RuleViewer) {
  return viewer.isPlatformStaff ? {} : { createdById: viewer.id };
}

async function assertRuleOwner(id: string, viewer: RuleViewer): Promise<void> {
  const rule = await prisma.automationRule.findUnique({ where: { id }, select: { createdById: true } });
  if (!rule || (!viewer.isPlatformStaff && rule.createdById !== viewer.id)) {
    throw new NotFoundError('Automation rule');
  }
}


export interface RuleConditions {
  daysRemaining?: number;
  overdueDays?: number;
  occupancyPct?: number;
  riskScore?: number;
}

export interface ActionConfig {
  taskTitle?: string;
  taskDescription?: string;
  assignTo?: string;
  daysUntilDue?: number;
}


async function acquireJobLock(lockId: string, durationMs: number): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + durationMs);
  try {
    await prisma.jobLock.upsert({
      where: { id: lockId },
      update: { lockedAt: now, lockedUntil },
      create: { id: lockId, lockedAt: now, lockedUntil },
    });
    return true;
  } catch { return false; }
}

function resolveAssignee(
  assignTo: string | undefined,
  leaseOwnerId: string | null | undefined,
  managerId: string | null | undefined,
): string | undefined {
  if (!assignTo) return undefined;
  if (assignTo === 'lease_owner') return leaseOwnerId ?? undefined;
  if (assignTo === 'manager') return managerId ?? undefined;
  return assignTo; // treat as a literal userId
}

/*
 * A literal `assignTo` userId is only honored when it belongs to the rule
 * owner's organization. Without this a rule could assign tasks to a user in
 * another tenant. The derived tokens (`lease_owner`, `manager`) are already
 * safe because they resolve from the owner's own records.
 */
async function resolveValidAssignTo(assignTo: string | undefined, ownerId: string): Promise<string | undefined> {
  if (!assignTo || assignTo === 'lease_owner' || assignTo === 'manager') return assignTo;
  const organizationId = await resolveOrganizationId(ownerId);
  const member = await prisma.user.findFirst({ where: { id: assignTo, organizationId }, select: { id: true } });
  return member ? assignTo : undefined;
}


async function evaluateRule(
  ownerId: string,
  trigger: AutomationTrigger,
  conditions: RuleConditions,
  action: AutomationAction,
  actionConfig: ActionConfig,
): Promise<{ tasksCreated: number; details: Record<string, unknown> }> {
  const now = new Date();
  let tasksCreated = 0;
  const details: Record<string, unknown> = {};
  const assignTo = await resolveValidAssignTo(actionConfig.assignTo, ownerId);

  if (trigger === 'LEASE_DAYS_REMAINING') {
    const days = conditions.daysRemaining ?? 90;
    const threshold = new Date(now.getTime() + days * 86400000);

    const leases = await prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: threshold, gte: now },
        property: { ownerId },
      },
      select: {
        id: true,
        leaseNumber: true,
        endDate: true,
        ownerUserId: true,
        propertyId: true,
        tenant: { select: { name: true, assignedManagerId: true } },
        property: { select: { name: true } },
        tasks: {
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            createdAt: { gte: new Date(now.getTime() - 30 * 86400000) },
          },
          select: { id: true },
          take: 1,
        },
      },
    });

    details.matchedLeases = leases.length;

    if (action === 'CREATE_TASK') {
      for (const lease of leases) {
        if (lease.tasks.length > 0) continue;

        const daysLeft = differenceInDays(lease.endDate, now);
        const title = (actionConfig.taskTitle ?? 'Lease renewal required')
          .replace('{tenant}', lease.tenant.name)
          .replace('{property}', lease.property.name)
          .replace('{days}', String(daysLeft));

        const description = (actionConfig.taskDescription ?? '')
          .replace('{tenant}', lease.tenant.name)
          .replace('{property}', lease.property.name)
          .replace('{days}', String(daysLeft));

        const assigneeUserId = resolveAssignee(
          assignTo,
          lease.ownerUserId,
          lease.tenant.assignedManagerId,
        );

        const dueAt = actionConfig.daysUntilDue
          ? new Date(now.getTime() + actionConfig.daysUntilDue * 86400000)
          : undefined;

        await prisma.task.create({
          data: {
            title,
            description: description || undefined,
            leaseId: lease.id,
            propertyId: lease.propertyId,
            assigneeUserId,
            dueAt,
          },
        });
        tasksCreated++;
      }
    }
  }

  if (trigger === 'PAYMENT_OVERDUE_DAYS') {
    const days = conditions.overdueDays ?? 14;
    const threshold = new Date(now.getTime() - days * 86400000);

    const records = await prisma.financialRecord.findMany({
      where: {
        type: 'REVENUE',
        status: 'PENDING',
        dueDate: { lt: threshold },
        property: { ownerId },
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        leaseId: true,
        propertyId: true,
        lease: {
          select: {
            ownerUserId: true,
            tenant: { select: { name: true, assignedManagerId: true } },
          },
        },
        property: { select: { name: true } },
      },
    });

    details.matchedRecords = records.length;

    if (action === 'CREATE_TASK') {
      for (const rec of records) {
        const existing = rec.leaseId
          ? await prisma.task.count({
              where: {
                leaseId: rec.leaseId,
                status: { in: ['OPEN', 'IN_PROGRESS'] },
                title: { contains: 'overdue' },
                createdAt: { gte: new Date(now.getTime() - 7 * 86400000) },
              },
            })
          : 0;
        if (existing > 0) continue;

        const daysOverdue = rec.dueDate
          ? differenceInDays(now, rec.dueDate)
          : days;

        const tenantName = rec.lease?.tenant.name ?? 'Unknown';
        const title = (actionConfig.taskTitle ?? 'Collect overdue payment')
          .replace('{tenant}', tenantName)
          .replace('{days}', String(daysOverdue));

        const assigneeUserId = resolveAssignee(
          assignTo,
          rec.lease?.ownerUserId,
          rec.lease?.tenant.assignedManagerId,
        );

        await prisma.task.create({
          data: {
            title,
            description: `$${Number(rec.amount).toLocaleString()} overdue for ${daysOverdue} days`,
            leaseId: rec.leaseId ?? undefined,
            propertyId: rec.propertyId,
            assigneeUserId,
            dueAt: actionConfig.daysUntilDue
              ? new Date(now.getTime() + actionConfig.daysUntilDue * 86400000)
              : undefined,
          },
        });
        tasksCreated++;
      }
    }
  }

  if (trigger === 'OCCUPANCY_BELOW') {
    const threshold = conditions.occupancyPct ?? 80;

    const properties = await prisma.property.findMany({
      where: { ...ACTIVE_PROPERTY_WHERE, ownerId },
      select: {
        id: true,
        name: true,
        totalUnits: true,
        ownerId: true,
        tasks: {
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            title: { contains: 'occupancy' },
            createdAt: { gte: new Date(now.getTime() - 7 * 86400000) },
          },
          select: { id: true },
          take: 1,
        },
        _count: ACTIVE_LEASE_COUNT,
      },
    });

    let matched = 0;
    if (action === 'CREATE_TASK') {
      for (const property of properties) {
        const occupancyRate = property.totalUnits > 0
          ? Math.round((property._count.leases / property.totalUnits) * 100)
          : 0;
        if (occupancyRate >= threshold) continue;
        if (property.tasks.length > 0) continue;

        matched++;
        const title = (actionConfig.taskTitle ?? 'Low occupancy — {property}')
          .replace('{property}', property.name)
          .replace('{occupancy}', String(occupancyRate));

        await prisma.task.create({
          data: {
            title,
            description: `${property.name} occupancy is ${occupancyRate}%, below the ${threshold}% threshold`,
            propertyId: property.id,
            assigneeUserId: resolveAssignee(assignTo, property.ownerId, undefined),
            dueAt: actionConfig.daysUntilDue
              ? new Date(now.getTime() + actionConfig.daysUntilDue * 86400000)
              : undefined,
          },
        });
        tasksCreated++;
      }
    }
    details.matchedProperties = matched;
  }

  if (trigger === 'RISK_SCORE_ABOVE') {
    const threshold = conditions.riskScore ?? 50;
    const expiryWindow = new Date(now.getTime() + 90 * 86400000);

    const properties = await prisma.property.findMany({
      where: { ...ACTIVE_PROPERTY_WHERE, ownerId },
      select: {
        id: true,
        name: true,
        totalUnits: true,
        ownerId: true,
        tasks: {
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            title: { contains: 'risk' },
            createdAt: { gte: new Date(now.getTime() - 7 * 86400000) },
          },
          select: { id: true },
          take: 1,
        },
        _count: ACTIVE_LEASE_COUNT,
        alerts: { where: { status: 'OPEN', severity: 'CRITICAL' }, select: { id: true } },
        leases: {
          where: { status: 'ACTIVE', deletedAt: null, endDate: { lte: expiryWindow } },
          select: { id: true },
        },
      },
    });

    let matched = 0;
    if (action === 'CREATE_TASK') {
      for (const property of properties) {
        const occupancyRate = property.totalUnits > 0
          ? (property._count.leases / property.totalUnits) * 100
          : 0;

        const occupancyRisk = Math.max(0, 80 - occupancyRate) * 0.5;       // 0–40
        const alertRisk     = Math.min(40, property.alerts.length * 20);    // 0–40
        const expiryRisk    = Math.min(20, property.leases.length * 7);     // 0–20
        const riskScore     = Math.round(occupancyRisk + alertRisk + expiryRisk);

        if (riskScore <= threshold) continue;
        if (property.tasks.length > 0) continue;

        matched++;
        const title = (actionConfig.taskTitle ?? 'High risk property — {property}')
          .replace('{property}', property.name)
          .replace('{risk}', String(riskScore));

        await prisma.task.create({
          data: {
            title,
            description: `${property.name} risk score is ${riskScore}/100 (threshold: ${threshold})`,
            propertyId: property.id,
            assigneeUserId: resolveAssignee(assignTo, property.ownerId, undefined),
            dueAt: actionConfig.daysUntilDue
              ? new Date(now.getTime() + actionConfig.daysUntilDue * 86400000)
              : undefined,
          },
        });
        tasksCreated++;
      }
    }
    details.matchedProperties = matched;
  }

  return { tasksCreated, details };
}


export async function getRules(viewer: RuleViewer) {
  return prisma.automationRule.findMany({
    where: ruleOwnerScope(viewer),
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      trigger: true,
      conditions: true,
      action: true,
      actionConfig: true,
      lastRunAt: true,
      createdAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { logs: true } },
    },
  });
}

export async function createRule(data: {
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: RuleConditions;
  action: AutomationAction;
  actionConfig: ActionConfig;
  createdById?: string;
}) {
  return prisma.automationRule.create({
    data: {
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      conditions: data.conditions as object,
      action: data.action,
      actionConfig: data.actionConfig as object,
      createdById: data.createdById,
    },
  });
}

export async function updateRule(
  id: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
    conditions?: RuleConditions;
    actionConfig?: ActionConfig;
  },
  viewer: RuleViewer,
) {
  await assertRuleOwner(id, viewer);
  return prisma.automationRule.update({
    where: { id },
    data: {
      ...data,
      conditions: data.conditions as object | undefined,
      actionConfig: data.actionConfig as object | undefined,
    },
  });
}

export async function deleteRule(id: string, viewer: RuleViewer) {
  await assertRuleOwner(id, viewer);
  return prisma.automationRule.delete({ where: { id } });
}

export async function runRule(ruleId: string, viewer: RuleViewer): Promise<{
  tasksCreated: number;
  details: Record<string, unknown>;
}> {
  await assertRuleOwner(ruleId, viewer);
  const rule = await prisma.automationRule.findUniqueOrThrow({ where: { id: ruleId } });

  /*
   * A rule with no owner cannot be safely scoped to one organization, so it
   * evaluates against nothing rather than the whole platform.
   */
  if (!rule.createdById) {
    return { tasksCreated: 0, details: { skipped: 'rule has no owner' } };
  }

  const result = await evaluateRule(
    rule.createdById,
    rule.trigger,
    rule.conditions as RuleConditions,
    rule.action,
    rule.actionConfig as ActionConfig,
  );

  await prisma.automationRule.update({
    where: { id: ruleId },
    data: { lastRunAt: new Date() },
  });

  await prisma.automationLog.create({
    data: {
      ruleId,
      outcome: 'SUCCESS',
      tasksCreated: result.tasksCreated,
      details: result.details as object,
    },
  });

  return result;
}

export async function runAllRules(): Promise<{ total: number; tasksCreated: number }> {
  const locked = await acquireJobLock('automation_run', 5 * 60 * 1000);
  if (!locked) return { total: 0, tasksCreated: 0 };

  const rules = await prisma.automationRule.findMany({ where: { isActive: true, createdById: { not: null } } });
  let totalTasks = 0;

  for (const rule of rules) {
    try {
      const result = await evaluateRule(
        rule.createdById!,
        rule.trigger,
        rule.conditions as RuleConditions,
        rule.action,
        rule.actionConfig as ActionConfig,
      );
      totalTasks += result.tasksCreated;

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      });

      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          outcome: 'SUCCESS',
          tasksCreated: result.tasksCreated,
          details: result.details as object,
        },
      });
    } catch (err) {
      await prisma.automationLog.create({
        data: {
          ruleId: rule.id,
          outcome: 'FAILED',
          tasksCreated: 0,
          details: { error: String(err) } as object,
        },
      });
    }
  }

  return { total: rules.length, tasksCreated: totalTasks };
}

export async function getAutomationLogs(viewer: RuleViewer, ruleId?: string) {
  return prisma.automationLog.findMany({
    where: {
      ...(ruleId ? { ruleId } : {}),
      ...(viewer.isPlatformStaff ? {} : { rule: { createdById: viewer.id } }),
    },
    orderBy: { triggeredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      outcome: true,
      tasksCreated: true,
      details: true,
      triggeredAt: true,
      rule: { select: { id: true, name: true } },
    },
  });
}

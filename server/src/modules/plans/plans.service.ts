import type { Plan, UsageType } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { ForbiddenError } from '../../utils/errors';


export const PLAN_LIMITS: Record<Plan, {
  properties: number;
  leases: number;
  aiRuns: number;
  contracts: number;
  simulations: number;
}> = {
  FREE:         { properties: 3,        leases: 25,       aiRuns: 0,        contracts: 0,        simulations: 0        },
  ESSENTIALS:   { properties: 25,       leases: 500,      aiRuns: 0,        contracts: 0,        simulations: 0        },
  PROFESSIONAL: { properties: 150,      leases: 5_000,    aiRuns: 500,      contracts: 100,      simulations: 100      },
  EXECUTIVE:    { properties: Infinity, leases: Infinity, aiRuns: Infinity, contracts: Infinity, simulations: Infinity },
};

export const PLAN_ORDER: Record<Plan, number> = {
  FREE:         0,
  ESSENTIALS:   1,
  PROFESSIONAL: 2,
  EXECUTIVE:    3,
};

export function meetsMinPlan(userPlan: Plan, required: Plan): boolean {
  return PLAN_ORDER[userPlan] >= PLAN_ORDER[required];
}


export async function enforcePropertyLimit(plan: Plan, userId: string): Promise<void> {
  const limit = PLAN_LIMITS[plan].properties;
  if (limit === Infinity) return;
  const count = await prisma.property.count({ where: { ownerId: userId } });
  if (count >= limit) {
    throw new ForbiddenError(
      `Your ${plan} plan includes up to ${limit} properties — upgrade your plan to add more.`
    );
  }
}

export async function enforceLeaseLimit(plan: Plan, userId?: string): Promise<void> {
  const limit = PLAN_LIMITS[plan].leases;
  if (limit === Infinity) return;
  const count = await prisma.lease.count(
    userId ? { where: { property: { ownerId: userId } } } : undefined
  );
  if (count >= limit) {
    throw new ForbiddenError(
      `Your ${plan} plan includes up to ${limit.toLocaleString()} leases — upgrade your plan to add more.`
    );
  }
}


function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function trackUsage(userId: string, type: UsageType): Promise<void> {
  await prisma.usageRecord.create({
    data: { userId, type, periodStart: currentPeriodStart() },
  });
}

export async function getUsageSummary(userId: string): Promise<{
  aiRuns: number;
  contracts: number;
  simulations: number;
  periodStart: Date;
}> {
  const start = currentPeriodStart();
  const records = await prisma.usageRecord.groupBy({
    by: ['type'],
    where: { userId, periodStart: start },
    _count: { id: true },
  });

  const byType = Object.fromEntries(records.map(r => [r.type, r._count.id]));
  return {
    aiRuns:      byType['AI_ANALYSIS']         ?? 0,
    contracts:   byType['CONTRACT_PROCESSING']  ?? 0,
    simulations: byType['IMPACT_SIMULATION']    ?? 0,
    periodStart: start,
  };
}


export async function setPlan(userId: string, plan: Plan): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { plan } });
}

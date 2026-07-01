import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';

export interface AffectedLease {
  leaseId: string;
  leaseNumber: string;
  propertyName: string;
  tenantName: string;
  overdueAmount: number;
}

export type RecommendationBasis = 'portfolio' | 'standard';

export interface LateFeeRecommendation {
  feeType: 'PERCENTAGE' | 'FLAT';
  percent: number | null;
  flat: number | null;
  graceDays: number;
  basis: RecommendationBasis;
}

export interface LateFeePolicySuggestion {
  affectedLeases: AffectedLease[];
  affectedCount: number;
  overdueTotal: number;
  recommended: LateFeeRecommendation;
}

export interface ApplyLateFeePolicyInput {
  feeType: 'PERCENTAGE' | 'FLAT';
  percent?: number | null;
  flat?: number | null;
  graceDays: number;
  leaseIds?: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function deriveRecommendation(userId: string): Promise<LateFeeRecommendation> {
  const configured = await prisma.lease.findMany({
    where: {
      deletedAt: null,
      property: { ownerId: userId, deletedAt: null },
      lateFeeType: { not: 'NONE' },
    },
    select: { lateFeeType: true, lateFeePercent: true, lateFeeFlat: true, lateFeeGraceDays: true },
  });

  if (configured.length === 0) {
    return { feeType: 'PERCENTAGE', percent: 5, flat: null, graceDays: 5, basis: 'standard' };
  }

  const counts = new Map<string, { policy: LateFeeRecommendation; n: number }>();
  for (const l of configured) {
    const feeType = l.lateFeeType as 'PERCENTAGE' | 'FLAT';
    const percent = l.lateFeePercent != null ? Number(l.lateFeePercent) : null;
    const flat = l.lateFeeFlat != null ? Number(l.lateFeeFlat) : null;
    const graceDays = l.lateFeeGraceDays ?? 0;
    const key = `${feeType}|${percent ?? ''}|${flat ?? ''}|${graceDays}`;
    const existing = counts.get(key);
    if (existing) existing.n += 1;
    else counts.set(key, { policy: { feeType, percent, flat, graceDays, basis: 'portfolio' }, n: 1 });
  }

  let best: { policy: LateFeeRecommendation; n: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.n > best.n) best = entry;
  }
  return best!.policy;
}

export async function getLateFeePolicySuggestion(userId: string): Promise<LateFeePolicySuggestion> {
  const now = new Date();

  const overdue = await prisma.financialRecord.findMany({
    where: {
      type: 'REVENUE',
      status: 'PENDING',
      dueDate: { lt: now },
      leaseId: { not: null },
      property: { ownerId: userId, deletedAt: null },
      lease: { lateFeeType: 'NONE', deletedAt: null },
    },
    select: {
      amount: true,
      property: { select: { name: true } },
      lease: { select: { id: true, leaseNumber: true, tenant: { select: { name: true } } } },
    },
  });

  const byLease = new Map<string, AffectedLease>();
  let overdueTotal = 0;
  for (const rec of overdue) {
    if (!rec.lease) continue;
    const amount = Number(rec.amount);
    overdueTotal += amount;
    const existing = byLease.get(rec.lease.id);
    if (existing) existing.overdueAmount = round2(existing.overdueAmount + amount);
    else byLease.set(rec.lease.id, {
      leaseId: rec.lease.id,
      leaseNumber: rec.lease.leaseNumber,
      propertyName: rec.property.name,
      tenantName: rec.lease.tenant.name,
      overdueAmount: round2(amount),
    });
  }

  const affectedLeases = [...byLease.values()].sort((a, b) => b.overdueAmount - a.overdueAmount);

  return {
    affectedLeases,
    affectedCount: affectedLeases.length,
    overdueTotal: round2(overdueTotal),
    recommended: await deriveRecommendation(userId),
  };
}

export async function applyLateFeePolicy(userId: string, input: ApplyLateFeePolicyInput): Promise<{ applied: number }> {
  let targetIds: string[];
  if (input.leaseIds && input.leaseIds.length > 0) {
    const owned = await prisma.lease.findMany({
      where: { id: { in: input.leaseIds }, deletedAt: null, property: { ownerId: userId, deletedAt: null } },
      select: { id: true },
    });
    targetIds = owned.map((l) => l.id);
  } else {
    const suggestion = await getLateFeePolicySuggestion(userId);
    targetIds = suggestion.affectedLeases.map((l) => l.leaseId);
  }

  if (targetIds.length === 0) return { applied: 0 };

  const data: Prisma.LeaseUpdateManyMutationInput = {
    lateFeeType: input.feeType,
    lateFeeGraceDays: input.graceDays,
    lateFeePercent: input.feeType === 'PERCENTAGE' ? input.percent ?? 0 : null,
    lateFeeFlat: input.feeType === 'FLAT' ? input.flat ?? 0 : null,
  };

  const res = await prisma.lease.updateMany({ where: { id: { in: targetIds } }, data });
  return { applied: res.count };
}

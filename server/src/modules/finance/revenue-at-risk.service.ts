import { RenewalRisk, RenewalStage } from '@prisma/client';
import { prisma } from '../../infrastructure/database';

const HORIZON_DAYS = 90;
const TOP_N = 8;

const RENEWAL_RISK_WEIGHT: Record<RenewalRisk, number> = {
  CRITICAL: 1.5,
  HIGH: 1.3,
  MEDIUM: 1.15,
  LOW: 1.0,
};

const STAGE_WEIGHT: Partial<Record<RenewalStage, number>> = {
  NOT_STARTED: 1.2,
  CONTACTED: 1.1,
};

export interface RevenueRisk {
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string;
  monthlyRent: number;
  daysToExpiry: number;
  endDate: Date;
  renewalRisk: RenewalRisk;
  renewalStage: RenewalStage;
  impactScore: number;
  reasons: string[];
}

export interface RevenueAtRisk {
  totalAtRisk: number;
  leaseCount: number;
  expiringWithin30: number;
  renewalsNotStarted: number;
  highRiskCount: number;
  risks: RevenueRisk[];
}

// Financial exposure, not operational urgency: monthly rent is the dominant term,
// while expiry proximity and renewal risk only scale it (so a large lease expiring
// later outranks a tiny lease expiring sooner).
function scoreRisk(input: {
  monthlyRent: number;
  daysToExpiry: number;
  renewalRisk: RenewalRisk;
  renewalStage: RenewalStage;
}): number {
  const proximity = 1 + Math.max(0, Math.min(1, (HORIZON_DAYS - input.daysToExpiry) / HORIZON_DAYS));
  const riskWeight = RENEWAL_RISK_WEIGHT[input.renewalRisk] ?? 1.0;
  const stageWeight = STAGE_WEIGHT[input.renewalStage] ?? 1.0;
  return Math.round(input.monthlyRent * proximity * riskWeight * stageWeight);
}

function buildReasons(input: {
  daysToExpiry: number;
  renewalRisk: RenewalRisk;
  renewalStage: RenewalStage;
  hasRenewalDate: boolean;
  openAlertCount: number;
}): string[] {
  const reasons: string[] = [];

  if (input.daysToExpiry < 0) reasons.push(`Lease expired ${Math.abs(input.daysToExpiry)} days ago (holdover)`);
  else reasons.push(`Expires in ${input.daysToExpiry} days`);

  if (input.renewalStage === 'NOT_STARTED') reasons.push('Renewal not started');
  if (input.renewalRisk === 'CRITICAL') reasons.push('Critical renewal risk');
  else if (input.renewalRisk === 'HIGH') reasons.push('High renewal risk');
  if (!input.hasRenewalDate && input.renewalStage !== 'SIGNED') reasons.push('No renewal date scheduled');
  if (input.openAlertCount > 0) reasons.push(`${input.openAlertCount} open alert${input.openAlertCount > 1 ? 's' : ''}`);

  return reasons;
}

export async function getRevenueAtRisk(userId: string): Promise<RevenueAtRisk> {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86400000);
  const holdoverFloor = new Date(now.getTime() - HORIZON_DAYS * 86400000);

  const leases = await prisma.lease.findMany({
    where: {
      property: { ownerId: userId },
      deletedAt: null,
      status: 'ACTIVE',
      endDate: { gte: holdoverFloor, lte: horizonEnd },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
    },
    include: {
      property: { select: { id: true, name: true } },
      tenant: { select: { id: true, name: true } },
      alerts: {
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true },
      },
    },
  });

  const risks: RevenueRisk[] = leases.map((lease) => {
    const monthlyRent = Number(lease.baseRent);
    const daysToExpiry = Math.round((lease.endDate.getTime() - now.getTime()) / 86400000);
    const openAlertCount = lease.alerts.length;

    return {
      leaseId: lease.id,
      propertyId: lease.propertyId,
      propertyName: lease.property.name,
      tenantName: lease.tenant.name,
      monthlyRent,
      daysToExpiry,
      endDate: lease.endDate,
      renewalRisk: lease.renewalRisk,
      renewalStage: lease.renewalStage,
      impactScore: scoreRisk({ monthlyRent, daysToExpiry, renewalRisk: lease.renewalRisk, renewalStage: lease.renewalStage }),
      reasons: buildReasons({
        daysToExpiry,
        renewalRisk: lease.renewalRisk,
        renewalStage: lease.renewalStage,
        hasRenewalDate: Boolean(lease.renewalDate || lease.renewalScheduledAt),
        openAlertCount,
      }),
    };
  });

  risks.sort((a, b) => b.impactScore - a.impactScore);

  return {
    totalAtRisk: risks.reduce((sum, r) => sum + r.monthlyRent, 0),
    leaseCount: risks.length,
    expiringWithin30: risks.filter((r) => r.daysToExpiry <= 30).length,
    renewalsNotStarted: risks.filter((r) => r.renewalStage === 'NOT_STARTED').length,
    highRiskCount: risks.filter((r) => r.renewalRisk === 'HIGH' || r.renewalRisk === 'CRITICAL').length,
    risks: risks.slice(0, TOP_N),
  };
}

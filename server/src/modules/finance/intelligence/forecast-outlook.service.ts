import { prisma } from '../../../infrastructure/database';
import type { Confidence } from './intelligence.types';

export interface ExpirationLease {
  leaseId: string;
  tenantName: string;
  propertyName: string;
  monthlyRent: number;
  endDate: string;
}

export interface ExpirationMonth {
  month: string;
  expiringCount: number;
  revenueAtRisk: number;
  leases: ExpirationLease[];
}

export interface ForecastOutlook {
  horizonMonths: number;
  totalRevenueAtRisk: number;
  timeline: ExpirationMonth[];
  confidence: Confidence;
  confidenceScore: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function utcMonthLabel(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const HORIZON_MONTHS = 6;

export async function getForecastOutlook(userId: string): Promise<ForecastOutlook> {
  const now = new Date();
  const nowY = now.getUTCFullYear();
  const nowM = now.getUTCMonth();
  const horizonEnd = new Date(Date.UTC(nowY, nowM + HORIZON_MONTHS, 1) - 1);

  const [leases, activeCount, withRentCount] = await Promise.all([
    prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        property: { ownerId: userId, deletedAt: null },
        endDate: { gte: now, lte: horizonEnd },
      },
      select: {
        id: true,
        baseRent: true,
        endDate: true,
        tenant: { select: { name: true } },
        property: { select: { name: true } },
      },
      orderBy: { endDate: 'asc' },
    }),
    prisma.lease.count({ where: { status: 'ACTIVE', deletedAt: null, property: { ownerId: userId, deletedAt: null } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', deletedAt: null, property: { ownerId: userId, deletedAt: null }, baseRent: { gt: 0 } } }),
  ]);

  const timeline: ExpirationMonth[] = Array.from({ length: HORIZON_MONTHS }, (_, i) => ({
    month: utcMonthLabel(nowY, nowM + i),
    expiringCount: 0,
    revenueAtRisk: 0,
    leases: [],
  }));

  for (const lease of leases) {
    const offset = (lease.endDate.getUTCFullYear() - nowY) * 12 + (lease.endDate.getUTCMonth() - nowM);
    if (offset < 0 || offset >= HORIZON_MONTHS) continue;
    const rent = Number(lease.baseRent);
    const bucket = timeline[offset];
    bucket.expiringCount += 1;
    bucket.revenueAtRisk += rent;
    bucket.leases.push({
      leaseId: lease.id,
      tenantName: lease.tenant.name,
      propertyName: lease.property.name,
      monthlyRent: rent,
      endDate: lease.endDate.toISOString(),
    });
  }

  const totalRevenueAtRisk = timeline.reduce((sum, m) => sum + m.revenueAtRisk, 0);

  const ratio = activeCount > 0 ? withRentCount / activeCount : 0;
  const confidence: Confidence =
    activeCount === 0
      ? { level: 'LOW', basis: 'No active leases to project from' }
      : ratio >= 0.95
        ? { level: 'HIGH', basis: `Projected from ${activeCount} active leases with set rent and expiry` }
        : ratio >= 0.7
          ? { level: 'MEDIUM', basis: `${withRentCount} of ${activeCount} active leases have complete terms` }
          : { level: 'LOW', basis: `Only ${withRentCount} of ${activeCount} active leases have a set rent` };

  return { horizonMonths: HORIZON_MONTHS, totalRevenueAtRisk, timeline, confidence, confidenceScore: Math.round(ratio * 100) };
}

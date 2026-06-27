import { prisma } from '../../infrastructure/database';

export interface LateFeeForecastItem {
  leaseId: string;
  leaseNumber: string;
  propertyName: string;
  tenantName: string;
  overdueAmount: number;
  daysLate: number;
  graceDays: number;
  feeType: 'FLAT' | 'PERCENTAGE';
  baseFee: number;
  interest: number;
  fee: number;
  chargeable: boolean;
}

export interface LateFeeForecast {
  overdueBalance: number;
  overdueCount: number;
  chargeableCount: number;
  withinGraceCount: number;
  unconfiguredCount: number;
  expectedLateFees: number;
  baseFees: number;
  interestAccrued: number;
  items: LateFeeForecastItem[];
}

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getLateFeeForecast(userId: string): Promise<LateFeeForecast> {
  const now = new Date();

  const overdue = await prisma.financialRecord.findMany({
    where: {
      type: 'REVENUE',
      status: 'PENDING',
      dueDate: { lt: now },
      leaseId: { not: null },
      property: { ownerId: userId, deletedAt: null },
    },
    include: {
      property: { select: { name: true } },
      lease: {
        select: {
          id: true,
          leaseNumber: true,
          lateFeeType: true,
          lateFeeFlat: true,
          lateFeePercent: true,
          lateFeeGraceDays: true,
          lateFeeInterestPct: true,
          tenant: { select: { name: true } },
        },
      },
    },
  });

  let overdueBalance = 0;
  let expectedLateFees = 0;
  let baseFees = 0;
  let interestAccrued = 0;
  let chargeableCount = 0;
  let withinGraceCount = 0;
  let unconfiguredCount = 0;
  const items: LateFeeForecastItem[] = [];

  for (const rec of overdue) {
    const lease = rec.lease;
    if (!lease || !rec.dueDate) continue;

    const overdueAmount = Number(rec.amount);
    overdueBalance += overdueAmount;

    if (lease.lateFeeType === 'NONE') {
      unconfiguredCount += 1;
      continue;
    }

    const daysLate = Math.floor((now.getTime() - rec.dueDate.getTime()) / DAY);
    const graceDays = lease.lateFeeGraceDays ?? 0;
    const chargeable = daysLate > graceDays;

    const base = lease.lateFeeType === 'FLAT'
      ? Number(lease.lateFeeFlat ?? 0)
      : (Number(lease.lateFeePercent ?? 0) / 100) * overdueAmount;

    const monthsPastGrace = Math.max(0, (daysLate - graceDays) / 30);
    const interest = lease.lateFeeInterestPct
      ? (Number(lease.lateFeeInterestPct) / 100) * overdueAmount * monthsPastGrace
      : 0;

    const fee = chargeable ? round2(base + interest) : 0;

    if (chargeable) {
      chargeableCount += 1;
      expectedLateFees += fee;
      baseFees += base;
      interestAccrued += interest;
    } else {
      withinGraceCount += 1;
    }

    items.push({
      leaseId: lease.id,
      leaseNumber: lease.leaseNumber,
      propertyName: rec.property.name,
      tenantName: lease.tenant.name,
      overdueAmount: round2(overdueAmount),
      daysLate,
      graceDays,
      feeType: lease.lateFeeType,
      baseFee: round2(base),
      interest: round2(interest),
      fee,
      chargeable,
    });
  }

  items.sort((a, b) => b.fee - a.fee || b.overdueAmount - a.overdueAmount);

  return {
    overdueBalance: round2(overdueBalance),
    overdueCount: overdue.length,
    chargeableCount,
    withinGraceCount,
    unconfiguredCount,
    expectedLateFees: round2(expectedLateFees),
    baseFees: round2(baseFees),
    interestAccrued: round2(interestAccrued),
    items: items.slice(0, 10),
  };
}

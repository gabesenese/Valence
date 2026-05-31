import { prisma } from '../../infrastructure/database';
import { addDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { generateLeaseExpirationAlerts } from './alerts.service';

// ─── Detector: Leases expiring with no renewal action ─────────────────────────
async function detectUnactionedExpirations(): Promise<number> {
  const now = new Date();
  let created = 0;

  const leases = await prisma.lease.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: addDays(now, 30) },
      renewalDate: null,
      alerts: {
        none: {
          type: 'RENEWAL_RISK',
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
      },
    },
    include: { property: true, tenant: true },
  });

  for (const lease of leases) {
    const daysLeft = Math.ceil((lease.endDate.getTime() - now.getTime()) / 86400000);
    await prisma.alert.create({
      data: {
        type: 'RENEWAL_RISK',
        severity: 'CRITICAL',
        title: 'Lease expiring — no renewal action recorded',
        description: `Lease ${lease.leaseNumber} (${lease.tenant.name}) at ${lease.property.name} expires in ${daysLeft} days with no renewal date set. Immediate action required.`,
        propertyId: lease.propertyId,
        leaseId: lease.id,
        metadata: { leaseNumber: lease.leaseNumber, daysLeft, tenantName: lease.tenant.name, action: 'renewal_required' },
      },
    });
    created++;
  }

  return created;
}

// ─── Detector: Revenue deviates from 3-month baseline ────────────────────────
async function detectPaymentAnomalies(): Promise<number> {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  let created = 0;

  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  });

  for (const property of properties) {
    // 3-month historical average
    const historical: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const mo = subMonths(now, i);
      const agg = await prisma.financialRecord.aggregate({
        where: {
          propertyId: property.id,
          type: 'REVENUE',
          periodStart: { gte: startOfMonth(mo), lte: endOfMonth(mo) },
          status: { not: 'VOID' },
        },
        _sum: { amount: true },
      });
      historical.push(Number(agg._sum.amount ?? 0));
    }

    const baseline = historical.reduce((s, v) => s + v, 0) / 3;
    if (baseline === 0) continue;

    const currentAgg = await prisma.financialRecord.aggregate({
      where: {
        propertyId: property.id,
        type: 'REVENUE',
        periodStart: { gte: thisMonthStart },
        status: { not: 'VOID' },
      },
      _sum: { amount: true },
    });
    const current = Number(currentAgg._sum.amount ?? 0);
    const deviationPct = ((current - baseline) / baseline) * 100;

    if (deviationPct >= -15) continue; // within acceptable range

    const existing = await prisma.alert.findFirst({
      where: {
        propertyId: property.id,
        type: 'PAYMENT_ANOMALY',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        createdAt: { gte: addDays(now, -7) },
      },
    });
    if (existing) continue;

    const severity = deviationPct <= -30 ? 'CRITICAL' : 'WARNING';
    await prisma.alert.create({
      data: {
        type: 'PAYMENT_ANOMALY',
        severity,
        title: `Potential revenue leakage — ${Math.abs(Math.round(deviationPct))}% below baseline`,
        description: `${property.name} current month revenue of $${Math.round(current).toLocaleString()} is ${Math.abs(Math.round(deviationPct))}% below the 3-month average of $${Math.round(baseline).toLocaleString()}. Possible revenue leakage or missing records.`,
        propertyId: property.id,
        metadata: {
          currentRevenue: Math.round(current),
          baselineRevenue: Math.round(baseline),
          deviationPct: Math.round(deviationPct),
        },
      },
    });
    created++;
  }

  return created;
}

// ─── Detector: Occupancy below operational threshold ─────────────────────────
async function detectOccupancyDrops(): Promise<number> {
  const now = new Date();
  let created = 0;

  const properties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      totalUnits: true,
      _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
    },
  });

  for (const property of properties) {
    if (property.totalUnits === 0) continue;
    const rate = (property._count.leases / property.totalUnits) * 100;
    if (rate >= 70) continue;

    const existing = await prisma.alert.findFirst({
      where: {
        propertyId: property.id,
        type: 'OCCUPANCY_CHANGE',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        createdAt: { gte: addDays(now, -1) },
      },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: 'OCCUPANCY_CHANGE',
        severity: rate < 40 ? 'CRITICAL' : 'WARNING',
        title: `Low occupancy detected: ${Math.round(rate)}%`,
        description: `${property.name} has ${property._count.leases} active lease${property._count.leases !== 1 ? 's' : ''} across ${property.totalUnits} units (${Math.round(rate)}% occupancy) — below the 70% operational threshold. Review leasing pipeline.`,
        propertyId: property.id,
        metadata: {
          occupancyRate: Math.round(rate),
          activeLeases: property._count.leases,
          totalUnits: property.totalUnits,
        },
      },
    });
    created++;
  }

  return created;
}

// ─── Detector: Flagged financial records without an open alert ────────────────
async function detectFinancialDiscrepancies(): Promise<number> {
  let created = 0;

  const flagged = await prisma.financialRecord.findMany({
    where: { status: 'FLAGGED' },
    include: { property: true },
    take: 50,
  });

  for (const record of flagged) {
    const existing = await prisma.alert.findFirst({
      where: {
        propertyId: record.propertyId,
        type: 'FINANCIAL_DISCREPANCY',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        metadata: { path: ['recordId'], equals: record.id },
      },
    });
    if (existing) continue;

    await prisma.alert.create({
      data: {
        type: 'FINANCIAL_DISCREPANCY',
        severity: 'WARNING',
        title: 'Financial record flagged for review',
        description: `A ${record.type.toLowerCase()} record of $${Number(record.amount).toLocaleString()} at ${record.property.name} is flagged.${record.discrepancy ? ` Discrepancy amount: $${Number(record.discrepancy).toLocaleString()}.` : ''} Review for accuracy.`,
        propertyId: record.propertyId,
        leaseId: record.leaseId ?? undefined,
        metadata: { recordId: record.id, amount: Number(record.amount), recordType: record.type },
      },
    });
    created++;
  }

  return created;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────
export async function runAnomalyScan(): Promise<{ total: number; breakdown: Record<string, number> }> {
  const [renewalRisk, leaseExpiration, paymentAnomalies, occupancy, discrepancies] = await Promise.all([
    detectUnactionedExpirations(),
    generateLeaseExpirationAlerts(),
    detectPaymentAnomalies(),
    detectOccupancyDrops(),
    detectFinancialDiscrepancies(),
  ]);

  const breakdown = { renewalRisk, leaseExpiration, paymentAnomalies, occupancy, discrepancies };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  return { total, breakdown };
}

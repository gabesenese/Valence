import { prisma } from '../../infrastructure/database';
import { startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';


export interface HealthScoreComponent {
  name:        string;
  score:       number;
  maxScore:    number;
  label:       string;
  description: string;
  delta:       number;   // vs last month; 0 when no historical data available
}

export interface ScoreDriver {
  name:  string;
  label: string;
  delta: number;
}

export interface PortfolioHealthScore {
  score:      number;
  delta:      number;
  trend:      'up' | 'down' | 'stable';
  band:       'critical' | 'at_risk' | 'stable' | 'healthy';
  components: HealthScoreComponent[];
  drivers: {
    positive: ScoreDriver[];
    negative: ScoreDriver[];
  };
  computedAt: string;
}


function band(score: number): PortfolioHealthScore['band'] {
  if (score >= 75) return 'healthy';
  if (score >= 55) return 'stable';
  if (score >= 35) return 'at_risk';
  return 'critical';
}


async function getMonthRevenue(propertyIds: string[], monthDate: Date): Promise<number> {
  const start = startOfMonth(monthDate);
  const end   = endOfMonth(monthDate);
  const agg = await prisma.financialRecord.aggregate({
    where: {
      propertyId:  { in: propertyIds },
      type:        'REVENUE',
      periodStart: { gte: start, lte: end },
      status:      { not: 'VOID' },
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}


async function scoreRevenueStability(propertyIds: string[]): Promise<{ score: number; description: string }> {
  const now = new Date();
  const [lastMonth, m2, m3, m4] = await Promise.all([
    getMonthRevenue(propertyIds, subMonths(now, 1)),
    getMonthRevenue(propertyIds, subMonths(now, 2)),
    getMonthRevenue(propertyIds, subMonths(now, 3)),
    getMonthRevenue(propertyIds, subMonths(now, 4)),
  ]);
  const historical = [m2, m3, m4].filter(v => v > 0);
  if (historical.length === 0) return { score: 10, description: 'Insufficient historical revenue data to assess stability' };
  const baseline    = historical.reduce((s, v) => s + v, 0) / historical.length;
  const variancePct = Math.abs((lastMonth - baseline) / baseline) * 100;
  if (variancePct <= 3)  return { score: 20, description: `Revenue stable — ${variancePct.toFixed(1)}% variance vs 3-month avg` };
  if (variancePct <= 7)  return { score: 15, description: `Minor variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  if (variancePct <= 15) return { score: 10, description: `Moderate variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  if (variancePct <= 30) return { score: 5,  description: `High variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  return                        { score: 0,  description: `Severe variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
}

async function scoreRevenueStabilityLastMonth(propertyIds: string[]): Promise<number> {
  const now = new Date();
  const [m2, m3, m4, m5] = await Promise.all([
    getMonthRevenue(propertyIds, subMonths(now, 2)),
    getMonthRevenue(propertyIds, subMonths(now, 3)),
    getMonthRevenue(propertyIds, subMonths(now, 4)),
    getMonthRevenue(propertyIds, subMonths(now, 5)),
  ]);
  const historical = [m3, m4, m5].filter(v => v > 0);
  if (historical.length === 0) return 10;
  const baseline    = historical.reduce((s, v) => s + v, 0) / historical.length;
  const variancePct = Math.abs((m2 - baseline) / baseline) * 100;
  if (variancePct <= 3)  return 20;
  if (variancePct <= 7)  return 15;
  if (variancePct <= 15) return 10;
  if (variancePct <= 30) return 5;
  return 0;
}

function scoreOccupancy(occupancyRate: number): { score: number; description: string } {
  const r = Math.round(occupancyRate * 10) / 10;
  if (r >= 95) return { score: 20, description: `${r}% — excellent occupancy` };
  if (r >= 90) return { score: 17, description: `${r}% — strong occupancy` };
  if (r >= 80) return { score: 12, description: `${r}% — adequate occupancy` };
  if (r >= 70) return { score: 6,  description: `${r}% — below target (< 80%)` };
  return              { score: 0,  description: `${r}% — critical vacancy risk` };
}

async function scoreLeaseRisk(propertyIds: string[], totalRevenue: number, refDate?: Date): Promise<{ score: number; description: string }> {
  const base    = refDate ?? new Date();
  const horizon = addDays(base, 90);
  const atRisk  = await prisma.lease.findMany({
    where: {
      propertyId:   { in: propertyIds },
      status:       'ACTIVE',
      endDate:      { gte: base, lte: horizon },
      renewalStage: { in: ['NOT_STARTED', 'CONTACTED'] },
    },
    select: { baseRent: true },
  });
  const revenueAtRisk = atRisk.reduce((s, l) => s + Number(l.baseRent), 0);
  const pct = totalRevenue > 0 ? (revenueAtRisk / totalRevenue) * 100 : 0;
  if (pct === 0) return { score: 20, description: 'No expiring leases without active renewal conversations' };
  if (pct < 5)   return { score: 15, description: `${pct.toFixed(1)}% of revenue expiring without engagement in 90d` };
  if (pct < 15)  return { score: 10, description: `${pct.toFixed(1)}% of revenue at expiry risk — renewals needed` };
  if (pct < 30)  return { score: 4,  description: `${pct.toFixed(1)}% of revenue at expiry risk — urgent action required` };
  return                { score: 0,  description: `${pct.toFixed(1)}% of revenue at critical expiry risk` };
}

async function scorePaymentReliability(propertyIds: string[]): Promise<{ score: number; description: string }> {
  const count = await prisma.financialRecord.count({
    where: { status: { in: ['FLAGGED', 'DISPUTED'] }, propertyId: { in: propertyIds } },
  });
  if (count === 0) return { score: 15, description: 'No flagged or disputed payment records' };
  if (count <= 2)  return { score: 10, description: `${count} payment record${count > 1 ? 's' : ''} flagged or disputed` };
  if (count <= 5)  return { score: 5,  description: `${count} flagged/disputed records — elevated concern` };
  return                  { score: 0,  description: `${count} flagged/disputed records — requires immediate review` };
}

async function scoreAlerts(userId: string): Promise<{ score: number; description: string }> {
  const owned = {
    OR: [
      { property: { ownerId: userId } },
      { lease: { property: { ownerId: userId } } },
    ],
  };
  const [critical, warning] = await Promise.all([
    prisma.alert.count({ where: { ...owned, severity: 'CRITICAL', status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } }),
    prisma.alert.count({ where: { ...owned, severity: 'WARNING',  status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } }),
  ]);
  const penalty = Math.min(15, critical * 5 + warning * 2);
  const score   = 15 - penalty;
  if (critical === 0 && warning === 0) return { score: 15, description: 'No open critical or warning alerts' };
  if (critical > 0) return { score, description: `${critical} critical alert${critical > 1 ? 's' : ''}, ${warning} warning${warning > 1 ? 's' : ''} open` };
  return               { score, description: `${warning} open warning alert${warning > 1 ? 's' : ''}` };
}

async function scoreVacancyExposure(properties: { totalUnits: number; _count: { leases: number } }[]): Promise<{ score: number; description: string }> {
  if (properties.length === 0) return { score: 3, description: 'No properties to evaluate' };
  const under = properties.filter(p => (p.totalUnits > 0 ? p._count.leases / p.totalUnits : 0) < 0.80);
  const pct   = (under.length / properties.length) * 100;
  if (pct === 0) return { score: 5, description: 'All properties above 80% occupancy' };
  if (pct <= 20) return { score: 3, description: `${under.length} of ${properties.length} properties below 80% occupancy` };
  if (pct <= 50) return { score: 2, description: `${under.length} of ${properties.length} properties below 80% occupancy — elevated` };
  return               { score: 0, description: `${under.length} of ${properties.length} properties below 80% occupancy — critical` };
}

async function scoreRetentionRisk(propertyIds: string[]): Promise<{ score: number; description: string }> {
  const [total, highRisk] = await Promise.all([
    prisma.lease.count({ where: { status: 'ACTIVE', propertyId: { in: propertyIds } } }),
    prisma.lease.count({ where: { status: 'ACTIVE', propertyId: { in: propertyIds }, renewalRisk: { in: ['HIGH', 'CRITICAL'] } } }),
  ]);
  if (total === 0) return { score: 3, description: 'No active leases' };
  const pct = (highRisk / total) * 100;
  if (pct === 0)  return { score: 5, description: 'No leases flagged as high or critical renewal risk' };
  if (pct <= 10)  return { score: 4, description: `${highRisk} lease${highRisk > 1 ? 's' : ''} at high/critical renewal risk (${pct.toFixed(0)}%)` };
  if (pct <= 20)  return { score: 3, description: `${pct.toFixed(0)}% of leases at elevated renewal risk` };
  if (pct <= 30)  return { score: 1, description: `${pct.toFixed(0)}% of leases at high/critical renewal risk` };
  return                 { score: 0, description: `${pct.toFixed(0)}% of leases at critical renewal risk — major retention problem` };
}


async function computeLastMonthComponents(
  propertyIds:    string[],
  totalRevenue:   number,
  currentScores:  Record<string, number>,
): Promise<Record<string, number>> {
  const now = new Date();

  const [revStabLast, leaseRiskLast] = await Promise.all([
    scoreRevenueStabilityLastMonth(propertyIds),
    scoreLeaseRisk(propertyIds, totalRevenue, subMonths(now, 1)).then(r => r.score),
  ]);

  return {
    revenueStability:     revStabLast,
    occupancyPerformance: currentScores['occupancyPerformance'],   // no historical snapshot
    leaseRisk:            leaseRiskLast,
    paymentReliability:   currentScores['paymentReliability'],     // no historical snapshot
    alertSeverity:        currentScores['alertSeverity'],          // no historical snapshot
    vacancyExposure:      currentScores['vacancyExposure'],        // no historical snapshot
    tenantRetentionRisk:  currentScores['tenantRetentionRisk'],    // no historical snapshot
  };
}


export async function computeHealthScore(userId: string): Promise<PortfolioHealthScore> {
  const now = new Date();

  const [properties, activeLeaseAgg] = await Promise.all([
    prisma.property.findMany({
      where: { status: 'ACTIVE', ownerId: userId },
      select: {
        id: true,
        totalUnits: true,
        _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.lease.aggregate({ where: { status: 'ACTIVE', property: { ownerId: userId } }, _sum: { baseRent: true } }),
  ]);

  const propertyIds   = properties.map(p => p.id);
  const totalUnits    = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p._count.leases, 0);
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
  const totalRevenue  = Number(activeLeaseAgg._sum.baseRent ?? 0);

  const [revStab, leaseRisk, payments, alerts, vacancy, retention] = await Promise.all([
    scoreRevenueStability(propertyIds),
    scoreLeaseRisk(propertyIds, totalRevenue),
    scorePaymentReliability(propertyIds),
    scoreAlerts(userId),
    scoreVacancyExposure(properties),
    scoreRetentionRisk(propertyIds),
  ]);
  const occupancy = scoreOccupancy(occupancyRate);

  const currentScores: Record<string, number> = {
    revenueStability:     revStab.score,
    occupancyPerformance: occupancy.score,
    leaseRisk:            leaseRisk.score,
    paymentReliability:   payments.score,
    alertSeverity:        alerts.score,
    vacancyExposure:      vacancy.score,
    tenantRetentionRisk:  retention.score,
  };

  const lastScores = await computeLastMonthComponents(propertyIds, totalRevenue, currentScores);

  const componentDefs = [
    { name: 'revenueStability',    maxScore: 20, label: 'Revenue Stability',       result: revStab    },
    { name: 'occupancyPerformance',maxScore: 20, label: 'Occupancy Performance',   result: occupancy  },
    { name: 'leaseRisk',           maxScore: 20, label: 'Lease Risk',              result: leaseRisk  },
    { name: 'paymentReliability',  maxScore: 15, label: 'Payment Reliability',     result: payments   },
    { name: 'alertSeverity',       maxScore: 15, label: 'Alert Severity & Volume', result: alerts     },
    { name: 'vacancyExposure',     maxScore:  5, label: 'Vacancy Exposure',        result: vacancy    },
    { name: 'tenantRetentionRisk', maxScore:  5, label: 'Tenant Retention Risk',   result: retention  },
  ] as const;

  const components: HealthScoreComponent[] = componentDefs.map(c => ({
    name:        c.name,
    score:       currentScores[c.name],
    maxScore:    c.maxScore,
    label:       c.label,
    description: c.result.description,
    delta:       currentScores[c.name] - lastScores[c.name],
  }));

  const score         = components.reduce((s, c) => s + c.score, 0);
  const lastMonthTotal= Object.values(lastScores).reduce((s, v) => s + v, 0);
  const delta         = score - lastMonthTotal;

  const movers = components
    .filter(c => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const drivers = {
    positive: movers.filter(c => c.delta > 0).slice(0, 3).map(c => ({ name: c.name, label: c.label, delta: c.delta })),
    negative: movers.filter(c => c.delta < 0).slice(0, 3).map(c => ({ name: c.name, label: c.label, delta: c.delta })),
  };

  return {
    score,
    delta,
    trend:      delta > 1 ? 'up' : delta < -1 ? 'down' : 'stable',
    band:       band(score),
    components,
    drivers,
    computedAt: now.toISOString(),
  };
}

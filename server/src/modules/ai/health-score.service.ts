import { prisma } from '../../infrastructure/database';
import { startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthScoreComponent {
  name:        string;
  score:       number;
  maxScore:    number;
  label:       string;
  description: string;
}

export interface PortfolioHealthScore {
  score:      number;
  delta:      number;
  trend:      'up' | 'down' | 'stable';
  band:       'critical' | 'at_risk' | 'stable' | 'healthy';
  components: HealthScoreComponent[];
  computedAt: string;
}

// ─── Band classifier ──────────────────────────────────────────────────────────

function band(score: number): PortfolioHealthScore['band'] {
  if (score >= 75) return 'healthy';
  if (score >= 55) return 'stable';
  if (score >= 35) return 'at_risk';
  return 'critical';
}

// ─── Revenue helper ───────────────────────────────────────────────────────────

async function getMonthRevenue(propertyIds: string[], monthDate: Date): Promise<number> {
  const start = startOfMonth(monthDate);
  const end   = endOfMonth(monthDate);
  const agg = await prisma.financialRecord.aggregate({
    where: {
      ...(propertyIds.length ? { propertyId: { in: propertyIds } } : {}),
      type:        'REVENUE',
      periodStart: { gte: start, lte: end },
      status:      { not: 'VOID' },
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

// ─── Component: Revenue Stability (0–20) ─────────────────────────────────────
//
// Always compares the LAST COMPLETE month vs the 3 months before it, so the
// score is never distorted by an in-progress month that has zero records.

async function scoreRevenueStability(propertyIds: string[]): Promise<{ score: number; description: string }> {
  const now = new Date();

  // last complete month and the 3 months before it
  const [lastMonth, m2, m3, m4] = await Promise.all([
    getMonthRevenue(propertyIds, subMonths(now, 1)),
    getMonthRevenue(propertyIds, subMonths(now, 2)),
    getMonthRevenue(propertyIds, subMonths(now, 3)),
    getMonthRevenue(propertyIds, subMonths(now, 4)),
  ]);

  const historicalMonths = [m2, m3, m4].filter(v => v > 0);
  if (historicalMonths.length === 0) {
    // No historical records at all — score neutral, don't penalise
    return { score: 10, description: 'Insufficient historical revenue data to assess stability' };
  }

  const baseline    = historicalMonths.reduce((s, v) => s + v, 0) / historicalMonths.length;
  const variancePct = Math.abs((lastMonth - baseline) / baseline) * 100;

  if (variancePct <= 3)  return { score: 20, description: `Revenue stable — ${variancePct.toFixed(1)}% variance vs 3-month avg` };
  if (variancePct <= 7)  return { score: 15, description: `Minor variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  if (variancePct <= 15) return { score: 10, description: `Moderate variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  if (variancePct <= 30) return { score: 5,  description: `High variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
  return                        { score: 0,  description: `Severe variance — ${variancePct.toFixed(1)}% vs 3-month avg` };
}

// ─── Component: Occupancy Performance (0–20) ─────────────────────────────────
//
// Occupied units = number of ACTIVE leases per property (one lease = one unit).
// This is the most accurate proxy available without a separate unit-occupancy model.

function scoreOccupancy(occupancyRate: number): { score: number; description: string } {
  const r = Math.round(occupancyRate * 10) / 10;
  if (r >= 95) return { score: 20, description: `${r}% — excellent occupancy` };
  if (r >= 90) return { score: 17, description: `${r}% — strong occupancy` };
  if (r >= 80) return { score: 12, description: `${r}% — adequate occupancy` };
  if (r >= 70) return { score: 6,  description: `${r}% — below target (< 80%)` };
  return              { score: 0,  description: `${r}% — critical vacancy risk` };
}

// ─── Component: Lease Risk (0–20) ────────────────────────────────────────────
//
// Measures revenue at risk from leases expiring within 90 days where renewal
// conversations have NOT meaningfully started (renewalStage = NOT_STARTED or
// CONTACTED). Simply having a renewalDate set does NOT signal active engagement.

async function scoreLeaseRisk(totalRevenue: number): Promise<{ score: number; description: string }> {
  const horizon = addDays(new Date(), 90);

  const atRiskLeases = await prisma.lease.findMany({
    where: {
      status:  'ACTIVE',
      endDate: { gte: new Date(), lte: horizon },
      renewalStage: { in: ['NOT_STARTED', 'CONTACTED'] },
    },
    select: { baseRent: true },
  });

  const revenueAtRisk = atRiskLeases.reduce((s, l) => s + Number(l.baseRent), 0);
  const pct = totalRevenue > 0 ? (revenueAtRisk / totalRevenue) * 100 : 0;

  if (pct === 0) return { score: 20, description: 'No expiring leases without active renewal conversations' };
  if (pct < 5)   return { score: 15, description: `${pct.toFixed(1)}% of revenue expiring without engagement in 90d` };
  if (pct < 15)  return { score: 10, description: `${pct.toFixed(1)}% of revenue at expiry risk — renewals needed` };
  if (pct < 30)  return { score: 4,  description: `${pct.toFixed(1)}% of revenue at expiry risk — urgent action required` };
  return                { score: 0,  description: `${pct.toFixed(1)}% of revenue at critical expiry risk` };
}

// ─── Component: Payment Reliability (0–15) ───────────────────────────────────
//
// Counts financial records currently in FLAGGED or DISPUTED status.
// These represent active payment problems, not resolved historical issues.

async function scorePaymentReliability(): Promise<{ score: number; description: string }> {
  const count = await prisma.financialRecord.count({
    where: { status: { in: ['FLAGGED', 'DISPUTED'] } },
  });
  if (count === 0) return { score: 15, description: 'No flagged or disputed payment records' };
  if (count <= 2)  return { score: 10, description: `${count} payment record${count > 1 ? 's' : ''} flagged or disputed` };
  if (count <= 5)  return { score: 5,  description: `${count} flagged/disputed records — elevated concern` };
  return                  { score: 0,  description: `${count} flagged/disputed records — requires immediate review` };
}

// ─── Component: Alert Severity & Volume (0–15) ───────────────────────────────
//
// AlertSeverity enum: INFO | WARNING | CRITICAL (no HIGH in schema).
// Penalty: -5 per open CRITICAL alert, -2 per open WARNING alert, floor 0.

async function scoreAlerts(): Promise<{ score: number; description: string }> {
  const [critical, warning] = await Promise.all([
    prisma.alert.count({ where: { severity: 'CRITICAL', status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } }),
    prisma.alert.count({ where: { severity: 'WARNING',  status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } } }),
  ]);
  const penalty = Math.min(15, critical * 5 + warning * 2);
  const score   = 15 - penalty;

  if (critical === 0 && warning === 0) return { score: 15, description: 'No open critical or warning alerts' };
  if (critical > 0) return { score, description: `${critical} critical alert${critical > 1 ? 's' : ''}, ${warning} warning${warning > 1 ? 's' : ''} open` };
  return               { score, description: `${warning} open warning alert${warning > 1 ? 's' : ''}` };
}

// ─── Component: Vacancy Exposure (0–5) ───────────────────────────────────────
//
// Distinct from Occupancy: counts how many PROPERTIES have persistently low
// occupancy (< 80%). Occupancy measures the portfolio rate; this measures
// concentration of risk — how many assets are underperforming.

async function scoreVacancyExposure(properties: { totalUnits: number; _count: { leases: number } }[]): Promise<{ score: number; description: string }> {
  if (properties.length === 0) return { score: 3, description: 'No properties to evaluate' };

  const underperforming = properties.filter(p => {
    const rate = p.totalUnits > 0 ? p._count.leases / p.totalUnits : 0;
    return rate < 0.80;
  });

  const pct = (underperforming.length / properties.length) * 100;

  if (pct === 0) return { score: 5, description: 'All properties above 80% occupancy' };
  if (pct <= 20) return { score: 3, description: `${underperforming.length} of ${properties.length} properties below 80% occupancy` };
  if (pct <= 50) return { score: 2, description: `${underperforming.length} of ${properties.length} properties below 80% occupancy — elevated` };
  return               { score: 0, description: `${underperforming.length} of ${properties.length} properties below 80% occupancy — critical` };
}

// ─── Component: Tenant Retention Risk (0–5) ──────────────────────────────────
//
// Percentage of active leases flagged HIGH or CRITICAL renewal risk
// (the RenewalRisk enum has: LOW | MEDIUM | HIGH | CRITICAL).

async function scoreRetentionRisk(): Promise<{ score: number; description: string }> {
  const [total, highRisk] = await Promise.all([
    prisma.lease.count({ where: { status: 'ACTIVE' } }),
    prisma.lease.count({ where: { status: 'ACTIVE', renewalRisk: { in: ['HIGH', 'CRITICAL'] } } }),
  ]);
  if (total === 0)  return { score: 3, description: 'No active leases' };
  const pct = (highRisk / total) * 100;
  if (pct === 0)   return { score: 5, description: 'No leases flagged as high or critical renewal risk' };
  if (pct <= 10)   return { score: 4, description: `${highRisk} lease${highRisk > 1 ? 's' : ''} at high/critical renewal risk (${pct.toFixed(0)}%)` };
  if (pct <= 20)   return { score: 3, description: `${pct.toFixed(0)}% of leases at elevated renewal risk` };
  if (pct <= 30)   return { score: 1, description: `${pct.toFixed(0)}% of leases at high/critical renewal risk` };
  return                  { score: 0, description: `${pct.toFixed(0)}% of leases at critical renewal risk — major retention problem` };
}

// ─── Month-over-month delta ───────────────────────────────────────────────────
//
// Re-run revenue stability and lease risk as they were 1 month ago using real
// data. The other components (occupancy, alerts, vacancy, retention) lack
// reliable historical snapshots, so we hold them constant in the delta.

async function computeLastMonthPartialScore(
  propertyIds: string[],
  occupancyScore:  number,
  alertScore:      number,
  vacancyScore:    number,
  retentionScore:  number,
  totalRevenue:    number,
): Promise<number> {
  const now = new Date();

  // Revenue stability as of 1 month ago: compare month-2 vs months 3-5
  const [m2, m3, m4, m5] = await Promise.all([
    getMonthRevenue(propertyIds, subMonths(now, 2)),
    getMonthRevenue(propertyIds, subMonths(now, 3)),
    getMonthRevenue(propertyIds, subMonths(now, 4)),
    getMonthRevenue(propertyIds, subMonths(now, 5)),
  ]);
  const historicalMonths = [m3, m4, m5].filter(v => v > 0);
  let revStabLastScore = 10;
  if (historicalMonths.length > 0) {
    const baseline    = historicalMonths.reduce((s, v) => s + v, 0) / historicalMonths.length;
    const variancePct = Math.abs((m2 - baseline) / baseline) * 100;
    if (variancePct <= 3)  revStabLastScore = 20;
    else if (variancePct <= 7)  revStabLastScore = 15;
    else if (variancePct <= 15) revStabLastScore = 10;
    else if (variancePct <= 30) revStabLastScore = 5;
    else                        revStabLastScore = 0;
  }

  // Lease risk as of 1 month ago: horizon was addDays(lastMonth, 90)
  const lastMonth = subMonths(now, 1);
  const horizon   = addDays(lastMonth, 90);
  const atRisk    = await prisma.lease.findMany({
    where: {
      status:  'ACTIVE',
      endDate: { gte: lastMonth, lte: horizon },
      renewalStage: { in: ['NOT_STARTED', 'CONTACTED'] },
    },
    select: { baseRent: true },
  });
  const revenueAtRisk = atRisk.reduce((s, l) => s + Number(l.baseRent), 0);
  const pct = totalRevenue > 0 ? (revenueAtRisk / totalRevenue) * 100 : 0;
  let leaseRiskLastScore: number;
  if (pct === 0)      leaseRiskLastScore = 20;
  else if (pct < 5)   leaseRiskLastScore = 15;
  else if (pct < 15)  leaseRiskLastScore = 10;
  else if (pct < 30)  leaseRiskLastScore = 4;
  else                leaseRiskLastScore = 0;

  return revStabLastScore + occupancyScore + leaseRiskLastScore
    + alertScore + vacancyScore + retentionScore;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function computeHealthScore(): Promise<PortfolioHealthScore> {
  const now = new Date();

  // Gather base data
  const [properties, activeLeaseAgg] = await Promise.all([
    prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        totalUnits: true,
        _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.lease.aggregate({
      where: { status: 'ACTIVE' },
      _sum:  { baseRent: true },
    }),
  ]);

  const propertyIds   = properties.map(p => p.id);
  const totalUnits    = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p._count.leases, 0);
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  // Use contracted baseRent as authoritative total revenue (not financial records,
  // which can be incomplete mid-month or lag entry)
  const totalRevenue = Number(activeLeaseAgg._sum.baseRent ?? 0);

  // Compute all components concurrently
  const [revStab, leaseRisk, payments, alerts, vacancy, retention] = await Promise.all([
    scoreRevenueStability(propertyIds),
    scoreLeaseRisk(totalRevenue),
    scorePaymentReliability(),
    scoreAlerts(),
    scoreVacancyExposure(properties),
    scoreRetentionRisk(),
  ]);
  const occupancy = scoreOccupancy(occupancyRate);

  const components: HealthScoreComponent[] = [
    { name: 'revenueStability',    score: revStab.score,    maxScore: 20, label: 'Revenue Stability',       description: revStab.description    },
    { name: 'occupancyPerformance',score: occupancy.score,  maxScore: 20, label: 'Occupancy Performance',   description: occupancy.description  },
    { name: 'leaseRisk',           score: leaseRisk.score,  maxScore: 20, label: 'Lease Risk',              description: leaseRisk.description  },
    { name: 'paymentReliability',  score: payments.score,   maxScore: 15, label: 'Payment Reliability',     description: payments.description   },
    { name: 'alertSeverity',       score: alerts.score,     maxScore: 15, label: 'Alert Severity & Volume', description: alerts.description     },
    { name: 'vacancyExposure',     score: vacancy.score,    maxScore:  5, label: 'Vacancy Exposure',        description: vacancy.description    },
    { name: 'tenantRetentionRisk', score: retention.score,  maxScore:  5, label: 'Tenant Retention Risk',   description: retention.description  },
  ];

  const score = components.reduce((s, c) => s + c.score, 0);

  // Compute delta using real historical data for the two most data-rich components
  const lastMonthScore = await computeLastMonthPartialScore(
    propertyIds,
    occupancy.score,
    alerts.score,
    vacancy.score,
    retention.score,
    totalRevenue,
  );
  const delta = score - lastMonthScore;

  return {
    score,
    delta,
    trend:      delta > 1 ? 'up' : delta < -1 ? 'down' : 'stable',
    band:       band(score),
    components,
    computedAt: now.toISOString(),
  };
}

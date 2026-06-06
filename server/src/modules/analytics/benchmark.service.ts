import { prisma } from '../../infrastructure/database';
import { startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropertyScorecard {
  id:              string;
  name:            string;
  code:            string;
  totalUnits:      number;
  activeLeases:    number;
  occupancyRate:   number;
  monthlyRevenue:  number;
  monthlyExpenses: number;
  noi:             number;
  revenuePerUnit:  number;
  noiPerUnit:      number;
  revenueDeltaPct: number | null;
  openAlerts:      number;
  criticalAlerts:  number;
  expiringSoon:    number;
  highRiskLeases:  number;
  riskScore:       number;
  // Composite performance score (0–100): weighted avg of normalized revenue, NOI, occupancy ranks
  compositeScore:  number;
  // Portfolio-relative percentile (0–100): 95 = top 5%, 10 = bottom 10%
  percentile:      number;
  ranks: {
    byRevenue:   number;
    byGrowth:    number | null;
    byNOI:       number;
    byRisk:      number;
    byOccupancy: number;
  };
  isOutlier:      boolean;
  outlierReasons: string[];
}

export interface BenchmarkReport {
  generatedAt:       string;
  propertyCount:     number;
  portfolioAverages: {
    occupancyRate:   number;
    monthlyRevenue:  number;
    noi:             number;
    revenuePerUnit:  number;
    riskScore:       number;
  };
  highlights: {
    bestRevenue:      PropertyScorecard | null;
    fastestGrowing:   PropertyScorecard | null;
    highestNOI:       PropertyScorecard | null;
    lowestRisk:       PropertyScorecard | null;
    worstPerforming:  PropertyScorecard | null;
    highestRisk:      PropertyScorecard | null;
  };
  outliers:    PropertyScorecard[];
  properties:  PropertyScorecard[];
}

// ─── Risk score helper ────────────────────────────────────────────────────────

function computeRiskScore(p: {
  openAlerts: number;
  criticalAlerts: number;
  expiringSoon: number;
  highRiskLeases: number;
  occupancyRate: number;
}): number {
  let score = 0;
  score += p.criticalAlerts * 15;
  score += (p.openAlerts - p.criticalAlerts) * 5;
  score += p.expiringSoon * 8;
  score += p.highRiskLeases * 10;
  if (p.occupancyRate < 70) score += 20;
  else if (p.occupancyRate < 80) score += 10;
  return Math.min(100, score);
}

// ─── Outlier detection ────────────────────────────────────────────────────────

function detectOutliers(properties: PropertyScorecard[]): void {
  if (properties.length < 2) return;

  const revenues    = properties.map(p => p.monthlyRevenue);
  const nois        = properties.map(p => p.noi);
  const occupancies = properties.map(p => p.occupancyRate);
  const risks       = properties.map(p => p.riskScore);

  const mean    = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const stddev  = (arr: number[]) => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length); };

  const revMean = mean(revenues);   const revStd = stddev(revenues);
  const noiMean = mean(nois);       const noiStd = stddev(nois);
  const occMean = mean(occupancies);const occStd = stddev(occupancies);
  const riskMean= mean(risks);      const riskStd= stddev(risks);

  for (const p of properties) {
    const reasons: string[] = [];
    if (revStd > 0 && Math.abs(p.monthlyRevenue - revMean) > 1.5 * revStd)
      reasons.push(p.monthlyRevenue > revMean ? 'Significantly above-average revenue' : 'Significantly below-average revenue');
    if (noiStd > 0 && Math.abs(p.noi - noiMean) > 1.5 * noiStd)
      reasons.push(p.noi > noiMean ? 'Above-average NOI' : 'Below-average NOI — cost review recommended');
    if (occStd > 0 && Math.abs(p.occupancyRate - occMean) > 1.5 * occStd)
      reasons.push(p.occupancyRate > occMean ? 'Top occupancy performer' : 'Occupancy significantly below portfolio avg');
    if (riskStd > 0 && (p.riskScore - riskMean) > 1.5 * riskStd)
      reasons.push('Risk profile significantly higher than portfolio avg');

    p.outlierReasons = reasons;
    p.isOutlier      = reasons.length > 0;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getBenchmarks(): Promise<BenchmarkReport> {
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const lastStart  = startOfMonth(subMonths(now, 1));
  const lastEnd    = endOfMonth(subMonths(now, 1));

  const rawProperties = await prisma.property.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      code: true,
      totalUnits: true,
      _count: { select: { leases: { where: { status: 'ACTIVE' } } } },
    },
  });

  if (rawProperties.length === 0) {
    return {
      generatedAt: now.toISOString(),
      propertyCount: 0,
      portfolioAverages: { occupancyRate: 0, monthlyRevenue: 0, noi: 0, revenuePerUnit: 0, riskScore: 0 },
      highlights: { bestRevenue: null, fastestGrowing: null, highestNOI: null, lowestRisk: null, worstPerforming: null, highestRisk: null },
      outliers: [],
      properties: [],
    };
  }

  const scorecards = await Promise.all(
    rawProperties.map(async (p) => {
      const [rev, prevRev, exp, alerts, expiringSoon, highRiskLeases] = await Promise.all([
        prisma.financialRecord.aggregate({
          where: { propertyId: p.id, type: 'REVENUE', periodStart: { gte: monthStart }, status: { not: 'VOID' } },
          _sum: { amount: true },
        }),
        prisma.financialRecord.aggregate({
          where: { propertyId: p.id, type: 'REVENUE', periodStart: { gte: lastStart, lte: lastEnd }, status: { not: 'VOID' } },
          _sum: { amount: true },
        }),
        prisma.financialRecord.aggregate({
          where: { propertyId: p.id, type: 'EXPENSE', periodStart: { gte: monthStart }, status: { not: 'VOID' } },
          _sum: { amount: true },
        }),
        prisma.alert.groupBy({
          by: ['severity'],
          where: { propertyId: p.id, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
          _count: true,
        }),
        prisma.lease.count({
          where: { propertyId: p.id, status: 'ACTIVE', endDate: { gte: now, lte: addDays(now, 90) } },
        }),
        prisma.lease.count({
          where: { propertyId: p.id, status: 'ACTIVE', renewalRisk: { in: ['HIGH', 'CRITICAL'] } },
        }),
      ]);

      const monthlyRevenue  = Number(rev._sum.amount ?? 0);
      const prevRevenue     = Number(prevRev._sum.amount ?? 0);
      const monthlyExpenses = Number(exp._sum.amount ?? 0);
      const noi             = monthlyRevenue - monthlyExpenses;
      const occupancyRate   = p.totalUnits > 0 ? (p._count.leases / p.totalUnits) * 100 : 0;
      const revenueDeltaPct = prevRevenue > 0 ? Number((((monthlyRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)) : null;

      const openAlerts     = alerts.reduce((s, a) => s + a._count, 0);
      const criticalAlerts = alerts.find(a => a.severity === 'CRITICAL')?._count ?? 0;
      const riskScore      = computeRiskScore({ openAlerts, criticalAlerts, expiringSoon, highRiskLeases, occupancyRate });

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        totalUnits: p.totalUnits,
        activeLeases: p._count.leases,
        occupancyRate: Number(occupancyRate.toFixed(1)),
        monthlyRevenue,
        monthlyExpenses,
        noi,
        revenuePerUnit: p.totalUnits > 0 ? Math.round(monthlyRevenue / p.totalUnits) : 0,
        noiPerUnit: p.totalUnits > 0 ? Math.round(noi / p.totalUnits) : 0,
        revenueDeltaPct,
        openAlerts,
        criticalAlerts,
        expiringSoon,
        highRiskLeases,
        riskScore,
        compositeScore: 0,
        percentile: 0,
        ranks: { byRevenue: 0, byGrowth: null as number | null, byNOI: 0, byRisk: 0, byOccupancy: 0 },
        isOutlier: false,
        outlierReasons: [] as string[],
      } satisfies PropertyScorecard;
    })
  );

  // ── Assign ranks ───────────────────────────────────────────────────────────
  const byRevenue   = [...scorecards].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  const byNOI       = [...scorecards].sort((a, b) => b.noi - a.noi);
  const byRisk      = [...scorecards].sort((a, b) => a.riskScore - b.riskScore);
  const byOccupancy = [...scorecards].sort((a, b) => b.occupancyRate - a.occupancyRate);
  const byGrowth    = scorecards.filter(p => p.revenueDeltaPct !== null)
                       .sort((a, b) => (b.revenueDeltaPct ?? 0) - (a.revenueDeltaPct ?? 0));

  for (const p of scorecards) {
    p.ranks.byRevenue   = byRevenue.findIndex(x => x.id === p.id) + 1;
    p.ranks.byNOI       = byNOI.findIndex(x => x.id === p.id) + 1;
    p.ranks.byRisk      = byRisk.findIndex(x => x.id === p.id) + 1;
    p.ranks.byOccupancy = byOccupancy.findIndex(x => x.id === p.id) + 1;
    const gi = byGrowth.findIndex(x => x.id === p.id);
    p.ranks.byGrowth    = gi !== -1 ? gi + 1 : null;
  }

  // ── Composite score & percentile ──────────────────────────────────────────
  // Normalize each rank to 0–100 (rank 1 of N → 100, rank N of N → 0),
  // then average revenue, NOI, and occupancy contributions equally.
  // Risk score is inverted (lower = better) and contributes as a penalty.
  const N = scorecards.length;
  const norm = (rank: number) => N > 1 ? ((N - rank) / (N - 1)) * 100 : 100;

  for (const p of scorecards) {
    const perfScore = (norm(p.ranks.byRevenue) + norm(p.ranks.byNOI) + norm(p.ranks.byOccupancy)) / 3;
    // Risk score is 0–100 where higher = worse; invert for penalty (max -20 pts)
    const riskPenalty = (p.riskScore / 100) * 20;
    p.compositeScore = Math.round(Math.max(0, Math.min(100, perfScore - riskPenalty)));
  }

  // Rank by composite score descending, then assign percentile
  const byComposite = [...scorecards].sort((a, b) => b.compositeScore - a.compositeScore);
  for (const p of scorecards) {
    const compositeRank = byComposite.findIndex(x => x.id === p.id) + 1;
    p.percentile = N > 1 ? Math.round(norm(compositeRank)) : 100;
  }

  // ── Outlier detection ──────────────────────────────────────────────────────
  detectOutliers(scorecards);

  // ── Portfolio averages ─────────────────────────────────────────────────────
  const avg = <T extends number>(arr: T[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const portfolioAverages = {
    occupancyRate:  Number(avg(scorecards.map(p => p.occupancyRate)).toFixed(1)),
    monthlyRevenue: Math.round(avg(scorecards.map(p => p.monthlyRevenue))),
    noi:            Math.round(avg(scorecards.map(p => p.noi))),
    revenuePerUnit: Math.round(avg(scorecards.map(p => p.revenuePerUnit))),
    riskScore:      Math.round(avg(scorecards.map(p => p.riskScore))),
  };

  return {
    generatedAt:   now.toISOString(),
    propertyCount: scorecards.length,
    portfolioAverages,
    highlights: {
      bestRevenue:    byRevenue[0] ?? null,
      fastestGrowing: byGrowth[0] ?? null,
      highestNOI:     byNOI[0] ?? null,
      lowestRisk:     byRisk[0] ?? null,
      worstPerforming:byRevenue[byRevenue.length - 1] ?? null,
      highestRisk:    byRisk[byRisk.length - 1] ?? null,
    },
    outliers:   scorecards.filter(p => p.isOutlier),
    properties: byRevenue,
  };
}

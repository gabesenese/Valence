import type { Band, Confidence, Direction, HealthFactor, HealthScore } from './intelligence.types';

export interface HealthInput {
  monthlyRevenue: number;
  netCurrent: number;
  revenueDeltaPct: number | null;
  expenseDeltaPct: number | null;
  expensesComparable: boolean;
  atRisk: { totalAtRisk: number; leaseCount: number; highRiskCount: number; renewalsNotStarted: number };
  overBudgetCount: number;
  worstBudgetVariancePct: number | null;
  overdueBalance: number;
  flaggedRecords: number;
  confidence: Confidence;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function band(score: number): Band {
  if (score >= 80) return 'HEALTHY';
  if (score >= 60) return 'WATCH';
  return 'AT_RISK';
}

export function computeHealthScore(input: HealthInput): HealthScore {
  let score = 100;
  const reasons: string[] = [];

  if (input.expensesComparable) {
    const margin = input.monthlyRevenue > 0 ? input.netCurrent / input.monthlyRevenue : 0;
    if (input.netCurrent < 0) {
      score -= 25;
      reasons.push('Operating at a loss this month');
    } else if (input.monthlyRevenue > 0 && margin < 0.1) {
      score -= 10;
      reasons.push('Thin operating margin');
    }
  }

  if (input.revenueDeltaPct != null) {
    if (input.revenueDeltaPct <= -5) {
      score -= 12;
      reasons.push(`Revenue down ${Math.abs(input.revenueDeltaPct)}% from last month`);
    } else if (input.revenueDeltaPct < 0) {
      score -= 5;
    } else if (input.revenueDeltaPct > 0) {
      reasons.push(`Revenue up ${input.revenueDeltaPct}% from last month`);
    }
  }

  if (input.expenseDeltaPct != null && input.expenseDeltaPct >= 10) {
    score -= 8;
    reasons.push(`Expenses up ${input.expenseDeltaPct}% from last month`);
  }

  if (input.atRisk.totalAtRisk > 0) {
    const atRiskPct = input.monthlyRevenue > 0 ? (input.atRisk.totalAtRisk / input.monthlyRevenue) * 100 : 0;
    score -= Math.min(25, Math.round(atRiskPct * 0.4));
    reasons.push(
      `${input.atRisk.leaseCount} lease${input.atRisk.leaseCount !== 1 ? 's' : ''} nearing expiry` +
        (atRiskPct > 0 ? ` (${Math.round(atRiskPct)}% of revenue)` : ''),
    );
  }

  if (input.overBudgetCount > 0) {
    score -= Math.min(15, Math.round((input.worstBudgetVariancePct ?? 0) * 0.3));
    reasons.push(`Expenses elevated in ${input.overBudgetCount} budget${input.overBudgetCount !== 1 ? 's' : ''}`);
  }

  if (input.overdueBalance > 0) {
    const overduePct = input.monthlyRevenue > 0 ? (input.overdueBalance / input.monthlyRevenue) * 100 : 0;
    score -= Math.min(15, Math.round(overduePct * 0.3));
    reasons.push('Overdue rent outstanding');
  }

  if (input.flaggedRecords > 0) {
    score -= Math.min(10, input.flaggedRecords * 2);
  }

  const revenueDir: Direction =
    input.revenueDeltaPct == null || input.revenueDeltaPct === 0 ? 'flat' : input.revenueDeltaPct > 0 ? 'up' : 'down';
  const expenseDir: Direction =
    input.expenseDeltaPct == null || input.expenseDeltaPct === 0 ? 'flat' : input.expenseDeltaPct > 0 ? 'up' : 'down';
  const renewalsDir: Direction =
    input.atRisk.highRiskCount > 0 || input.atRisk.renewalsNotStarted > 0 ? 'down' : 'up';
  const cashFlowDir: Direction =
    input.netCurrent < 0 || input.overdueBalance > 0 ? 'down' : 'up';

  const revenueWarn = input.revenueDeltaPct != null && input.revenueDeltaPct <= -5;
  const expenseWarn = input.expenseDeltaPct != null && input.expenseDeltaPct >= 10;
  const cashWarn = input.netCurrent < 0 || input.overdueBalance > 0;
  const renewalBad = input.atRisk.highRiskCount > 0;
  const renewalWarn = input.atRisk.leaseCount > 0;

  const factors: HealthFactor[] = [
    { key: 'revenue', label: 'Revenue', direction: revenueDir, sentiment: revenueWarn ? 'bad' : 'good', status: revenueWarn ? 'warn' : 'ok' },
    { key: 'expenses', label: 'Expenses', direction: expenseDir, sentiment: expenseWarn ? 'bad' : 'good', status: expenseWarn ? 'warn' : 'ok' },
    { key: 'cashFlow', label: 'Cash Flow', direction: cashFlowDir, sentiment: cashWarn ? 'bad' : 'good', status: cashWarn ? 'warn' : 'ok' },
    { key: 'renewals', label: 'Renewals', direction: renewalsDir, sentiment: renewalBad || renewalWarn ? 'bad' : 'good', status: renewalBad ? 'bad' : renewalWarn ? 'warn' : 'ok' },
    {
      key: 'dataQuality',
      label: 'Data Quality',
      direction: 'flat',
      sentiment: input.confidence.level === 'LOW' ? 'bad' : 'neutral',
      status: input.confidence.level === 'HIGH' ? 'ok' : input.confidence.level === 'MEDIUM' ? 'warn' : 'bad',
    },
  ];

  // A perfect score can't be claimed on data we don't trust. Cap the ceiling by
  // confidence so the score never contradicts a flagged Data Quality factor (a
  // clean-but-thin portfolio reads "provisional", not falsely perfect).
  const confidenceCap = input.confidence.level === 'HIGH' ? 100 : input.confidence.level === 'MEDIUM' ? 95 : 85;
  if (score > confidenceCap) {
    reasons.push(
      input.confidence.level === 'LOW'
        ? 'Limited data — health is a provisional estimate'
        : 'Some data still syncing — health is an estimate',
    );
  }
  const finalScore = clamp(Math.min(score, confidenceCap));

  return {
    score: finalScore,
    band: band(finalScore),
    factors,
    reasons: reasons.slice(0, 4),
    confidence: input.confidence,
  };
}

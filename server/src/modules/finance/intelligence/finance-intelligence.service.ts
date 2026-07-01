import { prisma } from '../../../infrastructure/database';
import { getFinancialSummary } from '../finance.service';
import { getRevenueAtRisk } from '../revenue-at-risk.service';
import { getBudgets } from '../budget.service';
import { getLateFeeForecast } from '../late-fee-forecast.service';
import { getPeriodComparison } from './financial-trend.service';
import { computeHealthScore } from './financial-health.service';
import { buildRecommendations } from './financial-recommendation.service';
import type { ChangeItem, FinancialIntelligence, Highlight } from './intelligence.types';

export async function getFinanceIntelligence(userId: string): Promise<FinancialIntelligence> {
  const [period, atRisk, budgetReport, lateFee, summary] = await Promise.all([
    getPeriodComparison(userId),
    getRevenueAtRisk(userId),
    getBudgets(userId),
    getLateFeeForecast(userId),
    getFinancialSummary(undefined, userId),
  ]);

  const overBudget = budgetReport.items.filter((b) => b.status === 'over');
  const worstBudgetVariancePct = overBudget.reduce<number | null>(
    (worst, b) => (b.variancePct != null && (worst == null || b.variancePct > worst) ? b.variancePct : worst),
    null,
  );

  const overBudgetPropertyIds = [...new Set(overBudget.map((b) => b.propertyId).filter((id): id is string => Boolean(id)))];
  const properties = overBudgetPropertyIds.length
    ? await prisma.property.findMany({ where: { id: { in: overBudgetPropertyIds }, ownerId: userId }, select: { id: true, name: true } })
    : [];
  const propertyNameById = Object.fromEntries(properties.map((p) => [p.id, p.name]));

  const revenueMetric = period.metrics.find((m) => m.key === 'revenue')!;
  const expenseMetric = period.metrics.find((m) => m.key === 'expenses')!;
  const netMetric = period.metrics.find((m) => m.key === 'netIncome')!;

  const health = computeHealthScore({
    monthlyRevenue: period.current.revenue,
    netCurrent: netMetric.current,
    revenueDeltaPct: revenueMetric.deltaPct,
    expenseDeltaPct: expenseMetric.deltaPct,
    expensesComparable: expenseMetric.comparable,
    atRisk: {
      totalAtRisk: atRisk.totalAtRisk,
      leaseCount: atRisk.leaseCount,
      highRiskCount: atRisk.highRiskCount,
      renewalsNotStarted: atRisk.renewalsNotStarted,
    },
    overBudgetCount: overBudget.length,
    worstBudgetVariancePct,
    overdueBalance: lateFee.overdueBalance,
    flaggedRecords: summary.flaggedRecords,
    confidence: netMetric.confidence,
  });

  const highlights: Highlight[] = [];
  if (atRisk.leaseCount > 0) {
    highlights.push({
      key: 'at-risk',
      kind: 'REVENUE_AT_RISK',
      count: atRisk.leaseCount,
      amount: atRisk.totalAtRisk,
      detail: null,
      tone: atRisk.highRiskCount > 0 ? 'critical' : 'warning',
      deepLink: null,
    });
  }
  if (overBudget.length > 0) {
    const only = overBudget.length === 1 ? overBudget[0] : null;
    const onlyName = only?.propertyId ? propertyNameById[only.propertyId] ?? null : null;
    highlights.push({
      key: 'over-budget',
      kind: 'OVER_BUDGET',
      count: overBudget.length,
      amount: null,
      detail: onlyName,
      tone: 'warning',
      deepLink: only ? `/finance?category=${encodeURIComponent(only.category)}` : '/finance',
    });
  }

  const sinceLastVisit: ChangeItem[] = [];
  if (revenueMetric.comparable) {
    sinceLastVisit.push({
      key: 'revenue',
      label: 'Revenue',
      amount: revenueMetric.deltaAbs,
      count: null,
      direction: revenueMetric.direction,
      sentiment: revenueMetric.sentiment,
    });
  }
  if (expenseMetric.comparable) {
    sinceLastVisit.push({
      key: 'expenses',
      label: 'Expenses',
      amount: expenseMetric.deltaAbs,
      count: null,
      direction: expenseMetric.direction,
      sentiment: expenseMetric.sentiment,
    });
  }
  sinceLastVisit.push({
    key: 'high-risk',
    label: 'High-risk leases',
    amount: null,
    count: atRisk.highRiskCount,
    direction: 'flat',
    sentiment: atRisk.highRiskCount > 0 ? 'bad' : 'good',
  });

  const recommendations = buildRecommendations({
    atRisk,
    budgets: budgetReport.items,
    lateFee,
    propertyNameById,
  });

  return {
    generatedAt: new Date().toISOString(),
    metrics: period.metrics,
    highlights,
    health,
    sinceLastVisit,
    recommendations,
  };
}

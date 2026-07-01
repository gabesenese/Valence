import { categoryLabel } from '../expense-categories';
import type { RevenueAtRisk } from '../revenue-at-risk.service';
import type { LateFeeForecast } from '../late-fee-forecast.service';
import type { BudgetVarianceItem } from '../budget.service';
import type { Confidence, Recommendation, Severity } from './intelligence.types';

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const MAX_RECOMMENDATIONS = 5;

const LEASE_CONFIDENCE: Confidence = { level: 'HIGH', basis: 'Based on your lease records' };
const BUDGET_CONFIDENCE: Confidence = { level: 'HIGH', basis: 'Based on your configured budgets' };

export interface RecommendationInput {
  atRisk: RevenueAtRisk;
  budgets: BudgetVarianceItem[];
  lateFee: LateFeeForecast;
  propertyNameById: Record<string, string>;
}

// Each candidate carries its raw magnitude so equal-severity recommendations rank
// by business impact ($/mo or % over budget) before the list is trimmed.
type Candidate = Omit<Recommendation, 'priority'> & { weight: number };

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const candidates: Candidate[] = [];

  for (const risk of input.atRisk.risks.slice(0, 2)) {
    const severity: Severity =
      risk.renewalRisk === 'CRITICAL' || risk.daysToExpiry <= 30
        ? 'HIGH'
        : risk.renewalRisk === 'HIGH'
          ? 'MEDIUM'
          : 'LOW';
    candidates.push({
      id: `renew-${risk.leaseId}`,
      title: `Renew ${risk.tenantName} at ${risk.propertyName}`,
      description: risk.reasons.slice(0, 3).join(' · '),
      impact: { value: risk.monthlyRent, unit: 'PER_MONTH' },
      severity,
      action: 'RENEW_LEASE',
      deepLink: `/leases/${risk.leaseId}`,
      confidence: LEASE_CONFIDENCE,
      weight: risk.monthlyRent,
    });
  }

  const overBudget = input.budgets
    .filter((b) => b.status === 'over')
    .sort((a, b) => (b.variancePct ?? 0) - (a.variancePct ?? 0))
    .slice(0, 2);

  for (const item of overBudget) {
    const pct = item.variancePct ?? 0;
    const severity: Severity = pct >= 25 ? 'HIGH' : pct >= 10 ? 'MEDIUM' : 'LOW';
    const propertyName = item.propertyId ? input.propertyNameById[item.propertyId] : null;
    candidates.push({
      id: `budget-${item.id}`,
      title: `${categoryLabel(item.category)} costs exceed budget`,
      description: propertyName ? `Over budget at ${propertyName}` : 'Over your monthly budget',
      impact: { value: pct, unit: 'PERCENT' },
      severity,
      action: 'REVIEW_BUDGET',
      deepLink: `/finance?category=${encodeURIComponent(item.category)}`,
      confidence: BUDGET_CONFIDENCE,
      weight: item.variance,
    });
  }

  if (input.lateFee.overdueBalance > 0) {
    candidates.push({
      id: 'collect-overdue',
      title: `Collect ${input.lateFee.overdueCount} overdue ${input.lateFee.overdueCount === 1 ? 'invoice' : 'invoices'}`,
      description:
        input.lateFee.chargeableCount > 0 ? `${input.lateFee.chargeableCount} past grace — late fees apply` : 'Rent past its due date',
      impact: { value: input.lateFee.overdueBalance, unit: 'ONCE' },
      severity: input.lateFee.chargeableCount > 0 ? 'HIGH' : 'MEDIUM',
      action: 'COLLECT',
      deepLink: '/finance?tab=ledger',
      confidence: LEASE_CONFIDENCE,
      weight: input.lateFee.overdueBalance,
    });
  }

  if (input.lateFee.unconfiguredCount > 0) {
    candidates.push({
      id: 'late-fee-policy',
      title: `Set a late-fee policy on ${input.lateFee.unconfiguredCount} overdue lease${input.lateFee.unconfiguredCount === 1 ? '' : 's'}`,
      description: 'Start capturing late-fee revenue on overdue rent',
      impact: null,
      severity: 'LOW',
      action: 'SET_LATE_FEE_POLICY',
      deepLink: input.lateFee.firstUnconfiguredLeaseId ? `/leases/${input.lateFee.firstUnconfiguredLeaseId}` : '/leases',
      confidence: LEASE_CONFIDENCE,
      weight: 0,
    });
  }

  candidates.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.weight - a.weight);

  return candidates.slice(0, MAX_RECOMMENDATIONS).map(({ weight: _weight, ...rec }, i) => ({
    ...rec,
    priority: i + 1,
  }));
}

import { getFinanceIntelligence } from '../finance/intelligence/finance-intelligence.service';
import { getForecastOutlook } from '../finance/intelligence/forecast-outlook.service';
import { getTenantProfitability } from '../finance/tenant-profitability.service';
import { getFinancialSummary } from '../finance/finance.service';
import type { MetricDelta } from '../finance/intelligence/intelligence.types';
import type { ForecastOutlook } from '../finance/intelligence/forecast-outlook.service';
import type { TenantProfitability } from '../finance/tenant-profitability.service';
import type { CopilotObservation, CopilotObservations, EvidenceRef, ObservationSeverity } from './copilot.types';

const SEVERITY_RANK: Record<ObservationSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };
const MAX_OBSERVATIONS = 5;

export interface ObservationSources {
  metrics: MetricDelta[];
  forecast: ForecastOutlook;
  tenants: TenantProfitability[];
  flaggedRecords: number;
  generatedAt: string;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function ev(factId: string, label: string, value: string, source: string, confidence: EvidenceRef['confidence']): EvidenceRef {
  return { factId, label, value, source, confidence };
}

/**
 * Cross-tab observations: patterns that no single Finance tab surfaces because
 * each requires correlating signals across tabs (Overview trends × Expenses,
 * Forecast timing, Profitability concentration, Ledger trust). Fully
 * deterministic — every figure is computed by Valence, so there is nothing to
 * fabricate and nothing to trace-check. The Copilot add-on gates access; the
 * intelligence itself never guesses.
 */
export function deriveObservations(s: ObservationSources): CopilotObservations {
  const observations: CopilotObservation[] = [];

  const revenue = s.metrics.find((m) => m.key === 'revenue');
  const expenses = s.metrics.find((m) => m.key === 'expenses');
  if (
    revenue?.comparable &&
    expenses?.comparable &&
    expenses.direction === 'up' &&
    expenses.deltaPct != null &&
    expenses.deltaPct >= 5 &&
    (revenue.direction !== 'up' || (revenue.deltaPct ?? 0) < expenses.deltaPct)
  ) {
    const revClause =
      revenue.direction === 'down'
        ? `revenue fell ${Math.abs(revenue.deltaPct ?? 0)}%`
        : revenue.direction === 'flat'
          ? 'revenue held flat'
          : `revenue rose only ${revenue.deltaPct}%`;
    observations.push({
      id: 'margin-compression',
      title: 'Margin is compressing',
      detail: `Expenses climbed ${expenses.deltaPct}% month-over-month while ${revClause}. The gap is squeezing net income — the pressure is on cost, not revenue.`,
      severity: expenses.deltaPct >= 15 ? 'HIGH' : 'MEDIUM',
      evidence: [
        ev('metric.revenue', 'Revenue', `${money(revenue.current)} (${revenue.direction} ${Math.abs(revenue.deltaPct ?? 0)}% MoM)`, 'finance/period-comparison', revenue.confidence.level),
        ev('metric.expenses', 'Expenses', `${money(expenses.current)} (up ${expenses.deltaPct}% MoM)`, 'finance/period-comparison', expenses.confidence.level),
      ],
      action: { label: 'Review expenses', deepLink: '/finance?tab=expenses' },
    });
  }

  if (s.forecast.totalRevenueAtRisk > 0) {
    const peak = s.forecast.timeline.reduce((a, b) => (b.revenueAtRisk > a.revenueAtRisk ? b : a));
    const share = peak.revenueAtRisk / s.forecast.totalRevenueAtRisk;
    if (peak.expiringCount >= 2 && share > 0.5) {
      observations.push({
        id: 'renewal-cliff',
        title: `Renewal cliff in ${peak.month}`,
        detail: `${pct(share)} of your ${s.forecast.horizonMonths}-month expiring rent — ${money(peak.revenueAtRisk)}/mo across ${peak.expiringCount} leases — lands in ${peak.month}. Start those renewals early so they don't slip at once.`,
        severity: share >= 0.75 ? 'HIGH' : 'MEDIUM',
        evidence: [
          ev('forecast.peak', `Expirations in ${peak.month}`, `${money(peak.revenueAtRisk)}/mo across ${peak.expiringCount} leases`, 'finance/forecast-outlook', s.forecast.confidence.level),
        ],
        action: { label: 'Open forecast', deepLink: '/finance?tab=forecast' },
      });
    }
  }

  const totalRent = s.tenants.reduce((sum, t) => sum + t.monthlyRent, 0);
  if (totalRent > 0 && s.tenants.length >= 3) {
    const top = s.tenants.reduce((a, b) => (b.monthlyRent > a.monthlyRent ? b : a));
    const share = top.monthlyRent / totalRent;
    if (share >= 0.3) {
      observations.push({
        id: 'tenant-concentration',
        title: `${top.tenantName} is a concentration risk`,
        detail: `One tenant — ${top.tenantName} — is ${pct(share)} of your rent roll at ${money(top.monthlyRent)}/mo. Losing them would hit revenue disproportionately, so weight their renewal accordingly.`,
        severity: share >= 0.5 ? 'HIGH' : 'MEDIUM',
        evidence: [
          ev(`tenant.${top.tenantId}`, top.tenantName, `${money(top.monthlyRent)}/mo · ${pct(share)} of rent roll`, 'finance/tenant-profitability', 'MEDIUM'),
        ],
        action: { label: 'View profitability', deepLink: '/finance?tab=profitability' },
      });
    }
  }

  if (s.flaggedRecords > 0) {
    const n = s.flaggedRecords;
    observations.push({
      id: 'ledger-trust',
      title: 'Some figures rest on unreviewed records',
      detail: `${n} flagged record${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} still awaiting review. Clear ${n === 1 ? 'it' : 'them'} so every number above is fully trustworthy.`,
      severity: 'LOW',
      evidence: [ev('ledger.flagged', 'Records flagged for review', `${n} awaiting review`, 'finance/ledger', 'HIGH')],
      action: { label: 'Open ledger', deepLink: '/finance?tab=ledger' },
    });
  }

  observations.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return { observations: observations.slice(0, MAX_OBSERVATIONS), generatedAt: s.generatedAt };
}

export async function generateObservations(userId: string): Promise<CopilotObservations> {
  const [intel, forecast, profitability, summary] = await Promise.all([
    getFinanceIntelligence(userId),
    getForecastOutlook(userId),
    getTenantProfitability(userId),
    getFinancialSummary(undefined, userId),
  ]);

  return deriveObservations({
    metrics: intel.metrics,
    forecast,
    tenants: profitability.tenants,
    flaggedRecords: summary.flaggedRecords,
    generatedAt: intel.generatedAt,
  });
}

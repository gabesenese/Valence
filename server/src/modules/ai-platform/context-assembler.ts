import { getFinanceIntelligence } from '../finance/intelligence/finance-intelligence.service';
import { getForecastOutlook } from '../finance/intelligence/forecast-outlook.service';
import { getTenantProfitability } from '../finance/tenant-profitability.service';
import { getFinancialSummary } from '../finance/finance.service';
import type { Impact } from '../finance/intelligence/intelligence.types';
import type { ContextFact, FinanceContext } from './copilot.types';

const TENANT_CAP = 12;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function impactText(impact: Impact): string {
  if (impact.unit === 'PERCENT') return `${impact.value}%`;
  const suffix = impact.unit === 'PER_MONTH' ? '/mo' : '';
  return `${money(impact.value)}${suffix}`;
}

export async function assembleFinanceContext(userId: string): Promise<FinanceContext> {
  const [intel, profitability, forecast, summary] = await Promise.all([
    getFinanceIntelligence(userId),
    getTenantProfitability(userId),
    getForecastOutlook(userId),
    getFinancialSummary(undefined, userId),
  ]);
  const facts: ContextFact[] = [];

  for (const m of intel.metrics) {
    const delta = m.comparable && m.deltaPct != null ? ` (${m.direction} ${Math.abs(m.deltaPct)}% vs prior month)` : '';
    facts.push({
      factId: `metric.${m.key}`,
      label: m.label,
      value: `${money(m.current)}${delta}`,
      numeric: m.current,
      source: 'finance/period-comparison',
      confidence: m.confidence.level,
      deepLink: null,
    });
  }

  facts.push({
    factId: 'health.score',
    label: 'Financial health',
    value: `${intel.health.score}/100 (${intel.health.band})`,
    numeric: intel.health.score,
    source: 'finance/health',
    confidence: intel.health.confidence.level,
    deepLink: null,
  });

  for (const h of intel.highlights) {
    facts.push({
      factId: `highlight.${h.key}`,
      label: h.detail ? `${h.kind} — ${h.detail}` : h.kind,
      value: h.amount != null ? `${h.count} (${money(h.amount)})` : `${h.count}`,
      numeric: h.amount,
      source: 'finance/highlights',
      confidence: 'HIGH',
      deepLink: null,
    });
  }

  for (const r of intel.recommendations) {
    facts.push({
      factId: `rec.${r.id}`,
      label: r.title,
      value: r.impact ? `${r.description} — impact ${impactText(r.impact)}` : r.description,
      numeric: r.impact?.value ?? null,
      source: 'finance/recommendations',
      confidence: r.confidence.level,
      deepLink: r.deepLink,
    });
  }

  const expiringCount = forecast.timeline.reduce((n, m) => n + m.expiringCount, 0);
  if (expiringCount > 0 && forecast.totalRevenueAtRisk > 0) {
    const peak = forecast.timeline.reduce((a, b) => (b.revenueAtRisk > a.revenueAtRisk ? b : a));
    facts.push({
      factId: 'forecast.expirations',
      label: `Lease expirations (${forecast.horizonMonths}-month outlook)`,
      value: `${money(forecast.totalRevenueAtRisk)}/mo across ${expiringCount} lease${expiringCount === 1 ? '' : 's'}; heaviest ${peak.month} (${peak.expiringCount})`,
      numeric: forecast.totalRevenueAtRisk,
      source: 'finance/forecast-outlook',
      confidence: forecast.confidence.level,
      deepLink: '/finance?tab=forecast',
    });
  }

  if (summary.flaggedRecords > 0) {
    facts.push({
      factId: 'ledger.flagged',
      label: 'Records flagged for review',
      value: `${summary.flaggedRecords} record${summary.flaggedRecords === 1 ? '' : 's'} awaiting review`,
      numeric: summary.flaggedRecords,
      source: 'finance/ledger',
      confidence: 'HIGH',
      deepLink: '/finance?tab=ledger',
    });
  }

  const tenants: ContextFact[] = [...profitability.tenants]
    .sort((a, b) => a.net - b.net)
    .slice(0, TENANT_CAP)
    .map((t) => ({
      factId: `tenant.${t.tenantId}`,
      label: t.tenantName,
      value: `${money(t.monthlyRent)}/mo rent · ${money(t.net)} net after costs · ${t.marginPct}% margin`,
      numeric: t.net,
      source: 'finance/tenant-profitability',
      confidence: 'MEDIUM',
      deepLink: '/finance?tab=profitability',
    }));

  return {
    generatedAt: intel.generatedAt,
    healthScore: intel.health.score,
    healthBand: intel.health.band,
    facts,
    tenants,
  };
}

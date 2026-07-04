import { describe, it, expect } from 'vitest';
import { verifyTraceability } from '../modules/ai-platform/traceability';
import type { EvidenceRef } from '../modules/ai-platform/copilot.types';

const evidence: EvidenceRef[] = [
  { factId: 'metric.revenue', label: 'Revenue', value: '$42,000 (up 3% vs prior month)', source: 'finance/period-comparison', confidence: 'HIGH' },
  { factId: 'highlight.at-risk', label: 'REVENUE_AT_RISK', value: '2 ($12,500)', source: 'finance/highlights', confidence: 'HIGH' },
];

describe('copilot traceability guard', () => {
  it('accepts an answer whose figures all trace to evidence', () => {
    const answer = 'Revenue is $42,000. You have $12,500 at risk across 2 leases.';
    expect(verifyTraceability(answer, evidence).ok).toBe(true);
  });

  it('rejects an answer that invents a dollar figure', () => {
    const answer = 'Revenue is $42,000 but you could lose $99,999 next quarter.';
    const result = verifyTraceability(answer, evidence);
    expect(result.ok).toBe(false);
    expect(result.unbacked).toContain('$99,999');
  });

  it('is insensitive to spacing and thousands separators', () => {
    const answer = 'At risk: $ 12500.';
    expect(verifyTraceability(answer, evidence).ok).toBe(true);
  });

  it('passes when the answer cites no figures at all', () => {
    expect(verifyTraceability('Your portfolio looks stable this month.', evidence).ok).toBe(true);
  });
});

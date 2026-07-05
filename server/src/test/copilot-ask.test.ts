import { describe, it, expect } from 'vitest';
import { evidenceReferencedBy } from '../modules/ai-platform/copilot-ask.service';
import type { EvidenceRef } from '../modules/ai-platform/copilot.types';

const evidence: EvidenceRef[] = [
  { factId: 'metric.revenue', label: 'Revenue', value: '$42,000 (up 3% vs prior month)', source: 'finance/period-comparison', confidence: 'HIGH' },
  { factId: 'highlight.at-risk', label: 'Revenue at risk', value: '2 ($12,500)', source: 'finance/highlights', confidence: 'HIGH' },
  { factId: 'rec.budget', label: 'Review Maple St budget', value: 'Over by 14%', source: 'finance/recommendations', confidence: 'MEDIUM' },
];

describe('Ask Valence evidence grounding', () => {
  it('links evidence by a cited dollar figure', () => {
    const refs = evidenceReferencedBy(evidence, 'You have $12,500 at risk across 2 leases.');
    expect(refs.map((r) => r.factId)).toContain('highlight.at-risk');
  });

  it('links evidence by label keyword', () => {
    const refs = evidenceReferencedBy(evidence, 'Your revenue looks stable this month.');
    expect(refs.map((r) => r.factId)).toContain('metric.revenue');
  });

  it('returns nothing when the answer references no known fact', () => {
    const refs = evidenceReferencedBy(evidence, 'I cannot answer that from your data.');
    expect(refs).toHaveLength(0);
  });

  it('caps referenced evidence at six', () => {
    const many: EvidenceRef[] = Array.from({ length: 10 }, (_, i) => ({
      factId: `f${i}`, label: 'Revenue', value: '$1', source: 's', confidence: 'HIGH',
    }));
    expect(evidenceReferencedBy(many, 'revenue').length).toBeLessThanOrEqual(6);
  });
});

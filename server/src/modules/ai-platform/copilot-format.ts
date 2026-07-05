import type { ContextFact, CopilotAction, EvidenceRef } from './copilot.types';

export function toEvidence(facts: ContextFact[]): EvidenceRef[] {
  return facts.map((f) => ({
    factId: f.factId,
    label: f.label,
    value: f.value,
    source: f.source,
    confidence: f.confidence,
  }));
}

export function toActions(facts: ContextFact[]): CopilotAction[] {
  const seen = new Set<string>();
  const actions: CopilotAction[] = [];
  for (const f of facts) {
    if (!f.deepLink || seen.has(f.deepLink)) continue;
    seen.add(f.deepLink);
    actions.push({ label: f.label, deepLink: f.deepLink });
  }
  return actions.slice(0, 4);
}

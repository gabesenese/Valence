import { assembleFinanceContext } from './context-assembler';
import { verifyTraceability } from './traceability';
import { getProvider } from './provider';
import { logAiUsage } from './usage-log';
import { toActions, toEvidence } from './copilot-format';
import type { ContextFact, CopilotResponse } from './copilot.types';

const FEATURE = 'finance_copilot_brief';

const BAND_PHRASE: Record<string, string> = { HEALTHY: 'healthy', WATCH: 'worth watching', AT_RISK: 'at risk' };

function deterministicAnswer(facts: ContextFact[], healthScore: number, healthBand: string): string {
  const health = `Your finances are ${BAND_PHRASE[healthBand] ?? healthBand.toLowerCase()} at ${healthScore}/100.`;
  const recs = facts.filter((f) => f.factId.startsWith('rec.'));

  if (recs.length === 0) return `${health} Nothing needs action right now.`;

  const top = recs[0];
  if (recs.length === 1) return `${health} The one move that matters is ${top.label.toLowerCase()} — ${top.value}.`;

  const others = recs.length - 1;
  return `${health} ${top.label} outranks the ${others} other open item${others > 1 ? 's' : ''} because it carries the largest impact (${top.value}) — handle it before the rest.`;
}

function buildDeterministicBrief(
  facts: ContextFact[],
  healthScore: number,
  healthBand: string,
  generatedAt: string,
): CopilotResponse {
  const evidence = toEvidence(facts);
  const lowConfidence = facts.filter((f) => f.confidence !== 'HIGH').map((f) => f.label);

  return {
    answer: deterministicAnswer(facts, healthScore, healthBand),
    evidence,
    actions: toActions(facts),
    confidence: lowConfidence.length
      ? { level: 'PARTIAL', limitations: [`Lower-confidence inputs: ${lowConfidence.join(', ')}`] }
      : { level: 'COMPLETE' },
    generatedAt,
    degraded: true,
  };
}

const SYSTEM_PROMPT = `You are Valence Copilot, an analyst explaining a property portfolio's finances to its owner.
You are given deterministic FACTS already computed and already shown to the owner on screen.
Write a TIGHT analysis: 2 sentences, 45 words MAX. Brevity is the point — a busy owner skims this.
Your job is to EXPLAIN, not to repeat. The owner can already see the list of priorities and figures.
Hard rules:
- Use ONLY numbers present in the FACTS. Never invent, estimate, or round to a different figure.
- Do NOT restate the priority list ("Renew X, collect Y") — the owner sees that already.
- Sentence 1: the health read in a few words. Sentence 2: the ONE comparative reason the top action outranks the rest.
- No filler. Never write closing sentences like "By addressing this..." or "This suggests...". Stop once the point is made.
- Analyst voice: direct, specific, no hedging, no marketing.
Return plain prose only.`;

export async function generateCopilotBrief(userId: string): Promise<CopilotResponse> {
  const ctx = await assembleFinanceContext(userId);
  const deterministic = buildDeterministicBrief(ctx.facts, ctx.healthScore, ctx.healthBand, ctx.generatedAt);

  const provider = getProvider();
  if (!provider.available()) return deterministic;

  const factBlock = ctx.facts.map((f) => `- ${f.label}: ${f.value}`).join('\n');

  try {
    const result = await provider.generate({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `FACTS:\n${factBlock}` }],
      temperature: 0.3,
      maxTokens: 140,
    });

    void logAiUsage({ userId, feature: FEATURE, provider: result.provider, model: result.model, usage: result.usage });

    const answer = result.text.trim();
    const trace = verifyTraceability(answer, deterministic.evidence);
    if (!answer || !trace.ok) return deterministic;

    return { ...deterministic, answer, degraded: false };
  } catch {
    return deterministic;
  }
}

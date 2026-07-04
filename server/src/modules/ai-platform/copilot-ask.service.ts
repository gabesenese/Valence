import { prisma } from '../../infrastructure/database';
import { AppError } from '../../utils/errors';
import { assembleFinanceContext } from './context-assembler';
import { verifyTraceability } from './traceability';
import { getProvider } from './provider';
import { logAiUsage } from './usage-log';
import { toActions, toEvidence } from './copilot-format';
import type { CopilotResponse, EvidenceRef } from './copilot.types';

const FEATURE = 'finance_copilot_ask';
const DAILY_LIMIT = 100;

const MONEY_TOKEN = /\$\s?[\d,]+(?:\.\d+)?/g;
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'your', 'from', 'are', 'has']);

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Fair-use guard, not billing. The Copilot add-on is flat-priced, so this caps
 * abusive volume without coupling Ask to the tier's AI quota. Counted from the
 * internal AiUsageLog, bounded to the current UTC day.
 */
export async function assertAskQuota(userId: string): Promise<void> {
  const usedToday = await prisma.aiUsageLog.count({
    where: { userId, feature: FEATURE, createdAt: { gte: startOfUtcDay() } },
  });
  if (usedToday >= DAILY_LIMIT) {
    throw new AppError(`You've reached today's limit of ${DAILY_LIMIT} Copilot questions. It resets tomorrow.`, 429, 'RATE_LIMITED');
  }
}

/**
 * Which evidence actually grounds the answer — the money figures it cites, plus
 * facts whose label words the answer mentions. Keeps the source chips honest
 * instead of dumping the whole context.
 */
export function evidenceReferencedBy(evidence: EvidenceRef[], answer: string): EvidenceRef[] {
  const answerLower = answer.toLowerCase();
  const answerMoney = new Set((answer.match(MONEY_TOKEN) ?? []).map((t) => t.replace(/[\s,]/g, '')));

  const referenced = evidence.filter((e) => {
    const eMoney = (e.value.match(MONEY_TOKEN) ?? []).map((t) => t.replace(/[\s,]/g, ''));
    if (eMoney.some((m) => answerMoney.has(m))) return true;
    return e.label
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((w) => w.length > 2 && !STOPWORDS.has(w) && answerLower.includes(w));
  });

  return referenced.slice(0, 6);
}

const ASK_SYSTEM = `You are Valence Copilot answering a property portfolio owner's question.
You are given deterministic FACTS already computed by Valence. Answer the QUESTION using ONLY those FACTS.
Hard rules:
- Use ONLY numbers written verbatim in the FACTS. Never invent, estimate, or infer a figure that is not present.
- If the FACTS do not contain what's needed to answer, say so plainly in one sentence and suggest which Finance area to check. Do not guess.
- Be concise (1-4 sentences), specific, and direct. No hedging, no marketing.
Return plain prose only.`;

const UNAVAILABLE = 'Ask Valence is temporarily unavailable. Your Finance numbers are unaffected — the deterministic dashboards are all still accurate.';

export async function answerFinanceQuestion(userId: string, question: string): Promise<CopilotResponse> {
  const ctx = await assembleFinanceContext(userId);
  const allFacts = [...ctx.facts, ...ctx.tenants];
  const evidence = toEvidence(allFacts);
  const actions = toActions(allFacts);
  const generatedAt = new Date().toISOString();

  const provider = getProvider();
  if (!provider.available()) {
    return { answer: UNAVAILABLE, evidence: [], actions, confidence: { level: 'PARTIAL', limitations: ['AI narration unavailable'] }, generatedAt, degraded: true };
  }

  const portfolioBlock = ctx.facts.map((f) => `- ${f.label}: ${f.value}`).join('\n');
  const tenantBlock = ctx.tenants.length
    ? `\n\nPER-TENANT PERFORMANCE (net = rent minus allocated costs; lower net = worse performing):\n${ctx.tenants.map((f) => `- ${f.label}: ${f.value}`).join('\n')}`
    : '';
  const factBlock = `${portfolioBlock}${tenantBlock}`;

  try {
    const result = await provider.generate({
      system: ASK_SYSTEM,
      messages: [{ role: 'user', content: `FACTS:\n${factBlock}\n\nQUESTION: ${question}` }],
      temperature: 0.2,
      maxTokens: 400,
    });

    void logAiUsage({ userId, feature: FEATURE, provider: result.provider, model: result.model, usage: result.usage });

    const answer = result.text.trim();
    const trace = verifyTraceability(answer, evidence);
    if (!answer || !trace.ok) {
      return {
        answer: "I can't answer that from your Finance data with confidence — I won't guess at a number. Try rephrasing, or open the relevant Finance tab.",
        evidence: [],
        actions,
        confidence: { level: 'PARTIAL', limitations: ['Could not ground the answer in your data'] },
        generatedAt,
        degraded: true,
      };
    }

    const referenced = evidenceReferencedBy(evidence, answer);
    return {
      answer,
      evidence: referenced,
      actions,
      confidence: referenced.length ? { level: 'COMPLETE' } : { level: 'PARTIAL', limitations: ['Answer not tied to a specific figure'] },
      generatedAt,
      degraded: false,
    };
  } catch {
    return { answer: UNAVAILABLE, evidence: [], actions, confidence: { level: 'PARTIAL', limitations: ['AI narration unavailable'] }, generatedAt, degraded: true };
  }
}

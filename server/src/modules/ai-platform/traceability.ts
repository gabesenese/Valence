import type { EvidenceRef } from './copilot.types';

const MONEY_TOKEN = /\$\s?[\d,]+(?:\.\d+)?/g;

function normalizeMoney(token: string): string {
  return token.replace(/[\s,]/g, '').replace(/\.0+$/, '');
}

/**
 * Guards the analyst voice against inventing numbers. Every dollar figure the
 * model writes must trace back to a deterministic evidence value — otherwise the
 * answer is untrustworthy and the caller falls back to the deterministic brief.
 * We only police money tokens: those are the figures a hallucination would fake,
 * and the deterministic layer owns every one of them.
 */
export function verifyTraceability(
  answer: string,
  evidence: EvidenceRef[],
): { ok: boolean; unbacked: string[] } {
  const backed = new Set(
    evidence.flatMap((e) => (e.value.match(MONEY_TOKEN) ?? []).map(normalizeMoney)),
  );

  const unbacked = [...(answer.match(MONEY_TOKEN) ?? [])]
    .filter((token) => !backed.has(normalizeMoney(token)));

  return { ok: unbacked.length === 0, unbacked };
}

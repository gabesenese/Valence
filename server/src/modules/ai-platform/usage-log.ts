import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';
import type { AiProviderName, AiUsage } from './provider';

/**
 * Best-effort per-1M-token cost estimate (USD) for internal cost tracking.
 * Derived deterministically from token counts × published rates; unknown models
 * cost 0. This is an ops metric, never shown to customers.
 */
const RATE_PER_MILLION: Record<string, { input: number; output: number }> = {
  'llama-3.3-70b-versatile':   { input: 0.59, output: 0.79 },
  'anthropic/claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  mock:                        { input: 0, output: 0 },
};

export function estimateCostUsd(model: string, usage: AiUsage): number {
  const rate = RATE_PER_MILLION[model];
  if (!rate) return 0;
  const cost = (usage.promptTokens / 1_000_000) * rate.input
    + (usage.completionTokens / 1_000_000) * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface AiUsageEntry {
  userId: string;
  feature: string;
  provider: AiProviderName;
  model: string;
  usage: AiUsage;
}

export async function logAiUsage(entry: AiUsageEntry): Promise<void> {
  const costUsd = estimateCostUsd(entry.model, entry.usage);
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: entry.userId,
        feature: entry.feature,
        provider: entry.provider,
        model: entry.model,
        promptTokens: entry.usage.promptTokens,
        completionTokens: entry.usage.completionTokens,
        costUsd,
      },
    });
  } catch (err) {
    logger.warn('Failed to record AI usage', { error: (err as Error).message, feature: entry.feature });
  }
}

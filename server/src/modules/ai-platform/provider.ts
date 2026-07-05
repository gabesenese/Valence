import Groq from 'groq-sdk';
import { env } from '../../config/env';

export type AiProviderName = 'mock' | 'groq' | 'anthropic';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiGenerateParams {
  system?: string;
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface AiResult {
  text: string;
  usage: AiUsage;
  provider: AiProviderName;
  model: string;
}

/**
 * Generic AI provider contract. Every Finance Copilot feature talks to this,
 * never to a specific SDK — so we can swap Groq / Anthropic-via-Gateway per
 * feature without touching feature code. Concrete prompts + tool-calling land
 * with the Copilot features (Phase 1+); Phase 0A ships the abstraction, the
 * providers we can verify today (mock, groq), and cost logging.
 */
export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  available(): boolean;
  generate(params: AiGenerateParams): Promise<AiResult>;
}


class MockProvider implements AiProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock';
  available(): boolean {
    return true;
  }
  async generate(params: AiGenerateParams): Promise<AiResult> {
    const last = params.messages[params.messages.length - 1]?.content ?? '';
    return {
      text: `[mock] ${last.slice(0, 200)}`,
      usage: { promptTokens: 0, completionTokens: 0 },
      provider: this.name,
      model: this.model,
    };
  }
}


class GroqProvider implements AiProvider {
  readonly name = 'groq' as const;
  readonly model = 'llama-3.3-70b-versatile';
  private client: Groq | null = null;

  available(): boolean {
    return Boolean(env.GROQ_API_KEY);
  }

  private getClient(): Groq {
    if (!env.GROQ_API_KEY) throw new Error('Groq is not configured (missing GROQ_API_KEY)');
    if (!this.client) this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    return this.client;
  }

  async generate(params: AiGenerateParams): Promise<AiResult> {
    const messages: AiMessage[] = params.system
      ? [{ role: 'system', content: params.system }, ...params.messages]
      : params.messages;

    const resp = await this.getClient().chat.completions.create({
      model: this.model,
      messages,
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxTokens ?? 1024,
    });

    return {
      text: resp.choices[0]?.message?.content ?? '',
      usage: {
        promptTokens: resp.usage?.prompt_tokens ?? 0,
        completionTokens: resp.usage?.completion_tokens ?? 0,
      },
      provider: this.name,
      model: this.model,
    };
  }
}


/**
 * Anthropic (via the Vercel AI Gateway) — the intended premium provider for
 * Copilot. Wired for real in Phase 1 alongside the first prompts, so it can be
 * exercised against a live key. Until then it advertises availability from env
 * but fails loudly rather than shipping an unverified integration.
 */
class AnthropicGatewayProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  readonly model = 'anthropic/claude-sonnet-4-6';
  available(): boolean {
    return Boolean(env.AI_GATEWAY_API_KEY || env.ANTHROPIC_API_KEY);
  }
  async generate(_params: AiGenerateParams): Promise<AiResult> {
    throw new Error('Anthropic provider is not wired yet — lands with Finance Copilot Phase 1.');
  }
}


const PROVIDERS: Record<AiProviderName, AiProvider> = {
  mock: new MockProvider(),
  groq: new GroqProvider(),
  anthropic: new AnthropicGatewayProvider(),
};

export function getProvider(name: AiProviderName = env.AI_PROVIDER): AiProvider {
  return PROVIDERS[name];
}

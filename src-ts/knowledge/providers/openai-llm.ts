/**
 * Knowledge module - OpenAI LLM Provider
 *
 * Implements the LLMProvider interface using the OpenAI API.
 * Supports streaming responses and model tier routing.
 */

import type { LLMResponse, StreamChunk, TokenUsage } from '../models';
import {
  ModelTier,
  ProviderType,
  createTokenUsage,
  createLLMResponse,
  RateLimitError,
  TokenLimitError,
  ProviderUnavailableError,
} from '../models';

// ============================================================
// Default model mapping
// ============================================================

export const DEFAULT_MODEL_MAPPING: Record<string, string> = {
  [ModelTier.FAST]: 'gpt-4o-mini',
  [ModelTier.DEFAULT]: 'gpt-4o',
  [ModelTier.POWERFUL]: 'gpt-4-turbo',
};

// ============================================================
// Model pricing (USD per 1K tokens)
// ============================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

// ============================================================
// OpenAI API types (minimal)
// ============================================================

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: { content: string | null };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta: { content?: string };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================
// OpenAI LLM Provider
// ============================================================

export class OpenAILLMProvider {
  private readonly _apiKey: string | null;
  private readonly _baseUrl: string | null;
  private readonly _organization: string | null;
  private readonly _timeout: number;
  private readonly _maxRetries: number;
  private readonly _modelMapping: Record<string, string>;

  constructor(params: {
    apiKey?: string | null;
    baseUrl?: string | null;
    organization?: string | null;
    modelMapping?: Record<string, string> | null;
    timeout?: number;
    maxRetries?: number;
  }) {
    this._apiKey = params.apiKey ?? process.env.OPENAI_API_KEY ?? null;
    this._baseUrl = params.baseUrl ?? null;
    this._organization = params.organization ?? null;
    this._timeout = params.timeout ?? 60.0;
    this._maxRetries = params.maxRetries ?? 3;
    this._modelMapping = params.modelMapping ?? { ...DEFAULT_MODEL_MAPPING };
  }

  get providerType(): string {
    return ProviderType.OPENAI;
  }

  getModelForTier(tier: string): string {
    return this._modelMapping[tier] ?? this._modelMapping[ModelTier.DEFAULT];
  }

  private _getApiUrl(): string {
    const base = this._baseUrl ?? 'https://api.openai.com/v1';
    return `${base.replace(/\/$/, '')}/chat/completions`;
  }

  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this._apiKey) {
      headers['Authorization'] = `Bearer ${this._apiKey}`;
    }
    if (this._organization) {
      headers['OpenAI-Organization'] = this._organization;
    }
    return headers;
  }

  /**
   * Execute completion request
   */
  async complete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
      responseFormat?: Record<string, unknown>;
    },
  ): Promise<LLMResponse> {
    const messages: OpenAIChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens != null) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.stopSequences && options.stopSequences.length > 0) {
      body.stop = options.stopSequences;
    }
    if (options?.responseFormat?.type === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const startTime = performance.now();
    let response: Response;
    try {
      response = await fetch(this._getApiUrl(), {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this._timeout * 1000),
      });
    } catch (e) {
      this._handleAPIError(e as Error);
      // Unreachable, but satisfies TypeScript
      throw e;
    }

    if (!response.ok) {
      const errorText = await response.text();
      this._handleAPIError(new Error(errorText));
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const latencyMs = Math.round(performance.now() - startTime);

    const content = data.choices[0]?.message?.content ?? '';

    const usage = createTokenUsage({
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      estimatedCost: this._estimateCost(
        model,
        data.usage?.prompt_tokens ?? 0,
        data.usage?.completion_tokens ?? 0,
      ),
    });

    return createLLMResponse({
      content,
      modelUsed: model,
      provider: ProviderType.OPENAI,
      usage,
      latencyMs,
      cached: false,
    });
  }

  /**
   * Execute streaming completion request
   */
  async *streamComplete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    },
  ): AsyncGenerator<StreamChunk, void, undefined> {
    const messages: OpenAIChatMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (options?.maxTokens != null) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.stopSequences && options.stopSequences.length > 0) {
      body.stop = options.stopSequences;
    }

    let response: Response;
    try {
      response = await fetch(this._getApiUrl(), {
        method: 'POST',
        headers: this._buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this._timeout * 1000),
      });
    } catch (e) {
      this._handleAPIError(e as Error);
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      this._handleAPIError(new Error(errorText));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(dataStr) as OpenAIStreamChunk;

            if (chunk.choices?.[0]?.delta?.content) {
              yield {
                content: chunk.choices[0].delta.content,
                isFinal: false,
                usage: null,
              };
            }

            if (chunk.usage) {
              yield {
                content: '',
                isFinal: true,
                usage: createTokenUsage({
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }),
              };
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (e) {
      this._handleAPIError(e as Error);
    }
  }

  /**
   * Check provider health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.complete('Hi', this.getModelForTier(ModelTier.FAST), {
        temperature: 0,
        maxTokens: 5,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle API errors and convert to unified error types
   */
  private _handleAPIError(error: Error): never {
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('rate') || errorMsg.includes('limit')) {
      throw new RateLimitError(error.message, ProviderType.OPENAI);
    }
    if (errorMsg.includes('token') || errorMsg.includes('length')) {
      throw new TokenLimitError(error.message, ProviderType.OPENAI);
    }
    throw new ProviderUnavailableError(error.message, ProviderType.OPENAI);
  }

  /**
   * Estimate request cost
   */
  private _estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? { input: 0, output: 0 };
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
  }
}

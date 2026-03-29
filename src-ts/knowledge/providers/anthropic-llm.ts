/**
 * Knowledge module - Anthropic LLM Provider
 *
 * Implements the LLMProvider interface using the Anthropic API.
 * Supports Claude series models and streaming responses.
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
  [ModelTier.FAST]: 'claude-3-haiku-20240307',
  [ModelTier.DEFAULT]: 'claude-3-5-sonnet-20241022',
  [ModelTier.POWERFUL]: 'claude-3-opus-20240229',
};

// ============================================================
// Model pricing (USD per 1M tokens)
// ============================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
};

// ============================================================
// Anthropic API types (minimal)
// ============================================================

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { text?: string; stop_reason?: string };
  message?: AnthropicMessageResponse;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================
// Anthropic LLM Provider
// ============================================================

export class AnthropicLLMProvider {
  private readonly _apiKey: string | null;
  private readonly _baseUrl: string | null;
  private readonly _timeout: number;
  private readonly _maxRetries: number;
  private readonly _modelMapping: Record<string, string>;

  constructor(params: {
    apiKey?: string | null;
    baseUrl?: string | null;
    modelMapping?: Record<string, string> | null;
    timeout?: number;
    maxRetries?: number;
  }) {
    this._apiKey = params.apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
    this._baseUrl = params.baseUrl ?? null;
    this._timeout = params.timeout ?? 60.0;
    this._maxRetries = params.maxRetries ?? 3;
    this._modelMapping = params.modelMapping ?? { ...DEFAULT_MODEL_MAPPING };
  }

  get providerType(): string {
    return ProviderType.ANTHROPIC;
  }

  getModelForTier(tier: string): string {
    return this._modelMapping[tier] ?? this._modelMapping[ModelTier.DEFAULT];
  }

  private _getApiUrl(): string {
    const base = this._baseUrl ?? 'https://api.anthropic.com/v1';
    return `${base.replace(/\/$/, '')}/messages`;
  }

  private _buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this._apiKey ?? '',
      'anthropic-version': '2023-06-01',
    };
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
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }
    if (options?.stopSequences && options.stopSequences.length > 0) {
      body.stop_sequences = options.stopSequences;
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
      throw e;
    }

    if (!response.ok) {
      const errorText = await response.text();
      this._handleAPIError(new Error(errorText));
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const latencyMs = Math.round(performance.now() - startTime);

    let content = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.text) {
          content += block.text;
        }
      }
    }

    const usage = createTokenUsage({
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      estimatedCost: this._estimateCost(
        model,
        data.usage.input_tokens,
        data.usage.output_tokens,
      ),
    });

    return createLLMResponse({
      content,
      modelUsed: model,
      provider: ProviderType.ANTHROPIC,
      usage,
      latencyMs,
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
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    if (options?.systemPrompt) {
      body.system = options.systemPrompt;
    }
    if (options?.stopSequences && options.stopSequences.length > 0) {
      body.stop_sequences = options.stopSequences;
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

          try {
            const event = JSON.parse(dataStr) as AnthropicStreamEvent;

            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield {
                content: event.delta.text,
                isFinal: false,
                usage: null,
              };
            }

            if (event.type === 'message_stop') {
              // Final chunk - we don't have usage from stream in Anthropic
              // Usage comes via message_delta event
              yield {
                content: '',
                isFinal: true,
                usage: null,
              };
            }

            if (event.type === 'message_delta' && event.usage) {
              // Anthropic sends usage in message_delta
              yield {
                content: '',
                isFinal: true,
                usage: createTokenUsage({
                  promptTokens: event.usage.input_tokens ?? 0,
                  completionTokens: event.usage.output_tokens ?? 0,
                  totalTokens: (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
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
      throw new RateLimitError(error.message, ProviderType.ANTHROPIC);
    }
    if (errorMsg.includes('token') || errorMsg.includes('length')) {
      throw new TokenLimitError(error.message, ProviderType.ANTHROPIC);
    }
    throw new ProviderUnavailableError(error.message, ProviderType.ANTHROPIC);
  }

  /**
   * Estimate request cost
   */
  private _estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? { input: 0, output: 0 };
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}

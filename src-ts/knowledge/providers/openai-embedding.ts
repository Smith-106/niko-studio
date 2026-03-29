/**
 * Knowledge module - OpenAI Embedding Provider
 *
 * Implements the EmbeddingProvider interface using the OpenAI API.
 * Supports text-embedding-3 series models with custom dimensions.
 */

import type { EmbeddingResponse } from '../models';
import {
  ProviderType,
  createTokenUsage,
  createEmbeddingResponse,
  EmbeddingError,
} from '../models';

// ============================================================
// Model dimensions mapping
// ============================================================

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

// ============================================================
// Model pricing (USD per 1M tokens)
// ============================================================

const MODEL_PRICING: Record<string, number> = {
  'text-embedding-3-small': 0.02,
  'text-embedding-3-large': 0.13,
  'text-embedding-ada-002': 0.10,
};

// ============================================================
// OpenAI Embedding API types
// ============================================================

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ============================================================
// OpenAI Embedding Provider
// ============================================================

export class OpenAIEmbeddingProvider {
  private readonly _apiKey: string | null;
  private readonly _baseUrl: string | null;
  private readonly _organization: string | null;
  private readonly _defaultModel: string;
  private readonly _timeout: number;
  private readonly _maxRetries: number;

  constructor(params: {
    apiKey?: string | null;
    baseUrl?: string | null;
    organization?: string | null;
    defaultModel?: string;
    timeout?: number;
    maxRetries?: number;
  }) {
    this._apiKey = params.apiKey ?? process.env.OPENAI_API_KEY ?? null;
    this._baseUrl = params.baseUrl ?? null;
    this._organization = params.organization ?? null;
    this._defaultModel = params.defaultModel ?? 'text-embedding-3-small';
    this._timeout = params.timeout ?? 60.0;
    this._maxRetries = params.maxRetries ?? 3;
  }

  get providerType(): string {
    return ProviderType.OPENAI;
  }

  getDimensions(model: string): number {
    return MODEL_DIMENSIONS[model] ?? 1536;
  }

  private _getApiUrl(): string {
    const base = this._baseUrl ?? 'https://api.openai.com/v1';
    return `${base.replace(/\/$/, '')}/embeddings`;
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
   * Execute vector encoding request
   */
  async embed(
    texts: string[],
    model: string,
    options?: { dimensions?: number },
  ): Promise<EmbeddingResponse> {
    const body: Record<string, unknown> = {
      model: model || this._defaultModel,
      input: texts,
    };

    // text-embedding-3 series supports custom dimensions
    if (options?.dimensions && model.startsWith('text-embedding-3')) {
      body.dimensions = options.dimensions;
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
      throw new EmbeddingError((e as Error).message, ProviderType.OPENAI);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmbeddingError(errorText, ProviderType.OPENAI);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    const latencyMs = Math.round(performance.now() - startTime);

    const embeddings = data.data.map(item => item.embedding);
    const actualDimensions = embeddings.length > 0 ? embeddings[0].length : 0;

    const usage = createTokenUsage({
      promptTokens: data.usage.prompt_tokens,
      completionTokens: 0,
      totalTokens: data.usage.total_tokens,
      estimatedCost: this._estimateCost(model, data.usage.total_tokens),
    });

    return createEmbeddingResponse({
      embeddings,
      modelUsed: model,
      provider: ProviderType.OPENAI,
      dimensions: actualDimensions,
      usage,
      latencyMs,
    });
  }

  /**
   * Check provider health status
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embed(['test'], this._defaultModel);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estimate request cost
   */
  private _estimateCost(model: string, tokenCount: number): number {
    const price = MODEL_PRICING[model] ?? 0;
    return (tokenCount * price) / 1_000_000;
  }
}

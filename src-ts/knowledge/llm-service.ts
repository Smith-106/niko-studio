/**
 * Knowledge module - LLM service
 *
 * Unified multi-provider LLM service with model tier routing, retry, and degradation.
 */

import type { LLMProvider } from './models';
import type {
  LLMRequest,
  LLMResponse,
  StreamChunk,
} from './models';
import {
  ModelTier,
  LLMError,
  RateLimitError,
  ProviderUnavailableError,
  createLLMRequest,
} from './models';
import { createLogger } from '../logger';

// ============================================================
// Retry utility
// ============================================================

const log = createLogger('llm');

/**
 * Retry with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    exponentialBase: number;
  },
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, exponentialBase } = options;
  let lastException: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RateLimitError) && !(e instanceof ProviderUnavailableError)) {
        throw e;
      }
      lastException = e as Error;
      if (attempt === maxRetries) break;

      log.warn('LLM request failed, retrying', {
        attempt: attempt + 1,
        maxRetries,
        error: (e as Error).message,
        errorType: (e as Error).constructor.name,
      });

      let delay: number;
      if (e instanceof RateLimitError && e.retryAfter !== null) {
        delay = e.retryAfter;
      } else {
        const base = Math.min(baseDelay * Math.pow(exponentialBase, attempt), maxDelay);
        // Add jitter (0-25%) to avoid thundering herd
        delay = base * (1 + Math.random() * 0.25);
      }

      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
  }

  throw lastException;
}

// ============================================================
// LLM Service Implementation
// ============================================================

/**
 * LLM service implementation
 *
 * Provides a unified LLM API supporting:
 * - Multi-provider management
 * - Model tier routing (FAST/DEFAULT/POWERFUL)
 * - Automatic retry and degradation
 * - Streaming responses
 * - JSON generation
 */
export class LLMServiceImpl {
  private readonly _providers: Map<string, LLMProvider>;
  private readonly _defaultProvider: string;
  private readonly _maxRetries: number;
  private readonly _retryBaseDelay: number;

  constructor(params: {
    providers: Map<string, LLMProvider>;
    defaultProvider?: string;
    maxRetries?: number;
    retryBaseDelay?: number;
  }) {
    this._providers = params.providers;
    this._defaultProvider = params.defaultProvider ?? 'openai';
    this._maxRetries = params.maxRetries ?? 3;
    this._retryBaseDelay = params.retryBaseDelay ?? 1.0;
  }

  /**
   * Get provider instance by type
   */
  private _getProvider(providerType?: string | null): LLMProvider {
    let ptype = providerType ?? this._defaultProvider;
    const provider = this._providers.get(ptype);
    if (!provider) {
      const available = Array.from(this._providers.keys());
      if (available.length === 0) {
        throw new ProviderUnavailableError('No providers available');
      }
      ptype = available[0];
      return this._providers.get(ptype)!;
    }
    return provider;
  }

  /**
   * Resolve model name from tier or explicit model string
   */
  private _resolveModel(
    model: string | ModelTier | null | undefined,
    provider: LLMProvider,
  ): string {
    if (model == null) {
      return provider.getModelForTier(ModelTier.DEFAULT);
    }
    if (Object.values(ModelTier).includes(model as ModelTier)) {
      return provider.getModelForTier(model as ModelTier);
    }
    return model as string;
  }

  /**
   * Generate text response
   */
  async generate(
    prompt: string,
    options?: {
      model?: string | ModelTier | null;
      temperature?: number;
      maxTokens?: number | null;
      systemPrompt?: string | null;
      stopSequences?: string[] | null;
      provider?: string | null;
    },
  ): Promise<string> {
    const response = await this._generateWithRetry(
      prompt,
      options?.model ?? null,
      options?.temperature ?? 0.7,
      options?.maxTokens ?? null,
      options?.systemPrompt ?? null,
      options?.stopSequences ?? null,
      options?.provider ?? null,
    );
    return response.content;
  }

  /**
   * Generate with retry logic
   */
  private async _generateWithRetry(
    prompt: string,
    model: string | ModelTier | null,
    temperature: number,
    maxTokens: number | null,
    systemPrompt: string | null,
    stopSequences: string[] | null,
    provider: string | null,
  ): Promise<LLMResponse> {
    const llmProvider = this._getProvider(provider);
    const modelName = this._resolveModel(model, llmProvider);

    return withRetry(
      () =>
        llmProvider.generate(createLLMRequest({
          prompt,
          modelOverride: modelName,
          temperature,
          maxTokens: maxTokens ?? undefined,
          systemPrompt: systemPrompt ?? undefined,
          stopSequences: stopSequences ?? undefined,
        })),
      {
        maxRetries: this._maxRetries,
        baseDelay: this._retryBaseDelay,
        maxDelay: 60.0,
        exponentialBase: 2.0,
      },
    );
  }

  /**
   * Generate response with full metadata
   */
  async generateWithMetadata(request: LLMRequest): Promise<LLMResponse> {
    return this._generateWithRetry(
      request.prompt,
      request.modelOverride ?? request.modelTier,
      request.temperature,
      request.maxTokens,
      request.systemPrompt,
      request.stopSequences.length > 0 ? request.stopSequences : null,
      null,
    );
  }

  /**
   * Generate JSON format response
   */
  async generateJson(
    prompt: string,
    options?: {
      model?: string | ModelTier | null;
      temperature?: number;
      maxTokens?: number | null;
      systemPrompt?: string | null;
      provider?: string | null;
    },
  ): Promise<Record<string, unknown>> {
    const provider = options?.provider ?? null;
    const llmProvider = this._getProvider(provider);
    const modelName = this._resolveModel(options?.model, llmProvider);

    // Add JSON format prompt
    let jsonSystem = options?.systemPrompt ?? '';
    if (!jsonSystem.toLowerCase().includes('json')) {
      jsonSystem = (jsonSystem + '\n\nRespond with valid JSON only.').trim();
    }

    const response = await withRetry(
      () =>
        llmProvider.generate(createLLMRequest({
          prompt,
          modelOverride: modelName,
          temperature: options?.temperature ?? 0.3,
          maxTokens: options?.maxTokens ?? undefined,
          systemPrompt: jsonSystem || undefined,
          responseFormat: { type: 'json' },
        })),
      {
        maxRetries: this._maxRetries,
        baseDelay: this._retryBaseDelay,
        maxDelay: 60.0,
        exponentialBase: 2.0,
      },
    );

    try {
      return JSON.parse(response.content);
    } catch (e) {
      throw new LLMError(`Failed to parse JSON response: ${e}`);
    }
  }

  /**
   * Stream text response
   */
  async *stream(
    prompt: string,
    options?: {
      model?: string | ModelTier | null;
      temperature?: number;
      maxTokens?: number | null;
      systemPrompt?: string | null;
      provider?: string | null;
    },
  ): AsyncGenerator<StreamChunk, void, undefined> {
    const llmProvider = this._getProvider(options?.provider);
    const modelName = this._resolveModel(options?.model, llmProvider);

    yield* llmProvider.streamGenerate(createLLMRequest({
      prompt,
      modelOverride: modelName,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? undefined,
      systemPrompt: options?.systemPrompt ?? undefined,
    }));
  }

  /**
   * Batch generate text responses
   */
  async batchGenerate(
    prompts: string[],
    options?: {
      model?: string | ModelTier | null;
      temperature?: number;
      maxTokens?: number | null;
      maxConcurrency?: number;
      provider?: string | null;
    },
  ): Promise<string[]> {
    const maxConcurrency = options?.maxConcurrency ?? 5;
    const semaphore = { current: 0, max: maxConcurrency };
    const queue: Array<() => void> = [];

    const acquire = (): Promise<void> => {
      if (semaphore.current < semaphore.max) {
        semaphore.current++;
        return Promise.resolve();
      }
      return new Promise<void>(resolve => queue.push(resolve));
    };

    const release = (): void => {
      semaphore.current--;
      if (queue.length > 0) {
        semaphore.current++;
        const next = queue.shift()!;
        next();
      }
    };

    const generateOne = async (prompt: string): Promise<string> => {
      await acquire();
      try {
        return await this.generate(prompt, {
          model: options?.model,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          provider: options?.provider,
        });
      } finally {
        release();
      }
    };

    return Promise.all(prompts.map(p => generateOne(p)));
  }
}

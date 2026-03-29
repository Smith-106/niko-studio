/**
 * LLMService - Multi-Provider LLM Abstraction Layer
 *
 * TypeScript implementation of LLMService interface.
 * Migrated from src/knowledge/services/llm_service.py.
 *
 * Features:
 * - Multi-provider management (OpenAI, Anthropic, Azure, Local)
 * - Model tier routing (FAST, DEFAULT, POWERFUL)
 * - Automatic retry with exponential backoff
 * - Streaming response support
 * - JSON generation mode
 * - Batch processing
 */

import type { LLMService, LLMProvider, LLMRequest, LLMResponse, StreamChunk } from '../protocols/llm';

/**
 * Model tier for complexity-based routing
 */
export enum ModelTier {
  FAST = 'fast',         // Low latency, simple tasks (e.g., haiku, gpt-4o-mini)
  DEFAULT = 'default',   // Balanced performance (e.g., sonnet, gpt-4o)
  POWERFUL = 'powerful', // Maximum capability (e.g., opus, o1)
}

/**
 * LLM provider types
 */
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE = 'azure',
  LOCAL = 'local',
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * LLM error types
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider?: ProviderType
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class RateLimitError extends LLMError {
  constructor(
    message: string = 'Rate limit exceeded',
    provider?: ProviderType,
    public readonly retryAfter?: number
  ) {
    super(message, provider);
    this.name = 'RateLimitError';
  }
}

export class TokenLimitError extends LLMError {
  constructor(
    message: string = 'Token limit exceeded',
    provider?: ProviderType,
    public readonly tokenCount?: number,
    public readonly tokenLimit?: number
  ) {
    super(message, provider);
    this.name = 'TokenLimitError';
  }
}

export class ProviderUnavailableError extends LLMError {
  constructor(
    message: string = 'Provider unavailable',
    provider?: ProviderType,
    public readonly fallbackAvailable: boolean = false
  ) {
    super(message, provider);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;      // milliseconds
  maxDelay: number;       // milliseconds
  exponentialBase: number;
}

/**
 * LLMService configuration
 */
export interface LLMServiceConfig {
  defaultProvider?: ProviderType;
  retry?: Partial<RetryConfig>;
}

/**
 * LLMService Implementation
 *
 * Implements LLMService protocol with multi-provider support,
 * automatic retry, and model tier routing.
 */
export class LLMServiceImpl implements LLMService {
  private readonly providers: Map<ProviderType, LLMProvider>;
  private readonly defaultProvider: ProviderType;
  private readonly retryConfig: RetryConfig;

  constructor(
    providers: Map<ProviderType, LLMProvider> | Record<ProviderType, LLMProvider>,
    config: LLMServiceConfig = {}
  ) {
    // Convert record to map if needed
    this.providers = providers instanceof Map
      ? providers
      : new Map(Object.entries(providers) as [ProviderType, LLMProvider][]);

    this.defaultProvider = config.defaultProvider ?? ProviderType.OPENAI;

    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 3,
      baseDelay: config.retry?.baseDelay ?? 1000,
      maxDelay: config.retry?.maxDelay ?? 60000,
      exponentialBase: config.retry?.exponentialBase ?? 2,
    };
  }

  /**
   * Get provider instance
   */
  private getProvider(providerType?: ProviderType): LLMProvider {
    const ptype = providerType ?? this.defaultProvider;

    if (!this.providers.has(ptype)) {
      const available = Array.from(this.providers.keys());
      if (available.length === 0) {
        throw new ProviderUnavailableError('No providers available');
      }
      // Fallback to first available provider
      return this.providers.get(available[0])!;
    }

    return this.providers.get(ptype)!;
  }

  /**
   * Resolve model name from tier or explicit name
   */
  private resolveModel(
    model: string | ModelTier | undefined,
    provider: LLMProvider
  ): string {
    if (model === undefined) {
      return provider.getModelForTier(ModelTier.DEFAULT);
    }

    if (typeof model === 'string') {
      return model;
    }

    // ModelTier enum
    return provider.getModelForTier(model);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on specific errors
        if (error instanceof RateLimitError || error instanceof ProviderUnavailableError) {
          if (attempt < this.retryConfig.maxRetries) {
            // Calculate delay
            let delay: number;
            if (error instanceof RateLimitError && error.retryAfter) {
              delay = error.retryAfter;
            } else {
              delay = Math.min(
                this.retryConfig.baseDelay * Math.pow(this.retryConfig.exponentialBase, attempt),
                this.retryConfig.maxDelay
              );
            }

            console.warn(
              `${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), ` +
              `retrying in ${delay}ms: ${error.message}`
            );

            await this.sleep(delay);
            continue;
          }
        }

        // Non-retryable error or max retries exceeded
        throw error;
      }
    }

    throw lastError;
  }

  // ============================================================
  // LLMService Interface Implementation
  // ============================================================

  /**
   * Generate text response
   */
  async generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): Promise<string> {
    const response = await this.generateWithMetadata({
      prompt,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt,
      stopSequences: options?.stopSequences,
    });

    return response.content;
  }

  /**
   * Generate text response with full metadata
   */
  async generateWithMetadata(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProvider();
    const modelName = this.resolveModel(request.model, provider);

    return this.withRetry(
      async () => {
        const response = await provider.complete(
          request.prompt,
          modelName,
          {
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            systemPrompt: request.systemPrompt,
            stopSequences: request.stopSequences,
          }
        );

        return response;
      },
      'generateWithMetadata'
    );
  }

  /**
   * Generate JSON format response
   */
  async generateJson(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<Record<string, unknown>> {
    const provider = this.getProvider();
    const modelName = this.resolveModel(options?.model, provider);

    // Add JSON format instruction
    let jsonSystem = options?.systemPrompt ?? '';
    if (!jsonSystem.toLowerCase().includes('json')) {
      jsonSystem = (jsonSystem + '\n\nRespond with valid JSON only.').trim();
    }

    const response = await this.withRetry(
      async () => {
        return provider.complete(prompt, modelName, {
          temperature: options?.temperature ?? 0.3, // Lower temperature for structured output
          maxTokens: options?.maxTokens,
          systemPrompt: jsonSystem,
          responseFormat: { type: 'json' },
        });
      },
      'generateJson'
    );

    // Parse JSON response
    try {
      return JSON.parse(response.content);
    } catch (error) {
      throw new LLMError(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
        provider.providerType as ProviderType
      );
    }
  }

  /**
   * Stream text response
   */
  async *stream(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncIterableIterator<StreamChunk> {
    const provider = this.getProvider();
    const modelName = this.resolveModel(options?.model, provider);

    // Streaming doesn't use retry for simplicity
    // (would need to buffer chunks and handle errors differently)
    yield* provider.streamComplete(prompt, modelName, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      systemPrompt: options?.systemPrompt,
    });
  }

  /**
   * Generate embedding (optional method)
   */
  async embed?(
    text: string,
    options?: { model?: string }
  ): Promise<number[]> {
    // This would require an EmbeddingProvider
    // For now, throw not implemented
    throw new LLMError('Embedding not supported by LLMService. Use EmbeddingService instead.');
  }

  /**
   * Batch generate text responses
   */
  async batchGenerate(
    prompts: string[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      maxConcurrency?: number;
    }
  ): Promise<string[]> {
    const maxConcurrency = options?.maxConcurrency ?? 5;
    const results: string[] = new Array(prompts.length);

    // Process in batches
    for (let i = 0; i < prompts.length; i += maxConcurrency) {
      const batch = prompts.slice(i, Math.min(i + maxConcurrency, prompts.length));
      const batchResults = await Promise.all(
        batch.map((prompt) =>
          this.generate(prompt, {
            model: options?.model,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
          })
        )
      );

      results.splice(i, batch.length, ...batchResults);
    }

    return results;
  }

  // ============================================================
  // Additional Helper Methods
  // ============================================================

  /**
   * Check provider health status
   */
  async healthCheck(providerType?: ProviderType): Promise<boolean> {
    const provider = this.getProvider(providerType);
    return provider.healthCheck();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): ProviderType {
    return this.defaultProvider;
  }
}

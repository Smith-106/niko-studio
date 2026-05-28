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
import { HookRegistry, HookType, createHookContext, type HookResult } from '../hooks/writing-hooks.js';
import { CircuitBreakerRegistry, CircuitState } from './circuit-breaker.js';

import { createLogger } from "../logger/index.js";
const _log = createLogger("svc-llm");

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
  hooks?: HookRegistry;
  tokenBudget?: number;
}

/**
 * Budget exceeded error
 */
export class BudgetExceededError extends LLMError {
  constructor(
    message: string = 'Token budget exceeded',
    public readonly used: number,
    public readonly budget: number
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class CircuitOpenError extends LLMError {
  constructor(
    public readonly providerName: string,
    public readonly circuitState: CircuitState,
    message?: string
  ) {
    super(
      message ?? `Circuit is ${circuitState} for provider "${providerName}"`,
      providerName as ProviderType
    );
    this.name = 'CircuitOpenError';
  }
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
  private readonly _hooks: HookRegistry | null;
  private readonly _tokenBudget: number | null;
  private _tokensUsed = 0;
  private readonly _circuitBreakerRegistry: CircuitBreakerRegistry;

  constructor(
    providers: Map<ProviderType, LLMProvider> | Record<ProviderType, LLMProvider>,
    config: LLMServiceConfig = {}
  ) {
    // Convert record to map if needed
    this.providers = providers instanceof Map
      ? providers
      : new Map(Object.entries(providers) as [ProviderType, LLMProvider][]);

    this.defaultProvider = config.defaultProvider ?? ProviderType.OPENAI;
    this._hooks = config.hooks ?? null;
    this._tokenBudget = config.tokenBudget ?? null;

    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 3,
      baseDelay: config.retry?.baseDelay ?? 1000,
      maxDelay: config.retry?.maxDelay ?? 60000,
      exponentialBase: config.retry?.exponentialBase ?? 2,
    };

    this._circuitBreakerRegistry = new CircuitBreakerRegistry({
      failureThreshold: 5,
      cooldownMs: 60000,
      halfOpenMaxCalls: 3,
    });
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
   * Get ordered list of provider types for fallback, starting with preferred.
   * Circuit-open providers are skipped unless all are open.
   */
  private getProviderFallbackOrder(preferred?: ProviderType): ProviderType[] {
    const all = Array.from(this.providers.keys());

    // If no preferred, use default
    const start = preferred ?? this.defaultProvider;

    // Reorder so preferred is first
    const ordered: ProviderType[] = [];
    const remaining: ProviderType[] = [];
    for (const p of all) {
      if (p === start) {
        ordered.push(p);
      } else {
        remaining.push(p);
      }
    }
    ordered.push(...remaining);

    // Separate into available (circuit allows) and blocked
    const available = ordered.filter(p => this._circuitBreakerRegistry.allow(p));
    const blocked = ordered.filter(p => !this._circuitBreakerRegistry.allow(p));

    // If at least one provider is available, use only available ones
    if (available.length > 0) {
      return available;
    }

    // All circuits are open — return the full list so we can attempt
    // the preferred provider and produce a clear error if it fails
    return ordered;
  }

  /**
   * Execute an LLM operation with cross-provider fallback.
   * Tries providers in fallback order; on failure, records it in the
   * circuit breaker and moves to the next provider.
   */
  private async executeWithFallback<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderType
  ): Promise<T> {
    const fallbackOrder = this.getProviderFallbackOrder(preferredProvider);
    const errors: Error[] = [];

    for (const providerType of fallbackOrder) {
      // Check circuit breaker before attempting
      if (!this._circuitBreakerRegistry.allow(providerType)) {
        const state = this._circuitBreakerRegistry.getState(providerType);
        _log.warn(
          `${operationName}: skipping provider "${providerType}" — circuit is ${state}`
        );
        errors.push(new CircuitOpenError(providerType, state));
        continue;
      }

      const provider = this.providers.get(providerType)!;

      try {
        const result = await operation(provider);
        this._circuitBreakerRegistry.recordSuccess(providerType);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this._circuitBreakerRegistry.recordFailure(providerType);
        _log.warn(
          `${operationName}: provider "${providerType}" failed: ${err.message}, ` +
          `trying next provider`
        );
        errors.push(err);
      }
    }

    // All providers exhausted
    const openProviders = this._circuitBreakerRegistry.getOpenCircuitProviders();
    if (openProviders.length > 0 && errors.every(e => e instanceof CircuitOpenError)) {
      throw new CircuitOpenError(
        openProviders[0],
        this._circuitBreakerRegistry.getState(openProviders[0]),
        `All provider circuits are open [${openProviders.join(', ')}]. ` +
        `No providers available.`
      );
    }

    throw new ProviderUnavailableError(
      `All providers failed for ${operationName}: ` +
      errors.map(e => e.message).join('; '),
      undefined,
      false
    );
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

            _log.warn(
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
    // Budget pre-check (estimate from maxTokens or prompt length)
    this.checkBudget(request.maxTokens ?? Math.ceil(request.prompt.length / 4));

    const response = await this.executeWithFallback(
      async (provider) => {
        const modelName = this.resolveModel(request.model, provider);

        // Hook: BEFORE_LLM_CALL
        if (this._hooks) {
          const hookCtx = createHookContext({ content: request.prompt, metadata: { model: modelName, operation: 'generate' } });
          await this._hooks.execute(HookType.BEFORE_LLM_CALL, hookCtx);
        }

        const result = await this.withRetry(
          async () => provider.complete(
            request.prompt,
            modelName,
            {
              temperature: request.temperature,
              maxTokens: request.maxTokens,
              systemPrompt: request.systemPrompt,
              stopSequences: request.stopSequences,
            }
          ),
          'generateWithMetadata'
        );

        // Hook: AFTER_LLM_CALL
        if (this._hooks) {
          const hookCtx = createHookContext({ content: result.content, metadata: { model: modelName, tokens: result.usage?.totalTokens } });
          await this._hooks.execute(HookType.AFTER_LLM_CALL, hookCtx);
        }

        return result;
      },
      'generateWithMetadata'
    );

    this.trackTokenUsage(response.usage);
    return response;
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
    // Budget pre-check
    this.checkBudget(options?.maxTokens ?? Math.ceil(prompt.length / 4));

    // Add JSON format instruction
    let jsonSystem = options?.systemPrompt ?? '';
    if (!jsonSystem.toLowerCase().includes('json')) {
      jsonSystem = (jsonSystem + '\n\nRespond with valid JSON only.').trim();
    }

    const { response, provider } = await this.executeWithFallback(
      async (prov) => {
        const modelName = this.resolveModel(options?.model, prov);
        const result = await this.withRetry(
          async () => prov.complete(prompt, modelName, {
            temperature: options?.temperature ?? 0.3, // Lower temperature for structured output
            maxTokens: options?.maxTokens,
            systemPrompt: jsonSystem,
            responseFormat: { type: 'json' },
          }),
          'generateJson'
        );
        return { response: result, provider: prov };
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
   * Stream text response with retry on transient errors.
   *
   * On retryable errors (network timeout, 429, 5xx), the stream is
   * reconnected from the beginning. Non-retryable errors (4xx except 429)
   * fail immediately.
   *
   * If the primary provider's circuit is open or the stream fails,
   * falls back to the next available provider.
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
    const fallbackOrder = this.getProviderFallbackOrder();
    const errors: Error[] = [];

    for (const providerType of fallbackOrder) {
      if (!this._circuitBreakerRegistry.allow(providerType)) {
        const state = this._circuitBreakerRegistry.getState(providerType);
        _log.warn(`stream: skipping provider "${providerType}" — circuit is ${state}`);
        errors.push(new CircuitOpenError(providerType, state));
        continue;
      }

      const provider = this.providers.get(providerType)!;
      const modelName = this.resolveModel(options?.model, provider);
      const maxStreamRetries = 2;

      // Hook: BEFORE_LLM_CALL (stream)
      if (this._hooks) {
        const hookCtx = createHookContext({ content: prompt, metadata: { model: modelName, operation: 'stream' } });
        await this._hooks.execute(HookType.BEFORE_LLM_CALL, hookCtx);
      }

      try {
        for (let attempt = 0; attempt <= maxStreamRetries; attempt++) {
          try {
            const stream = provider.streamComplete(prompt, modelName, {
              temperature: options?.temperature,
              maxTokens: options?.maxTokens,
              systemPrompt: options?.systemPrompt,
            });

            for await (const chunk of stream) {
              yield chunk;
            }

            // Hook: AFTER_LLM_CALL (stream completed)
            if (this._hooks) {
              const hookCtx = createHookContext({ content: '', metadata: { model: modelName, operation: 'stream', status: 'completed' } });
              await this._hooks.execute(HookType.AFTER_LLM_CALL, hookCtx);
            }

            this._circuitBreakerRegistry.recordSuccess(providerType);
            return; // Stream completed successfully
          } catch (error: any) {
            const isRetryable =
              error?.status === 429 ||
              (error?.status >= 500 && error?.status < 600) ||
              error?.code === 'ECONNRESET' ||
              error?.code === 'ETIMEDOUT' ||
              error?.code === 'ENOTFOUND' ||
              error?.name === 'AbortError';

            if (!isRetryable || attempt >= maxStreamRetries) {
              throw error;
            }

            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(this.retryConfig.exponentialBase, attempt),
              this.retryConfig.maxDelay
            );

            // For 429, respect retry-after header if present
            const retryAfter = error?.headers?.['retry-after'];
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this._circuitBreakerRegistry.recordFailure(providerType);
        _log.warn(`stream: provider "${providerType}" failed: ${err.message}, trying next provider`);
        errors.push(err);
        continue; // Try next provider
      }
    }

    // All providers exhausted
    const openProviders = this._circuitBreakerRegistry.getOpenCircuitProviders();
    if (openProviders.length > 0 && errors.every(e => e instanceof CircuitOpenError)) {
      throw new CircuitOpenError(
        openProviders[0],
        this._circuitBreakerRegistry.getState(openProviders[0]),
        `All provider circuits are open [${openProviders.join(', ')}]. No providers available.`
      );
    }

    throw new ProviderUnavailableError(
      `All providers failed for stream: ` +
      errors.map(e => e.message).join('; '),
      undefined,
      false
    );
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

  /**
   * Get token budget status
   */
  getBudgetStatus(): { used: number; budget: number | null; remaining: number | null } {
    return {
      used: this._tokensUsed,
      budget: this._tokenBudget,
      remaining: this._tokenBudget != null ? this._tokenBudget - this._tokensUsed : null,
    };
  }

  /**
   * Register a provider dynamically
   */
  registerProvider(type: ProviderType, provider: LLMProvider): void {
    this.providers.set(type, provider);
  }

  /**
   * Check budget before dispatching
   */
  private checkBudget(estimatedTokens: number): void {
    if (this._tokenBudget == null) return;

    if (this._tokensUsed + estimatedTokens > this._tokenBudget) {
      throw new BudgetExceededError(
        `Token budget exceeded: used ${this._tokensUsed}, estimated ${estimatedTokens}, budget ${this._tokenBudget}`,
        this._tokensUsed,
        this._tokenBudget
      );
    }
  }

  private trackTokenUsage(usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined): void {
    if (!usage || this._tokenBudget == null) return;
    this._tokensUsed += usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
  }
}

/**
 * Knowledge module - service manager
 *
 * Manages the lifecycle of LLM and Embedding services.
 * Singleton pattern with health checking and hot-reload support.
 */

import type {
  ProviderConfig,
  ServiceConfig,
  LLMProvider as LLMServiceProviderContract,
  EmbeddingProvider as EmbeddingServiceProviderContract,
  LLMResponse,
  EmbeddingResponse,
  StreamChunk,
} from './models';
import {
  ProviderType,
  createServiceConfig,
} from './models';
import { InMemoryEmbeddingCache } from './cache';
import { LLMServiceImpl } from './llm-service';
import { EmbeddingServiceImpl } from './embedding-service';
import {
  OpenAILLMProvider,
  AnthropicLLMProvider,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
} from './providers';

interface LLMRuntimeProvider {
  readonly providerType: string;
  getModelForTier(tier: string): string;
  complete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
      responseFormat?: Record<string, unknown>;
    },
  ): Promise<LLMResponse>;
  streamComplete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    },
  ): AsyncGenerator<StreamChunk, void, undefined>;
  healthCheck(): Promise<boolean>;
}

interface EmbeddingRuntimeProvider {
  readonly providerType: string;
  getDimensions(model: string): number;
  embed(
    texts: string[],
    model: string,
    options?: { dimensions?: number },
  ): Promise<EmbeddingResponse>;
  healthCheck(): Promise<boolean>;
}

function createLLMServiceProvider(
  provider: LLMRuntimeProvider,
): LLMServiceProviderContract {
  return {
    providerType: provider.providerType,
    getModelForTier: (tier) => provider.getModelForTier(tier),
    generate: async (request) => {
      const model = request.modelOverride ?? provider.getModelForTier(request.modelTier);
      return provider.complete(request.prompt, model, {
        temperature: request.temperature,
        maxTokens: request.maxTokens ?? undefined,
        systemPrompt: request.systemPrompt ?? undefined,
        stopSequences: request.stopSequences,
        responseFormat: request.responseFormat ?? undefined,
      });
    },
    streamGenerate: async function* (request) {
      const model = request.modelOverride ?? provider.getModelForTier(request.modelTier);
      for await (const chunk of provider.streamComplete(request.prompt, model, {
        temperature: request.temperature,
        maxTokens: request.maxTokens ?? undefined,
        systemPrompt: request.systemPrompt ?? undefined,
        stopSequences: request.stopSequences,
      })) {
        yield chunk;
      }
    },
    healthCheck: () => provider.healthCheck(),
  };
}

function createEmbeddingServiceProvider(
  provider: EmbeddingRuntimeProvider,
): EmbeddingServiceProviderContract {
  return {
    providerType: provider.providerType,
    getModel: () => '',
    embed: async (texts, model) => {
      const response = await provider.embed(texts, model ?? '');
      return response.embeddings;
    },
    healthCheck: () => provider.healthCheck(),
  };
}

/**
 * Service manager
 *
 * Singleton that manages all LLM/Embedding service instances.
 * Supports:
 * - Service initialization and shutdown
 * - Health checking
 * - Configuration hot-reload
 */
export class ServiceManager {
  private static _instance: ServiceManager | null = null;

  private _config: ServiceConfig;
  private readonly _llmProviders: Map<string, LLMServiceProviderContract>;
  private readonly _embeddingProviders: Map<string, EmbeddingServiceProviderContract>;
  private _llmService: LLMServiceImpl | null = null;
  private _embeddingService: EmbeddingServiceImpl | null = null;
  private _cache: InMemoryEmbeddingCache | null = null;
  private _healthStatus: Record<string, boolean> = {};
  private _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _initialized: boolean = false;

  private constructor(config?: ServiceConfig | null) {
    this._config = config ?? createServiceConfig();
    this._llmProviders = new Map();
    this._embeddingProviders = new Map();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: ServiceConfig | null): ServiceManager {
    if (!ServiceManager._instance) {
      ServiceManager._instance = new ServiceManager(config);
    }
    return ServiceManager._instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  static resetInstance(): void {
    if (ServiceManager._instance) {
      ServiceManager._instance.shutdown();
    }
    ServiceManager._instance = null;
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Initialize cache
    if (this._config.embeddingCacheEnabled) {
      this._cache = new InMemoryEmbeddingCache(
        this._config.embeddingCacheMaxSize,
        this._config.embeddingCacheTTL,
      );
    }

    // Initialize providers
    for (const providerConfig of this._config.providers) {
      await this._initProvider(providerConfig);
    }

    // Initialize services
    this._llmService = new LLMServiceImpl({
      providers: this._llmProviders,
      defaultProvider: this._config.defaultLLMProvider,
      maxRetries: this._config.retryMaxAttempts,
      retryBaseDelay: this._config.retryInitialDelay,
    });

    this._embeddingService = new EmbeddingServiceImpl({
      providers: this._embeddingProviders,
      defaultProvider: this._config.defaultEmbeddingProvider,
      cache: this._cache,
    });

    // Start health check loop
    this._healthCheckTimer = setInterval(() => {
      this.checkHealth().catch(() => {
        // Health check failures are logged but don't crash
      });
    }, this._config.healthCheckInterval * 1000);

    this._initialized = true;
  }

  /**
   * Initialize a single provider
   */
  private async _initProvider(config: ProviderConfig): Promise<void> {
    const ptype = config.provider;

    if (ptype === ProviderType.OPENAI) {
      const llmProvider = new OpenAILLMProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        organization: config.organization,
        modelMapping: config.modelMapping,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
      this._llmProviders.set(ptype, createLLMServiceProvider(llmProvider));

      const embeddingProvider = new OpenAIEmbeddingProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        organization: config.organization,
        defaultModel: config.embeddingModel,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
      this._embeddingProviders.set(ptype, createEmbeddingServiceProvider(embeddingProvider));
    } else if (ptype === ProviderType.ANTHROPIC) {
      const llmProvider = new AnthropicLLMProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        modelMapping: config.modelMapping,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
      });
      this._llmProviders.set(ptype, createLLMServiceProvider(llmProvider));
    } else if (ptype === ProviderType.LOCAL) {
      const embeddingProvider = new LocalEmbeddingProvider({
        modelName: config.embeddingModel,
        backend: config.baseUrl ?? 'fastembed',
      });
      this._embeddingProviders.set(ptype, createEmbeddingServiceProvider(embeddingProvider));
    }
  }

  /**
   * Shutdown all services
   */
  shutdown(): void {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }

    if (this._cache) {
      this._cache.clear().catch(() => {});
    }

    this._llmProviders.clear();
    this._embeddingProviders.clear();
    this._llmService = null;
    this._embeddingService = null;
    this._initialized = false;
    ServiceManager._instance = null;
  }

  /**
   * Get LLM service
   */
  get llm(): LLMServiceImpl {
    if (!this._llmService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._llmService;
  }

  /**
   * Get Embedding service
   */
  get embedding(): EmbeddingServiceImpl {
    if (!this._embeddingService) {
      throw new Error('ServiceManager not initialized. Call initialize() first.');
    }
    return this._embeddingService;
  }

  /**
   * Check all provider health statuses
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const checks: Record<string, boolean> = {};

    for (const [ptype, provider] of this._llmProviders) {
      checks[`llm_${ptype}`] = await provider.healthCheck();
    }

    for (const [ptype, provider] of this._embeddingProviders) {
      checks[`embedding_${ptype}`] = await provider.healthCheck();
    }

    this._healthStatus = checks;
    return checks;
  }

  /**
   * Check if any service is healthy
   */
  isHealthy(): boolean {
    return Object.values(this._healthStatus).some(Boolean);
  }

  /**
   * Get health status
   */
  getHealthStatus(): Record<string, boolean> {
    return { ...this._healthStatus };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<Record<string, unknown> | null> {
    if (this._cache) {
      return this._cache.stats();
    }
    return null;
  }
}

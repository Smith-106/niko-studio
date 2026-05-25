/**
 * EmbeddingService - Multi-Provider Embedding Abstraction Layer
 *
 * TypeScript implementation of EmbeddingService interface.
 * Migrated from src/knowledge/services/embedding_service.py.
 *
 * Features:
 * - Multi-provider management (OpenAI, Local, FastEmbed)
 * - Optional embedding cache with batch operations
 * - Batch processing with automatic batching
 * - Cosine similarity calculation
 * - Provider fallback support
 */

import type {
  EmbeddingService,
  EmbeddingProvider,
  EmbeddingCache,
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingResponse,
} from '../protocols/embedding';

/**
 * Provider types for embeddings
 */
export enum ProviderType {
  OPENAI = 'openai',
  LOCAL = 'local',
  FASTEMBED = 'fastembed',
  ANTHROPIC = 'anthropic',
}

/**
 * Embedding error types
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly provider?: ProviderType
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

export class ProviderUnavailableError extends EmbeddingError {
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
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * EmbeddingService configuration
 */
export interface EmbeddingServiceConfig {
  defaultProvider?: ProviderType;
  defaultModel?: string;
  cache?: EmbeddingCache;
}

const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_LOCAL_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5';

/**
 * EmbeddingService Implementation
 *
 * Implements EmbeddingService protocol with multi-provider support,
 * optional caching, and batch processing.
 */
export class EmbeddingServiceImpl implements EmbeddingService {
  private readonly providers: Map<ProviderType, EmbeddingProvider>;
  private readonly defaultProvider: ProviderType;
  private readonly defaultModel?: string;
  private readonly cache?: EmbeddingCache;

  constructor(
    providers: Map<ProviderType, EmbeddingProvider> | Record<ProviderType, EmbeddingProvider>,
    config: EmbeddingServiceConfig = {}
  ) {
    // Convert record to map if needed
    this.providers = providers instanceof Map
      ? providers
      : new Map(Object.entries(providers) as [ProviderType, EmbeddingProvider][]);

    this.defaultModel = config.defaultModel;
    this.cache = config.cache;

    // Validate providers
    if (this.providers.size === 0) {
      throw new EmbeddingError('At least one provider is required');
    }

    const availableProviders = Array.from(this.providers.keys());
    this.defaultProvider = config.defaultProvider && this.providers.has(config.defaultProvider)
      ? config.defaultProvider
      : availableProviders[0]!;
  }

  /**
   * Get provider instance with fallback
   */
  private getProvider(providerType?: ProviderType): EmbeddingProvider {
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
   * Get default model for provider
   */
  private getDefaultModel(provider: EmbeddingProvider): string {
    if (this.defaultModel) {
      return this.defaultModel;
    }

    // Provider-specific defaults
    switch (provider.providerType) {
      case ProviderType.OPENAI:
        return DEFAULT_OPENAI_EMBEDDING_MODEL;
      case ProviderType.LOCAL:
      case ProviderType.FASTEMBED:
        return DEFAULT_LOCAL_EMBEDDING_MODEL;
      default:
        return DEFAULT_OPENAI_EMBEDDING_MODEL;
    }
  }

  // ============================================================
  // EmbeddingService Interface Implementation
  // ============================================================

  /**
   * Generate vector representation for a single text
   */
  async embed(
    text: string,
    options?: { model?: string }
  ): Promise<number[]> {
    const embeddings = await this.embedBatch([text], options);
    return embeddings[0];
  }

  /**
   * 统一的缓存查询→收集未命中→调用提供商→更新缓存管道
   * 消除 embedBatch 和 embedWithMetadata 的重复逻辑
   */
  private async _executeWithCache(
    texts: string[],
    modelName: string,
    batchSize: number,
  ): Promise<{
    results: Record<string, number[]>;
    cacheHits: number;
    providerDimensions: number;
  }> {
    const provider = this.getProvider();
    const cacheResults: Record<string, number[] | null> = {};
    const textsToEmbed: string[] = [];
    let cacheHits = 0;

    // 查询缓存，收集未命中项
    if (this.cache) {
      const cached = await this.cache.getBatch(texts, modelName);
      for (const text of texts) {
        if (cached[text]) {
          cacheResults[text] = cached[text];
          cacheHits++;
        } else {
          textsToEmbed.push(text);
        }
      }
    } else {
      textsToEmbed.push(...texts);
    }

    // 批量调用提供商处理未命中项
    const newEmbeddings: Record<string, number[]> = {};
    let providerDimensions = 0;
    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, Math.min(i + batchSize, textsToEmbed.length));
      const response = await provider.embed(batch, modelName);
      providerDimensions = response.dimensions || providerDimensions;

      for (let j = 0; j < batch.length; j++) {
        newEmbeddings[batch[j]] = response.embeddings[j];
      }
    }

    // 更新缓存
    if (this.cache && Object.keys(newEmbeddings).length > 0) {
      await this.cache.setBatch(newEmbeddings, modelName);
    }

    // 合并结果
    const results: Record<string, number[]> = {};
    for (const text of texts) {
      if (text in newEmbeddings) {
        results[text] = newEmbeddings[text];
      } else if (cacheResults[text]) {
        results[text] = cacheResults[text]!;
      }
    }

    return { results, cacheHits, providerDimensions };
  }

  /**
   * Batch generate vector representations for texts
   */
  async embedBatch(
    texts: string[],
    options?: {
      model?: string;
      batchSize?: number;
    }
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const provider = this.getProvider();
    const modelName = options?.model ?? this.getDefaultModel(provider);
    const batchSize = options?.batchSize ?? 100;

    const { results } = await this._executeWithCache(texts, modelName, batchSize);

    // 按原始顺序排列
    return texts.map((text) => results[text]);
  }

  /**
   * Generate vector representation (including metadata)
   */
  async embedWithMetadata(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const provider = this.getProvider();
    const modelName = request.model ?? this.getDefaultModel(provider);

    const { results, cacheHits, providerDimensions } = await this._executeWithCache(
      [request.text],
      modelName,
      100,
    );

    const embedding = results[request.text];

    return {
      embedding,
      metadata: {
        model: modelName,
        provider: provider.providerType,
        dimensions: providerDimensions || embedding.length,
        cacheHits,
      },
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  similarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new EmbeddingError('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0.0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Get vector dimensions of the model
   */
  getDimensions(model?: string): number {
    const provider = this.getProvider();
    const modelName = model ?? this.getDefaultModel(provider);
    return provider.getDimensions(modelName);
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
   * Get cache statistics
   */
  async getCacheStats(): Promise<Record<string, unknown> | null> {
    if (!this.cache) {
      return null;
    }
    return this.cache.stats();
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }
}

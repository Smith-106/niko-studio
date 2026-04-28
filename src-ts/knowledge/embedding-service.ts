/**
 * Knowledge module - embedding service
 *
 * Unified multi-provider embedding service with caching, batch processing,
 * and similarity calculation.
 */

import type { EmbeddingCache } from '../protocols/embedding';
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingProvider,
  TokenUsage,
} from './models';
import {
  ProviderType,
  createTokenUsage,
  createEmbeddingResponse,
  EmbeddingError,
} from './models';

/**
 * Embedding service implementation
 *
 * Provides a unified embedding API supporting:
 * - Multi-provider management
 * - Embedding cache
 * - Batch processing
 * - Similarity calculation
 */
export class EmbeddingServiceImpl {
  private readonly _providers: Map<string, EmbeddingProvider>;
  private readonly _defaultProvider: string;
  private readonly _cache: EmbeddingCache | null;
  private readonly _defaultModel: string | null;

  constructor(params: {
    providers: Map<string, EmbeddingProvider>;
    defaultProvider?: string;
    cache?: EmbeddingCache | null;
    defaultModel?: string | null;
  }) {
    this._providers = params.providers;
    this._defaultProvider = params.defaultProvider ?? ProviderType.LOCAL;
    this._cache = params.cache ?? null;
    this._defaultModel = params.defaultModel ?? null;
  }

  /**
   * Get provider instance by type
   */
  private _getProvider(providerType?: string | null): EmbeddingProvider {
    let ptype = providerType ?? this._defaultProvider;
    const provider = this._providers.get(ptype);
    if (!provider) {
      const available = Array.from(this._providers.keys());
      if (available.length === 0) {
        throw new EmbeddingError('No providers available');
      }
      ptype = available[0];
      return this._providers.get(ptype)!;
    }
    return provider;
  }

  /**
   * Get default model name for a provider
   */
  private _getDefaultModel(provider: EmbeddingProvider): string {
    if (this._defaultModel) return this._defaultModel;
    if (provider.providerType === ProviderType.OPENAI) {
      return 'text-embedding-3-small';
    }
    if (provider.providerType === ProviderType.LOCAL) {
      return 'BAAI/bge-small-en-v1.5';
    }
    return 'text-embedding-3-small';
  }

  /**
   * Generate vector representation for a single text
   */
  async embed(
    text: string,
    options?: { model?: string | null; provider?: string | null },
  ): Promise<number[]> {
    const embeddings = await this.embedBatch([text], {
      model: options?.model,
      provider: options?.provider,
    });
    return embeddings[0];
  }

  /**
   * Batch generate vector representations for texts
   */
  async embedBatch(
    texts: string[],
    options?: {
      model?: string | null;
      batchSize?: number;
      provider?: string | null;
    },
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const embProvider = this._getProvider(options?.provider);
    const modelName = options?.model ?? this._getDefaultModel(embProvider);
    const batchSize = options?.batchSize ?? 100;

    // Check cache
    let cacheResults: Record<string, number[] | null> = {};
    const textsToEmbed: string[] = [];
    const textIndices: Map<string, number> = new Map();

    if (this._cache) {
      cacheResults = await this._cache.getBatch(texts, modelName);
      for (let i = 0; i < texts.length; i++) {
        textIndices.set(texts[i], i);
        if (cacheResults[texts[i]] == null) {
          textsToEmbed.push(texts[i]);
        }
      }
    } else {
      for (let i = 0; i < texts.length; i++) {
        textIndices.set(texts[i], i);
      }
      textsToEmbed.push(...texts);
    }

    // Process uncached texts in batches
    const newEmbeddings: Map<string, number[]> = new Map();
    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, i + batchSize);
      const embeddings = await embProvider.embed(batch, modelName);
      for (let j = 0; j < batch.length; j++) {
        newEmbeddings.set(batch[j], embeddings[j]);
      }
    }

    // Update cache
    if (this._cache && newEmbeddings.size > 0) {
      const items: Record<string, number[]> = {};
      for (const [k, v] of newEmbeddings) {
        items[k] = v;
      }
      await this._cache.setBatch(items, modelName);
    }

    // Merge results, preserving original order
    const results: number[][] = new Array(texts.length).fill(null as any) as number[][];
    for (const text of texts) {
      const idx = textIndices.get(text)!;
      if (newEmbeddings.has(text)) {
        results[idx] = newEmbeddings.get(text)!;
      } else if (cacheResults[text]) {
        results[idx] = cacheResults[text]!;
      }
    }

    return results;
  }

  /**
   * Generate vector representations with full metadata
   */
  async embedWithMetadata(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const embProvider = this._getProvider();
    const modelName = request.modelOverride ?? this._getDefaultModel(embProvider);

    // Check cache
    let cacheHits = 0;
    let textsToEmbed = [...request.texts];
    const cachedEmbeddings: Map<string, number[]> = new Map();

    if (this._cache) {
      const cacheResults = await this._cache.getBatch(request.texts, modelName);
      textsToEmbed = [];
      for (const text of request.texts) {
        if (cacheResults[text]) {
          cachedEmbeddings.set(text, cacheResults[text]!);
          cacheHits++;
        } else {
          textsToEmbed.push(text);
        }
      }
    }

    // Call provider
    if (textsToEmbed.length > 0) {
      const embeddings = await embProvider.embed(textsToEmbed, modelName);

      // Update cache
      if (this._cache) {
        const newItems: Record<string, number[]> = {};
        for (let i = 0; i < textsToEmbed.length; i++) {
          newItems[textsToEmbed[i]] = embeddings[i];
          cachedEmbeddings.set(textsToEmbed[i], embeddings[i]);
        }
        await this._cache.setBatch(newItems, modelName);
      }

      // Merge results
      const allEmbeddings = request.texts.map(t => cachedEmbeddings.get(t) ?? []);
      const actualDimensions = allEmbeddings.length > 0 && allEmbeddings[0] ? allEmbeddings[0].length : 0;

      return createEmbeddingResponse({
        embeddings: allEmbeddings,
        modelUsed: modelName,
        provider: embProvider.providerType as any,
        dimensions: actualDimensions,
        usage: createTokenUsage(),
        latencyMs: 0,
        cacheHits,
      });
    } else {
      // All cache hits
      const embeddings = request.texts.map(t => cachedEmbeddings.get(t) ?? []);
      const dimensions = embeddings.length > 0 && embeddings[0] ? embeddings[0].length : 0;

      return createEmbeddingResponse({
        embeddings,
        modelUsed: modelName,
        provider: embProvider.providerType as any,
        dimensions,
        usage: createTokenUsage(),
        latencyMs: 0,
        cacheHits,
      });
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   *
   * @returns Cosine similarity (-1 to 1)
   */
  similarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
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

    if (norm1 === 0 || norm2 === 0) return 0.0;

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Get vector dimensions for a model
   */
  async getDimensions(model?: string | null): Promise<number> {
    const provider = this._getProvider();
    const modelName = model ?? this._getDefaultModel(provider);
    // Embed a test string to determine dimensions
    const [embedding] = await provider.embed(['test'], modelName);
    return embedding.length;
  }
}

/**
 * Unit tests for EmbeddingService
 *
 * Tests cover:
 * - Provider management
 * - Embedding generation (single and batch)
 * - Cache integration
 * - Similarity calculation
 * - Error handling
 * - Provider fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmbeddingServiceImpl,
  EmbeddingError,
  ProviderUnavailableError,
  ProviderType,
} from '../../services/embedding-service';
import type { EmbeddingProvider, EmbeddingCache, BatchEmbeddingResponse } from '../../protocols/embedding';

// Mock EmbeddingProvider
class MockEmbeddingProvider implements EmbeddingProvider {
  readonly providerType: string;

  private embeddings: Map<string, number[][]> = new Map();
  private healthStatus: boolean = true;
  private dimensions: Map<string, number> = new Map();

  constructor(providerType: string = ProviderType.OPENAI) {
    this.providerType = providerType;
  }

  async embed(
    texts: string[],
    model: string
  ): Promise<BatchEmbeddingResponse> {
    if (!this.healthStatus) {
      throw new EmbeddingError('Provider unhealthy', this.providerType as ProviderType);
    }

    const key = `${model}:${texts.length}`;
    if (this.embeddings.has(key)) {
      return {
        embeddings: this.embeddings.get(key)!,
        model,
        provider: this.providerType,
        dimensions: this.dimensions.get(model) || 1536,
      };
    }

    // Generate mock embeddings
    const embeddings = texts.map(() =>
      Array.from({ length: 1536 }, () => Math.random() - 0.5)
    );
    this.embeddings.set(key, embeddings);
    return {
      embeddings,
      model,
      provider: this.providerType,
      dimensions: this.dimensions.get(model) || 1536,
    };
  }

  async healthCheck(): Promise<boolean> {
    return this.healthStatus;
  }

  getDimensions(model: string): number {
    return this.dimensions.get(model) || 1536;
  }

  // Test helpers
  setHealthStatus(status: boolean): void {
    this.healthStatus = status;
  }

  setDimensions(model: string, dims: number): void {
    this.dimensions.set(model, dims);
  }

  setEmbeddings(model: string, texts: string[], embeddings: number[][]): void {
    const key = `${model}:${texts.length}`;
    this.embeddings.set(key, embeddings);
  }
}

// Mock EmbeddingCache
class MockEmbeddingCache implements EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private statsData: { hits: number; misses: number } = { hits: 0, misses: 0 };

  async get(text: string, model: string): Promise<number[] | null> {
    const key = `${model}:${text}`;
    const result = this.cache.get(key);
    if (result) {
      this.statsData.hits++;
    } else {
      this.statsData.misses++;
    }
    return result || null;
  }

  async set(text: string, model: string, embedding: number[], ttl?: number): Promise<void> {
    const key = `${model}:${text}`;
    this.cache.set(key, embedding);
  }

  async getBatch(texts: string[], model: string): Promise<Record<string, number[] | null>> {
    const results: Record<string, number[] | null> = {};
    for (const text of texts) {
      results[text] = await this.get(text, model);
    }
    return results;
  }

  async setBatch(items: Record<string, number[]>, model: string, ttl?: number): Promise<void> {
    for (const [text, embedding] of Object.entries(items)) {
      await this.set(text, model, embedding, ttl);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.statsData = { hits: 0, misses: 0 };
  }

  async stats(): Promise<Record<string, unknown>> {
    return {
      size: this.cache.size,
      ...this.statsData,
    };
  }
}

describe('EmbeddingServiceImpl', () => {
  let mockProvider: MockEmbeddingProvider;
  let mockCache: MockEmbeddingCache;

  beforeEach(() => {
    mockProvider = new MockEmbeddingProvider();
    mockCache = new MockEmbeddingCache();
  });

  // ============================================================
  // Constructor and Provider Management
  // ============================================================

  describe('constructor', () => {
    it('should initialize with map of providers', () => {
      const providers = new Map([[ProviderType.OPENAI, mockProvider]]);
      const service = new EmbeddingServiceImpl(providers);

      expect(service.getAvailableProviders()).toEqual([ProviderType.OPENAI]);
      expect(service.getDefaultProvider()).toBe(ProviderType.OPENAI);
    });

    it('should initialize with record of providers', () => {
      const providers = {
        [ProviderType.OPENAI]: mockProvider,
      };
      const service = new EmbeddingServiceImpl(providers);

      expect(service.getAvailableProviders()).toEqual([ProviderType.OPENAI]);
    });

    it('should throw error if no providers provided', () => {
      expect(() => new EmbeddingServiceImpl(new Map())).toThrow(EmbeddingError);
    });

    it('should accept custom default provider', () => {
      const localProvider = new MockEmbeddingProvider(ProviderType.LOCAL);
      const providers = new Map([
        [ProviderType.OPENAI, mockProvider],
        [ProviderType.LOCAL, localProvider],
      ]);
      const service = new EmbeddingServiceImpl(providers, {
        defaultProvider: ProviderType.LOCAL,
      });

      expect(service.getDefaultProvider()).toBe(ProviderType.LOCAL);
    });

    it('should accept cache in config', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { cache: mockCache }
      );

      expect(service.getCacheStats()).toBeDefined();
    });
  });

  // ============================================================
  // Embedding Generation
  // ============================================================

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const embedding = await service.embed('test text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('should use specified model', async () => {
      mockProvider.setDimensions('custom-model', 768);
      mockProvider.setEmbeddings('custom-model', ['test text'], [Array.from({ length: 768 }, () => 0.5)]);
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const embedding = await service.embed('test text', { model: 'custom-model' });

      expect(embedding.length).toBe(768);
    });

    it('should throw error for unavailable provider', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      // Simulate all providers being unavailable
      mockProvider.setHealthStatus(false);

      await expect(service.embed('test')).rejects.toThrow(EmbeddingError);
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await service.embedBatch(texts);

      expect(embeddings.length).toBe(3);
      embeddings.forEach((emb) => {
        expect(Array.isArray(emb)).toBe(true);
        expect(emb.length).toBe(1536);
      });
    });

    it('should return empty array for empty input', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const embeddings = await service.embedBatch([]);

      expect(embeddings).toEqual([]);
    });

    it('should process large batches with batching', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const texts = Array.from({ length: 250 }, (_, i) => `text ${i}`);
      const embeddings = await service.embedBatch(texts, { batchSize: 100 });

      expect(embeddings.length).toBe(250);
    });

    it('should preserve order of results', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const texts = ['first', 'second', 'third'];
      const embeddings = await service.embedBatch(texts);

      // Each embedding should be unique and in order
      expect(embeddings[0]).not.toEqual(embeddings[1]);
      expect(embeddings[1]).not.toEqual(embeddings[2]);
    });
  });

  describe('embedWithMetadata', () => {
    it('should generate embedding with metadata', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const response = await service.embedWithMetadata({
        text: 'test text',
        model: 'text-embedding-3-small',
      });

      expect(response).toBeDefined();
      expect(response.embedding).toBeDefined();
      expect(Array.isArray(response.embedding)).toBe(true);
      expect(response.metadata.model).toBe('text-embedding-3-small');
      expect(response.metadata.provider).toBe(ProviderType.OPENAI);
      expect(response.metadata.dimensions).toBe(1536);
    });

    it('should track cache hits', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { cache: mockCache }
      );

      const request = { text: 'test text' };

      // First call - cache miss
      const response1 = await service.embedWithMetadata(request);
      expect(response1.metadata.cacheHits).toBe(0);

      // Second call - cache hit
      const response2 = await service.embedWithMetadata(request);
      expect(response2.metadata.cacheHits).toBe(1);
    });
  });

  // ============================================================
  // Cache Integration
  // ============================================================

  describe('cache integration', () => {
    it('should use cache for repeated embeddings', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { cache: mockCache }
      );

      const text = 'cached text';

      // First call - cache miss
      const embedding1 = await service.embed(text);

      // Second call - should use cache
      const embedding2 = await service.embed(text);

      expect(embedding1).toEqual(embedding2);

      const stats = await service.getCacheStats();
      expect(stats).toMatchObject({
        size: 1,
        hits: expect.any(Number),
      });
    });

    it('should batch cache operations', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { cache: mockCache }
      );

      const texts = ['text 1', 'text 2', 'text 3'];

      // First call - cache misses
      await service.embedBatch(texts);

      // Second call - all cache hits
      await service.embedBatch(texts);

      const stats = await service.getCacheStats();
      expect(stats).toMatchObject({
        size: 3,
        hits: expect.any(Number),
      });
    });

    it('should clear cache', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { cache: mockCache }
      );

      await service.embed('test text');
      await service.clearCache();

      const stats = await service.getCacheStats();
      expect(stats).toMatchObject({ size: 0 });
    });

    it('should preserve prior batch dimensions when a later batch omits them', async () => {
      class FlakyDimensionsProvider extends MockEmbeddingProvider {
        private callCount = 0;

        override async embed(texts: string[], model: string): Promise<BatchEmbeddingResponse> {
          this.callCount += 1;
          return {
            embeddings: texts.map((_, index) => [this.callCount, index]),
            model,
            provider: this.providerType,
            dimensions: this.callCount === 1 ? 2 : 0,
          };
        }
      }

      const provider = new FlakyDimensionsProvider();
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, provider]]),
      );

      const response = await (service as any)._executeWithCache(
        ['first', 'second'],
        'test-model',
        1,
      );

      expect(response.providerDimensions).toBe(2);
      expect(response.cacheHits).toBe(0);
      expect(response.results).toEqual({
        first: [1, 0],
        second: [2, 0],
      });
    });
  });

  // ============================================================
  // Similarity Calculation
  // ============================================================

  describe('similarity', () => {
    it('should calculate cosine similarity', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = service.similarity(vec1, vec2);

      expect(similarity).toBeCloseTo(1.0);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = service.similarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0.0);
    });

    it('should calculate similarity for opposite vectors', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = service.similarity(vec1, vec2);

      expect(similarity).toBeCloseTo(-1.0);
    });

    it('should throw error for mismatched dimensions', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const vec1 = [1, 0, 0];
      const vec2 = [1, 0];

      expect(() => service.similarity(vec1, vec2)).toThrow(EmbeddingError);
    });

    it('should return 0 for zero vectors', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = service.similarity(vec1, vec2);

      expect(similarity).toBe(0.0);
    });
  });

  // ============================================================
  // Dimension Query
  // ============================================================

  describe('getDimensions', () => {
    it('should return dimensions for model', () => {
      mockProvider.setDimensions('text-embedding-3-small', 1536);
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const dims = service.getDimensions('text-embedding-3-small');

      expect(dims).toBe(1536);
    });

    it('should use default model if not specified', () => {
      mockProvider.setDimensions('default-model', 768);
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { defaultModel: 'default-model' }
      );

      const dims = service.getDimensions();

      expect(dims).toBe(768);
    });
  });

  // ============================================================
  // Provider Fallback
  // ============================================================

  describe('provider fallback', () => {
    it('should fallback to available provider when requested provider not in map', async () => {
      const openaiProvider = new MockEmbeddingProvider(ProviderType.OPENAI);
      const localProvider = new MockEmbeddingProvider(ProviderType.LOCAL);

      const service = new EmbeddingServiceImpl(
        new Map([
          [ProviderType.OPENAI, openaiProvider],
          [ProviderType.LOCAL, localProvider],
        ]),
        { defaultProvider: ProviderType.OPENAI }
      );

      // Request a provider that doesn't exist - should fallback to default
      const embedding = await service.embed('test', { model: 'test-model' });

      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should throw error if all providers unavailable', async () => {
      const provider1 = new MockEmbeddingProvider(ProviderType.OPENAI);
      provider1.setHealthStatus(false);

      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, provider1]])
      );

      // Provider will throw when trying to embed
      await expect(service.embed('test')).rejects.toThrow();
    });

    it('should use the first available provider for health checks when the requested provider is missing', async () => {
      const openaiProvider = new MockEmbeddingProvider(ProviderType.OPENAI);
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, openaiProvider]])
      );

      await expect(service.healthCheck(ProviderType.LOCAL)).resolves.toBe(true);
    });

    it('should throw ProviderUnavailableError when the provider registry becomes empty', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      (service as unknown as { providers: Map<ProviderType, EmbeddingProvider> }).providers.clear();

      await expect(service.healthCheck(ProviderType.LOCAL)).rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('default model selection', () => {
    it('should fall back to the OpenAI default model for unknown provider types', () => {
      const customProvider = new MockEmbeddingProvider('custom-provider');
      customProvider.setDimensions('text-embedding-3-small', 321);

      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, customProvider as unknown as EmbeddingProvider]])
      );

      expect(service.getDimensions()).toBe(321);
    });
  });

  // ============================================================
  // Health Check
  // ============================================================

  describe('healthCheck', () => {
    it('should return true for healthy provider', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const health = await service.healthCheck();

      expect(health).toBe(true);
    });

    it('should return false for unhealthy provider', async () => {
      mockProvider.setHealthStatus(false);
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]])
      );

      const health = await service.healthCheck();

      expect(health).toBe(false);
    });
  });

  // ============================================================
  // Provider Management
  // ============================================================

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const openai = new MockEmbeddingProvider(ProviderType.OPENAI);
      const local = new MockEmbeddingProvider(ProviderType.LOCAL);

      const service = new EmbeddingServiceImpl(
        new Map([
          [ProviderType.OPENAI, openai],
          [ProviderType.LOCAL, local],
        ])
      );

      const providers = service.getAvailableProviders();

      expect(providers).toEqual(expect.arrayContaining([ProviderType.OPENAI, ProviderType.LOCAL]));
    });
  });

  describe('getDefaultProvider', () => {
    it('should return default provider', () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.OPENAI, mockProvider]]),
        { defaultProvider: ProviderType.OPENAI }
      );

      const provider = service.getDefaultProvider();

      expect(provider).toBe(ProviderType.OPENAI);
    });
  });
});

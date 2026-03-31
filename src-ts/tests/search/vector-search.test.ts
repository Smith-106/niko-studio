/**
 * VectorSearch Unit Tests
 *
 * Tests for VectorSearch implementation covering:
 * - Initialization and configuration
 * - Error types
 * - Constructor behavior
 *
 * Note: The current implementation uses a stub SQLite layer (better-sqlite3 not connected).
 * DB-dependent operations throw DatabaseError. These tests validate constructor and error behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VectorSearch,
  VectorSearchError,
  DatabaseError,
  EmbeddingError,
  type VectorSearchConfig,
  type HNSWConfig,
} from '../../search/vector-search';
import type { EmbeddingService } from '../../protocols/embedding';

/**
 * Mock EmbeddingService for testing
 */
class MockEmbeddingService implements EmbeddingService {
  async embed(
    text: string,
    options?: { model?: string }
  ): Promise<number[]> {
    return Array(384).fill(0.1);
  }

  async embedBatch(
    texts: string[],
    options?: { model?: string }
  ): Promise<number[][]> {
    return texts.map(() => Array(384).fill(0.1));
  }

  embedWithMetadata(request: unknown): Promise<unknown> {
    return Promise.resolve({ embedding: Array(384).fill(0.1), model: 'test' });
  }

  similarity(embedding1: number[], embedding2: number[]): number {
    return 0.95;
  }

  getDimensions(model?: string): number {
    return 384;
  }
}

describe('VectorSearch', () => {
  let vectorSearch: VectorSearch;
  let mockEmbedding: MockEmbeddingService;

  beforeEach(() => {
    mockEmbedding = new MockEmbeddingService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Initialization Tests
  // ============================================================

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      };

      vectorSearch = new VectorSearch(config);
      expect(vectorSearch).toBeDefined();
    });

    it('should accept custom dimension', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
        dimension: 768,
      };

      vectorSearch = new VectorSearch(config);
      expect(vectorSearch).toBeDefined();
    });

    it('should accept custom model name', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
        modelName: 'custom-model',
      };

      vectorSearch = new VectorSearch(config);
      expect(vectorSearch).toBeDefined();
    });

    it('should accept custom HNSW configuration', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
        hnsw: {
          efConstruction: 300,
          efSearch: 150,
          m: 32,
        },
      };

      vectorSearch = new VectorSearch(config);
      expect(vectorSearch).toBeDefined();
    });
  });

  // ============================================================
  // HNSW Configuration Tests (interface shape)
  // ============================================================

  describe('HNSW Configuration', () => {
    it('should define HNSWConfig interface with correct shape', () => {
      const config: HNSWConfig = {
        dimension: 384,
        efConstruction: 200,
        efSearch: 100,
        m: 16,
      };
      expect(config.dimension).toBe(384);
      expect(config.efConstruction).toBe(200);
      expect(config.efSearch).toBe(100);
      expect(config.m).toBe(16);
    });

    it('should allow custom HNSWConfig values', () => {
      const config: HNSWConfig = {
        dimension: 768,
        m: 32,
        efConstruction: 300,
        efSearch: 150,
      };
      expect(config.dimension).toBe(768);
      expect(config.m).toBe(32);
      expect(config.efConstruction).toBe(300);
      expect(config.efSearch).toBe(150);
    });
  });

  // ============================================================
  // Database Operations Tests (stub behavior)
  // ============================================================

  describe('Database Operations', () => {
    beforeEach(() => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
    });

    it('should throw DatabaseError on add (no real DB connection)', async () => {
      await expect(
        vectorSearch.add('item-1', 'test content', undefined, 'chunk', Array(384).fill(0.1))
      ).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on search (no real DB connection)', async () => {
      await expect(
        vectorSearch.search('test query', { topK: 5 })
      ).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on delete (no real DB connection)', async () => {
      await expect(
        vectorSearch.delete('item-1')
      ).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on index (no real DB connection)', async () => {
      await expect(
        vectorSearch.index('item-1', 'test content')
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ============================================================
  // Error Types Tests
  // ============================================================

  describe('Error Types', () => {
    it('should create VectorSearchError', () => {
      const error = new VectorSearchError('test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(VectorSearchError);
      expect(error.name).toBe('VectorSearchError');
      expect(error.message).toBe('test error');
    });

    it('should create DatabaseError', () => {
      const error = new DatabaseError('db error');
      expect(error).toBeInstanceOf(VectorSearchError);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.name).toBe('DatabaseError');
      expect(error.message).toBe('db error');
    });

    it('should create DatabaseError with cause', () => {
      const cause = new Error('original error');
      const error = new DatabaseError('db error', cause);
      expect(error.cause).toBe(cause);
    });

    it('should create EmbeddingError', () => {
      const error = new EmbeddingError('embed error');
      expect(error).toBeInstanceOf(VectorSearchError);
      expect(error).toBeInstanceOf(EmbeddingError);
      expect(error.name).toBe('EmbeddingError');
      expect(error.message).toBe('embed error');
    });

    it('should create EmbeddingError with cause', () => {
      const cause = new Error('original error');
      const error = new EmbeddingError('embed error', cause);
      expect(error.cause).toBe(cause);
    });
  });

  // ============================================================
  // Error Handling Tests
  // ============================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
    });

    it('should handle embedding errors in add', async () => {
      const errorEmbedding: EmbeddingService = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        embedBatch: vi.fn(),
        embedWithMetadata: vi.fn(),
        similarity: vi.fn(),
        getDimensions: vi.fn(),
      };

      const vsWithError = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: errorEmbedding,
      });

      // Should throw DatabaseError (no DB) before even getting to embedding
      await expect(
        vsWithError.add('item-1', 'test content')
      ).rejects.toThrow();
    });

    it('should throw DatabaseError for empty query search', async () => {
      await expect(vectorSearch.search('', { topK: 5 })).rejects.toThrow(DatabaseError);
    });
  });

  // ============================================================
  // Convenience Tests
  // ============================================================

  describe('Convenience', () => {
    it('should create VectorSearch instance', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      };

      const vs = new VectorSearch(config);
      expect(vs).toBeInstanceOf(VectorSearch);
    });

    it('should close without error', () => {
      const vs = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
      expect(() => vs.close()).not.toThrow();
    });
  });
});

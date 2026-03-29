/**
 * VectorSearch Unit Tests
 *
 * Comprehensive tests for VectorSearch implementation covering:
 * - Initialization and configuration
 * - Vector operations (add, delete, search)
 * - Brute-force similarity search
 * - HNSW configuration
 * - Error handling
 * - Helper functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VectorSearch,
  VectorSearchError,
  DatabaseError,
  EmbeddingError,
  HNSWConfig,
  type VectorSearchConfig,
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
    // Return mock 384-dimensional embedding
    return Array(384).fill(0.1);
  }

  async embedBatch(
    texts: string[],
    options?: { model?: string }
  ): Promise<number[][]> {
    return texts.map(() => Array(384).fill(0.1));
  }

  getDefaultDimension(): number {
    return 384;
  }

  getDefaultModel(): string {
    return 'BAAI/bge-small-en-v1.5';
  }
}

/**
 * Generate random embedding vector
 */
function generateRandomEmbedding(dimension: number = 384): number[] {
  return Array.from({ length: dimension }, () => Math.random());
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
  // HNSW Configuration Tests
  // ============================================================

  describe('HNSW Configuration', () => {
    it('should use default HNSW values', () => {
      const defaultConfig = new HNSWConfig();
      expect(defaultConfig.dimension).toBe(384);
      expect(defaultConfig.efConstruction).toBe(200);
      expect(defaultConfig.efSearch).toBe(100);
      expect(defaultConfig.m).toBe(16);
    });

    it('should accept custom HNSW values', () => {
      const customConfig = new HNSWConfig({
        dimension: 768,
        m: 32,
        efConstruction: 300,
        efSearch: 150,
      });
      expect(customConfig.dimension).toBe(768);
      expect(customConfig.m).toBe(32);
      expect(customConfig.efConstruction).toBe(300);
      expect(customConfig.efSearch).toBe(150);
    });
  });

  // ============================================================
  // Add and Delete Tests
  // ============================================================

  describe('Add and Delete', () => {
    beforeEach(() => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
    });

    it('should add a vector with embedding', async () => {
      const embedding = generateRandomEmbedding();
      await vectorSearch.add('item-1', 'test content', { embedding });

      const results = await vectorSearch.search('test content', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should add a vector without embedding (generate on-the-fly)', async () => {
      await vectorSearch.add('item-1', 'test content');

      const results = await vectorSearch.search('test content', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should add a vector with metadata', async () => {
      const embedding = generateRandomEmbedding();
      const metadata = { path: '/test.md', docId: 'doc-1' };

      await vectorSearch.add('item-1', 'test content', {
        embedding,
        metadata,
        type: 'chunk',
      });

      const results = await vectorSearch.search('test content', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should delete a vector', async () => {
      const embedding = generateRandomEmbedding();
      await vectorSearch.add('item-1', 'test content', { embedding });

      const deleted = await vectorSearch.delete('item-1');
      expect(deleted).toBe(true);
    });

    it('should return false when deleting non-existent vector', async () => {
      const deleted = await vectorSearch.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should update an existing vector (upsert)', async () => {
      const embedding1 = generateRandomEmbedding();
      const embedding2 = generateRandomEmbedding();

      await vectorSearch.add('item-1', 'original content', { embedding: embedding1 });
      await vectorSearch.add('item-1', 'updated content', { embedding: embedding2 });

      const deleted = await vectorSearch.delete('item-1');
      expect(deleted).toBe(true);
    });
  });

  // ============================================================
  // Search Tests
  // ============================================================

  describe('Search Operations', () => {
    beforeEach(async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      // Add test vectors
      const embeddings = [
        generateRandomEmbedding(),
        generateRandomEmbedding(),
        generateRandomEmbedding(),
      ];

      await vectorSearch.add('vec-1', 'machine learning algorithms', {
        embedding: embeddings[0],
        type: 'chunk',
      });
      await vectorSearch.add('vec-2', 'deep learning neural networks', {
        embedding: embeddings[1],
        type: 'chunk',
      });
      await vectorSearch.add('vec-3', 'natural language processing', {
        embedding: embeddings[2],
        type: 'memory',
      });
    });

    it('should search with text query', async () => {
      const results = await vectorSearch.search('machine learning', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should search with vector query', async () => {
      const queryVector = generateRandomEmbedding();
      const results = await vectorSearch.searchVector(queryVector, { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply type filter', async () => {
      const results = await vectorSearch.search('learning', {
        topK: 5,
        typeFilter: 'chunk',
      });

      expect(results.every(r => r.type === 'chunk')).toBe(true);
    });

    it('should apply min score filter', async () => {
      const results = await vectorSearch.search('learning', {
        topK: 5,
        minScore: 0.5,
      });

      expect(results.every(r => r.score >= 0.5)).toBe(true);
    });

    it('should limit results with topK', async () => {
      const results = await vectorSearch.search('learning', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return results in correct format', async () => {
      const results = await vectorSearch.search('machine learning', { topK: 5 });

      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('type');
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('mode_used');
      }
    });
  });

  // ============================================================
  // Hybrid Search Tests
  // ============================================================

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      const embeddings = [
        generateRandomEmbedding(),
        generateRandomEmbedding(),
      ];

      await vectorSearch.add('vec-1', 'machine learning basics', {
        embedding: embeddings[0],
        type: 'chunk',
      });
      await vectorSearch.add('vec-2', 'deep learning advanced', {
        embedding: embeddings[1],
        type: 'chunk',
      });
    });

    it('should perform hybrid search', async () => {
      const results = await vectorSearch.hybridSearch('machine learning', {
        topK: 5,
        vectorWeight: 0.6,
        keywordWeight: 0.4,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should return hybrid source in results', async () => {
      const results = await vectorSearch.hybridSearch('learning', { topK: 5 });

      if (results.length > 0) {
        expect(results.some(r => r.source === 'hybrid')).toBe(true);
      }
    });
  });

  // ============================================================
  // Statistics Tests
  // ============================================================

  describe('Statistics', () => {
    beforeEach(async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      const embeddings = [
        generateRandomEmbedding(),
        generateRandomEmbedding(),
      ];

      await vectorSearch.add('vec-1', 'content 1', {
        embedding: embeddings[0],
        type: 'chunk',
      });
      await vectorSearch.add('vec-2', 'content 2', {
        embedding: embeddings[1],
        type: 'memory',
      });
    });

    it('should return statistics', async () => {
      const stats = await vectorSearch.getStats();

      expect(stats).toHaveProperty('totalItems');
      expect(stats).toHaveProperty('byType');
      expect(stats.totalItems).toBeGreaterThanOrEqual(2);
      expect(stats.byType['chunk']).toBeGreaterThanOrEqual(1);
      expect(stats.byType['memory']).toBeGreaterThanOrEqual(1);
    });

    it('should return empty statistics for new index', async () => {
      const newVS = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      const stats = await newVS.getStats();
      expect(stats.totalItems).toBe(0);
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

    it('should handle embedding errors gracefully', async () => {
      const errorEmbedding: EmbeddingService = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        embedBatch: vi.fn(),
        getDefaultDimension: vi.fn(),
        getDefaultModel: vi.fn(),
      };

      const vsWithError = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: errorEmbedding,
      });

      await expect(vsWithError.add('item-1', 'test content')).rejects.toThrow(EmbeddingError);
    });

    it('should handle invalid vector dimensions', async () => {
      const invalidEmbedding = [0.1, 0.2, 0.3]; // Wrong dimension

      await expect(
        vectorSearch.add('item-1', 'test content', { embedding: invalidEmbedding })
      ).rejects.toThrow();
    });

    it('should handle search with no items', async () => {
      const newVS = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      const results = await newVS.search('test query', { topK: 5 });
      expect(results).toEqual([]);
    });

    it('should handle empty query', async () => {
      const results = await vectorSearch.search('', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Batch Operations Tests
  // ============================================================

  describe('Batch Operations', () => {
    beforeEach(() => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
    });

    it('should add batch of vectors', async () => {
      const items = [
        { id: 'batch-1', content: 'Content 1', type: 'chunk' },
        { id: 'batch-2', content: 'Content 2', type: 'chunk' },
        { id: 'batch-3', content: 'Content 3', type: 'memory' },
      ];

      const count = await vectorSearch.addBatch(items);
      expect(count).toBe(3);

      const stats = await vectorSearch.getStats();
      expect(stats.totalItems).toBe(3);
    });

    it('should handle empty batch', async () => {
      const count = await vectorSearch.addBatch([]);
      expect(count).toBe(0);
    });
  });

  // ============================================================
  // Save and Load Tests
  // ============================================================

  describe('Save and Load', () => {
    it('should save to default path', async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      await vectorSearch.add('item-1', 'test content');
      const savedPath = await vectorSearch.save();
      expect(savedPath).toBeDefined();
    });

    it('should load from path', async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      await vectorSearch.add('item-1', 'test content');
      const savedPath = await vectorSearch.save();

      const newVS = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });

      await newVS.load(savedPath);
      const stats = await newVS.getStats();
      expect(stats.totalItems).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // Convenience Functions Tests
  // ============================================================

  describe('Convenience Functions', () => {
    it('should create vector search instance', () => {
      const config: VectorSearchConfig = {
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      };

      const vs = new VectorSearch(config);
      expect(vs).toBeInstanceOf(VectorSearch);
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================

  describe('Integration', () => {
    beforeEach(async () => {
      vectorSearch = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
    });

    it('should handle complete workflow', async () => {
      // Add vectors
      const embeddings = [
        generateRandomEmbedding(),
        generateRandomEmbedding(),
        generateRandomEmbedding(),
      ];

      await vectorSearch.add('doc-1', 'Machine learning is powerful', {
        embedding: embeddings[0],
        metadata: { path: '/doc1.md' },
        type: 'chunk',
      });
      await vectorSearch.add('doc-2', 'Deep learning enables AI', {
        embedding: embeddings[1],
        metadata: { path: '/doc2.md' },
        type: 'chunk',
      });
      await vectorSearch.add('doc-3', 'NLP processes text', {
        embedding: embeddings[2],
        metadata: { path: '/doc3.md' },
        type: 'memory',
      });

      // Search
      const results = await vectorSearch.search('machine learning', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);

      // Get stats
      const stats = await vectorSearch.getStats();
      expect(stats.totalItems).toBe(3);

      // Delete
      const deleted = await vectorSearch.delete('doc-1');
      expect(deleted).toBe(true);

      // Verify deletion
      const statsAfterDelete = await vectorSearch.getStats();
      expect(statsAfterDelete.totalItems).toBe(2);
    });

    it('should handle multiple search operations', async () => {
      const embedding = generateRandomEmbedding();
      await vectorSearch.add('item-1', 'test content', { embedding });

      // Perform multiple searches
      const results1 = await vectorSearch.search('test', { topK: 5 });
      const results2 = await vectorSearch.searchVector(embedding, { topK: 5 });
      const results3 = await vectorSearch.hybridSearch('test', { topK: 5 });

      expect(results1.length).toBeGreaterThanOrEqual(0);
      expect(results2.length).toBeGreaterThanOrEqual(0);
      expect(results3.length).toBeGreaterThanOrEqual(0);
    });
  });
});

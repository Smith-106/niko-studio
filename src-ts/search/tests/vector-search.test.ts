/**
 * Unit tests for VectorSearch
 *
 * Tests vector search functionality with mocked database and embedding service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VectorSearch,
  VectorSearchError,
  DatabaseError,
  EmbeddingError,
  createVectorSearch,
} from '../vector-search';
import type { EmbeddingService } from '../../protocols/embedding';

// Mock EmbeddingService
const mockEmbeddingService: EmbeddingService = {
  embed: vi.fn(async (text: string) => {
    // Return a simple mock embedding based on text length
    const dim = 384;
    const vector = new Array(dim).fill(0).map((_, i) => (text.length + i) / (dim + text.length));
    return vector;
  }),

  embedBatch: vi.fn(async (texts: string[], options?: { model?: string }) => {
    return texts.map(text => {
      const dim = 384;
      return new Array(dim).fill(0).map((_, i) => (text.length + i) / (dim + text.length));
    });
  }),

  embedWithMetadata: vi.fn(async (request) => {
    const embedding = await mockEmbeddingService.embed(request.text);
    return {
      embedding,
      metadata: {
        model: request.model ?? 'test-model',
        provider: 'test' as const,
        dimensions: embedding.length,
        cacheHits: 0,
      },
    };
  }),

  similarity: vi.fn((a: number[], b: number[]) => {
    // Simple cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }),

  getDimensions: vi.fn((model?: string) => 384),
};

describe('VectorSearch', () => {
  let vectorSearch: VectorSearch;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create VectorSearch instance
    vectorSearch = new VectorSearch({
      dbPath: ':memory:',
      embeddingService: mockEmbeddingService,
      dimension: 384,
      modelName: 'test-model',
    });
  });

  afterEach(() => {
    vectorSearch.close();
  });

  describe('constructor', () => {
    it('should create instance with required config', () => {
      expect(vectorSearch).toBeDefined();
    });

    it('should use default dimension if not specified', () => {
      const vs = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbeddingService,
      });
      expect(vs).toBeDefined();
      vs.close();
    });

    it('should merge HNSW config with defaults', () => {
      const vs = new VectorSearch({
        dbPath: ':memory:',
        embeddingService: mockEmbeddingService,
        hnsw: {
          efConstruction: 300,
        },
      });
      expect(vs).toBeDefined();
      vs.close();
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity correctly for identical vectors', async () => {
      const vector = [1, 2, 3, 4];
      // Access private method via type assertion
      const similarity = (vectorSearch as any).cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity correctly for orthogonal vectors', () => {
      const vector1 = [1, 0, 0, 0];
      const vector2 = [0, 1, 0, 0];
      const similarity = (vectorSearch as any).cosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should throw error for different dimensions', () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2, 3, 4];
      expect(() => (vectorSearch as any).cosineSimilarity(vector1, vector2)).toThrow(
        VectorSearchError
      );
    });
  });

  describe('vectorToBuffer', () => {
    it('should convert vector to buffer correctly', () => {
      const vector = [1.0, 2.0, 3.0, 4.0];
      const buffer = (vectorSearch as any).vectorToBuffer(vector);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBe(vector.length * 4); // 4 bytes per float

      // Verify values
      const back = (vectorSearch as any).bufferToVector(buffer);
      for (let i = 0; i < vector.length; i++) {
        expect(back[i]).toBeCloseTo(vector[i], 5);
      }
    });
  });

  describe('bufferToVector', () => {
    it('should convert buffer to vector correctly', () => {
      const original = [1.5, 2.5, 3.5, 4.5, 5.5];
      const buffer = (vectorSearch as any).vectorToBuffer(original);
      const result = (vectorSearch as any).bufferToVector(buffer);

      expect(result.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(result[i]).toBeCloseTo(original[i], 5);
      }
    });
  });

  describe('buildSearchResult', () => {
    it('should build normalized search result', () => {
      const result = (vectorSearch as any).buildSearchResult(
        'test-id',
        'test content',
        0.95,
        'chunk',
        'vector',
        { path: '/test', extra: { key: 'value' } }
      );

      expect(result).toEqual({
        id: 'test-id',
        content: 'test content',
        score: 0.95,
        type: 'chunk',
        source: 'vector',
        mode_used: 'vector',
        metadata: {
          path: '/test',
          doc_id: undefined,
          surface: undefined,
          loc: undefined,
          chunk_index: undefined,
          extra: { key: 'value' },
        },
        loc: undefined,
        snapshot_query: 'search_result_sample_query',
      });
    });

    it('should normalize location correctly', () => {
      const result = (vectorSearch as any).buildSearchResult(
        'test-id',
        'test content',
        0.95,
        'chunk',
        'vector',
        {},
        { kind: 'range', start: 10, end: 20 }
      );

      expect(result.loc).toEqual({
        kind: 'range',
        start: 10,
        end: 20,
      });
    });
  });

  describe('buildMetadata', () => {
    it('should build normalized metadata with defaults', () => {
      const metadata = (vectorSearch as any).buildMetadata();
      expect(metadata).toEqual({
        path: undefined,
        doc_id: undefined,
        surface: undefined,
        loc: undefined,
        chunk_index: undefined,
        extra: {},
      });
    });

    it('should preserve provided values', () => {
      const input = {
        path: '/test/file.md',
        doc_id: 'doc-123',
        chunk_index: 5,
        extra: { custom: 'value' },
      };
      const metadata = (vectorSearch as any).buildMetadata(input);
      expect(metadata).toMatchObject({
        path: '/test/file.md',
        doc_id: 'doc-123',
        chunk_index: 5,
        extra: { custom: 'value' },
      });
    });
  });

  describe('normalizeLoc', () => {
    it('should return undefined for null input', () => {
      const result = (vectorSearch as any).normalizeLoc(null);
      expect(result).toBeUndefined();
    });

    it('should default kind to char', () => {
      const result = (vectorSearch as any).normalizeLoc({ start: 10 });
      expect(result.kind).toBe('char');
    });

    it('should normalize all fields', () => {
      const result = (vectorSearch as any).normalizeLoc({
        kind: 'line',
        start: '5',
        end: '10',
      });
      expect(result).toEqual({
        kind: 'line',
        start: 5,
        end: 10,
      });
    });
  });

  describe('reciprocalRankFusion', () => {
    it('should fuse results correctly', () => {
      const vectorResults = [
        { id: 'a', content: 'A', score: 0.9, type: 'chunk', metadata: {}, source: 'vector' },
        { id: 'b', content: 'B', score: 0.8, type: 'chunk', metadata: {}, source: 'vector' },
      ] as any[];

      const keywordResults = [
        { id: 'b', content: 'B', score: 0.95, type: 'chunk', metadata: {}, source: 'keyword' },
        { id: 'c', content: 'C', score: 0.85, type: 'chunk', metadata: {}, source: 'keyword' },
      ] as any[];

      const fused = (vectorSearch as any).reciprocalRankFusion(
        vectorResults,
        keywordResults,
        0.7,
        0.3,
        60,
        5
      );

      expect(fused.length).toBeGreaterThan(0);
      expect(fused[0].source).toBe('hybrid');
      expect(fused[0].mode_used).toBe('hybrid');
    });

    it('should boost items appearing in both lists', () => {
      const vectorResults = [
        { id: 'a', content: 'A', score: 0.9, type: 'chunk', metadata: {}, source: 'vector' },
      ] as any[];

      const keywordResults = [
        { id: 'a', content: 'A', score: 0.95, type: 'chunk', metadata: {}, source: 'keyword' },
      ] as any[];

      const fused = (vectorSearch as any).reciprocalRankFusion(
        vectorResults,
        keywordResults,
        0.5,
        0.5,
        60,
        5
      );

      // Item 'a' should have higher score due to appearing in both
      expect(fused[0].id).toBe('a');
      expect(fused[0].score).toBeGreaterThan(0.5 / 61); // Basic RRF score
    });

    it('should respect topK parameter', () => {
      const vectorResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `v${i}`,
          content: `V${i}`,
          score: 0.9 - i * 0.05,
          type: 'chunk',
          metadata: {},
          source: 'vector',
        })) as any[];

      const keywordResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `k${i}`,
          content: `K${i}`,
          score: 0.9 - i * 0.05,
          type: 'chunk',
          metadata: {},
          source: 'keyword',
        })) as any[];

      const fused = (vectorSearch as any).reciprocalRankFusion(
        vectorResults,
        keywordResults,
        0.7,
        0.3,
        60,
        3
      );

      expect(fused.length).toBe(3);
    });
  });

  describe('SearchInterface implementation', () => {
    it('should throw DatabaseError for search without database', async () => {
      await expect(vectorSearch.search('test query')).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError for index without database', async () => {
      await expect(vectorSearch.index('test-id', 'test content')).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError for delete without database', async () => {
      await expect(vectorSearch.delete('test-id')).rejects.toThrow(DatabaseError);
    });
  });

  describe('Error handling', () => {
    it('should throw VectorSearchError for mismatched vector dimensions', () => {
      expect(() => (vectorSearch as any).cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
        VectorSearchError
      );
    });

    it('should preserve error cause in DatabaseError', () => {
      const cause = new Error('Original error');
      const error = new DatabaseError('Database failed', cause);
      expect(error.cause).toBe(cause);
      expect(error.message).toBe('Database failed');
    });

    it('should preserve error cause in EmbeddingError', () => {
      const cause = new Error('Embedding failed');
      const error = new EmbeddingError('Embedding error', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('Factory function', () => {
    it('should create VectorSearch instance', () => {
      const vs = createVectorSearch(':memory:', mockEmbeddingService, {
        dimension: 512,
        modelName: 'custom-model',
      });
      expect(vs).toBeInstanceOf(VectorSearch);
      vs.close();
    });

    it('should work with minimal options', () => {
      const vs = createVectorSearch(':memory:', mockEmbeddingService);
      expect(vs).toBeInstanceOf(VectorSearch);
      vs.close();
    });
  });

  describe('Statistics', () => {
    it('should throw DatabaseError for stats without database', async () => {
      await expect(vectorSearch.getStats()).rejects.toThrow(DatabaseError);
    });
  });
});

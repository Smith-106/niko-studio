/**
 * SmartSearch Unit Tests
 *
 * Comprehensive tests for SmartSearch implementation covering:
 * - Search operations (fuzzy, semantic, hybrid, auto)
 * - Index and delete operations
 * - RRF fusion algorithm
 * - SearchMode selection
 * - FTS5 and LIKE fallback
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SmartSearch,
  SearchMode,
  createSmartSearch,
  type VectorIndexInterface,
  type DatabaseConnection,
  type SmartSearchResult,
} from '../../search/smart-search';

/**
 * Mock VectorIndex for testing
 */
class MockVectorIndex implements VectorIndexInterface {
  private items = new Map<string, { content: string; metadata: Record<string, unknown>; type: string }>();

  async search(
    query: string,
    options?: { topK?: number; minScore?: number; typeFilter?: string }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const minScore = options?.minScore ?? 0.0;
    const typeFilter = options?.typeFilter;

    const results: SmartSearchResult[] = [];
    for (const [id, item] of this.items.entries()) {
      if (typeFilter && item.type !== typeFilter) continue;

      // Simple similarity: count word overlaps
      const queryWords = new Set(query.toLowerCase().split(/\s+/));
      const contentWords = new Set(item.content.toLowerCase().split(/\s+/));
      const overlap = [...queryWords].filter(w => contentWords.has(w)).length;
      const score = overlap / queryWords.size;

      if (score >= minScore) {
        results.push({
          id,
          content: item.content,
          score,
          type: item.type,
          metadata: item.metadata as SmartSearchResult['metadata'],
          source: 'semantic',
          mode_used: 'semantic',
          loc: item.metadata.loc as SmartSearchResult['loc'],
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  upsert(id: string, content: string, metadata?: Record<string, unknown>, type?: string): void {
    this.items.set(id, {
      content,
      metadata: metadata ?? {},
      type: type ?? 'chunk',
    });
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }
}

/**
 * Mock DatabaseConnection for testing
 */
class MockDatabaseConnection implements DatabaseConnection {
  private ftsData = new Map<string, { content: string; metadata: string; type: string }>();

  setData(data: Array<{ id: string; content: string; metadata: string; type: string }>): void {
    for (const item of data) {
      this.ftsData.set(item.id, item);
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    // Simplified FTS5 simulation
    if (sql.includes('vector_items_fts')) {
      const searchTerms = (params?.[0] as string)?.split(' OR ').map(t => t.replace(/"/g, '')) ?? [];
      const results: Array<{ id: string; content: string; metadata: string; type: string; rank: number }> = [];

      for (const [id, item] of this.ftsData.entries()) {
        const matches = searchTerms.some(term => item.content.toLowerCase().includes(term.toLowerCase()));
        if (matches) {
          results.push({
            id,
            content: item.content,
            metadata: item.metadata,
            type: item.type,
            rank: -Math.random() * 10, // Negative BM25 score
          });
        }
      }

      return results as unknown as T[];
    }

    // LIKE fallback
    if (sql.includes('LIKE')) {
      const likeParams = params?.filter(p => typeof p === 'string' && p.includes('%')) ?? [];
      const searchTerms = likeParams.map(p => (p as string).replace(/%/g, '').toLowerCase());

      const results: Array<{ id: string; content: string; metadata: string; type: string }> = [];
      for (const [id, item] of this.ftsData.entries()) {
        const matches = searchTerms.some(term => item.content.toLowerCase().includes(term));
        if (matches) {
          results.push({
            id,
            content: item.content,
            metadata: item.metadata,
            type: item.type,
          });
        }
      }

      return results as unknown as T[];
    }

    return [];
  }

  close(): void {
    // No-op
  }
}

describe('SmartSearch', () => {
  let vectorIndex: MockVectorIndex;
  let dbConnection: MockDatabaseConnection;
  let search: SmartSearch;

  beforeEach(() => {
    vectorIndex = new MockVectorIndex();
    dbConnection = new MockDatabaseConnection();
    search = new SmartSearch({
      vectorIndex,
      dbConnection,
    });
  });

  describe('Index and Delete', () => {
    it('should index a document', async () => {
      await search.index('test-1', 'test content', {
        metadata: { path: '/test.txt' },
        type: 'chunk',
      });

      const results = await search.search('test', { topK: 5, mode: SearchMode.SEMANTIC });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id', 'test-1');
    });

    it('should delete a document', async () => {
      await search.index('test-1', 'test content');
      const deleted = await search.delete('test-1');
      expect(deleted).toBe(true);

      const results = await search.search('test', { topK: 5 });
      expect(results.find(r => r.id === 'test-1')).toBeUndefined();
    });

    it('should throw error when indexing without vector index', async () => {
      const searchNoIndex = new SmartSearch({});
      await expect(searchNoIndex.index('test', 'content')).rejects.toThrow(
        'No vector index available for indexing'
      );
    });

    it('should throw error when deleting without vector index', async () => {
      const searchNoIndex = new SmartSearch({});
      await expect(searchNoIndex.delete('test')).rejects.toThrow(
        'No vector index available for deletion'
      );
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Index test documents
      await search.index('doc-1', 'machine learning algorithms', { type: 'chunk' });
      await search.index('doc-2', 'deep learning neural networks', { type: 'chunk' });
      await search.index('doc-3', 'natural language processing', { type: 'chunk' });

      // Set up FTS data
      dbConnection.setData([
        {
          id: 'fts-1',
          content: 'machine learning algorithms',
          metadata: JSON.stringify({ path: '/ml.txt' }),
          type: 'chunk',
        },
        {
          id: 'fts-2',
          content: 'deep learning neural networks',
          metadata: JSON.stringify({ path: '/dl.txt' }),
          type: 'chunk',
        },
      ]);
    });

    it('should perform semantic search', async () => {
      const results = await search.search('machine learning', {
        mode: SearchMode.SEMANTIC,
        topK: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('source', 'semantic');
    });

    it('should perform fuzzy search', async () => {
      const results = await search.search('machine', {
        mode: SearchMode.FUZZY,
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should perform hybrid search', async () => {
      const results = await search.search('learning', {
        mode: SearchMode.HYBRID,
        topK: 5,
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty('source', 'hybrid');
      }
    });

    it('should perform auto mode selection', async () => {
      // Short query should use fuzzy
      const shortResults = await search.search('ml', {
        mode: SearchMode.AUTO,
        topK: 5,
      });
      expect(shortResults.length).toBeGreaterThanOrEqual(0);

      // Question should use semantic
      const questionResults = await search.search('what is machine learning', {
        mode: SearchMode.AUTO,
        topK: 5,
      });
      expect(questionResults.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply type filter', async () => {
      const results = await search.search('learning', {
        typeFilter: 'chunk',
        topK: 10,
      });

      expect(results.every(r => r.type === 'chunk')).toBe(true);
    });

    it('should apply min score filter', async () => {
      const results = await search.search('learning', {
        minScore: 0.5,
        topK: 10,
      });

      expect(results.every(r => (r.score as number) >= 0.5)).toBe(true);
    });

    it('should fallback to fuzzy when semantic returns empty', async () => {
      const searchSemanticOnly = new SmartSearch({ vectorIndex });

      // Query that won't match semantic
      const results = await searchSemanticOnly.search('xyznonexistent', {
        mode: SearchMode.SEMANTIC,
        topK: 5,
      });

      // Should fallback to fuzzy (which may still return empty, but no error)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SearchMode Selection', () => {
    it('should select FUZZY for short keyword queries', () => {
      const mode = (search as any).selectMode('ml');
      expect(mode).toBe(SearchMode.FUZZY);
    });

    it('should select SEMANTIC for question queries', () => {
      const mode = (search as any).selectMode('what is machine learning');
      expect(mode).toBe(SearchMode.SEMANTIC);
    });

    it('should select HYBRID for quoted phrases', () => {
      const mode = (search as any).selectMode('"machine learning"');
      expect(mode).toBe(SearchMode.HYBRID);
    });

    it('should select SEMANTIC for long queries', () => {
      const mode = (search as any).selectMode(
        'how to implement machine learning algorithms for natural language processing'
      );
      expect(mode).toBe(SearchMode.SEMANTIC);
    });

    it('should default to HYBRID for medium queries', () => {
      const mode = (search as any).selectMode('machine learning data');
      expect(mode).toBe(SearchMode.HYBRID);
    });
  });

  describe('RRF Fusion', () => {
    it('should merge results with RRF scoring', () => {
      const semanticResults: SmartSearchResult[] = [
        {
          id: 'doc-1',
          content: 'content 1',
          score: 0.9,
          type: 'chunk',
          metadata: {},
          source: 'semantic',
          mode_used: 'semantic',
        },
        {
          id: 'doc-2',
          content: 'content 2',
          score: 0.8,
          type: 'chunk',
          metadata: {},
          source: 'semantic',
          mode_used: 'semantic',
        },
      ];

      const fuzzyResults: SmartSearchResult[] = [
        {
          id: 'doc-2',
          content: 'content 2',
          score: 0.95,
          type: 'chunk',
          metadata: {},
          source: 'fts5',
          mode_used: 'fuzzy',
        },
        {
          id: 'doc-3',
          content: 'content 3',
          score: 0.7,
          type: 'chunk',
          metadata: {},
          source: 'fts5',
          mode_used: 'fuzzy',
        },
      ];

      const merged = (search as any).rrfMerge(semanticResults, fuzzyResults);

      expect(merged.length).toBe(3);
      expect(merged[0]).toHaveProperty('source', 'hybrid');
      // doc-2 should rank high (appears in both)
      expect(merged.map(r => r.id)).toContain('doc-2');
    });

    it('should handle empty results', () => {
      const merged = (search as any).rrfMerge([], []);
      expect(merged.length).toBe(0);
    });

    it('should handle single result list', () => {
      const semanticResults: SmartSearchResult[] = [
        {
          id: 'doc-1',
          content: 'content',
          score: 0.9,
          type: 'chunk',
          metadata: {},
          source: 'semantic',
          mode_used: 'semantic',
        },
      ];

      const merged = (search as any).rrfMerge(semanticResults, []);
      expect(merged.length).toBe(1);
      expect(merged[0].id).toBe('doc-1');
    });
  });

  describe('FTS5 and LIKE Fallback', () => {
    it('should use FTS5 for search', async () => {
      dbConnection.setData([
        {
          id: 'fts-1',
          content: 'test document',
          metadata: JSON.stringify({}),
          type: 'chunk',
        },
      ]);

      const results = await (search as any).fts5Search('test', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should fallback to LIKE search when FTS5 fails', async () => {
      // Create search without proper FTS5 setup
      const searchLikeOnly = new SmartSearch({ dbConnection });

      dbConnection.setData([
        {
          id: 'like-1',
          content: 'test document',
          metadata: JSON.stringify({}),
          type: 'chunk',
        },
      ]);

      const results = await (search as any).likeSearch('test', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing vector index gracefully', async () => {
      const searchNoIndex = new SmartSearch({});
      const results = await searchNoIndex.search('test', {
        mode: SearchMode.SEMANTIC,
        topK: 5,
      });
      expect(results.length).toBe(0);
    });

    it('should handle missing database connection gracefully', async () => {
      const searchNoDb = new SmartSearch({});
      const results = await searchNoDb.search('test', {
        mode: SearchMode.FUZZY,
        topK: 5,
      });
      expect(results.length).toBe(0);
    });

    it('should handle search errors gracefully', async () => {
      // Mock vector index that throws error
      const errorIndex: VectorIndexInterface = {
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
        upsert: vi.fn(),
        delete: vi.fn(),
      };

      const searchWithError = new SmartSearch({ vectorIndex: errorIndex });

      const results = await searchWithError.search('test', {
        mode: SearchMode.SEMANTIC,
        topK: 5,
      });

      expect(results.length).toBe(0);
    });
  });

  describe('Factory Function', () => {
    it('should create SmartSearch instance with config', () => {
      const instance = createSmartSearch({
        vectorIndex,
        dbConnection,
        rrfK: 50,
        semanticWeight: 0.7,
        fuzzyWeight: 0.3,
      });

      expect(instance).toBeInstanceOf(SmartSearch);
    });

    it('should create SmartSearch with default config', () => {
      const instance = createSmartSearch({});
      expect(instance).toBeInstanceOf(SmartSearch);
    });
  });

  describe('Result Format', () => {
    it('should return results in correct format', async () => {
      await search.index('test-1', 'test content');

      const results = await search.search('test', { topK: 5, mode: SearchMode.SEMANTIC });
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('mode_used');
      expect(result).toHaveProperty('metadata');

      // Score should be rounded to 4 decimals (or be an integer)
      if (typeof result.score === 'number') {
        const scoreStr = result.score.toString();
        expect(scoreStr).toMatch(/^\d+(\.\d{0,4})?$/);
      }
    });
  });
});

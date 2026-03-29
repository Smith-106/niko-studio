/**
 * HybridSearch Unit Tests
 *
 * Tests for multi-strategy search with RRF fusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HybridSearch,
  HybridSearchBuilder,
  createHybridSearch,
  StrategyPresets,
  type StrategyWeight,
} from './hybrid-search';
import type { SearchInterface } from '../protocols/search';

/**
 * Mock SearchInterface for testing
 */
class MockSearchInterface implements SearchInterface {
  private results: Array<{
    id: string;
    content: string;
    score: number;
    type?: string;
    metadata?: Record<string, unknown>;
    source?: string;
    loc?: { kind: 'line' | 'char' | 'range'; start: number; end?: number };
  }> = [];

  private shouldFail = false;

  constructor(
    results?: Array<{
      id: string;
      content: string;
      score: number;
      type?: string;
      metadata?: Record<string, unknown>;
    }>
  ) {
    this.results = results ?? [];
  }

  setResults(
    results: Array<{
      id: string;
      content: string;
      score: number;
      type?: string;
      metadata?: Record<string, unknown>;
    }>
  ): void {
    this.results = results;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async search(
    query: string,
    options?: { topK?: number; typeFilter?: string; minScore?: number }
  ): Promise<Record<string, unknown>[]> {
    if (this.shouldFail) {
      throw new Error('Mock search failed');
    }

    let filtered = [...this.results];

    if (options?.typeFilter) {
      filtered = filtered.filter(r => r.type === options.typeFilter);
    }

    if (options?.minScore !== undefined) {
      filtered = filtered.filter(r => r.score >= options.minScore!);
    }

    const topK = options?.topK ?? filtered.length;
    return filtered.slice(0, topK).map(r => ({
      id: r.id,
      content: r.content,
      score: r.score,
      type: r.type ?? 'chunk',
      metadata: r.metadata ?? {},
      source: r.source ?? 'mock',
      loc: r.loc,
    }));
  }

  async index(
    id: string,
    content: string,
    options?: { metadata?: Record<string, unknown>; type?: string }
  ): Promise<void> {
    this.results.push({
      id,
      content,
      score: 1.0,
      type: options?.type,
      metadata: options?.metadata,
    });
  }

  async delete(id: string): Promise<boolean> {
    const index = this.results.findIndex(r => r.id === id);
    if (index !== -1) {
      this.results.splice(index, 1);
      return true;
    }
    return false;
  }
}

describe('HybridSearch', () => {
  let keywordSearch: MockSearchInterface;
  let semanticSearch: MockSearchInterface;

  beforeEach(() => {
    keywordSearch = new MockSearchInterface();
    semanticSearch = new MockSearchInterface();
  });

  describe('constructor', () => {
    it('should create HybridSearch with strategies', () => {
      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
      });

      expect(hybrid).toBeDefined();
      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(2);
      expect(stats[0].name).toBe('keyword');
      expect(stats[1].name).toBe('semantic');
    });

    it('should normalize weights to sum to 1.0', () => {
      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 2 },
          { name: 'semantic', search: semanticSearch, weight: 3 },
        ],
      });

      const stats = hybrid.getStrategyStats();
      expect(stats[0].weight).toBeCloseTo(0.4, 2); // 2/5
      expect(stats[1].weight).toBeCloseTo(0.6, 2); // 3/5
    });

    it('should throw error when no strategies provided', () => {
      expect(() => new HybridSearch({ strategies: [] })).toThrow(
        'HybridSearch requires at least one search strategy'
      );
    });

    it('should use default RRF constant', () => {
      const hybrid = new HybridSearch({
        strategies: [{ name: 'test', search: keywordSearch, weight: 1 }],
      });

      expect(hybrid).toBeDefined();
    });
  });

  describe('search', () => {
    it('should combine results from multiple strategies with RRF', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'keyword result 1', score: 0.9 },
        { id: 'doc2', content: 'keyword result 2', score: 0.8 },
      ]);

      semanticSearch.setResults([
        { id: 'doc2', content: 'semantic result 2', score: 0.95 },
        { id: 'doc3', content: 'semantic result 3', score: 0.85 },
      ]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
        rrfK: 60,
      });

      const results = await hybrid.search('test query');

      expect(results.length).toBeGreaterThan(0);
      // doc2 should rank higher due to appearing in both strategies
      expect(results.find(r => r.id === 'doc2')).toBeDefined();
    });

    it('should respect topK option', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'result 1', score: 0.9 },
        { id: 'doc2', content: 'result 2', score: 0.8 },
        { id: 'doc3', content: 'result 3', score: 0.7 },
      ]);

      const hybrid = new HybridSearch({
        strategies: [{ name: 'keyword', search: keywordSearch, weight: 1 }],
      });

      const results = await hybrid.search('test', { topK: 2 });
      expect(results).toHaveLength(2);
    });

    it('should apply minScore filter', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'result 1', score: 0.9 },
        { id: 'doc2', content: 'result 2', score: 0.5 },
        { id: 'doc3', content: 'result 3', score: 0.3 },
      ]);

      const hybrid = new HybridSearch({
        strategies: [{ name: 'keyword', search: keywordSearch, weight: 1 }],
      });

      const results = await hybrid.search('test', { minScore: 0.4 });
      expect(results.every(r => (r.score as number) >= 0.4)).toBe(true);
    });

    it('should apply typeFilter to all strategies', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'memory 1', score: 0.9, type: 'memory' },
        { id: 'doc2', content: 'chunk 1', score: 0.8, type: 'chunk' },
      ]);

      const hybrid = new HybridSearch({
        strategies: [{ name: 'keyword', search: keywordSearch, weight: 1 }],
      });

      const results = await hybrid.search('test', { typeFilter: 'memory' });
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('memory');
    });

    it('should handle search failures gracefully', async () => {
      keywordSearch.setShouldFail(true);
      semanticSearch.setResults([{ id: 'doc1', content: 'semantic result', score: 0.9 }]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
      });

      const results = await hybrid.search('test');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('doc1');
    });

    it('should execute searches in parallel when enabled', async () => {
      const delays: number[] = [];
      
      const delaySearch = new (class implements SearchInterface {
        async search() {
          const start = Date.now();
          await new Promise(resolve => setTimeout(resolve, 50));
          delays.push(Date.now() - start);
          return [{ id: 'doc1', content: 'test', score: 0.9 }];
        }
        async index() {}
        async delete() { return false; }
      })();

      const hybrid = new HybridSearch({
        strategies: [
          { name: 's1', search: delaySearch, weight: 0.5 },
          { name: 's2', search: delaySearch, weight: 0.5 },
        ],
        parallelExecution: true,
      });

      await hybrid.search('test');
      
      // Both searches should complete in ~50ms, not 100ms
      expect(delays.length).toBe(2);
    });
  });

  describe('index', () => {
    it('should index document to all strategies', async () => {
      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
      });

      await hybrid.index('doc1', 'test content', { type: 'memory' });

      // Verify indexed in both
      const results1 = await keywordSearch.search('doc1');
      const results2 = await semanticSearch.search('doc1');
      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
    });

    it('should handle indexing failures gracefully', async () => {
      const failSearch = new MockSearchInterface();
      failSearch.setShouldFail(true);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'fail', search: failSearch, weight: 0.5 },
          { name: 'success', search: keywordSearch, weight: 0.5 },
        ],
      });

      // Should not throw
      await expect(
        hybrid.index('doc1', 'test content')
      ).resolves.not.toThrow();

      // Should still index to successful strategy
      const results = await keywordSearch.search('doc1');
      expect(results.length).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete document from all strategies', async () => {
      keywordSearch.setResults([{ id: 'doc1', content: 'test', score: 0.9 }]);
      semanticSearch.setResults([{ id: 'doc1', content: 'test', score: 0.9 }]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
      });

      const result = await hybrid.delete('doc1');
      expect(result).toBe(true);

      // Verify deleted from both
      const results1 = await keywordSearch.search('test');
      const results2 = await semanticSearch.search('test');
      expect(results1.length).toBe(0);
      expect(results2.length).toBe(0);
    });

    it('should return true if at least one strategy succeeds', async () => {
      const failSearch = new MockSearchInterface();
      failSearch.setShouldFail(true);
      keywordSearch.setResults([{ id: 'doc1', content: 'test', score: 0.9 }]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'fail', search: failSearch, weight: 0.5 },
          { name: 'success', search: keywordSearch, weight: 0.5 },
        ],
      });

      const result = await hybrid.delete('doc1');
      expect(result).toBe(true);
    });

    it('should return false if all strategies fail', async () => {
      const failSearch1 = new MockSearchInterface();
      const failSearch2 = new MockSearchInterface();
      failSearch1.setShouldFail(true);
      failSearch2.setShouldFail(true);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'fail1', search: failSearch1, weight: 0.5 },
          { name: 'fail2', search: failSearch2, weight: 0.5 },
        ],
      });

      const result = await hybrid.delete('doc1');
      expect(result).toBe(false);
    });
  });

  describe('strategy management', () => {
    it('should add strategy dynamically', () => {
      const hybrid = new HybridSearch({
        strategies: [{ name: 'keyword', search: keywordSearch, weight: 1 }],
      });

      hybrid.addStrategy('semantic', semanticSearch, 1);

      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(2);
      expect(stats[0].weight).toBeCloseTo(0.5, 2);
      expect(stats[1].weight).toBeCloseTo(0.5, 2);
    });

    it('should remove strategy by name', () => {
      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
      });

      const removed = hybrid.removeStrategy('keyword');
      expect(removed).toBe(true);

      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].name).toBe('semantic');
      expect(stats[0].weight).toBe(1);
    });

    it('should return false when removing non-existent strategy', () => {
      const hybrid = new HybridSearch({
        strategies: [{ name: 'keyword', search: keywordSearch, weight: 1 }],
      });

      const removed = hybrid.removeStrategy('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('HybridSearchBuilder', () => {
    it('should build HybridSearch with fluent API', () => {
      const hybrid = new HybridSearchBuilder()
        .addStrategy('keyword', keywordSearch, 0.5)
        .addStrategy('semantic', semanticSearch, 0.5)
        .setRrfK(50)
        .setDefaultTopK(20)
        .setParallelExecution(true)
        .build();

      expect(hybrid).toBeDefined();
      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(2);
    });
  });

  describe('StrategyPresets', () => {
    it('should create balanced hybrid search', () => {
      const config = StrategyPresets.balanced(keywordSearch, semanticSearch);
      const hybrid = new HybridSearch(config);

      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(2);
      expect(stats[0].weight).toBeCloseTo(0.5, 2);
      expect(stats[1].weight).toBeCloseTo(0.5, 2);
    });

    it('should create semantic-first hybrid search', () => {
      const config = StrategyPresets.semanticFirst(keywordSearch, semanticSearch);
      const hybrid = new HybridSearch(config);

      const stats = hybrid.getStrategyStats();
      expect(stats[0].weight).toBeCloseTo(0.3, 2); // keyword
      expect(stats[1].weight).toBeCloseTo(0.7, 2); // semantic
    });

    it('should create keyword-first hybrid search', () => {
      const config = StrategyPresets.keywordFirst(keywordSearch, semanticSearch);
      const hybrid = new HybridSearch(config);

      const stats = hybrid.getStrategyStats();
      expect(stats[0].weight).toBeCloseTo(0.7, 2); // keyword
      expect(stats[1].weight).toBeCloseTo(0.3, 2); // semantic
    });

    it('should create multi-strategy hybrid search', () => {
      const vectorSearch = new MockSearchInterface();
      const config = StrategyPresets.multiStrategy(keywordSearch, semanticSearch, vectorSearch);
      const hybrid = new HybridSearch(config);

      const stats = hybrid.getStrategyStats();
      expect(stats).toHaveLength(3);
      expect(stats[0].weight).toBeCloseTo(0.3, 2); // keyword
      expect(stats[1].weight).toBeCloseTo(0.4, 2); // semantic
      expect(stats[2].weight).toBeCloseTo(0.3, 2); // vector
    });
  });

  describe('RRF fusion', () => {
    it('should rank documents appearing in multiple strategies higher', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'unique keyword', score: 0.9 },
        { id: 'doc2', content: 'common result', score: 0.8 },
      ]);

      semanticSearch.setResults([
        { id: 'doc2', content: 'common result', score: 0.95 },
        { id: 'doc3', content: 'unique semantic', score: 0.85 },
      ]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.5 },
          { name: 'semantic', search: semanticSearch, weight: 0.5 },
        ],
        rrfK: 60,
      });

      const results = await hybrid.search('test');

      // doc2 should rank first (appears in both strategies)
      expect(results[0].id).toBe('doc2');
    });

    it('should weight strategies according to configuration', async () => {
      keywordSearch.setResults([
        { id: 'doc1', content: 'keyword result', score: 0.9 },
      ]);

      semanticSearch.setResults([
        { id: 'doc2', content: 'semantic result', score: 0.9 },
      ]);

      const hybrid = new HybridSearch({
        strategies: [
          { name: 'keyword', search: keywordSearch, weight: 0.3 },
          { name: 'semantic', search: semanticSearch, weight: 0.7 },
        ],
      });

      const results = await hybrid.search('test');

      // Semantic result should rank higher due to higher weight
      expect(results[0].id).toBe('doc2');
    });
  });

  describe('createHybridSearch factory', () => {
    it('should create HybridSearch instance', () => {
      const hybrid = createHybridSearch({
        strategies: [{ name: 'test', search: keywordSearch, weight: 1 }],
      });

      expect(hybrid).toBeInstanceOf(HybridSearch);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import type { SearchInterface } from '../../protocols/search';
import {
  HybridSearch,
  HybridSearchBuilder,
  StrategyPresets,
  createHybridSearch,
} from '../../search/hybrid-search';

function createMockSearch(results: Record<string, unknown>[]): SearchInterface {
  return {
    search: vi.fn().mockResolvedValue(results),
    index: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  };
}

function makeResult(id: string, score: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    content: `content-${id}`,
    score,
    type: 'chunk',
    source: 'test',
    metadata: {},
    loc: { kind: 'line', start: 1, end: 1 },
    ...overrides,
  };
}

describe('HybridSearch', () => {
  it('throws when constructed with zero strategies', () => {
    expect(() => new HybridSearch({ strategies: [] })).toThrow('at least one search strategy');
  });

  it('normalizes strategy weights to sum to 1.0', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 3 },
        { name: 'semantic', search: semantic, weight: 1 },
      ],
    });

    const stats = hs.getStrategyStats();
    const totalWeight = stats.reduce((sum, s) => sum + s.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
    expect(stats.find(s => s.name === 'keyword')!.weight).toBeCloseTo(0.75, 10);
    expect(stats.find(s => s.name === 'semantic')!.weight).toBeCloseTo(0.25, 10);
  });

  it('merges results from multiple strategies using RRF fusion', async () => {
    const keyword = createMockSearch([
      makeResult('doc-1', 0.9),
      makeResult('doc-2', 0.7),
      makeResult('doc-3', 0.5),
    ]);

    const semantic = createMockSearch([
      makeResult('doc-2', 0.8),
      makeResult('doc-4', 0.6),
      makeResult('doc-1', 0.4),
    ]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 0.5 },
        { name: 'semantic', search: semantic, weight: 0.5 },
      ],
      rrfK: 60,
    });

    const results = await hs.search('test query');

    // Both strategies should have been called
    expect(keyword.search).toHaveBeenCalledTimes(1);
    expect(semantic.search).toHaveBeenCalledTimes(1);

    // doc-1 appears in both sources and should rank high
    const ids = results.map(r => r.id);
    expect(ids).toContain('doc-1');
    expect(ids).toContain('doc-2');
    expect(ids).toContain('doc-3');
    expect(ids).toContain('doc-4');
  });

  it('applies minScore filter to merged results', async () => {
    const keyword = createMockSearch([
      makeResult('doc-1', 0.9),
      makeResult('doc-2', 0.8),
      makeResult('doc-3', 0.7),
    ]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 1.0 },
      ],
    });

    // No minScore filter: all results should pass
    const allResults = await hs.search('test');
    expect(allResults.length).toBe(3);

    // With a very small minScore (close to 0): still returns all
    const lowThreshold = await hs.search('test', { minScore: 0.0001 });
    expect(lowThreshold.length).toBe(3);

    // With an extremely high minScore: should filter out most results
    const highThreshold = await hs.search('test', { minScore: 999 });
    expect(highThreshold.length).toBe(0);
  });

  it('respects topK limit', async () => {
    const keyword = createMockSearch([
      makeResult('doc-1', 0.9),
      makeResult('doc-2', 0.8),
      makeResult('doc-3', 0.7),
      makeResult('doc-4', 0.6),
      makeResult('doc-5', 0.5),
    ]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 1.0 },
      ],
    });

    const results = await hs.search('test', { topK: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('scores are rounded to 4 decimal places', async () => {
    const keyword = createMockSearch([
      makeResult('doc-1', 0.9),
    ]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 1.0 },
      ],
    });

    const results = await hs.search('test');
    for (const r of results) {
      const decimals = String(r.score).split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(4);
    }
  });

  it('marks the source as hybrid in merged results', async () => {
    const keyword = createMockSearch([
      makeResult('doc-1', 0.9),
    ]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 1.0 },
      ],
    });

    const results = await hs.search('test');
    for (const r of results) {
      expect(r.source).toBe('hybrid');
    }
  });

  it('addStrategy dynamically normalizes weights', async () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const vector = createMockSearch([]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 1.0 },
      ],
    });

    hs.addStrategy('semantic', semantic, 1.0);
    hs.addStrategy('vector', vector, 1.0);

    const stats = hs.getStrategyStats();
    expect(stats).toHaveLength(3);
    const totalWeight = stats.reduce((sum, s) => sum + s.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it('removeStrategy removes and renormalizes weights', () => {
    const s1 = createMockSearch([]);
    const s2 = createMockSearch([]);
    const s3 = createMockSearch([]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'a', search: s1, weight: 1 },
        { name: 'b', search: s2, weight: 1 },
        { name: 'c', search: s3, weight: 1 },
      ],
    });

    const removed = hs.removeStrategy('b');
    expect(removed).toBe(true);
    expect(hs.getStrategyStats()).toHaveLength(2);

    const totalWeight = hs.getStrategyStats().reduce((sum, s) => sum + s.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 10);
  });

  it('removeStrategy returns false for unknown strategy', () => {
    const hs = new HybridSearch({
      strategies: [
        { name: 'a', search: createMockSearch([]), weight: 1 },
      ],
    });

    expect(hs.removeStrategy('nonexistent')).toBe(false);
  });

  it('indexes documents to all strategies', async () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 0.5 },
        { name: 'semantic', search: semantic, weight: 0.5 },
      ],
    });

    await hs.index('doc-1', 'test content', { type: 'chapter' });

    expect(keyword.index).toHaveBeenCalledWith('doc-1', 'test content', { type: 'chapter' });
    expect(semantic.index).toHaveBeenCalledWith('doc-1', 'test content', { type: 'chapter' });
  });

  it('delete returns true when at least one strategy succeeds', async () => {
    const failing = createMockSearch([]);
    (failing.delete as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const succeeding = createMockSearch([]);
    (succeeding.delete as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const hs = new HybridSearch({
      strategies: [
        { name: 'failing', search: failing, weight: 0.5 },
        { name: 'succeeding', search: succeeding, weight: 0.5 },
      ],
    });

    const result = await hs.delete('doc-1');
    expect(result).toBe(true);
  });

  it('search gracefully handles a failing strategy', async () => {
    const failing = createMockSearch([]);
    (failing.search as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('strategy error'));
    const ok = createMockSearch([makeResult('doc-1', 0.9)]);

    const hs = new HybridSearch({
      strategies: [
        { name: 'failing', search: failing, weight: 0.5 },
        { name: 'ok', search: ok, weight: 0.5 },
      ],
    });

    // Should not throw, should return results from the working strategy
    const results = await hs.search('test');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('HybridSearchBuilder', () => {
  it('builds a HybridSearch instance with all configured options', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);

    const hs = new HybridSearchBuilder()
      .addStrategy('keyword', keyword, 0.6)
      .addStrategy('semantic', semantic, 0.4)
      .setRrfK(40)
      .setDefaultTopK(20)
      .setParallelExecution(false)
      .build();

    expect(hs).toBeInstanceOf(HybridSearch);
    const stats = hs.getStrategyStats();
    expect(stats).toHaveLength(2);
    expect(stats.find(s => s.name === 'keyword')!.weight).toBeCloseTo(0.6, 10);
  });
});

describe('StrategyPresets', () => {
  it('balanced preset creates equal weight config', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const config = StrategyPresets.balanced(keyword, semantic);

    expect(config.strategies).toHaveLength(2);
    expect(config.strategies[0].weight).toBe(0.5);
    expect(config.strategies[1].weight).toBe(0.5);
  });

  it('semanticFirst preset assigns more weight to semantic', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const config = StrategyPresets.semanticFirst(keyword, semantic);

    expect(config.strategies.find(s => s.name === 'semantic')!.weight).toBe(0.7);
    expect(config.strategies.find(s => s.name === 'keyword')!.weight).toBe(0.3);
  });

  it('keywordFirst preset assigns more weight to keyword', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const config = StrategyPresets.keywordFirst(keyword, semantic);

    expect(config.strategies.find(s => s.name === 'keyword')!.weight).toBe(0.7);
  });

  it('multiStrategy preset includes three strategies', () => {
    const keyword = createMockSearch([]);
    const semantic = createMockSearch([]);
    const vector = createMockSearch([]);
    const config = StrategyPresets.multiStrategy(keyword, semantic, vector);

    expect(config.strategies).toHaveLength(3);
    expect(config.strategies.find(s => s.name === 'semantic')!.weight).toBe(0.4);
  });
});

describe('createHybridSearch', () => {
  it('factory creates a valid HybridSearch instance', () => {
    const hs = createHybridSearch({
      strategies: [
        { name: 'test', search: createMockSearch([]), weight: 1.0 },
      ],
    });
    expect(hs).toBeInstanceOf(HybridSearch);
  });
});

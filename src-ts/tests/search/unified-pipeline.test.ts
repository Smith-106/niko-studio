import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  UnifiedSearchPipeline,
  type UnifiedPipelineDeps,
} from '../../search/unified-pipeline.js';
import {
  SearchStrategyType,
  type ISearchStrategyConfig,
} from '../../search/strategy-config.js';

function createDeps() {
  const knowledgeSearch = vi.fn();
  const smartSearch = vi.fn();
  const hybridSearch = vi.fn();
  const vectorSearch = vi.fn();

  const deps = {
    knowledgeService: {
      search: knowledgeSearch,
    },
    smartSearch: {
      search: smartSearch,
    },
    hybridSearch: {
      search: hybridSearch,
    },
    vectorSearch: {
      search: vectorSearch,
    },
    obsidianService: {},
  } as unknown as UnifiedPipelineDeps;

  return {
    deps,
    knowledgeSearch,
    smartSearch,
    hybridSearch,
    vectorSearch,
  };
}

function makeConfig(
  cascade: ISearchStrategyConfig['cascade'],
  overrides: Partial<ISearchStrategyConfig> = {},
): ISearchStrategyConfig {
  return {
    name: 'TEST',
    cascade,
    defaultTopK: 10,
    minScore: 0,
    fallbackThreshold: 2,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('search/unified-pipeline', () => {
  it('filters to allowed local sources and deduplicates by content hash', async () => {
    const { deps, knowledgeSearch, vectorSearch, smartSearch, hybridSearch } = createDeps();

    knowledgeSearch.mockResolvedValue([
      { content: 'same paragraph', score: 0.2, metadata: { variant: 'low' } },
      { content: 'same paragraph', score: 0.9, metadata: { variant: 'high' } },
      { content: 'unique paragraph', score: 2, metadata: { variant: 'top' } },
      { content: null, score: Number.NaN },
    ]);

    const pipeline = new UnifiedSearchPipeline(deps);
    const config = makeConfig([
      { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 5, timeoutMs: 100 },
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.5, topK: 5, timeoutMs: 100 },
    ], { fallbackThreshold: 5 });

    const result = await pipeline.search('hero arc', {
      strategyConfig: config,
      sources: [SearchStrategyType.LOCAL],
      topK: 5,
    });

    expect(knowledgeSearch).toHaveBeenCalledWith('hero arc', { topK: 5 });
    expect(vectorSearch).not.toHaveBeenCalled();
    expect(smartSearch).not.toHaveBeenCalled();
    expect(hybridSearch).not.toHaveBeenCalled();
    expect(result.query).toBe('hero arc');
    expect(result.total).toBe(4);
    expect(result.dedupRemoved).toBe(1);
    expect(result.sources).toEqual({ knowledge: 4 });
    expect(result.results).toHaveLength(3);
    expect(result.results[0]).toMatchObject({
      content: 'unique paragraph',
      source: 'knowledge',
      metadata: { variant: 'top' },
    });
    expect(result.results[1]).toMatchObject({
      content: 'same paragraph',
      source: 'knowledge',
      metadata: { variant: 'high' },
    });
    expect(result.results[2]).toMatchObject({
      content: '',
      source: 'knowledge',
    });
  });

  it('supplements semantic search with smart-search results and falls through to external search', async () => {
    const { deps, vectorSearch, smartSearch, hybridSearch } = createDeps();

    vectorSearch.mockResolvedValue([
      { content: 'vector-one', score: 0.9, metadata: { lane: 'vector' } },
    ]);
    smartSearch.mockResolvedValue([
      { content: 'smart-one', score: 0.7, metadata: { lane: 'smart' } },
    ]);
    hybridSearch.mockResolvedValue([
      { content: 'external-one', score: 0.6, metadata: { lane: 'external' } },
    ]);

    const pipeline = new UnifiedSearchPipeline(deps);
    const config = makeConfig([
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.6, topK: 3, timeoutMs: 100 },
      { strategy: SearchStrategyType.EXTERNAL, weight: 0.4, topK: 2, timeoutMs: 100 },
    ], { fallbackThreshold: 3 });

    const result = await pipeline.search('deep lore', { strategyConfig: config, topK: 10 });

    expect(vectorSearch).toHaveBeenCalledWith('deep lore', { topK: 3 });
    expect(smartSearch).toHaveBeenCalledWith('deep lore', { mode: 'hybrid', topK: 3 });
    expect(hybridSearch).toHaveBeenCalledWith('deep lore', {
      strategies: ['keyword', 'semantic'],
      topK: 2,
    });
    expect(result.total).toBe(3);
    expect(result.dedupRemoved).toBe(0);
    expect(result.sources).toEqual({ vector: 2, obsidian: 1 });
    expect(result.results.map((item) => item.content)).toEqual([
      'vector-one',
      'smart-one',
      'external-one',
    ]);
    expect(result.results.map((item) => item.source)).toEqual([
      'vector',
      'smart-search',
      'obsidian',
    ]);
  });

  it('short-circuits semantic search when vector results already satisfy the fallback threshold', async () => {
    const { deps, vectorSearch, smartSearch, hybridSearch } = createDeps();

    vectorSearch.mockResolvedValue([
      { content: 'vector-a', score: 0.91 },
      { content: 'vector-b', score: 0.89 },
    ]);

    const pipeline = new UnifiedSearchPipeline(deps);
    const config = makeConfig([
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.7, topK: 4, timeoutMs: 100 },
      { strategy: SearchStrategyType.EXTERNAL, weight: 0.3, topK: 4, timeoutMs: 100 },
    ], { fallbackThreshold: 2 });

    const result = await pipeline.search('fast path', { strategyConfig: config, topK: 10 });

    expect(vectorSearch).toHaveBeenCalledWith('fast path', { topK: 4 });
    expect(smartSearch).not.toHaveBeenCalled();
    expect(hybridSearch).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(result.sources).toEqual({ vector: 2 });
    expect(result.results.map((item) => item.content)).toEqual(['vector-a', 'vector-b']);
  });

  it('continues after an unknown strategy and swallows backend errors', async () => {
    const { deps, knowledgeSearch } = createDeps();

    knowledgeSearch.mockRejectedValue(new Error('knowledge unavailable'));

    const pipeline = new UnifiedSearchPipeline(deps);
    const config = makeConfig([
      { strategy: 'mystery' as SearchStrategyType, weight: 1, topK: 1, timeoutMs: 100 },
      { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 1, timeoutMs: 100 },
    ], { fallbackThreshold: 1 });

    const result = await pipeline.search('broken flow', { strategyConfig: config });

    expect(knowledgeSearch).toHaveBeenCalledWith('broken flow', { topK: 1 });
    expect(result.total).toBe(0);
    expect(result.dedupRemoved).toBe(0);
    expect(result.sources).toEqual({ mystery: 0, knowledge: 0 });
    expect(result.results).toEqual([]);
  });

  it('returns an empty result when a backend times out before resolving', async () => {
    const { deps, knowledgeSearch } = createDeps();

    vi.useFakeTimers();
    knowledgeSearch.mockImplementation(() => new Promise(() => {}));

    const pipeline = new UnifiedSearchPipeline(deps);
    const config = makeConfig([
      { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 1, timeoutMs: 25 },
    ], { fallbackThreshold: 0 });

    const pending = pipeline.searchByPhase('timed query', 'draft', {
      strategyConfig: config,
      topK: 1,
    });

    await vi.advanceTimersByTimeAsync(25);
    const result = await pending;

    expect(knowledgeSearch).toHaveBeenCalledWith('timed query', { topK: 1 });
    expect(result.query).toBe('timed query');
    expect(result.total).toBe(0);
    expect(result.sources).toEqual({ knowledge: 0 });
    expect(result.results).toEqual([]);
  });
});

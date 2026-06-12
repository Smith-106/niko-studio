import { afterEach, describe, expect, it, vi } from 'vitest';

const mockedRrfMerge = vi.hoisted(() => vi.fn());

vi.mock('../../search/utils/rrf-fusion.js', async () => {
  const actual = await vi.importActual<typeof import('../../search/utils/rrf-fusion.js')>(
    '../../search/utils/rrf-fusion.js',
  );
  return {
    ...actual,
    rrfMerge: mockedRrfMerge,
  };
});

import {
  UnifiedSearchPipeline,
  type RankedSearchResult,
  type UnifiedPipelineDeps,
} from '../../search/unified-pipeline.js';
import {
  SearchStrategyType,
  type ISearchStrategyConfig,
} from '../../search/strategy-config.js';

function createDeps(
  overrides: Partial<UnifiedPipelineDeps> = {},
): {
  deps: UnifiedPipelineDeps;
  knowledgeSearchMock: ReturnType<typeof vi.fn>;
  smartSearchMock: ReturnType<typeof vi.fn>;
  hybridSearchMock: ReturnType<typeof vi.fn>;
  vectorSearchMock: ReturnType<typeof vi.fn>;
} {
  const knowledgeSearch = vi.fn().mockResolvedValue([]);
  const smartSearch = vi.fn().mockResolvedValue([]);
  const hybridSearch = vi.fn().mockResolvedValue([]);
  const vectorSearch = vi.fn().mockResolvedValue([]);

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
    ...overrides,
  } as unknown as UnifiedPipelineDeps;

  return {
    deps,
    knowledgeSearchMock: knowledgeSearch,
    smartSearchMock: smartSearch,
    hybridSearchMock: hybridSearch,
    vectorSearchMock: vectorSearch,
  };
}

function makeConfig(
  cascade: ISearchStrategyConfig['cascade'],
  overrides: Partial<ISearchStrategyConfig> = {},
): ISearchStrategyConfig {
  return {
    name: 'TEST_BRANCH_GAP',
    cascade,
    defaultTopK: 10,
    minScore: 0,
    fallbackThreshold: 10,
    ...overrides,
  };
}

describe('search/unified-pipeline branch gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockedRrfMerge.mockReset();
  });

  it('uses the constructor default config and swallows non-array backend payloads', async () => {
    const config = makeConfig([
      { strategy: SearchStrategyType.LOCAL, weight: 0.5, topK: 2, timeoutMs: 50 },
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.3, topK: 2, timeoutMs: 50 },
      { strategy: SearchStrategyType.EXTERNAL, weight: 0.2, topK: 2, timeoutMs: 50 },
    ], { fallbackThreshold: 1 });
    const {
      deps,
      knowledgeSearchMock,
      vectorSearchMock,
      smartSearchMock,
      hybridSearchMock,
    } = createDeps({
      strategyConfig: config,
    });

    knowledgeSearchMock.mockResolvedValueOnce({ items: [] });
    vectorSearchMock.mockResolvedValueOnce({ items: [] });
    smartSearchMock.mockResolvedValueOnce({ items: [] });
    hybridSearchMock.mockResolvedValueOnce({ items: [] });
    mockedRrfMerge.mockReturnValue([]);

    const pipeline = new UnifiedSearchPipeline(deps);
    const result = await pipeline.search('default-config-path');

    expect(knowledgeSearchMock).toHaveBeenCalledWith('default-config-path', { topK: 2 });
    expect(vectorSearchMock).toHaveBeenCalledWith('default-config-path', { topK: 2 });
    expect(smartSearchMock).toHaveBeenCalledWith('default-config-path', {
      mode: 'hybrid',
      topK: 2,
    });
    expect(hybridSearchMock).toHaveBeenCalledWith('default-config-path', {
      strategies: ['keyword', 'semantic'],
      topK: 2,
    });
    expect(result).toEqual({
      results: [],
      sources: {
        knowledge: 0,
        vector: 0,
        obsidian: 0,
      },
      query: 'default-config-path',
      total: 0,
      dedupRemoved: 0,
    });
  });

  it('coerces malformed payloads across all backends and falls back to the default obsidian weight', async () => {
    const {
      deps,
      knowledgeSearchMock,
      vectorSearchMock,
      smartSearchMock,
      hybridSearchMock,
    } = createDeps();
    knowledgeSearchMock.mockResolvedValueOnce([
      { content: 'knowledge-result', score: 'bad-score', metadata: undefined },
    ]);
    vectorSearchMock.mockResolvedValueOnce([
      { content: 123, score: 'bad-score', metadata: null },
    ]);
    smartSearchMock.mockResolvedValueOnce([
      { content: false, score: 'bad-score', metadata: null },
    ]);
    hybridSearchMock.mockResolvedValueOnce([
      { content: { lane: 'external' }, score: 'bad-score', metadata: null },
    ]);

    mockedRrfMerge.mockImplementation((sources: Array<{ items: Array<{ id: string }> }>) =>
      sources.flatMap((source) =>
        source.items.map((item, index) => ({
          id: item.id,
          score: 1 - index * 0.1,
        })),
      ),
    );

    const pipeline = new UnifiedSearchPipeline(deps);
    const result = await pipeline.search('coercion-path', {
      strategyConfig: makeConfig([
        { strategy: SearchStrategyType.LOCAL, weight: 0.6, topK: 3, timeoutMs: 50 },
        { strategy: SearchStrategyType.SEMANTIC, weight: 0.3, topK: 3, timeoutMs: 50 },
        { strategy: SearchStrategyType.EXTERNAL, weight: 0.1, topK: 3, timeoutMs: 50 },
      ], { fallbackThreshold: 5 }),
      topK: 10,
    });

    expect(result.total).toBe(4);
    expect(result.dedupRemoved).toBe(0);
    expect(result.results).toEqual([
      {
        content: 'knowledge-result',
        source: 'knowledge',
        score: 1,
        metadata: {},
      },
      {
        content: '123',
        source: 'vector',
        score: 1,
        metadata: {},
      },
      {
        content: 'false',
        source: 'smart-search',
        score: 1,
        metadata: {},
      },
      {
        content: '[object Object]',
        source: 'obsidian',
        score: 1,
        metadata: {},
      },
    ]);

    const sources = mockedRrfMerge.mock.calls.at(-1)?.[0] as Array<{
      name: string;
      weight: number;
    }>;
    const obsidianSource = sources.find((source) => source.name === 'obsidian');
    expect(obsidianSource?.weight).toBeCloseTo(0.1 / 1.3, 6);
  });

  it('falls back to empty content when smart, vector, and obsidian payloads omit content', async () => {
    const {
      deps,
      vectorSearchMock,
      smartSearchMock,
      hybridSearchMock,
    } = createDeps();

    vectorSearchMock.mockResolvedValueOnce([
      { score: 0.8, metadata: null },
    ]);
    smartSearchMock.mockResolvedValueOnce([
      { score: 0.7, metadata: null },
    ]);
    hybridSearchMock.mockResolvedValueOnce([
      { score: 0.6, metadata: null },
    ]);

    mockedRrfMerge.mockImplementation((sources: Array<{ items: Array<{ id: string }> }>) =>
      sources.flatMap((source) =>
        source.items.map((item, index) => ({
          id: item.id,
          score: 1 - index * 0.1,
        })),
      ),
    );

    const pipeline = new UnifiedSearchPipeline(deps);
    const result = await pipeline.search('missing-content-path', {
      strategyConfig: makeConfig([
        { strategy: SearchStrategyType.SEMANTIC, weight: 0.7, topK: 3, timeoutMs: 50 },
        { strategy: SearchStrategyType.EXTERNAL, weight: 0.3, topK: 3, timeoutMs: 50 },
      ], { fallbackThreshold: 5 }),
      topK: 10,
    });

    expect(result.total).toBe(3);
    expect(result.dedupRemoved).toBe(2);
    expect(result.results).toEqual([
      {
        content: '',
        source: 'vector',
        score: 1,
        metadata: {},
      },
    ]);
  });

  it('keeps the higher-scoring duplicate when fuse sees the same content twice', () => {
    const { deps } = createDeps();
    const pipeline = new UnifiedSearchPipeline(deps);
    const results: RankedSearchResult[] = [
      {
        content: 'duplicate-content',
        source: 'knowledge',
        score: 0.9,
        metadata: { keep: true },
      },
      {
        content: 'duplicate-content',
        source: 'vector',
        score: 0.1,
        metadata: { keep: false },
      },
    ];

    mockedRrfMerge.mockImplementation((sources: Array<{ items: Array<{ id: string }> }>) => [
      {
        id: sources[0]?.items[0]?.id ?? '',
        score: 0.5,
      },
    ]);

    const fused = (pipeline as unknown as {
      fuse: (rows: RankedSearchResult[], steps: ISearchStrategyConfig['cascade']) => RankedSearchResult[];
    }).fuse(results, [
      { strategy: SearchStrategyType.LOCAL, weight: 0.7, topK: 2, timeoutMs: 50 },
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.3, topK: 2, timeoutMs: 50 },
    ]);

    expect(fused).toEqual([
      {
        content: 'duplicate-content',
        source: 'knowledge',
        score: 1,
        metadata: { keep: true },
      },
    ]);
  });

  it('returns zero when the top fused score is zero', () => {
    const { deps } = createDeps();
    const pipeline = new UnifiedSearchPipeline(deps);
    const results: RankedSearchResult[] = [
      {
        content: 'zero-score-result',
        source: 'obsidian',
        score: 0.4,
        metadata: {},
      },
    ];

    mockedRrfMerge.mockImplementation((sources: Array<{ items: Array<{ id: string }> }>) => [
      {
        id: sources[0]?.items[0]?.id ?? '',
        score: 0,
      },
    ]);

    const fused = (pipeline as unknown as {
      fuse: (rows: RankedSearchResult[], steps: ISearchStrategyConfig['cascade']) => RankedSearchResult[];
    }).fuse(results, [
      { strategy: SearchStrategyType.EXTERNAL, weight: 0.2, topK: 1, timeoutMs: 50 },
    ]);

    expect(fused).toEqual([
      {
        content: 'zero-score-result',
        source: 'obsidian',
        score: 0,
        metadata: {},
      },
    ]);
  });

  it('falls back to the default RRF weight for an unmapped source', () => {
    const { deps } = createDeps();
    const pipeline = new UnifiedSearchPipeline(deps);
    const results: RankedSearchResult[] = [
      {
        content: 'rogue-source-result',
        source: 'rogue-source',
        score: 0.4,
        metadata: {},
      },
    ];

    mockedRrfMerge.mockImplementation((sources: Array<{ items: Array<{ id: string }> }>) => [
      {
        id: sources[0]?.items[0]?.id ?? '',
        score: 0.5,
      },
    ]);

    const fused = (pipeline as unknown as {
      fuse: (rows: RankedSearchResult[], steps: ISearchStrategyConfig['cascade']) => RankedSearchResult[];
    }).fuse(results, [
      { strategy: SearchStrategyType.LOCAL, weight: 0.7, topK: 2, timeoutMs: 50 },
    ]);

    expect(fused).toEqual([
      {
        content: 'rogue-source-result',
        source: 'rogue-source',
        score: 1,
        metadata: {},
      },
    ]);

    const sources = mockedRrfMerge.mock.calls.at(-1)?.[0] as Array<{
      name: string;
      weight: number;
    }>;
    expect(sources).toEqual([
      expect.objectContaining({
        name: 'rogue-source',
        weight: 1,
      }),
    ]);
  });
});

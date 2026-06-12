import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SearchInterface } from '../../protocols/search';
import { HybridSearch } from '../../search/hybrid-search';
import {
  SearchStrategyType,
  type ISearchStrategyConfig,
} from '../../search/strategy-config.js';

type MockSearch = SearchInterface & {
  search: ReturnType<typeof vi.fn>;
  index: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type HybridSearchInternals = HybridSearch & {
  executeCascadeSearch: (
    query: string,
    options: { topK?: number; typeFilter?: string; minScore?: number },
  ) => Promise<Record<string, unknown>[]>;
  executeStepWithTimeout: (
    query: string,
    strategy: { name: string; weight: number; search: SearchInterface },
    step: {
      strategy: SearchStrategyType;
      weight: number;
      topK: number;
      timeoutMs: number;
    },
    options: { topK?: number; typeFilter?: string },
  ) => Promise<Record<string, unknown>[]>;
  rrfMerge: (
    resultsByStrategy: Map<string, Record<string, unknown>[]>,
  ) => Record<string, unknown>[];
};

function createMockSearch(results: Record<string, unknown>[] = []): MockSearch {
  return {
    search: vi.fn().mockResolvedValue(results),
    index: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  } as unknown as MockSearch;
}

function makeResult(
  id: string,
  score: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

function makeConfig(
  cascade: ISearchStrategyConfig['cascade'],
  overrides: Partial<ISearchStrategyConfig> = {},
): ISearchStrategyConfig {
  return {
    name: 'TEST',
    cascade,
    defaultTopK: 5,
    minScore: 0,
    fallbackThreshold: 2,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('HybridSearch additional coverage', () => {
  it('uses cascade search config and stops after fallback threshold is satisfied', async () => {
    const keyword = createMockSearch([
      makeResult('local-doc', 0.9, {
        source: 'keyword-source',
        type: 'note',
        metadata: { lane: 'local' },
      }),
    ]);
    const semantic = createMockSearch([
      makeResult('semantic-doc', 0.8, {
        source: 'semantic-source',
        type: 'note',
        metadata: { lane: 'semantic' },
      }),
      makeResult('shared-doc', 0.7, {
        source: 'semantic-source',
        type: 'note',
        loc: { kind: 'range', start: 2, end: 4 },
      }),
    ]);
    const external = createMockSearch([
      makeResult('external-doc', 0.6, { source: 'external-source' }),
    ]);

    const hybrid = new HybridSearch({
      strategies: [
        { name: 'keyword', search: keyword, weight: 0.5 },
        { name: 'semantic', search: semantic, weight: 0.3 },
        { name: 'external', search: external, weight: 0.2 },
      ],
      strategyConfig: makeConfig(
        [
          { strategy: SearchStrategyType.LOCAL, weight: 0.8, topK: 1, timeoutMs: 50 },
          { strategy: SearchStrategyType.SEMANTIC, weight: 0.2, topK: 2, timeoutMs: 50 },
          { strategy: SearchStrategyType.EXTERNAL, weight: 0.1, topK: 1, timeoutMs: 50 },
        ],
        { fallbackThreshold: 2 },
      ),
    });

    const results = await hybrid.search('hero arc', {
      topK: 2,
      typeFilter: 'note',
      minScore: 0,
    });

    expect(keyword.search).toHaveBeenCalledWith('hero arc', {
      topK: 1,
      typeFilter: 'note',
    });
    expect(semantic.search).toHaveBeenCalledWith('hero arc', {
      topK: 2,
      typeFilter: 'note',
    });
    expect(external.search).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.source === 'hybrid')).toBe(true);
    expect(results.map((result) => result.id)).toEqual(
      expect.arrayContaining(['local-doc', 'semantic-doc']),
    );
  });

  it('falls back to the first registered strategy when cascade step names do not match', async () => {
    const custom = createMockSearch([
      makeResult('custom-doc', 0.9, {
        source: 'custom-source',
        type: 'memory',
        metadata: { lane: 'fallback' },
      }),
    ]);

    const hybrid = new HybridSearch({
      strategies: [{ name: 'custom', search: custom, weight: 1 }],
      strategyConfig: makeConfig([
        { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 3, timeoutMs: 50 },
      ], {
        defaultTopK: 1,
        fallbackThreshold: 1,
      }),
    });

    const results = await hybrid.search('fallback query');

    expect(custom.search).toHaveBeenCalledWith('fallback query', {
      topK: 3,
      typeFilter: undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'custom-doc',
      source: 'hybrid',
      strategy: 'custom',
      type: 'memory',
    });
  });

  it('returns timed out cascade step results as empty and continues to the next step', async () => {
    vi.useFakeTimers();

    const slow = createMockSearch();
    slow.search.mockImplementation(() => new Promise(() => {}));
    const semantic = createMockSearch([
      makeResult('semantic-doc', 0.9, { source: 'semantic-source' }),
    ]);

    const hybrid = new HybridSearch({
      strategies: [
        { name: 'keyword', search: slow, weight: 0.5 },
        { name: 'semantic', search: semantic, weight: 0.5 },
      ],
      strategyConfig: makeConfig(
        [
          { strategy: SearchStrategyType.LOCAL, weight: 0.6, topK: 1, timeoutMs: 25 },
          { strategy: SearchStrategyType.SEMANTIC, weight: 0.4, topK: 1, timeoutMs: 25 },
        ],
        { fallbackThreshold: 1 },
      ),
    });

    const pending = hybrid.search('timed query');

    await vi.advanceTimersByTimeAsync(25);
    const results = await pending;

    expect(slow.search).toHaveBeenCalledWith('timed query', {
      topK: 1,
      typeFilter: undefined,
    });
    expect(semantic.search).toHaveBeenCalledWith('timed query', {
      topK: 1,
      typeFilter: undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'semantic-doc',
      source: 'hybrid',
      strategy: 'semantic',
    });
  });

  it('uses cascade config defaults and unknown strategy fallback in the private cascade helper', async () => {
    const keyword = createMockSearch([
      makeResult('mystery-doc', 0.8, {
        source: 'keyword-source',
        type: 'note',
        metadata: { lane: 'mystery' },
      }),
    ]);
    const hybrid = new HybridSearch({
      strategies: [{ name: 'keyword', search: keyword, weight: 1 }],
      strategyConfig: makeConfig([
        {
          strategy: 'mystery' as SearchStrategyType,
          weight: 1,
          topK: 4,
          timeoutMs: 50,
        },
      ], {
        defaultTopK: 3,
        minScore: 0.25,
        fallbackThreshold: 1,
      }),
    }) as HybridSearchInternals;

    const results = await hybrid.executeCascadeSearch('mystery query', {});

    expect(keyword.search).toHaveBeenCalledWith('mystery query', {
      topK: 4,
      typeFilter: undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'mystery-doc',
      source: 'hybrid',
      strategy: 'keyword',
      type: 'note',
    });
  });

  it('uses step topK defaults and fills missing type or metadata in the private step helper', async () => {
    const keyword = createMockSearch([
      {
        id: 'step-doc',
        content: 'step-content',
        score: 0.5,
        source: 'step-source',
      },
    ]);
    const hybrid = new HybridSearch({
      strategies: [{ name: 'keyword', search: keyword, weight: 1 }],
    }) as HybridSearchInternals;

    const results = await hybrid.executeStepWithTimeout(
      'step query',
      { name: 'keyword', search: keyword, weight: 1 },
      {
        strategy: SearchStrategyType.LOCAL,
        weight: 0.4,
        topK: 2,
        timeoutMs: 50,
      },
      { typeFilter: 'note' },
    );

    expect(keyword.search).toHaveBeenCalledWith('step query', {
      topK: 2,
      typeFilter: 'note',
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'step-doc',
      score: 0.2,
      type: 'chunk',
      metadata: {},
      source: 'step-source',
      strategy: 'keyword',
    });
  });

  it('runs strategies sequentially when parallel execution is disabled and continues after a failure', async () => {
    const order: string[] = [];
    const failing = createMockSearch();
    failing.search.mockImplementation(async () => {
      order.push('first');
      throw new Error('boom');
    });

    const succeeding = createMockSearch();
    succeeding.search.mockImplementation(async () => {
      order.push('second');
      return [makeResult('sequential-doc', 0.8, { source: 'second-source' })];
    });

    const hybrid = new HybridSearch({
      strategies: [
        { name: 'first', search: failing, weight: 0.5 },
        { name: 'second', search: succeeding, weight: 0.5 },
      ],
      parallelExecution: false,
    });

    const results = await hybrid.search('sequential');

    expect(order).toEqual(['first', 'second']);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'sequential-doc',
      strategy: 'second',
      source: 'hybrid',
    });
  });

  it('fills missing type and metadata during sequential execution', async () => {
    const sequential = createMockSearch([
      {
        id: 'sequential-defaults',
        content: 'draft',
        score: 0.8,
        source: 'sequential-source',
      },
    ]);
    const hybrid = new HybridSearch({
      strategies: [{ name: 'sequential', search: sequential, weight: 1 }],
      parallelExecution: false,
    });

    const results = await hybrid.search('sequential defaults');

    expect(sequential.search).toHaveBeenCalledWith('sequential defaults', {
      topK: 20,
      typeFilter: undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'sequential-defaults',
      type: 'chunk',
      metadata: {},
      source: 'hybrid',
      strategy: 'sequential',
    });
  });

  it('fills missing type and metadata during parallel execution', async () => {
    const parallel = createMockSearch([
      {
        id: 'parallel-defaults',
        content: 'draft',
        score: 0.8,
        source: 'parallel-source',
      },
    ]);
    const hybrid = new HybridSearch({
      strategies: [{ name: 'parallel', search: parallel, weight: 1 }],
      parallelExecution: true,
    });

    const results = await hybrid.search('parallel defaults');

    expect(parallel.search).toHaveBeenCalledWith('parallel defaults', {
      topK: 20,
      typeFilter: undefined,
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'parallel-defaults',
      type: 'chunk',
      metadata: {},
      source: 'hybrid',
      strategy: 'parallel',
    });
  });

  it('swallows strategy index errors while still indexing with healthy strategies', async () => {
    const broken = createMockSearch();
    broken.index.mockRejectedValue(new Error('index failed'));
    const healthy = createMockSearch();

    const hybrid = new HybridSearch({
      strategies: [
        { name: 'broken', search: broken, weight: 0.5 },
        { name: 'healthy', search: healthy, weight: 0.5 },
      ],
    });

    await expect(
      hybrid.index('doc-1', 'draft text', { type: 'chapter' }),
    ).resolves.toBeUndefined();

    expect(broken.index).toHaveBeenCalledWith('doc-1', 'draft text', {
      type: 'chapter',
    });
    expect(healthy.index).toHaveBeenCalledWith('doc-1', 'draft text', {
      type: 'chapter',
    });
  });

  it('swallows strategy delete errors and still returns true when another strategy succeeds', async () => {
    const broken = createMockSearch();
    broken.delete.mockRejectedValue(new Error('delete failed'));
    const healthy = createMockSearch();
    healthy.delete.mockResolvedValue(true);

    const hybrid = new HybridSearch({
      strategies: [
        { name: 'broken', search: broken, weight: 0.5 },
        { name: 'healthy', search: healthy, weight: 0.5 },
      ],
    });

    await expect(hybrid.delete('doc-1')).resolves.toBe(true);
    expect(broken.delete).toHaveBeenCalledWith('doc-1');
    expect(healthy.delete).toHaveBeenCalledWith('doc-1');
  });

  it('returns null when removing the only remaining strategy', () => {
    const hybrid = new HybridSearch({
      strategies: [{ name: 'solo', search: createMockSearch(), weight: 1 }],
    });

    expect(hybrid.removeStrategy('solo')).toBeNull();
  });

  it('tolerates missing strategy maps and dropped merge payloads in the private rrf merge helper', () => {
    const hybrid = new HybridSearch({
      strategies: [
        { name: 'keyword', search: createMockSearch(), weight: 0.6 },
        { name: 'semantic', search: createMockSearch(), weight: 0.4 },
      ],
    }) as HybridSearchInternals;

    const lookupCount = new Map<string, number>();
    const resultsByStrategy = {
      get(name: string) {
        const count = (lookupCount.get(name) ?? 0) + 1;
        lookupCount.set(name, count);

        if (name === 'keyword') {
          if (count === 1) {
            return [
              {
                id: 'ghost-doc',
                content: 'ghost',
                score: 0.9,
                type: 'chunk',
                metadata: {},
                source: 'keyword-source',
                strategy: 'keyword',
              },
            ];
          }

          return [];
        }

        return undefined;
      },
    } as unknown as Map<string, Record<string, unknown>[]>;

    const results = hybrid.rrfMerge(resultsByStrategy);

    expect(results).toEqual([]);
  });

  it('returns an empty result when a defensive cascade step cannot resolve any strategy', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hybrid = Object.create(HybridSearch.prototype) as HybridSearch & {
      _strategies: [];
      _strategyConfig: ISearchStrategyConfig;
      defaultTopK: number;
      rrfK: number;
      parallelExecution: boolean;
    };

    hybrid._strategies = [];
    hybrid._strategyConfig = makeConfig([
      { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 1, timeoutMs: 10 },
    ], {
      defaultTopK: 1,
      fallbackThreshold: 1,
    });
    hybrid.defaultTopK = 1;
    hybrid.rrfK = 60;
    hybrid.parallelExecution = true;

    const results = await hybrid.search('unreachable-guard');

    expect(results).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { IterativeRetriever } from '../../search/iterative-retriever.js';
import type { RetrievalProfile, SearchResult } from '../../search/retrieval-types.js';
import { RerankerFactory } from '../../services/reranker/factory.js';

type PrivateRetriever = IterativeRetriever & Record<string, (...args: any[]) => any>;

function makeProfile(overrides: Partial<RetrievalProfile> = {}): RetrievalProfile {
  return {
    name: overrides.name ?? 'whitebox',
    sourceWeights: { memory: 1, graph: 1, file: 1, ...(overrides.sourceWeights ?? {}) },
    thresholds: { min_score: null, ...(overrides.thresholds ?? {}) },
    budget: { budget_tokens: null, ...(overrides.budget ?? {}) },
    rerank: { enabled: false, topK: 20, ...(overrides.rerank ?? {}) },
    sourceQuota: { ...(overrides.sourceQuota ?? {}) },
    fusion: {
      enabled: false,
      mode: 'linear',
      dense: 0.65,
      sparse: 0.2,
      graph: 0.15,
      ...(overrides.fusion ?? {}),
    },
  };
}

function makeTrace(query: string) {
  return {
    query,
    scope: 'all',
    limit: 10,
    profile: 'default',
    cacheHit: false,
    stages: {
      collect: {
        durationMs: 0,
        candidates: 0,
        routeMode: 'legacy',
        legacyCandidates: 0,
        elasticCandidates: 0,
      },
      rerank: {
        durationMs: 0,
        enabled: false,
        fallback: false,
        candidates: 0,
      },
      trim: {
        durationMs: 0,
        droppedByThreshold: 0,
        finalResults: 0,
        budgetTokens: null,
      },
    },
    totalDurationMs: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search/iterative-retriever whitebox additional coverage', () => {
  it('covers lazy adapter defaults, collect fallbacks, elastic skips, rerank metadata defaults, and sparse profile defaults', async () => {
    const lazyRetriever = new IterativeRetriever();
    expect(lazyRetriever.lastTrace).toBeNull();

    const lazyMemoryAdapter = lazyRetriever.memoryEngine as unknown as {
      engine: {
        search: ReturnType<typeof vi.fn>;
        getRetrievalProfile: ReturnType<typeof vi.fn>;
      };
      search: (query: string, options?: { dimensions?: string[]; limit?: number }) => Promise<Array<Record<string, unknown>>>;
      getRetrievalProfile: (name: string) => Record<string, unknown> | undefined;
    };
    lazyMemoryAdapter.engine.search = vi.fn().mockResolvedValue([]);
    lazyMemoryAdapter.engine.getRetrievalProfile = vi.fn().mockReturnValue(null);

    await lazyMemoryAdapter.search('lazy defaults');
    expect(lazyMemoryAdapter.engine.search).toHaveBeenCalledWith({
      query: 'lazy defaults',
      dimensions: null,
      limit: 10,
    });
    expect(lazyMemoryAdapter.getRetrievalProfile('missing')).toBeUndefined();

    const retriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([{ id: 7 }]),
        getRetrievalProfile: vi.fn((name: string) => (name === 'sparse-defaults' ? { enabled: true } : undefined)),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
      elasticsearchEnabled: true,
      elasticAdapter: {
        search: vi.fn().mockResolvedValue([
          { id: 'elastic-valid', content: 'elastic body', metadata: 'invalid-metadata' },
          { content: 'missing id' },
          { id: 'missing-content' },
        ]),
      },
    });
    const privateRetriever = retriever as unknown as PrivateRetriever;

    const collectedMemory = await privateRetriever.collectCandidates('fallbacks', 'memory', 3, makeProfile());
    expect(collectedMemory).toEqual([
      {
        id: '7',
        content: '',
        source: 'memory',
        score: 0,
        metadata: {
          layer: undefined,
          dimension: undefined,
        },
      },
    ]);

    vi.spyOn(privateRetriever, 'searchGraph').mockResolvedValue([
      { id: 'graph-fallback', type: 'Character', name: 'Alice' },
    ]);
    const collectedGraph = await privateRetriever.collectCandidates('fallbacks', 'graph', 3, makeProfile());
    expect(collectedGraph).toEqual([
      {
        id: 'graph-fallback',
        content: 'Character: Alice - ',
        source: 'graph',
        score: 0.5,
        metadata: {
          type: 'Character',
          name: 'Alice',
        },
      },
    ]);

    const noElasticRetriever = new IterativeRetriever({
      memoryEngine: { search: vi.fn().mockResolvedValue([]) },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
      elasticsearchEnabled: true,
    });
    expect(
      await (noElasticRetriever as unknown as PrivateRetriever).collectElasticCandidates('query', 'all', 3, 25),
    ).toEqual([]);

    const nullElasticRetriever = new IterativeRetriever({
      memoryEngine: { search: vi.fn().mockResolvedValue([]) },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
      elasticsearchEnabled: true,
      elasticAdapter: {
        search: vi.fn().mockResolvedValue(null),
      },
    });
    expect(
      await (nullElasticRetriever as unknown as PrivateRetriever).collectElasticCandidates('query', 'all', 3, 25),
    ).toEqual([]);

    const elasticCandidates = await privateRetriever.collectElasticCandidates('query', 'all', 5, 25);
    expect(elasticCandidates).toEqual([
      {
        id: 'elastic-valid',
        content: 'elastic body',
        source: 'elastic',
        score: 0,
        metadata: {},
      },
    ]);

    expect(
      privateRetriever.mergeResultCandidates(
        [
          { id: 'dup', content: 'first', source: 'memory', score: 0.9, metadata: {} },
          { id: 'unique', content: 'second', source: 'memory', score: 0.8, metadata: {} },
        ],
        [
          { id: 'dup', content: 'duplicate', source: 'elastic', score: 0.95, metadata: {} },
          { id: 'later', content: 'third', source: 'file', score: 0.7, metadata: {} },
        ],
        2,
      ),
    ).toEqual([
      { id: 'dup', content: 'duplicate', source: 'elastic', score: 0.95, metadata: {} },
      { id: 'unique', content: 'second', source: 'memory', score: 0.8, metadata: {} },
    ]);

    expect(
      privateRetriever.fuseScore(
        0.5,
        'memory',
        'alpha beta',
        new Set(['alpha']),
        makeProfile({
          fusion: {
            enabled: true,
            mode: undefined as unknown as RetrievalProfile['fusion']['mode'],
            dense: 0.6,
            sparse: 0.2,
            graph: 0.15,
          },
        }),
      ),
    ).toBeCloseTo(0.5, 6);

    vi.spyOn(RerankerFactory, 'fromEnv').mockReturnValue({
      rerank: vi.fn().mockResolvedValue([
        {
          id: 'doc-1',
          content: 'reranked',
          score: 0.91,
        },
      ]),
    } as never);

    const reranked = await privateRetriever.rerankCandidates(
      'rerank-defaults',
      [
        { id: 'doc-1', content: 'body', source: 'memory', score: 0.3 },
      ] as SearchResult[],
      3,
    );
    expect(reranked).toEqual([
      {
        id: 'doc-1',
        content: 'body',
        source: 'memory',
        score: 0.91,
        metadata: {
          reranked: true,
        },
      },
    ]);
    expect(RerankerFactory.fromEnv().rerank).toHaveBeenCalledWith(
      'rerank-defaults',
      ['body'],
      1,
      {
        documentIds: ['doc-1'],
        metadataList: [{ source: 'memory' }],
      },
    );

    expect(await privateRetriever.resolveProfile('sparse-defaults')).toMatchObject({
      name: 'sparse-defaults',
      sourceWeights: { memory: 1, graph: 1, file: 1 },
      thresholds: { min_score: null },
      budget: { budget_tokens: null },
      rerank: { enabled: false, topK: 20 },
      sourceQuota: {},
      fusion: { enabled: false, dense: 0.65, sparse: 0.2, graph: 0.15 },
    });

    expect(
      privateRetriever.extractKeywords([
        {},
        { content: 'alpha alpha beta' },
      ]),
    ).toEqual(['alpha', 'beta']);

    (privateRetriever as unknown as {
      _graphEngine: {
        getForeshadows: ReturnType<typeof vi.fn>;
      };
    })._graphEngine = {
      getForeshadows: vi.fn().mockResolvedValue([{ properties: {} }]),
    } as never;
    expect(await privateRetriever.resolveReference('foreshadow', '')).toBe(
      '伏笔: \n状态: pending\n描述: ',
    );
  });

  it('covers fusion helpers, route normalization, and profile fallback branches', async () => {
    const retriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([]),
        getRetrievalProfile: vi.fn((name: string) => {
          if (name === 'custom') {
            return {
              enabled: true,
              source_weights: { memory: 0.4, graph: 0.6, file: 0.8 },
              thresholds: { min_score: 0.25 },
              budget: { budget_tokens: 128 },
              source_quota: { memory: 2 },
            };
          }
          if (name === 'disabled') {
            return { enabled: false };
          }
          return undefined;
        }),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
    });
    const privateRetriever = retriever as unknown as PrivateRetriever;

    expect(privateRetriever.computeSparseHit('', new Set(['alpha']))).toBe(0);
    expect(privateRetriever.computeSparseHit('alpha beta', new Set())).toBe(0);
    expect(privateRetriever.computeSparseHit('alpha beta', new Set(['alpha', 'missing']))).toBe(0.5);

    expect(
      privateRetriever.fuseScore(
        0.5,
        'elastic',
        'alpha',
        new Set(['alpha']),
        makeProfile(),
      ),
    ).toBe(0.5);

    expect(
      privateRetriever.fuseScore(
        0.5,
        'graph',
        'alpha archive',
        new Set(['alpha', 'archive', 'missing']),
        makeProfile({
          fusion: {
            enabled: true,
            dense: 0.5,
            sparse: 0.25,
            graph: 0.1,
          },
        }),
      ),
    ).toBeCloseTo(0.5167, 4);

    const rrfScore = privateRetriever.fuseScore(
      0.8,
      'graph',
      'silver archive',
      new Set(['silver', 'missing']),
      makeProfile({
        fusion: {
          enabled: true,
          mode: 'rrf',
          dense: 0.6,
          sparse: 0.2,
          graph: 0.1,
          heat: 0.1,
        },
      }),
      0.9,
    );
    expect(rrfScore).toBeGreaterThan(0);
    expect(rrfScore).toBeLessThanOrEqual(1);

    expect((await privateRetriever.resolveProfile()).name).toBe('default');
    expect((await privateRetriever.resolveProfile('lite_low_cost')).name).toBe('lite_low_cost');
    expect(await privateRetriever.resolveProfile('custom')).toMatchObject({
      name: 'custom',
      sourceWeights: { memory: 0.4, graph: 0.6, file: 0.8 },
      thresholds: { min_score: 0.25 },
      budget: { budget_tokens: 128 },
      rerank: { enabled: false, topK: 20 },
      sourceQuota: { memory: 2 },
      fusion: { enabled: false, dense: 0.65, sparse: 0.2, graph: 0.15 },
    });
    expect((await privateRetriever.resolveProfile('disabled')).name).toBe('default');

    const invalidRouteRetriever = new IterativeRetriever({
      memoryEngine: { search: vi.fn().mockResolvedValue([]) },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
    });
    await invalidRouteRetriever.hybridSearch(
      'route probe',
      'memory',
      2,
      undefined,
      undefined,
      undefined,
      false,
      ' unsupported ',
    );
    expect(invalidRouteRetriever.lastTrace?.stages.collect.routeMode).toBe('legacy');

    const mixedTermsRetriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([]),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
    });
    await mixedTermsRetriever.hybridSearch('A 中 x yz', 'memory', 2);
    expect(mixedTermsRetriever.lastTrace?.stages.collect.candidates).toBe(0);

    const budgetTrim = privateRetriever.trimResults(
      [
        { id: 'empty', content: '', source: 'memory', score: 0.9, metadata: {} },
        { id: 'tiny', content: 'abc', source: 'memory', score: 0.8, metadata: {} },
        { id: 'full', content: '12345678', source: 'memory', score: 0.7, metadata: {} },
      ],
      10,
      null,
      2,
      undefined,
    );
    expect(budgetTrim).toMatchObject({
      droppedByThreshold: 0,
      trimmed: [
        expect.objectContaining({ id: 'empty' }),
        expect.objectContaining({ id: 'tiny' }),
      ],
    });

    const hybridRouteRetriever = new IterativeRetriever({
      memoryEngine: { search: vi.fn().mockResolvedValue([]) },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
      elasticsearchEnabled: true,
      elasticAdapter: {
        search: vi.fn().mockResolvedValue([]),
      },
    });
    await hybridRouteRetriever.hybridSearch('  ', 'memory', 2, undefined, undefined, undefined, false, ' HYBRID ');
    expect(hybridRouteRetriever.lastTrace?.stages.collect.routeMode).toBe('hybrid');

    const fallbackBranchRetriever = new IterativeRetriever({
      memoryEngine: { search: vi.fn().mockResolvedValue([]) },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn().mockResolvedValue([{ name: 'Bare Omen' }]),
      },
    });
    const privateFallbackRetriever = fallbackBranchRetriever as unknown as PrivateRetriever;
    expect(await privateFallbackRetriever.resolveReference('style', 'missing')).toBeNull();
    expect(await privateFallbackRetriever.resolveReference('foreshadow', 'bare')).toBe(
      '伏笔: Bare Omen\n状态: pending\n描述: ',
    );
    await fallbackBranchRetriever.hybridSearch(
      'null route',
      'memory',
      2,
      undefined,
      undefined,
      undefined,
      false,
      null as unknown as string,
    );
    expect(fallbackBranchRetriever.lastTrace?.stages.collect.routeMode).toBe('legacy');
  });

  it('covers elastic timeout, rerank fallback, iterative stop branches, graph errors, and file search fallbacks', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-whitebox-${randomUUID()}`);
    const nestedDir = join(tempRoot, 'nested');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(
      join(nestedDir, 'story.txt'),
      `${'x'.repeat(80)}needle${'y'.repeat(170)}`,
      'utf8',
    );
    writeFileSync(join(tempRoot, 'symbols.txt'), `prefix ${'@'.repeat(3)} suffix`, 'utf8');
    writeFileSync(join(tempRoot, 'plain.md'), 'plain body without search term', 'utf8');

    try {
      const pendingElastic = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: { search: vi.fn().mockResolvedValue([{ id: 'legacy', content: 'fallback', score: 0.4 }]) },
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(),
          getForeshadows: vi.fn(),
        },
        elasticsearchEnabled: true,
        elasticAdapter: {
          search: vi.fn(() => new Promise<Array<Record<string, unknown>>>(() => undefined)),
        },
      });
      const elasticResults = await pendingElastic.hybridSearch(
        'timeout probe',
        'all',
        5,
        undefined,
        undefined,
        undefined,
        false,
        'elastic',
        1,
      );
      expect(elasticResults).toEqual([
        expect.objectContaining({ id: 'legacy', source: 'memory' }),
      ]);

      const graphEngine = {
        searchEntitiesByName: vi.fn(async (_entityType: string, pattern: string) => {
          if (pattern.includes('broken')) {
            throw new Error('graph exploded');
          }
          return [
            { error: 'skip me' },
            { id: 'graph-ok', type: 'Character', name: 'Alice', properties: undefined },
          ];
        }),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      };
      const graphRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: { search: vi.fn().mockResolvedValue([]) },
        graphEngine,
      });
      const privateGraphRetriever = graphRetriever as unknown as PrivateRetriever;

      const graphResults = await privateGraphRetriever.searchGraph(
        'broken alpha beta gamma delta epsilon',
        10,
      );
      expect(graphResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'graph-ok',
            type: 'Character',
            name: 'Alice',
            score: 0.7,
          }),
        ]),
      );
      expect(await privateGraphRetriever.searchGraph('!!!', 5)).toEqual([]);

      const fileResults = await privateGraphRetriever.searchFiles('needle', 10);
      expect(fileResults).toEqual([
        expect.objectContaining({
          id: expect.stringContaining('story.txt'),
          metadata: expect.objectContaining({ extension: '.txt', matchCount: 1 }),
        }),
      ]);
      expect(fileResults[0]?.content.startsWith('...')).toBe(true);
      expect(fileResults[0]?.content.endsWith('...')).toBe(true);

      const fallbackKeywordResults = await privateGraphRetriever.searchFiles('@@@', 10);
      expect(fallbackKeywordResults).toEqual([
        expect.objectContaining({
          id: expect.stringContaining('symbols.txt'),
          metadata: expect.objectContaining({ extension: '.txt', matchCount: 1 }),
        }),
      ]);

      const fileRootRetriever = new IterativeRetriever({
        projectRoot: join(tempRoot, 'plain.md'),
        memoryEngine: { search: vi.fn().mockResolvedValue([]) },
        graphEngine,
      });
      expect(
        await (fileRootRetriever as unknown as PrivateRetriever).searchFiles('needle', 5),
      ).toEqual([]);

      vi.spyOn(RerankerFactory, 'fromEnv').mockReturnValue({
        rerank: vi.fn().mockResolvedValue([
          {
            id: 'missing-id',
            content: 'ghost result',
            score: 0.95,
            metadata: { reason: 'unmapped' },
          },
        ]),
      } as never);

      const originalCandidates: SearchResult[] = [
        { id: 'keep', content: '', source: 'memory', score: 0.2, metadata: {} },
      ];
      const reranked = await privateGraphRetriever.rerankCandidates('keep', originalCandidates, 5);
      expect(reranked).toBe(originalCandidates);

      const privateTrim = privateGraphRetriever.trimResults(
        [
          { id: 'keep', content: '', source: 'memory', score: 0.5, metadata: {} },
          { id: 'drop', content: 'long content', source: 'memory', score: 0.4, metadata: {} },
          { id: 'file', content: 'text', source: 'file', score: 0.3, metadata: {} },
        ],
        10,
        0.3,
        0,
        { memory: 1 },
      );
      expect(privateTrim).toMatchObject({
        droppedByThreshold: 0,
        trimmed: [
          expect.objectContaining({ id: 'keep' }),
          expect.objectContaining({ id: 'file' }),
        ],
      });

      const emptyRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: { search: vi.fn().mockResolvedValue([]) },
        graphEngine,
      });
      vi.spyOn(emptyRetriever, 'hybridSearch').mockImplementation(async (query: string) => {
        (emptyRetriever as unknown as { _lastTrace: unknown })._lastTrace = makeTrace(query);
        return [];
      });
      const emptyIter = await emptyRetriever.iterativeRetrieve('seed');
      expect(emptyIter).toMatchObject({
        iterations: 1,
        confidence: 0,
        queriesUsed: ['seed'],
      });
      expect(emptyIter.results).toEqual([]);

      const noExpansionRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: { search: vi.fn().mockResolvedValue([]) },
        graphEngine,
      });
      vi.spyOn(noExpansionRetriever, 'hybridSearch').mockImplementation(async (query: string) => {
        (noExpansionRetriever as unknown as { _lastTrace: unknown })._lastTrace = makeTrace(query);
        return [{ id: 'one', content: '!!', source: 'memory', score: 0.1, metadata: {} }];
      });
      const noExpansion = await noExpansionRetriever.iterativeRetrieve('seed', 3, 0.9);
      expect(noExpansion).toMatchObject({
        iterations: 1,
        confidence: 0.1,
        queriesUsed: ['seed'],
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('covers unresolved references, default fallbacks, and context passthrough branches', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-context-whitebox-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: {
          search: vi.fn(async (query: string, options?: { dimensions?: string[] }) => {
            if (query === '场景 empty') return [{}];
            if (query === '第7章') return [{}, { content: 'Chapter tail' }];
            if (query === 'memory-empty' && !options?.dimensions) return [{}];
            if (query === 'time-empty' && options?.dimensions?.[0] === 'timeline') {
              return [{}, { content: 'Tick' }];
            }
            if (query === 'explode') {
              throw new Error('memory exploded');
            }
            return [];
          }),
        },
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(async (name: string) => {
            if (name === 'Alice') return { name: 'Alice' };
            if (name === 'broken') throw new Error('character exploded');
            return { error: 'not found' };
          }),
          getForeshadows: vi.fn().mockResolvedValue([
            { name: 'Bell Omen', properties: {} },
          ]),
        },
        skillEngine: {
          load: vi.fn().mockRejectedValue(new Error('skill missing')),
        },
      });
      const privateRetriever = retriever as unknown as PrivateRetriever;

      expect(await privateRetriever.resolveReference('character', 'Alice')).toBe(
        '名称: Alice\n属性: {}',
      );
      expect(await privateRetriever.resolveReference('scene', 'empty')).toBe('');
      expect(await privateRetriever.resolveReference('chapter', '7')).toBe('\nChapter tail');
      expect(await privateRetriever.resolveReference('memory', 'memory-empty')).toBe('');
      expect(await privateRetriever.resolveReference('timeline', 'time-empty')).toBe('- \n- Tick');

      const foreshadow = await privateRetriever.resolveReference('foreshadow', 'bell');
      expect(foreshadow).toContain('伏笔: Bell Omen');
      expect(foreshadow).toContain('状态: pending');
      expect(foreshadow).toContain('描述: ');

      expect(await privateRetriever.resolveReference('style', 'missing')).toBeNull();
      expect(await privateRetriever.resolveReference('unknown', 'noop')).toBeNull();
      expect(await privateRetriever.resolveReference('scene', 'explode')).toBeNull();
      expect(await privateRetriever.resolveReference('character', 'broken')).toBeNull();

      const untouched = 'No references here.';
      expect(await retriever.resolveContext(untouched)).toBe(untouched);

      const unresolvedText = 'Keep @memory:explode and @style:missing untouched.';
      expect(await retriever.resolveContext(unresolvedText)).toBe(unresolvedText);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

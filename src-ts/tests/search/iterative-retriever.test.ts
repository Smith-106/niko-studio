import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphEngine } from '../../graph/graph-engine';
import {
  MemoryDimension,
  MemoryLayer,
  resetUnifiedMemoryEngine,
  setConfigProvider,
  UnifiedMemoryEngine,
} from '../../memory';
import { createIterativeRetriever, IterativeRetriever } from '../../search';
import { RerankerFactory } from '../../services/reranker/factory';

describe('search/iterative-retriever', () => {
  afterEach(() => {
    resetUnifiedMemoryEngine();
    setConfigProvider((_key, defaultValue) => defaultValue);
    vi.restoreAllMocks();
  });

  it('adapts the unified memory runtime to the retriever memory-provider contract', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-${randomUUID()}`);
    const dbPath = join(tempRoot, 'memory.db');
    let retriever: ReturnType<typeof createIterativeRetriever> | null = null;

    setConfigProvider((key, defaultValue) => {
      if (key === 'memory.db_path') return dbPath;
      if (key === 'data_dir') return null;
      return defaultValue;
    });

    const seedEngine = new UnifiedMemoryEngine({ dbPath });

    try {
      await seedEngine.add({
        content: 'Alice guards the silver key in the archive.',
        layer: MemoryLayer.SESSION,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'alice-retriever',
        importance: 0.91,
        tags: ['phase4', 'retriever'],
      });
      seedEngine.upsertRetrievalProfile({
        profileName: 'phase4-retriever',
        sourceWeights: { memory: 1, graph: 0.25, file: 0.1 },
        thresholds: { min_score: 0.2 },
        budget: { budget_tokens: 1200 },
        enabled: true,
      });
      seedEngine.close();

      retriever = createIterativeRetriever({ projectRoot: tempRoot });
      const results = await retriever.memoryEngine.search(
        'Alice guards the silver key in the archive.',
        {
          dimensions: [MemoryDimension.CONTEXT],
          limit: 5,
        },
      );
      const profile = retriever.memoryEngine.getRetrievalProfile?.('phase4-retriever');

      expect(results).toEqual([
        expect.objectContaining({
          content: 'Alice guards the silver key in the archive.',
          dimension: MemoryDimension.CONTEXT,
          entity_id: 'alice-retriever',
        }),
      ]);
      expect(profile).toMatchObject({
        profile_name: 'phase4-retriever',
        source_weights_json: { memory: 1, graph: 0.25, file: 0.1 },
        thresholds_json: { min_score: 0.2 },
        budget_json: { budget_tokens: 1200 },
        enabled: true,
      });
    } finally {
      const provider = (retriever as unknown as {
        _memoryEngine?: { engine?: { close?: () => void } };
      }) ?? {};
      provider._memoryEngine?.engine?.close?.();
      resetUnifiedMemoryEngine();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('lazily instantiates the ts graph runtime for graph-backed context resolution', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-graph-${randomUUID()}`);
    const previousDataDir = process.env.DATA_DIR;
    let retriever: ReturnType<typeof createIterativeRetriever> | null = null;

    process.env.DATA_DIR = tempRoot;

    const seedEngine = new GraphEngine(join(tempRoot, 'graph.db'));

    try {
      await seedEngine.createEntity('Character', 'Alice', { role: 'lead', squad: 'archive' });
      await seedEngine.createEntity('Foreshadow', 'SilverBell', {
        status: 'pending',
        description: 'The bell tolls before the vault opens.',
      });
      seedEngine.close();

      retriever = createIterativeRetriever({ projectRoot: tempRoot });
      const resolved = await retriever.resolveContext(
        'Signal @character:Alice before @foreshadow:SilverBell.',
      );

      expect(resolved).toContain('[character:Alice]');
      expect(resolved).toContain('[foreshadow:SilverBell]');
      expect(resolved).toContain('名称: Alice');
      expect(resolved).toContain('"role":"lead"');
      expect(resolved).toContain('伏笔: SilverBell');
      expect(resolved).toContain('状态: pending');
      expect(resolved).toContain('描述: The bell tolls before the vault opens.');
    } finally {
      const provider = (retriever as unknown as {
        _graphEngine?: { close?: () => void };
      }) ?? {};
      provider._graphEngine?.close?.();
      if (previousDataDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = previousDataDir;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('collects legacy candidates from memory, graph, and files and records trace metadata', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-legacy-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });
    writeFileSync(
      join(tempRoot, 'notes.md'),
      'The silver archive keeps the key safe inside the lower vault.',
      'utf8',
    );

    const memoryEngine = {
      search: vi.fn().mockResolvedValue([
        {
          id: 'memory-1',
          content: 'Silver key lives in archive memory.',
          score: 0.82,
          layer: 'session',
          dimension: 'context',
        },
      ]),
      getRetrievalProfile: vi.fn().mockReturnValue({
        enabled: true,
        source_weights_json: { memory: 1, graph: 1, file: 1 },
        thresholds_json: { min_score: null },
        budget_json: { budget_tokens: null },
        source_quota: {},
        rerank: { enabled: false, topK: 20 },
        fusion: { enabled: false, mode: 'linear', dense: 0.65, sparse: 0.2, graph: 0.15 },
      }),
    };
    const graphEngine = {
      searchEntitiesByName: vi.fn(async (_entityType: string, pattern: string) =>
        pattern.includes('silver')
          ? [
              {
                id: 'graph-1',
                type: 'Character',
                name: 'Silver Guard',
                properties: { role: 'keeper' },
              },
            ]
          : []),
      getCharacter: vi.fn(),
      getForeshadows: vi.fn(),
    };

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
      });

      const results = await retriever.hybridSearch('silver archive', 'all', 10, 'custom');

      expect(results.map((item) => item.source).sort()).toEqual(['file', 'graph', 'memory']);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'memory-1', source: 'memory' }),
          expect.objectContaining({ id: 'graph-1', source: 'graph' }),
          expect.objectContaining({ source: 'file', metadata: expect.objectContaining({ extension: '.md' }) }),
        ]),
      );
      expect(retriever.lastTrace).toMatchObject({
        profile: 'custom',
        stages: {
          collect: {
            routeMode: 'legacy',
            legacyCandidates: 3,
            elasticCandidates: 0,
          },
          rerank: {
            enabled: false,
            fallback: false,
            candidates: 3,
          },
          trim: {
            droppedByThreshold: 0,
            finalResults: 3,
            budgetTokens: null,
          },
        },
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('merges elastic results in hybrid mode and falls back to legacy when elastic search fails', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-elastic-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    const memoryEngine = {
      search: vi.fn().mockResolvedValue([
        { id: 'legacy-1', content: 'Legacy archive answer', score: 0.6 },
      ]),
    };
    const graphEngine = {
      searchEntitiesByName: vi.fn().mockResolvedValue([]),
      getCharacter: vi.fn(),
      getForeshadows: vi.fn(),
    };

    try {
      const hybridRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
        elasticsearchEnabled: true,
        elasticAdapter: {
          search: vi.fn().mockResolvedValue([
            {
              id: 'elastic-1',
              content: 'Elastic archive answer',
              score: 0.95,
              metadata: ['ignored'],
            },
            {
              id: '',
              content: 'invalid candidate',
              score: 1,
            },
          ]),
        },
      });

      const hybridResults = await hybridRetriever.hybridSearch(
        'archive',
        'all',
        10,
        undefined,
        undefined,
        undefined,
        false,
        'hybrid',
      );

      expect(hybridResults).toEqual([
        expect.objectContaining({
          id: 'elastic-1',
          source: 'elastic',
          metadata: {},
        }),
        expect.objectContaining({
          id: 'legacy-1',
          source: 'memory',
        }),
      ]);
      expect(hybridRetriever.lastTrace).toMatchObject({
        stages: {
          collect: {
            routeMode: 'hybrid',
            legacyCandidates: 1,
            elasticCandidates: 1,
          },
        },
      });

      const fallbackRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
        elasticsearchEnabled: true,
        elasticAdapter: {
          search: vi.fn().mockRejectedValue(new Error('elastic down')),
        },
      });

      const fallbackResults = await fallbackRetriever.hybridSearch(
        'archive',
        'all',
        10,
        undefined,
        undefined,
        undefined,
        false,
        'elastic',
      );

      expect(fallbackResults).toEqual([
        expect.objectContaining({ id: 'legacy-1', source: 'memory' }),
      ]);
      expect(fallbackRetriever.lastTrace).toMatchObject({
        stages: {
          collect: {
            routeMode: 'elastic',
            legacyCandidates: 1,
            elasticCandidates: 0,
          },
        },
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('reranks candidates when the reranker succeeds and falls back when reranking fails', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-rerank-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    const memoryEngine = {
      search: vi.fn().mockResolvedValue([
        { id: 'm1', content: 'first memory result', score: 0.6 },
        { id: 'm2', content: 'second memory result', score: 0.7 },
      ]),
    };
    const graphEngine = {
      searchEntitiesByName: vi.fn().mockResolvedValue([]),
      getCharacter: vi.fn(),
      getForeshadows: vi.fn(),
    };

    try {
      vi.spyOn(RerankerFactory, 'fromEnv').mockReturnValue({
        rerank: vi.fn().mockResolvedValue([
          {
            id: 'm2',
            content: 'second memory result',
            score: 0.93,
            metadata: { rerank_source: 'mock' },
            originalIndex: 1,
          },
          {
            id: 'm1',
            content: 'first memory result',
            score: 0.52,
            metadata: {},
            originalIndex: 0,
          },
        ]),
      } as never);

      const rerankedRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
      });
      const reranked = await rerankedRetriever.hybridSearch(
        'memory',
        'all',
        10,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(reranked.map((item) => item.id)).toEqual(['m2', 'm1']);
      expect(reranked[0]?.metadata).toMatchObject({
        reranked: true,
        rerank_source: 'mock',
      });
      expect(rerankedRetriever.lastTrace).toMatchObject({
        stages: {
          rerank: {
            enabled: true,
            fallback: false,
            candidates: 2,
          },
        },
      });

      vi.spyOn(RerankerFactory, 'fromEnv').mockReturnValueOnce({
        rerank: vi.fn().mockRejectedValue(new Error('rerank failed')),
      } as never);

      const fallbackRetriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
      });
      const fallback = await fallbackRetriever.hybridSearch(
        'memory',
        'all',
        10,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(fallback.map((item) => item.id)).toEqual(['m2', 'm1']);
      expect(fallbackRetriever.lastTrace).toMatchObject({
        stages: {
          rerank: {
            enabled: true,
            fallback: true,
            candidates: 2,
          },
        },
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('applies deduplication, threshold, source quota, and budget trimming during hybrid search', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-trim-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    const memoryEngine = {
      search: vi.fn().mockResolvedValue([
        { id: 'dup', content: 'top memory answer', score: 0.91 },
        { id: 'dup', content: 'duplicate memory answer', score: 0.4 },
        { id: 'low', content: 'low score answer', score: 0.1 },
        { id: 'm2', content: 'second memory answer that is slightly longer', score: 0.8 },
      ]),
      getRetrievalProfile: vi.fn().mockReturnValue({
        enabled: true,
        source_weights_json: { memory: 1, graph: 1, file: 1 },
        thresholds_json: { min_score: 0.2 },
        budget_json: { budget_tokens: 4 },
        source_quota: { memory: 1, graph: 1 },
        rerank: { enabled: false, topK: 20 },
        fusion: { enabled: false, mode: 'linear', dense: 0.65, sparse: 0.2, graph: 0.15 },
      }),
    };
    const graphEngine = {
      searchEntitiesByName: vi.fn().mockResolvedValue([
        { id: 'graph-1', type: 'Character', name: 'Alice', properties: { role: 'lead' } },
      ]),
      getCharacter: vi.fn(),
      getForeshadows: vi.fn(),
    };

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine,
      });

      const results = await retriever.hybridSearch('alice', 'all', 10, 'trimmed');

      expect(results).toEqual([
        expect.objectContaining({ id: 'dup', source: 'memory' }),
      ]);
      expect(retriever.lastTrace).toMatchObject({
        profile: 'trimmed',
        stages: {
          trim: {
            droppedByThreshold: 1,
            finalResults: 1,
            budgetTokens: 4,
          },
        },
      });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('iteratively expands the query until a confident result is found', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-iter-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    const searchMock = vi.fn(async (query: string) => {
      if (query === 'seed') {
        return [
          {
            id: 'r1',
            content: 'alpha beta alpha beta',
            score: 0.4,
          },
        ];
      }

      if (query === 'seed alpha beta') {
        return [
          {
            id: 'r2',
            content: 'resolved final answer',
            score: 0.92,
          },
        ];
      }

      return [];
    });

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: {
          search: searchMock,
        },
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(),
          getForeshadows: vi.fn(),
        },
      });

      const result = await retriever.iterativeRetrieve('seed');

      expect(searchMock.mock.calls.map((call) => call[0])).toEqual(['seed', 'seed alpha beta']);
      expect(result).toMatchObject({
        iterations: 2,
        confidence: 0.92,
        queriesUsed: ['seed', 'alpha beta'],
      });
      expect(result.results.map((item) => item.id)).toEqual(['r2', 'r1']);
      expect(result.retrievalTrace).toHaveLength(2);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves scene, chapter, memory, timeline, and style references into a context preamble', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-context-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });

    const memoryEngine = {
      search: vi.fn(async (query: string, options?: { dimensions?: string[]; limit?: number }) => {
        if (query === '场景 s1') return [{ content: 'Scene context body' }];
        if (query === '第3章') return [{ content: 'Chapter line A' }, { content: 'Chapter line B' }];
        if (query === 'artifact' && !options?.dimensions) return [{ content: 'Artifact memory' }];
        if (query === 'bell' && options?.dimensions?.[0] === 'timeline') {
          return [{ content: 'Bell tolled' }, { content: 'Door opened' }];
        }
        return [];
      }),
    };

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine,
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(),
          getForeshadows: vi.fn(),
        },
        skillEngine: {
          load: vi.fn().mockResolvedValue({
            name: 'noir',
            description: 'Dark and restrained tone',
          }),
        },
      });

      const resolved = await retriever.resolveContext(
        'Use @scene:s1 with @chapter:3 and @memory:artifact over @timeline:bell plus @style:noir.',
      );

      expect(resolved).toContain('=== 上下文 ===');
      expect(resolved).toContain('[scene:s1]');
      expect(resolved).toContain('Scene context body');
      expect(resolved).toContain('[chapter:3]');
      expect(resolved).toContain('Chapter line A\nChapter line B');
      expect(resolved).toContain('[memory:artifact]');
      expect(resolved).toContain('Artifact memory');
      expect(resolved).toContain('[timeline:bell]');
      expect(resolved).toContain('- Bell tolled');
      expect(resolved).toContain('[style:noir]');
      expect(resolved).toContain('技能包: noir');
      expect(resolved).toContain('描述: Dark and restrained tone');
      expect(resolved).toContain('=== 原文 ===');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

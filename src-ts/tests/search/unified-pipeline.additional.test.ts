import { describe, expect, it, vi } from 'vitest';

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

import { UnifiedSearchPipeline, type UnifiedPipelineDeps } from '../../search/unified-pipeline.js';
import { SearchStrategyType, type ISearchStrategyConfig } from '../../search/strategy-config.js';

function createDeps() {
  return {
    knowledgeService: {
      search: vi.fn().mockResolvedValue([
        { content: 'reachable result', score: 0.9, metadata: { lane: 'knowledge' } },
      ]),
    },
    smartSearch: {
      search: vi.fn().mockResolvedValue([]),
    },
    hybridSearch: {
      search: vi.fn().mockResolvedValue([]),
    },
    vectorSearch: {
      search: vi.fn().mockResolvedValue([]),
    },
    obsidianService: {},
  } as unknown as UnifiedPipelineDeps;
}

function makeConfig(): ISearchStrategyConfig {
  return {
    name: 'TEST_DEFENSIVE_BRANCH',
    cascade: [
      { strategy: SearchStrategyType.LOCAL, weight: 1, topK: 3, timeoutMs: 100 },
    ],
    defaultTopK: 10,
    minScore: 0,
    fallbackThreshold: 1,
  };
}

describe('search/unified-pipeline additional coverage', () => {
  it('returns the defensive unknown placeholder when fused ids are missing from the result map', async () => {
    mockedRrfMerge.mockReturnValue([
      { id: 'missing-content-hash', score: 1 },
    ]);

    const pipeline = new UnifiedSearchPipeline(createDeps());
    const result = await pipeline.search('ghost branch', {
      strategyConfig: makeConfig(),
      topK: 5,
    });

    expect(result.total).toBe(1);
    expect(result.dedupRemoved).toBe(0);
    expect(result.results).toEqual([
      {
        content: '',
        source: 'unknown',
        score: 0,
        metadata: {},
      },
    ]);
  });
});

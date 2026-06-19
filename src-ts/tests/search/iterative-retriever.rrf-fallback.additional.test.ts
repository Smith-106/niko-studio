import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RetrievalProfile } from '../../search/retrieval-types.js';

type PrivateRetriever = Record<string, (...args: any[]) => any>;

function makeProfile(): RetrievalProfile {
  return {
    name: 'rrf-fallback',
    sourceWeights: { memory: 1, graph: 1, file: 1 },
    thresholds: { min_score: null },
    budget: { budget_tokens: null },
    rerank: { enabled: false, topK: 20 },
    sourceQuota: {},
    fusion: {
      enabled: true,
      mode: 'rrf',
      dense: 0.6,
      sparse: 0.2,
      graph: 0.1,
    },
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../../search/utils/rrf-fusion.js');
});

describe('search/iterative-retriever rrf fallback coverage', () => {
  it('falls back to the weighted base score when rrf merge yields no ranked items', async () => {
    vi.doMock('../../search/utils/rrf-fusion.js', async () => {
      const actual = await vi.importActual<typeof import('../../search/utils/rrf-fusion.js')>(
        '../../search/utils/rrf-fusion.js',
      );

      return {
        ...actual,
        rrfMerge: vi.fn().mockReturnValue([]),
      };
    });

    const { IterativeRetriever } = await import('../../search/iterative-retriever.js');

    const retriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([]),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn(),
      },
    }) as unknown as PrivateRetriever;

    expect(
      retriever.fuseScore(
        0.42,
        'memory',
        'alpha',
        new Set(['alpha']),
        makeProfile(),
      ),
    ).toBeCloseTo(0.42, 6);
  });
});

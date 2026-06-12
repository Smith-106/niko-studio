import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hybridSearchMock = vi.hoisted(() => vi.fn());
const iterativeRetrieveMock = vi.hoisted(() => vi.fn());
const resolveContextMock = vi.hoisted(() => vi.fn());
const allowRequestMock = vi.hoisted(() => vi.fn());
const cacheGetMock = vi.hoisted(() => vi.fn());
const cacheSetMock = vi.hoisted(() => vi.fn());
const createIterativeRetrieverMock = vi.hoisted(() => vi.fn());
const createIntegrationAdaptersMock = vi.hoisted(() => vi.fn());

vi.mock('../../search', () => ({
  createIterativeRetriever: createIterativeRetrieverMock,
}));

vi.mock('../../integrations', () => ({
  createIntegrationAdapters: createIntegrationAdaptersMock,
}));

function buildAdapters(overrides: Record<string, unknown> = {}) {
  return {
    flags: {
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
      langflowEnabled: false,
    },
    requestedFlags: {
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
      langflowEnabled: false,
    },
    capabilities: {},
    cacheRateLimit: {
      allowRequest: allowRequestMock,
      cacheGet: cacheGetMock,
      cacheSet: cacheSetMock,
      getStatus: vi.fn(() => ({
        integration: 'redis-cache-rate-limit',
        state: 'disabled',
        support_level: 'experimental',
        code: 'INTEGRATION_DISABLED',
        detail: 'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
      })),
    },
    search: {
      getStatus: vi.fn(() => ({
        integration: 'elasticsearch-search',
        state: 'disabled',
        support_level: 'experimental',
        code: 'INTEGRATION_DISABLED',
        detail: 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
      })),
    },
    orchestration: {
      run: vi.fn(),
      getStatus: vi.fn(() => ({
        integration: 'langflow-orchestration',
        state: 'disabled',
        support_level: 'disabled',
        code: 'INTEGRATION_DISABLED',
        detail: 'Langflow orchestration is disabled; no external orchestration flow was started.',
      })),
    },
    ...overrides,
  };
}

describe('mcp search service additional coverage', () => {
  beforeEach(() => {
    createIterativeRetrieverMock.mockImplementation(() => ({
      hybridSearch: hybridSearchMock,
      iterativeRetrieve: iterativeRetrieveMock,
      resolveContext: resolveContextMock,
    }));
    createIntegrationAdaptersMock.mockImplementation(() => buildAdapters());
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns cached redis results without invoking the hybrid retriever', async () => {
    const cachedResults = [
      { id: 'cached-1', content: 'cached result', source: 'memory', score: 0.91 },
    ];

    allowRequestMock.mockResolvedValueOnce(true);
    cacheGetMock.mockResolvedValueOnce({ results: cachedResults });
    createIntegrationAdaptersMock.mockImplementationOnce(() =>
      buildAdapters({
        flags: {
          redisCacheEnabled: true,
          elasticsearchEnabled: false,
          langflowEnabled: false,
        },
      }),
    );

    const { searchHybrid } = await import('../../mcp/services/search.js?cache-hit');
    const result = await searchHybrid({
      query: 'cached query',
      scope: 'memory',
      limit: 2,
      profile: 'standard_balanced',
    });

    expect(result).toEqual(cachedResults);
    expect(allowRequestMock).toHaveBeenCalledWith('search:rate:memory', 120, 60);
    expect(cacheGetMock).toHaveBeenCalledWith('search:memory:cached query:2:standard_balanced');
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(cacheSetMock).not.toHaveBeenCalled();
  });

  it('returns the empty iterative fallback when the search engine cannot be created', async () => {
    createIterativeRetrieverMock.mockImplementationOnce(() => null);

    const { searchIterative } = await import('../../mcp/services/search.js?no-engine');
    const result = await searchIterative({
      query: 'missing engine',
      maxIterations: 4,
      confidenceThreshold: 0.95,
    });

    expect(result).toEqual({
      results: [],
      iterations: 0,
      confidence: 0,
      queriesUsed: ['missing engine'],
      retrievalTrace: [],
    });
    expect(iterativeRetrieveMock).not.toHaveBeenCalled();
  });

  it('returns early when redis rate limiting denies the request', async () => {
    allowRequestMock.mockResolvedValueOnce(false);
    createIntegrationAdaptersMock.mockImplementationOnce(() =>
      buildAdapters({
        flags: {
          redisCacheEnabled: true,
          elasticsearchEnabled: false,
          langflowEnabled: false,
        },
      }),
    );

    const { searchHybrid } = await import('../../mcp/services/search.js?rate-denied');
    const result = await searchHybrid({
      query: 'blocked query',
      scope: 'memory',
    });

    expect(result).toEqual([]);
    expect(allowRequestMock).toHaveBeenCalledWith('search:rate:memory', 120, 60);
    expect(cacheGetMock).not.toHaveBeenCalled();
    expect(hybridSearchMock).not.toHaveBeenCalled();
  });

  it('falls back to disabled adapters when integration adapters are unavailable', async () => {
    createIntegrationAdaptersMock.mockImplementation(() => null);
    hybridSearchMock.mockResolvedValueOnce([
      { id: 'doc-null-adapter', content: 'ok', source: 'memory', score: 0.5 },
    ]);

    const { searchHybrid } = await import('../../mcp/services/search.js?null-adapters');
    const result = await searchHybrid({
      query: 'null adapters',
    });

    expect(createIterativeRetrieverMock).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      elasticAdapter: undefined,
      elasticsearchEnabled: false,
    });
    expect(result).toEqual([
      { id: 'doc-null-adapter', content: 'ok', source: 'memory', score: 0.5 },
    ]);
  });

  it('returns empty hybrid and context fallbacks when the search engine cannot be created', async () => {
    createIterativeRetrieverMock.mockImplementation(() => null);

    const { searchHybrid, searchContext } = await import('../../mcp/services/search.js?no-engine-hybrid');

    await expect(searchHybrid({ query: 'missing engine hybrid' })).resolves.toEqual([]);
    await expect(searchContext('missing-engine-context')).resolves.toBe('');
    expect(hybridSearchMock).not.toHaveBeenCalled();
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it('uses default iterative parameters when optional arguments are omitted', async () => {
    iterativeRetrieveMock.mockResolvedValueOnce({
      results: [],
      iterations: 0,
      confidence: 0.1,
      queriesUsed: ['defaults'],
      retrievalTrace: [],
    });

    const { searchIterative } = await import('../../mcp/services/search.js?iterative-defaults');
    await searchIterative({ query: 'defaults' });

    expect(iterativeRetrieveMock).toHaveBeenCalledWith(
      'defaults',
      3,
      0.8,
      undefined,
      undefined,
      undefined,
      false,
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const hybridSearchMock = vi.fn();
const iterativeRetrieveMock = vi.fn();
const resolveContextMock = vi.fn();
const allowRequestMock = vi.fn();
const cacheGetMock = vi.fn();
const cacheSetMock = vi.fn();
const indexDocumentMock = vi.fn();
const elasticSearchMock = vi.fn();
const orchestrationRunMock = vi.fn();
const createIterativeRetrieverMock = vi.fn(() => ({
  hybridSearch: hybridSearchMock,
  iterativeRetrieve: iterativeRetrieveMock,
  resolveContext: resolveContextMock,
}));

const integrationAdaptersMock = {
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
  capabilities: {
    redisCacheEnabled: {
      flag: 'redisCacheEnabled',
      integration: 'redis-cache-rate-limit',
      support_level: 'experimental',
      requested: false,
      enabled: false,
      detail: 'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
    },
    elasticsearchEnabled: {
      flag: 'elasticsearchEnabled',
      integration: 'elasticsearch-search',
      support_level: 'experimental',
      requested: false,
      enabled: false,
      detail: 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
    },
    langflowEnabled: {
      flag: 'langflowEnabled',
      integration: 'langflow-orchestration',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'Langflow orchestration is disabled; no external orchestration flow was started.',
    },
  },
  cacheRateLimit: {
    allowRequest: allowRequestMock,
    cacheGet: cacheGetMock,
    cacheSet: cacheSetMock,
    getStatus: vi.fn(() => ({
      integration: 'redis-cache-rate-limit',
      state: integrationAdaptersMock.flags.redisCacheEnabled ? 'degraded' : 'disabled',
      support_level: 'experimental',
      code: integrationAdaptersMock.flags.redisCacheEnabled
        ? 'REDIS_CACHE_RATE_LIMIT_DEGRADED'
        : 'INTEGRATION_DISABLED',
      detail: integrationAdaptersMock.flags.redisCacheEnabled
        ? 'Redis cache/rate-limit is enabled in configuration but no external backend is implemented; in-process defaults remain active.'
        : 'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
    })),
  },
  search: {
    indexDocument: indexDocumentMock,
    search: elasticSearchMock,
    getStatus: vi.fn(() => ({
      integration: 'elasticsearch-search',
      state: integrationAdaptersMock.flags.elasticsearchEnabled ? 'degraded' : 'disabled',
      support_level: 'experimental',
      code: integrationAdaptersMock.flags.elasticsearchEnabled ? 'ELASTICSEARCH_DEGRADED' : 'INTEGRATION_DISABLED',
      detail: integrationAdaptersMock.flags.elasticsearchEnabled
        ? 'Elasticsearch is enabled but no durable external index is available; requests must fall back to local retrieval.'
        : 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
    })),
  },
  orchestration: {
    run: orchestrationRunMock,
    getStatus: vi.fn(() => ({
      integration: 'langflow-orchestration',
      state: integrationAdaptersMock.flags.langflowEnabled ? 'unsupported' : 'disabled',
      support_level: 'disabled',
      code: integrationAdaptersMock.flags.langflowEnabled ? 'LANGFLOW_UNSUPPORTED' : 'INTEGRATION_DISABLED',
      detail: integrationAdaptersMock.flags.langflowEnabled
        ? 'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.'
        : 'Langflow orchestration is disabled; no external orchestration flow was started.',
    })),
  },
};

vi.mock('../../search', () => ({
  createIterativeRetriever: createIterativeRetrieverMock,
}));

vi.mock('../../integrations', () => ({
  createIntegrationAdapters: vi.fn(() => integrationAdaptersMock),
}));

describe('mcp search service wiring', () => {
  afterEach(() => {
    integrationAdaptersMock.flags.redisCacheEnabled = false;
    integrationAdaptersMock.flags.elasticsearchEnabled = false;
    integrationAdaptersMock.flags.langflowEnabled = false;
    integrationAdaptersMock.requestedFlags.redisCacheEnabled = false;
    integrationAdaptersMock.requestedFlags.elasticsearchEnabled = false;
    integrationAdaptersMock.requestedFlags.langflowEnabled = false;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('delegates searchHybrid to IterativeRetriever', async () => {
    hybridSearchMock.mockResolvedValueOnce([{ id: 'doc-1', content: 'result', source: 'memory', score: 0.9 }]);

    const { searchHybrid } = await import('../../mcp/services/search.js');
    const result = await searchHybrid({
      query: 'hero journey',
      scope: 'all',
      limit: 5,
      profile: 'standard_balanced',
      rerank: true,
      routeMode: 'hybrid',
    });

    expect(hybridSearchMock).toHaveBeenCalledWith(
      'hero journey',
      'all',
      5,
      'standard_balanced',
      undefined,
      undefined,
      true,
      'hybrid',
      300,
    );
    expect(result).toEqual([{ id: 'doc-1', content: 'result', source: 'memory', score: 0.9 }]);
  });

  it('delegates searchIterative and searchContext to IterativeRetriever', async () => {
    iterativeRetrieveMock.mockResolvedValueOnce({
      results: [{ id: 'iter-1', content: 'done', source: 'memory', score: 0.76, metadata: {} }],
      iterations: 1,
      confidence: 0.76,
      queriesUsed: ['plot twist'],
      retrievalTrace: [],
    });
    resolveContextMock.mockResolvedValueOnce('resolved-context');

    const { searchIterative, searchContext } = await import('../../mcp/services/search.js');

    const iterative = await searchIterative({ query: 'plot twist', maxIterations: 2, confidenceThreshold: 0.7 });
    const context = await searchContext('@character:alice');

    expect(iterativeRetrieveMock).toHaveBeenCalledWith(
      'plot twist',
      2,
      0.7,
      undefined,
      undefined,
      undefined,
      false,
    );
    expect(resolveContextMock).toHaveBeenCalledWith('@character:alice');
    expect(iterative).toEqual({
      results: [{ id: 'iter-1', content: 'done', source: 'memory', score: 0.76, metadata: {} }],
      iterations: 1,
      confidence: 0.76,
      queriesUsed: ['plot twist'],
      retrievalTrace: [],
    });
    expect(context).toBe('resolved-context');
  });

  it('uses resolved redis defaults for rate limiting and cache writes', async () => {
    integrationAdaptersMock.flags.redisCacheEnabled = true;
    allowRequestMock.mockResolvedValueOnce(true);
    cacheGetMock.mockResolvedValueOnce(null);
    hybridSearchMock.mockResolvedValueOnce([
      { id: 'doc-2', content: 'cached later', source: 'memory', score: 0.8 },
    ]);

    const { searchHybrid } = await import('../../mcp/services/search.js');
    const result = await searchHybrid({
      query: 'silver bell',
      scope: 'memory',
      limit: 3,
    });

    expect(allowRequestMock).toHaveBeenCalledWith('search:rate:memory', 120, 60);
    expect(cacheSetMock).toHaveBeenCalledWith(
      'search:memory:silver bell:3:',
      {
        results: [{ id: 'doc-2', content: 'cached later', source: 'memory', score: 0.8 }],
      },
      120,
    );
    expect(result).toEqual([
      { id: 'doc-2', content: 'cached later', source: 'memory', score: 0.8 },
    ]);
  });

  it('injects the elastic adapter into the retriever when elastic search is enabled', async () => {
    integrationAdaptersMock.flags.elasticsearchEnabled = true;
    hybridSearchMock.mockResolvedValueOnce([]);

    const { searchHybrid } = await import('../../mcp/services/search.js');
    const result = await searchHybrid({ query: 'hybrid branch', routeMode: 'hybrid' });

    expect(createIterativeRetrieverMock).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      elasticAdapter: integrationAdaptersMock.search,
      elasticsearchEnabled: true,
    });
    expect(hybridSearchMock).toHaveBeenCalledWith(
      'hybrid branch',
      'all',
      10,
      undefined,
      undefined,
      undefined,
      false,
      'legacy',
      300,
    );
    expect(result).toEqual([
      {
        id: 'integration:elasticsearch-search',
        content: 'Elasticsearch is enabled but no durable external index is available; requests must fall back to local retrieval.',
        source: 'integration',
        score: 1,
        metadata: {
          integration: 'elasticsearch-search',
          state: 'degraded',
          support_level: 'experimental',
          code: 'ELASTICSEARCH_DEGRADED',
          routeMode: 'legacy',
          results: [],
        },
      },
    ]);
  });
});

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
  cacheRateLimit: {
    allowRequest: allowRequestMock,
    cacheGet: cacheGetMock,
    cacheSet: cacheSetMock,
  },
  search: {
    indexDocument: indexDocumentMock,
    search: elasticSearchMock,
  },
  orchestration: {
    run: orchestrationRunMock,
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
    await searchHybrid({ query: 'hybrid branch', routeMode: 'hybrid' });

    expect(createIterativeRetrieverMock).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      elasticAdapter: integrationAdaptersMock.search,
      elasticsearchEnabled: true,
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const createIterativeRetrieverMock = vi.fn(() => ({
  hybridSearch: vi.fn().mockResolvedValue([]),
}));

const integrationAdaptersMock = {
  flags: {
    postgresEnabled: false,
    redisCacheEnabled: false,
    elasticsearchEnabled: false,
    neo4jEnabled: false,
    langflowEnabled: false,
  },
  storageShadow: {
    shadowWriteMemory: vi.fn(),
  },
  cacheRateLimit: {
    cacheGet: vi.fn(),
    cacheSet: vi.fn(),
    allowRequest: vi.fn(),
  },
  search: {
    indexDocument: vi.fn(),
    search: vi.fn(),
  },
  graphProjection: {
    projectEntity: vi.fn(),
    projectRelation: vi.fn(),
  },
  governance: {
    onSchemaWorkflow: vi.fn(),
  },
  orchestration: {
    run: vi.fn(),
  },
};

vi.mock('../../search', () => ({
  createIterativeRetriever: createIterativeRetrieverMock,
}));

vi.mock('../../integrations', () => ({
  createIntegrationAdapters: vi.fn(() => integrationAdaptersMock),
}));

describe('SearchEngineAdapter default constructor', () => {
  afterEach(() => {
    integrationAdaptersMock.flags.elasticsearchEnabled = false;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('injects elastic search integration into the default retriever when enabled', async () => {
    integrationAdaptersMock.flags.elasticsearchEnabled = true;

    const { SearchEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new SearchEngineAdapter();

    expect(adapter).toBeInstanceOf(SearchEngineAdapter);
    expect(createIterativeRetrieverMock).toHaveBeenCalledWith({
      projectRoot: process.cwd(),
      elasticAdapter: integrationAdaptersMock.search,
      elasticsearchEnabled: true,
    });
  });
});

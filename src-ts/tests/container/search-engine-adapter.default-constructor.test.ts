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
  requestedFlags: {
    postgresEnabled: false,
    redisCacheEnabled: false,
    elasticsearchEnabled: false,
    neo4jEnabled: false,
    langflowEnabled: false,
    dbhubGovernanceEnabled: false,
  },
  capabilities: {
    postgresEnabled: {
      flag: 'postgresEnabled',
      integration: 'postgres-shadow',
      support_level: 'experimental',
      requested: false,
      enabled: false,
      detail: 'Postgres shadow-write integration is disabled; local-first persistence remains authoritative.',
    },
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
    neo4jEnabled: {
      flag: 'neo4jEnabled',
      integration: 'neo4j-projection',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'Neo4j projection is disabled; SQLite graph storage remains authoritative.',
    },
    langflowEnabled: {
      flag: 'langflowEnabled',
      integration: 'langflow-orchestration',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'Langflow orchestration is disabled; no external orchestration flow is started.',
    },
    dbhubGovernanceEnabled: {
      flag: 'dbhubGovernanceEnabled',
      integration: 'dbhub-governance',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'DBHub governance hook is disabled; local governance scripts remain authoritative.',
    },
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

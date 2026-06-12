import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfigManager, setConfigValue } from '../../config';
import * as integrations from '../../integrations';

const ENV_KEYS = [
  'INTEGRATION_POSTGRES_ENABLED',
  'INTEGRATION_REDIS_CACHE_ENABLED',
  'INTEGRATION_ELASTICSEARCH_ENABLED',
  'INTEGRATION_NEO4J_ENABLED',
  'INTEGRATION_LANGFLOW_ENABLED',
  'INTEGRATION_DBHUB_GOVERNANCE_ENABLED',
  'NIKO_POSTGRES_ENABLED',
  'NIKO_REDIS_CACHE_ENABLED',
  'NIKO_ELASTICSEARCH_ENABLED',
  'NIKO_NEO4J_ENABLED',
  'NIKO_LANGFLOW_ENABLED',
  'NIKO_DBHUB_GOVERNANCE_ENABLED',
  'NIKO_ENV',
  'NODE_ENV',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreIntegrationEnv(): void {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

describe('integrations adapter additional coverage', () => {
  afterEach(() => {
    restoreIntegrationEnv();
    ConfigManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('uses config fallback for runtime env and parses boolean-like config values', () => {
    restoreIntegrationEnv();
    delete process.env['NIKO_ENV'];
    delete process.env['NODE_ENV'];

    setConfigValue('env', '  Production  ');
    setConfigValue('integration.postgresEnabled', true);
    setConfigValue('integration.redisCacheEnabled', 1);
    setConfigValue('integration.elasticsearchEnabled', 0);
    setConfigValue('integration.neo4jEnabled', ' yes ');
    setConfigValue('integration.langflowEnabled', 'maybe');
    setConfigValue('integration.dbhubGovernanceEnabled', 2);

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.requestedFlags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: false,
      neo4jEnabled: true,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.flags).toEqual({
      postgresEnabled: false,
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
      neo4jEnabled: false,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.capabilities.postgresEnabled).toEqual({
      flag: 'postgresEnabled',
      integration: 'postgres-shadow',
      support_level: 'experimental',
      requested: true,
      enabled: false,
      detail:
        'Postgres shadow-write remains experimental and non-authoritative; local-first persistence must stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.capabilities.redisCacheEnabled).toEqual({
      flag: 'redisCacheEnabled',
      integration: 'redis-cache-rate-limit',
      support_level: 'experimental',
      requested: true,
      enabled: false,
      detail:
        'Redis cache/rate-limit remains experimental and non-authoritative; in-process defaults stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.capabilities.elasticsearchEnabled).toEqual({
      flag: 'elasticsearchEnabled',
      integration: 'elasticsearch-search',
      support_level: 'experimental',
      requested: false,
      enabled: false,
      detail: 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
    });
    expect(adapters.capabilities.neo4jEnabled).toEqual({
      flag: 'neo4jEnabled',
      integration: 'neo4j-projection',
      support_level: 'disabled',
      requested: true,
      enabled: false,
      detail:
        'Neo4j projection is not part of the supported runtime and stays disabled until a durable projection writer exists.',
    });
    expect(adapters.capabilities.langflowEnabled).toEqual({
      flag: 'langflowEnabled',
      integration: 'langflow-orchestration',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'Langflow orchestration is disabled; no external orchestration flow is started.',
    });
    expect(adapters.capabilities.dbhubGovernanceEnabled).toEqual({
      flag: 'dbhubGovernanceEnabled',
      integration: 'dbhub-governance',
      support_level: 'disabled',
      requested: false,
      enabled: false,
      detail: 'DBHub governance hook is disabled; local governance scripts remain authoritative.',
    });
  });

  it('falls back to development when config env is blank and keeps experimental adapters enabled', () => {
    restoreIntegrationEnv();
    delete process.env['NIKO_ENV'];
    delete process.env['NODE_ENV'];

    setConfigValue('env', '   ');
    setConfigValue('integration.postgresEnabled', true);
    setConfigValue('integration.redisCacheEnabled', false);
    setConfigValue('integration.elasticsearchEnabled', false);
    setConfigValue('integration.neo4jEnabled', false);
    setConfigValue('integration.langflowEnabled', false);
    setConfigValue('integration.dbhubGovernanceEnabled', false);

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
      neo4jEnabled: false,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'degraded',
      support_level: 'experimental',
      code: 'POSTGRES_SHADOW_UNSUPPORTED',
      detail:
        'Postgres shadow-write is enabled in configuration but no durable external writer is implemented.',
    });
  });

  it('exposes null and false defaults from direct no-op adapters', async () => {
    const cacheRateLimit = new integrations.NoopCacheRateLimitAdapter();
    const search = new integrations.NoopSearchAdapter();

    await expect(cacheRateLimit.cacheGet('missing')).resolves.toBeNull();
    await expect(cacheRateLimit.cacheSet('cache-key', { cached: true }, 30)).resolves.toBe(false);
    await expect(search.indexDocument({ id: 'doc-noop' })).resolves.toBe(false);
    await expect(search.search('hero', 'all', 5)).resolves.toEqual([]);
  });

  it('returns placeholder responses from direct stub adapters not reachable through the factory', async () => {
    const redis = new integrations.StubRedisCacheRateLimitAdapter();
    const elastic = new integrations.StubElasticsearchAdapter();
    const neo4j = new integrations.StubNeo4jProjectionAdapter();
    const governance = new integrations.StubDbhubGovernanceHook();
    const langflow = new integrations.StubLangflowOrchestrationHook();

    await expect(redis.cacheGet('cache-key')).resolves.toBeNull();
    await expect(redis.cacheSet('cache-key', { ok: true }, 60)).resolves.toBe(false);
    await expect(redis.allowRequest('cache-key', 3, 60)).resolves.toBe(true);

    await expect(elastic.indexDocument({ id: 'doc-stub' })).resolves.toBe(false);
    await expect(elastic.search('query', 'scope', 2)).resolves.toEqual([]);

    await expect(neo4j.projectEntity({ id: 'entity-1' })).resolves.toBe(false);
    await expect(neo4j.projectRelation({ id: 'relation-1' })).resolves.toBe(false);
    expect(neo4j.getStatus()).toEqual({
      integration: 'neo4j-projection',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'NEO4J_PROJECTION_UNSUPPORTED',
      detail:
        'Neo4j projection is enabled in configuration but no durable external projection writer is implemented.',
    });

    await expect(governance.onSchemaWorkflow('publish', { id: 'schema-1' })).resolves.toBe(false);
    expect(governance.getStatus()).toEqual({
      integration: 'dbhub-governance',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'DBHUB_GOVERNANCE_UNSUPPORTED',
      detail:
        'DBHub governance hook is enabled in configuration but no external governance bridge is implemented.',
    });

    await expect(langflow.run('flow-a', { draft: true })).resolves.toEqual({
      status: 'unsupported',
      flow_name: 'flow-a',
      provider: 'langflow',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'LANGFLOW_UNSUPPORTED',
      detail:
        'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.',
    });
    expect(langflow.getStatus()).toEqual({
      integration: 'langflow-orchestration',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'LANGFLOW_UNSUPPORTED',
      detail:
        'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.',
    });
  });
});

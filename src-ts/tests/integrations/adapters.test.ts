import { afterEach, describe, expect, it, vi } from 'vitest';

import * as integrations from '../../integrations';
import { createIntegrationAdapters as directCreateIntegrationAdapters } from '../../integrations/adapters';

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

describe('integrations adapter factory', () => {
  afterEach(() => {
    restoreIntegrationEnv();
    vi.restoreAllMocks();
  });

  it('re-exports the adapter factory and returns local-first no-op adapters by default', async () => {
    restoreIntegrationEnv();

    const adapterFactory = integrations.createIntegrationAdapters;
    const adapters = adapterFactory();

    expect(adapterFactory).toBe(directCreateIntegrationAdapters);
    expect(adapters.flags).toEqual({
      postgresEnabled: false,
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
      neo4jEnabled: false,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.requestedFlags).toEqual({
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
      requested: false,
      enabled: false,
      detail: 'Postgres shadow-write integration is disabled; local-first persistence remains authoritative.',
    });
    expect(adapters.capabilities.redisCacheEnabled).toEqual({
      flag: 'redisCacheEnabled',
      integration: 'redis-cache-rate-limit',
      support_level: 'experimental',
      requested: false,
      enabled: false,
      detail: 'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
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
      requested: false,
      enabled: false,
      detail: 'Neo4j projection is disabled; SQLite graph storage remains authoritative.',
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
    expect(adapters.storageShadow).toBeInstanceOf(integrations.NoopStorageShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.NoopCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.NoopSearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.NoopGraphProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.NoopGovernanceHookAdapter);
    expect(adapters.orchestration).toBeInstanceOf(integrations.NoopOrchestrationHookAdapter);
    await expect(adapters.storageShadow.shadowWriteMemory({ id: 'mem-1' })).resolves.toBe(false);
    await expect(adapters.cacheRateLimit.allowRequest('rate-limit', 10, 60)).resolves.toBe(true);
    await expect(adapters.search.search('hero', 'all', 5)).resolves.toEqual([]);
    await expect(adapters.governance.onSchemaWorkflow('sync', {})).resolves.toBe(false);
    await expect(adapters.orchestration.run('sync', {})).resolves.toEqual({
      status: 'disabled',
      flow_name: 'sync',
      state: 'disabled',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Langflow orchestration is disabled; no external orchestration flow is started.',
    });
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'disabled',
      support_level: 'experimental',
      code: 'INTEGRATION_DISABLED',
      detail: 'Postgres shadow-write integration is disabled; local-first persistence remains authoritative.',
    });
    expect(adapters.cacheRateLimit.getStatus()).toEqual({
      integration: 'redis-cache-rate-limit',
      state: 'disabled',
      support_level: 'experimental',
      code: 'INTEGRATION_DISABLED',
      detail: 'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
    });
    expect(adapters.search.getStatus()).toEqual({
      integration: 'elasticsearch-search',
      state: 'disabled',
      support_level: 'experimental',
      code: 'INTEGRATION_DISABLED',
      detail: 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
    });
    expect(adapters.graphProjection.getStatus()).toEqual({
      integration: 'neo4j-projection',
      state: 'disabled',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Neo4j projection is disabled; SQLite graph storage remains authoritative.',
    });
    expect(adapters.governance.getStatus()).toEqual({
      integration: 'dbhub-governance',
      state: 'disabled',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'DBHub governance hook is disabled; local governance scripts remain authoritative.',
    });
    expect(adapters.orchestration.getStatus()).toEqual({
      integration: 'langflow-orchestration',
      state: 'disabled',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Langflow orchestration is disabled; no external orchestration flow is started.',
    });
  });

  it('keeps experimental adapters available outside production while exposing capability metadata', async () => {
    process.env['INTEGRATION_POSTGRES_ENABLED'] = 'true';
    process.env['INTEGRATION_REDIS_CACHE_ENABLED'] = '1';
    process.env['INTEGRATION_ELASTICSEARCH_ENABLED'] = 'true';
    process.env['INTEGRATION_NEO4J_ENABLED'] = '1';
    process.env['INTEGRATION_LANGFLOW_ENABLED'] = 'true';
    process.env['INTEGRATION_DBHUB_GOVERNANCE_ENABLED'] = 'true';

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.requestedFlags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: true,
      langflowEnabled: true,
      dbhubGovernanceEnabled: true,
    });
    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: false,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.capabilities.postgresEnabled).toEqual({
      flag: 'postgresEnabled',
      integration: 'postgres-shadow',
      support_level: 'experimental',
      requested: true,
      enabled: true,
      detail: 'Postgres shadow-write remains experimental and non-authoritative; local-first persistence must stay authoritative.',
    });
    expect(adapters.capabilities.redisCacheEnabled).toEqual({
      flag: 'redisCacheEnabled',
      integration: 'redis-cache-rate-limit',
      support_level: 'experimental',
      requested: true,
      enabled: true,
      detail: 'Redis cache/rate-limit remains experimental and non-authoritative; in-process defaults stay authoritative.',
    });
    expect(adapters.capabilities.elasticsearchEnabled).toEqual({
      flag: 'elasticsearchEnabled',
      integration: 'elasticsearch-search',
      support_level: 'experimental',
      requested: true,
      enabled: true,
      detail: 'Elasticsearch search remains experimental and must fall back to local retrieval when no durable external index is available.',
    });
    expect(adapters.capabilities.neo4jEnabled).toEqual({
      flag: 'neo4jEnabled',
      integration: 'neo4j-projection',
      support_level: 'disabled',
      requested: true,
      enabled: false,
      detail: 'Neo4j projection is not part of the supported runtime and stays disabled until a durable projection writer exists.',
    });
    expect(adapters.capabilities.langflowEnabled).toEqual({
      flag: 'langflowEnabled',
      integration: 'langflow-orchestration',
      support_level: 'disabled',
      requested: true,
      enabled: false,
      detail: 'Langflow orchestration is not part of the supported runtime and stays disabled until a real remote flow runner exists.',
    });
    expect(adapters.capabilities.dbhubGovernanceEnabled).toEqual({
      flag: 'dbhubGovernanceEnabled',
      integration: 'dbhub-governance',
      support_level: 'disabled',
      requested: true,
      enabled: false,
      detail: 'DBHub governance hooks are not part of the supported runtime and stay disabled until a durable bridge exists.',
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.StubRedisCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.StubElasticsearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.NoopGraphProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.NoopGovernanceHookAdapter);
    expect(adapters.orchestration).toBeInstanceOf(integrations.NoopOrchestrationHookAdapter);
    await expect(adapters.storageShadow.shadowWriteMemory({ id: 'mem-2' })).resolves.toBe(false);
    await expect(adapters.cacheRateLimit.cacheSet('cache-key', { cached: true }, 30)).resolves.toBe(false);
    await expect(adapters.search.indexDocument({ id: 'doc-1' })).resolves.toBe(false);
    await expect(adapters.graphProjection.projectEntity({ id: 'entity-1' })).resolves.toBe(false);
    await expect(adapters.governance.onSchemaWorkflow('sync', {})).resolves.toBe(false);
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'degraded',
      support_level: 'experimental',
      code: 'POSTGRES_SHADOW_UNSUPPORTED',
      detail: 'Postgres shadow-write is enabled in configuration but no durable external writer is implemented.',
    });
    expect(adapters.cacheRateLimit.getStatus()).toEqual({
      integration: 'redis-cache-rate-limit',
      state: 'degraded',
      support_level: 'experimental',
      code: 'REDIS_CACHE_RATE_LIMIT_DEGRADED',
      detail: 'Redis cache/rate-limit is enabled in configuration but no external backend is implemented; in-process defaults remain active.',
    });
    expect(adapters.search.getStatus()).toEqual({
      integration: 'elasticsearch-search',
      state: 'degraded',
      support_level: 'experimental',
      code: 'ELASTICSEARCH_DEGRADED',
      detail: 'Elasticsearch is enabled but no durable external index is available; requests must fall back to local retrieval.',
    });
    expect(adapters.graphProjection.getStatus()).toEqual({
      integration: 'neo4j-projection',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED_BY_POLICY',
      detail: 'Neo4j projection is not part of the supported runtime and stays disabled until a durable projection writer exists.',
    });
    expect(adapters.governance.getStatus()).toEqual({
      integration: 'dbhub-governance',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED_BY_POLICY',
      detail: 'DBHub governance hooks are not part of the supported runtime and stay disabled until a durable bridge exists.',
    });
    await expect(adapters.orchestration.run('shadow-sync', { topic: 'memory' })).resolves.toEqual({
      status: 'unsupported',
      flow_name: 'shadow-sync',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED_BY_POLICY',
      detail: 'Langflow orchestration is not part of the supported runtime and stays disabled until a real remote flow runner exists.',
    });
    expect(adapters.orchestration.getStatus()).toEqual({
      integration: 'langflow-orchestration',
      state: 'unsupported',
      support_level: 'disabled',
      code: 'INTEGRATION_DISABLED_BY_POLICY',
      detail: 'Langflow orchestration is not part of the supported runtime and stays disabled until a real remote flow runner exists.',
    });
  });

  it('disables experimental adapters in production and exposes the policy through capability metadata', async () => {
    process.env['NIKO_ENV'] = 'production';
    process.env['INTEGRATION_POSTGRES_ENABLED'] = 'true';
    process.env['INTEGRATION_REDIS_CACHE_ENABLED'] = 'true';
    process.env['INTEGRATION_ELASTICSEARCH_ENABLED'] = 'true';

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.requestedFlags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: false,
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
      detail: 'Postgres shadow-write remains experimental and non-authoritative; local-first persistence must stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.capabilities.redisCacheEnabled).toEqual({
      flag: 'redisCacheEnabled',
      integration: 'redis-cache-rate-limit',
      support_level: 'experimental',
      requested: true,
      enabled: false,
      detail: 'Redis cache/rate-limit remains experimental and non-authoritative; in-process defaults stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.capabilities.elasticsearchEnabled).toEqual({
      flag: 'elasticsearchEnabled',
      integration: 'elasticsearch-search',
      support_level: 'experimental',
      requested: true,
      enabled: false,
      detail: 'Elasticsearch search remains experimental and must fall back to local retrieval when no durable external index is available. Experimental integrations are disabled in production.',
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.NoopStorageShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.NoopCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.NoopSearchAdapter);
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'degraded',
      support_level: 'experimental',
      code: 'INTEGRATION_EXPERIMENTAL_DISABLED_IN_PRODUCTION',
      detail: 'Postgres shadow-write remains experimental and non-authoritative; local-first persistence must stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.cacheRateLimit.getStatus()).toEqual({
      integration: 'redis-cache-rate-limit',
      state: 'degraded',
      support_level: 'experimental',
      code: 'INTEGRATION_EXPERIMENTAL_DISABLED_IN_PRODUCTION',
      detail: 'Redis cache/rate-limit remains experimental and non-authoritative; in-process defaults stay authoritative. Experimental integrations are disabled in production.',
    });
    expect(adapters.search.getStatus()).toEqual({
      integration: 'elasticsearch-search',
      state: 'degraded',
      support_level: 'experimental',
      code: 'INTEGRATION_EXPERIMENTAL_DISABLED_IN_PRODUCTION',
      detail: 'Elasticsearch search remains experimental and must fall back to local retrieval when no durable external index is available. Experimental integrations are disabled in production.',
    });
  });

  it('also honors migrated NIKO_* integration env names', async () => {
    process.env['NIKO_POSTGRES_ENABLED'] = 'true';
    process.env['NIKO_REDIS_CACHE_ENABLED'] = '1';
    process.env['NIKO_ELASTICSEARCH_ENABLED'] = 'true';
    process.env['NIKO_NEO4J_ENABLED'] = '1';
    process.env['NIKO_LANGFLOW_ENABLED'] = 'true';
    process.env['NIKO_DBHUB_GOVERNANCE_ENABLED'] = 'true';

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.requestedFlags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: true,
      langflowEnabled: true,
      dbhubGovernanceEnabled: true,
    });
    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: false,
      langflowEnabled: false,
      dbhubGovernanceEnabled: false,
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.StubRedisCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.StubElasticsearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.NoopGraphProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.NoopGovernanceHookAdapter);
    expect(adapters.orchestration).toBeInstanceOf(integrations.NoopOrchestrationHookAdapter);
  });
});

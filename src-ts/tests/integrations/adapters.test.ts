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
      code: 'INTEGRATION_DISABLED',
      detail: 'Langflow orchestration is disabled; no external orchestration flow was started.',
    });
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Postgres shadow-write integration is disabled; local-first persistence remains authoritative.',
    });
    expect(adapters.search.getStatus()).toEqual({
      integration: 'elasticsearch-search',
      state: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
    });
    expect(adapters.orchestration.getStatus()).toEqual({
      integration: 'langflow-orchestration',
      state: 'disabled',
      code: 'INTEGRATION_DISABLED',
      detail: 'Langflow orchestration is disabled; no external orchestration flow was started.',
    });
  });

  it('selects stub adapters when integration flags are enabled', async () => {
    process.env['INTEGRATION_POSTGRES_ENABLED'] = 'true';
    process.env['INTEGRATION_REDIS_CACHE_ENABLED'] = '1';
    process.env['INTEGRATION_ELASTICSEARCH_ENABLED'] = 'true';
    process.env['INTEGRATION_NEO4J_ENABLED'] = '1';
    process.env['INTEGRATION_LANGFLOW_ENABLED'] = 'true';
    process.env['INTEGRATION_DBHUB_GOVERNANCE_ENABLED'] = 'true';

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: true,
      langflowEnabled: true,
      dbhubGovernanceEnabled: true,
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.StubRedisCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.StubElasticsearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.StubNeo4jProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.StubDbhubGovernanceHook);
    expect(adapters.orchestration).toBeInstanceOf(integrations.StubLangflowOrchestrationHook);
    await expect(adapters.storageShadow.shadowWriteMemory({ id: 'mem-2' })).resolves.toBe(false);
    await expect(adapters.cacheRateLimit.cacheSet('cache-key', { cached: true }, 30)).resolves.toBe(true);
    await expect(adapters.search.indexDocument({ id: 'doc-1' })).resolves.toBe(false);
    await expect(adapters.graphProjection.projectEntity({ id: 'entity-1' })).resolves.toBe(true);
    expect(adapters.storageShadow.getStatus()).toEqual({
      integration: 'postgres-shadow',
      state: 'unsupported',
      code: 'POSTGRES_SHADOW_UNSUPPORTED',
      detail: 'Postgres shadow-write is enabled in configuration but no durable external writer is implemented.',
    });
    expect(adapters.search.getStatus()).toEqual({
      integration: 'elasticsearch-search',
      state: 'degraded',
      code: 'ELASTICSEARCH_DEGRADED',
      detail: 'Elasticsearch is enabled but no durable external index is available; requests must fall back to local retrieval.',
    });
    await expect(adapters.orchestration.run('shadow-sync', { topic: 'memory' })).resolves.toEqual({
      status: 'unsupported',
      flow_name: 'shadow-sync',
      provider: 'langflow',
      state: 'unsupported',
      code: 'LANGFLOW_UNSUPPORTED',
      detail: 'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.',
    });
    expect(adapters.orchestration.getStatus()).toEqual({
      integration: 'langflow-orchestration',
      state: 'unsupported',
      code: 'LANGFLOW_UNSUPPORTED',
      detail: 'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.',
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

    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: true,
      langflowEnabled: true,
      dbhubGovernanceEnabled: true,
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.StubRedisCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.StubElasticsearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.StubNeo4jProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.StubDbhubGovernanceHook);
    expect(adapters.orchestration).toBeInstanceOf(integrations.StubLangflowOrchestrationHook);
  });
});

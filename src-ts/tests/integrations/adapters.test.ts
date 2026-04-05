import { afterEach, describe, expect, it, vi } from 'vitest';

import * as integrations from '../../integrations';
import { createIntegrationAdapters as directCreateIntegrationAdapters } from '../../integrations/adapters';

const ENV_KEYS = [
  'INTEGRATION_POSTGRES_ENABLED',
  'INTEGRATION_REDIS_CACHE_ENABLED',
  'INTEGRATION_ELASTICSEARCH_ENABLED',
  'INTEGRATION_NEO4J_ENABLED',
  'INTEGRATION_LANGFLOW_ENABLED',
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
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.NoopStorageShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.NoopCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.NoopSearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.NoopGraphProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.StubDbhubGovernanceHook);
    expect(adapters.orchestration).toBeInstanceOf(integrations.NoopOrchestrationHookAdapter);
    await expect(adapters.storageShadow.shadowWriteMemory({ id: 'mem-1' })).resolves.toBe(false);
    await expect(adapters.cacheRateLimit.allowRequest('rate-limit', 10, 60)).resolves.toBe(true);
    await expect(adapters.search.search('hero', 'all', 5)).resolves.toEqual([]);
    await expect(adapters.orchestration.run('sync', {})).resolves.toEqual({
      status: 'disabled',
      flow_name: 'sync',
    });
  });

  it('selects stub adapters when integration flags are enabled', async () => {
    process.env['INTEGRATION_POSTGRES_ENABLED'] = 'true';
    process.env['INTEGRATION_REDIS_CACHE_ENABLED'] = '1';
    process.env['INTEGRATION_ELASTICSEARCH_ENABLED'] = 'true';
    process.env['INTEGRATION_NEO4J_ENABLED'] = '1';
    process.env['INTEGRATION_LANGFLOW_ENABLED'] = 'true';

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.flags).toEqual({
      postgresEnabled: true,
      redisCacheEnabled: true,
      elasticsearchEnabled: true,
      neo4jEnabled: true,
      langflowEnabled: true,
    });
    expect(adapters.storageShadow).toBeInstanceOf(integrations.StubPostgresShadowAdapter);
    expect(adapters.cacheRateLimit).toBeInstanceOf(integrations.StubRedisCacheRateLimitAdapter);
    expect(adapters.search).toBeInstanceOf(integrations.StubElasticsearchAdapter);
    expect(adapters.graphProjection).toBeInstanceOf(integrations.StubNeo4jProjectionAdapter);
    expect(adapters.governance).toBeInstanceOf(integrations.StubDbhubGovernanceHook);
    expect(adapters.orchestration).toBeInstanceOf(integrations.StubLangflowOrchestrationHook);
    await expect(adapters.storageShadow.shadowWriteMemory({ id: 'mem-2' })).resolves.toBe(true);
    await expect(adapters.cacheRateLimit.cacheSet('cache-key', { cached: true }, 30)).resolves.toBe(true);
    await expect(adapters.search.indexDocument({ id: 'doc-1' })).resolves.toBe(true);
    await expect(adapters.graphProjection.projectEntity({ id: 'entity-1' })).resolves.toBe(true);
    await expect(adapters.orchestration.run('shadow-sync', { topic: 'memory' })).resolves.toEqual({
      status: 'ok',
      flow_name: 'shadow-sync',
      provider: 'langflow',
    });
  });
});

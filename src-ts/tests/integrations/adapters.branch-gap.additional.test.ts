import { afterEach, describe, expect, it } from 'vitest';

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

describe('integrations adapter branch-gap coverage', () => {
  afterEach(() => {
    restoreIntegrationEnv();
    ConfigManager.resetInstance();
  });

  it('parses false-like string flags from config fallback', () => {
    restoreIntegrationEnv();
    delete process.env['NIKO_ENV'];
    delete process.env['NODE_ENV'];

    setConfigValue('env', 'development');
    setConfigValue('integration.postgresEnabled', 'off');
    setConfigValue('integration.redisCacheEnabled', 'no');
    setConfigValue('integration.elasticsearchEnabled', 'false');
    setConfigValue('integration.neo4jEnabled', '0');
    setConfigValue('integration.langflowEnabled', 'off');
    setConfigValue('integration.dbhubGovernanceEnabled', 'no');

    const adapters = integrations.createIntegrationAdapters();

    expect(adapters.requestedFlags).toEqual({
      postgresEnabled: false,
      redisCacheEnabled: false,
      elasticsearchEnabled: false,
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
  });
});

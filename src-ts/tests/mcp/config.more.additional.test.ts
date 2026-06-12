import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NIKO_ENV',
  'NIKO_GATEWAY_RELOAD',
  'NIKO_GATEWAY_HOST',
  'NIKO_GATEWAY_PORT',
  'NIKO_GATEWAY_LOCALHOST_ONLY',
  'NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS',
  'NIKO_SEARCH_ELASTIC_TIMEOUT_MS',
  'NIKO_DBHUB_GOVERNANCE_ENABLED',
  'NIKO_REDIS_CACHE_TTL_SECONDS',
  'NIKO_CORS_DEV_ORIGINS',
  'NIKO_CORS_PROD_ORIGINS',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

describe('mcp/config more additional coverage', () => {
  afterEach(async () => {
    restoreEnv();
    vi.resetModules();
    const { ConfigManager } = await import('../../config/index.js');
    ConfigManager.resetInstance();
  });

  it('covers boolean and number fallback coercion branches', async () => {
    const { setConfigValue } = await import('../../config/index.js');
    setConfigValue('gateway.localhostOnly', 7 as unknown as boolean);
    setConfigValue('gateway.port', null as unknown as number);
    setConfigValue('gateway.reload', 'maybe');

    const { getConfigValue } = await import('../../mcp/config.js');

    expect(getConfigValue('gateway.localhost_only', true)).toBe(true);
    expect(getConfigValue('gateway.port', 8000)).toBe(8000);
    expect(getConfigValue('gateway.reload', false)).toBe(false);
  });

  it('uses config fallbacks for reload, host-port, localhost-only, elastic timeout, governance, and ttl', async () => {
    const { setConfigValue } = await import('../../config/index.js');
    setConfigValue('env', 'development');
    setConfigValue('gateway.reload', false);
    setConfigValue('gateway.host', 'config-host');
    setConfigValue('gateway.port', 'bad-port');
    setConfigValue('gateway.localhostOnly', 'yes');
    setConfigValue('integration.searchElasticTimeoutMs', 'NaN');
    setConfigValue('integration.dbhubGovernanceEnabled', false);
    setConfigValue('integration.redisCacheTtlSeconds', 1);

    const {
      resolveReloadEnabled,
      resolveGatewayHostPort,
      resolveLocalhostOnlyEnabled,
      resolveSearchElasticTimeoutMs,
      resolveGovernanceHookEnabled,
      resolveRedisCacheTtlSeconds,
    } = await import('../../mcp/config.js');

    expect(resolveReloadEnabled()).toBe(false);
    expect(resolveGatewayHostPort()).toEqual({ host: 'config-host', port: 8000 });
    expect(resolveLocalhostOnlyEnabled()).toBe(true);
    expect(resolveSearchElasticTimeoutMs()).toBe(300);
    expect(resolveGovernanceHookEnabled()).toBe(false);
    expect(resolveRedisCacheTtlSeconds()).toBe(1);
  });

  it('falls back to default cors origins when env and config are empty', async () => {
    const { setConfigValue } = await import('../../config/index.js');
    setConfigValue('gateway.corsDevOrigins', []);
    setConfigValue('gateway.corsProdOrigins', []);

    const { resolveCorsOrigins } = await import('../../mcp/config.js');
    expect(resolveCorsOrigins()).toEqual(['*']);

    process.env.NIKO_ENV = 'production';
    vi.resetModules();

    const configModule = await import('../../config/index.js');
    configModule.setConfigValue('gateway.corsProdOrigins', []);
    const { resolveCorsOrigins: resolveProdCorsOrigins } = await import('../../mcp/config.js');
    expect(resolveProdCorsOrigins()).toEqual([
      'tauri://localhost',
      'https://tauri.localhost',
    ]);
  });
});

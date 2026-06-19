import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NIKO_ENV',
  'NIKO_GATEWAY_RELOAD',
  'NIKO_GATEWAY_HOST',
  'NIKO_GATEWAY_PORT',
  'NIKO_GATEWAY_LOCALHOST_ONLY',
  'NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS',
  'NIKO_SEARCH_ROUTE_MODE',
  'NIKO_SEARCH_ELASTIC_TIMEOUT_MS',
  'NIKO_REDIS_RATE_LIMIT',
  'NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS',
  'NIKO_LANGFLOW_FLOW_NAME',
  'NIKO_DBHUB_GOVERNANCE_ENABLED',
  'NIKO_REDIS_CACHE_TTL_SECONDS',
  'NIKO_UI_BRIDGE_ENABLED',
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

describe('mcp/config additional resolvers', () => {
  afterEach(async () => {
    restoreEnv();
    vi.resetModules();
    const { ConfigManager } = await import('../../config/index.js');
    ConfigManager.resetInstance();
  });

  it('coerces legacy config values across boolean, number, string, and object fallbacks', async () => {
    const { setConfigValue, ConfigManager } = await import('../../config/index.js');
    setConfigValue('gateway.localhostOnly', 'off');
    setConfigValue('gateway.port', '9123');
    setConfigValue('gateway.host', 101 as unknown as string);
    setConfigValue('integration.redisRateLimit', '27');
    setConfigValue('gateway.corsDevOrigins', ['live']);

    const { getConfigValue, isTruthyString } = await import('../../mcp/config.js');

    expect(getConfigValue('gateway.localhost_only', true)).toBe(false);
    expect(getConfigValue('gateway.port', 8000)).toBe(9123);
    expect(getConfigValue('gateway.host', 'fallback-host')).toBe('101');
    expect(getConfigValue('integration.redis_rate_limit', 1)).toBe(27);
    expect(getConfigValue('missing.path', ['fallback'])).toEqual(['fallback']);
    expect(getConfigValue('gateway.cors_dev_origins', ['fallback'])).toEqual(['live']);

    setConfigValue('gateway.host', null as never);
    expect(getConfigValue('gateway.host', 'fallback-host')).toBe('fallback-host');

    setConfigValue('gateway.corsDevOrigins', null as never);
    expect(getConfigValue('gateway.cors_dev_origins', ['fallback'])).toEqual(['fallback']);

    setConfigValue('gateway.localhostOnly', 1 as never);
    expect(getConfigValue('gateway.localhost_only', false)).toBe(true);

    setConfigValue('gateway.localhostOnly', 0 as never);
    expect(getConfigValue('gateway.localhost_only', true)).toBe(false);

    setConfigValue('gateway.localhostOnly', 2 as never);
    expect(getConfigValue('gateway.localhost_only', true)).toBe(true);

    setConfigValue('gateway.port', Number.NaN);
    expect(getConfigValue('gateway.port', 8000)).toBe(8000);

    setConfigValue('gateway.host', 'hero-host');
    expect(getConfigValue('gateway.host', 'fallback-host')).toBe('hero-host');
    expect(getConfigValue('missing.string', 'fallback-host')).toBe('fallback-host');
    expect(isTruthyString(undefined)).toBe(false);
    expect(isTruthyString(' YES ')).toBe(true);

    ConfigManager.resetInstance();
  });

  it('forces reload off in production and normalizes gateway host/port and localhost flag', async () => {
    process.env.NIKO_ENV = 'production';
    process.env.NIKO_GATEWAY_RELOAD = 'true';
    process.env.NIKO_GATEWAY_HOST = '   ';
    process.env.NIKO_GATEWAY_PORT = 'not-a-port';
    process.env.NIKO_GATEWAY_LOCALHOST_ONLY = '0';

    const {
      isProductionEnv,
      resolveReloadEnabled,
      resolveGatewayHostPort,
      resolveLocalhostOnlyEnabled,
    } = await import('../../mcp/config.js');

    expect(isProductionEnv()).toBe(true);
    expect(resolveReloadEnabled()).toBe(false);
    expect(resolveGatewayHostPort()).toEqual({
      host: '0.0.0.0',
      port: 8000,
    });
    expect(resolveLocalhostOnlyEnabled()).toBe(false);

    process.env.NIKO_ENV = 'development';
    process.env.NIKO_GATEWAY_RELOAD = 'off';
    expect(resolveReloadEnabled()).toBe(false);
  });

  it('falls back to truthy-string coercion when localhost-only config is stored as a string', async () => {
    delete process.env.NIKO_GATEWAY_LOCALHOST_ONLY;
    const { setConfigValue, ConfigManager } = await import('../../config/index.js');
    setConfigValue('gateway.localhostOnly', 'yes');

    const { resolveLocalhostOnlyEnabled } = await import('../../mcp/config.js');
    expect(resolveLocalhostOnlyEnabled()).toBe(true);

    ConfigManager.resetInstance();
  });

  it('normalizes exempt paths and validates route modes from env and config', async () => {
    process.env.NIKO_ENV = 'development';
    process.env.NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS = 'health, /metrics/,  ,api/v1/';
    process.env.NIKO_SEARCH_ROUTE_MODE = '  unsupported  ';

    const {
      resolveLocalhostOnlyExemptPaths,
      resolveSearchRouteMode,
    } = await import('../../mcp/config.js');

    expect(resolveLocalhostOnlyExemptPaths()).toEqual([
      '/health',
      '/metrics',
      '/api/v1',
    ]);
    expect(resolveSearchRouteMode()).toBe('legacy');

    const { ConfigManager, setConfigValue } = await import('../../config/index.js');
    delete process.env.NIKO_SEARCH_ROUTE_MODE;
    setConfigValue('integration.searchRouteMode', ' HYBRID ');
    vi.resetModules();

    const configModule = await import('../../config/index.js');
    const {
      resolveLocalhostOnlyExemptPaths: resolveLocalhostOnlyExemptPathsAgain,
      resolveSearchRouteMode: resolveSearchRouteModeAgain,
    } = await import('../../mcp/config.js');

    delete process.env.NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS;
    configModule.setConfigValue('integration.searchRouteMode', ' HYBRID ');
    configModule.setConfigValue('gateway.localhostOnlyExemptPaths', ['status/', '/internal', '']);

    expect(resolveLocalhostOnlyExemptPathsAgain()).toEqual([
      '/status',
      '/internal',
    ]);
    expect(resolveSearchRouteModeAgain()).toBe('hybrid');

    ConfigManager.resetInstance();
  });

  it('applies numeric lower bounds and resolves misc gateway helpers', async () => {
    process.env.NIKO_SEARCH_ELASTIC_TIMEOUT_MS = '20';
    process.env.NIKO_REDIS_RATE_LIMIT = '0';
    process.env.NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS = '-1';
    process.env.NIKO_LANGFLOW_FLOW_NAME = '   ';
    process.env.NIKO_DBHUB_GOVERNANCE_ENABLED = 'on';
    process.env.NIKO_REDIS_CACHE_TTL_SECONDS = 'NaN';
    process.env.NIKO_UI_BRIDGE_ENABLED = 'yes';

    const {
      resolveSearchElasticTimeoutMs,
      resolveRedisRateLimit,
      resolveLangflowFlowName,
      resolveGovernanceHookEnabled,
      resolveRedisCacheTtlSeconds,
      resolveSearchCacheKey,
      resolveUiBridgeEnabled,
      uiBridgeDisabledResponse,
    } = await import('../../mcp/config.js');

    expect(resolveSearchElasticTimeoutMs()).toBe(50);
    expect(resolveRedisRateLimit()).toEqual({
      limit: 1,
      windowSeconds: 1,
    });
    expect(resolveLangflowFlowName()).toBe('niko-search-pilot');
    expect(resolveGovernanceHookEnabled()).toBe(true);
    expect(resolveRedisCacheTtlSeconds()).toBe(120);
    expect(resolveSearchCacheKey('  Hello World  ', 'wiki', 3, null)).toBe(
      'search:wiki:3:default:hello world',
    );
    expect(resolveUiBridgeEnabled()).toBe(true);
    expect(uiBridgeDisabledResponse()).toEqual({
      statusCode: 404,
      body: {
        status: 'disabled',
        reason: 'ui_bridge_disabled',
        hint: 'Set NIKO_UI_BRIDGE_ENABLED=1 or gateway.ui_bridge_enabled=true',
      },
    });

    process.env.NIKO_SEARCH_ELASTIC_TIMEOUT_MS = 'NaN';
    process.env.NIKO_REDIS_RATE_LIMIT = 'NaN';
    process.env.NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS = 'NaN';

    expect(resolveSearchElasticTimeoutMs()).toBe(300);
    expect(resolveRedisRateLimit()).toEqual({
      limit: 120,
      windowSeconds: 60,
    });
  });

  it('parses origins and applies development and production cors rules', async () => {
    process.env.NIKO_ENV = 'development';
    process.env.NIKO_CORS_DEV_ORIGINS = 'http://a.local, http://b.local';

    const {
      parseOrigins,
      resolveCorsOrigins,
    } = await import('../../mcp/config.js');

    expect(parseOrigins('https://a.local, https://b.local')).toEqual([
      'https://a.local',
      'https://b.local',
    ]);
    expect(parseOrigins([' https://x.local ', '', 7])).toEqual([
      'https://x.local',
      '7',
    ]);
    expect(parseOrigins(null)).toEqual([]);
    expect(resolveCorsOrigins()).toEqual([
      'http://a.local',
      'http://b.local',
    ]);

    process.env.NIKO_ENV = 'production';
    process.env.NIKO_CORS_PROD_ORIGINS = '*,http://localhost:3000,https://safe.example.com';
    vi.resetModules();

    const { resolveCorsOrigins: resolveCorsOriginsProd } = await import('../../mcp/config.js');
    expect(resolveCorsOriginsProd()).toEqual(['https://safe.example.com']);

    process.env.NIKO_CORS_PROD_ORIGINS = '*,http://127.0.0.1:3000';
    vi.resetModules();

    const { resolveCorsOrigins: resolveCorsOriginsFallback } = await import('../../mcp/config.js');
    expect(resolveCorsOriginsFallback()).toEqual([
      'tauri://localhost',
      'https://tauri.localhost',
    ]);
  });
});

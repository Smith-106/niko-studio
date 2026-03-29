/**
 * MCP Gateway Configuration Resolvers
 *
 * Stateless configuration resolution functions for the MCP gateway.
 * All functions are pure and have no runtime dependencies.
 *
 * Migrated from src/mcp/config.py
 */

// ============================================================
// Internal: Config Value Placeholder
// ============================================================

const CONFIG_DEFAULTS: Record<string, unknown> = {
  'env': 'development',
  'gateway.host': '0.0.0.0',
  'gateway.port': 8000,
  'gateway.reload': true,
  'gateway.localhost_only': true,
  'gateway.localhost_only_exempt_paths': [],
  'gateway.ui_bridge_enabled': false,
  'gateway.detection_evasion_guard': true,
  'gateway.cors_prod_origins': [],
  'gateway.cors_dev_origins': ['*'],
  'integration.search_route_mode': 'legacy',
  'integration.search_elastic_timeout_ms': 300,
  'integration.redis_rate_limit': 120,
  'integration.redis_rate_limit_window_seconds': 60,
  'integration.langflow_flow_name': 'niko-search-pilot',
  'integration.dbhub_governance_enabled': false,
  'integration.redis_cache_ttl_seconds': 120,
};

/**
 * Read a config value from environment or config defaults.
 * Placeholder for Python's get_config_value().
 */
export function getConfigValue<T>(key: string, fallback: T): T {
  const envKey = key.toUpperCase().replace(/\./g, '_');
  const envVal = process.env[`NIKO_${envKey}`];
  if (envVal !== undefined) {
    if (typeof fallback === 'boolean') {
      return (envVal.trim().toLowerCase() in TRUTHY_STRINGS) as unknown as T;
    }
    if (typeof fallback === 'number') {
      const parsed = Number(envVal);
      return (Number.isNaN(parsed) ? fallback : parsed) as unknown as T;
    }
    return envVal as unknown as T;
  }
  return (CONFIG_DEFAULTS[key] ?? fallback) as T;
}

/** Stub for Python's get_services(). */
interface ServicesStub {
  isHealthy?: () => boolean | Record<string, unknown>;
}
function getServices(): ServicesStub {
  return {};
}

// ============================================================
// Helpers
// ============================================================

const TRUTHY_STRINGS = new Set(['true', '1', 'yes', 'on']);

export function isTruthyString(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return TRUTHY_STRINGS.has(raw.trim().toLowerCase());
}

// ============================================================
// Public Configuration Resolvers
// ============================================================

/**
 * Check if running in production environment.
 */
export function isProductionEnv(): boolean {
  const env = String(
    process.env.NIKO_ENV ?? getConfigValue('env', 'development')
  ).toLowerCase();
  return env === 'prod' || env === 'production';
}

/**
 * Resolve whether hot reload is enabled for development.
 */
export function resolveReloadEnabled(): boolean {
  if (isProductionEnv()) return false;
  const raw = process.env.NIKO_GATEWAY_RELOAD;
  if (raw !== undefined) return isTruthyString(raw);
  return Boolean(getConfigValue('gateway.reload', true));
}

/**
 * Resolve gateway host and port from environment or config.
 */
export function resolveGatewayHostPort(): { host: string; port: number } {
  let host = process.env.NIKO_GATEWAY_HOST;
  if (host === undefined) {
    host = String(getConfigValue('gateway.host', '0.0.0.0'));
  }
  host = host.trim() || '0.0.0.0';

  let rawPort = process.env.NIKO_GATEWAY_PORT;
  if (rawPort === undefined) {
    rawPort = String(getConfigValue('gateway.port', 8000));
  }

  const port = parseInt(String(rawPort).trim(), 10);
  return { host, port: Number.isNaN(port) ? 8000 : port };
}

/**
 * Check if LLM service is available.
 */
export function isLlmAvailable(): boolean {
  try {
    const services = getServices();
    const checker = services.isHealthy;
    if (typeof checker === 'function') {
      const result = checker();
      if (typeof result === 'boolean') return result;
      if (typeof result === 'object' && result !== null) {
        const status = String((result as Record<string, unknown>).status ?? '').trim().toLowerCase();
        return status === 'ok' || status === 'healthy' || status === 'pass';
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve whether gateway endpoints are restricted to localhost callers.
 */
export function resolveLocalhostOnlyEnabled(): boolean {
  const raw = process.env.NIKO_GATEWAY_LOCALHOST_ONLY;
  if (raw !== undefined) return isTruthyString(raw);

  const rawConfig = getConfigValue('gateway.localhost_only', true);
  if (typeof rawConfig === 'boolean') return rawConfig;
  return isTruthyString(String(rawConfig));
}

/**
 * Resolve paths that bypass localhost-only guard.
 */
export function resolveLocalhostOnlyExemptPaths(): string[] {
  let raw: unknown = process.env.NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS;
  if (raw === undefined) {
    raw = getConfigValue<unknown[]>('gateway.localhost_only_exempt_paths', []);
  }

  let paths: string[] = [];
  if (typeof raw === 'string') {
    paths = raw.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw)) {
    paths = raw.map((item) => String(item).trim()).filter(Boolean);
  }

  return paths.map((path) => {
    let normalized = path;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  });
}

/**
 * Resolve search routing mode.
 */
export function resolveSearchRouteMode(): string {
  let raw: string | undefined = process.env.NIKO_SEARCH_ROUTE_MODE;
  if (raw === undefined) {
    raw = String(getConfigValue('integration.search_route_mode', 'legacy'));
  }
  const mode = raw !== undefined ? raw.trim().toLowerCase() : 'legacy';
  if (mode !== 'legacy' && mode !== 'elastic' && mode !== 'hybrid') return 'legacy';
  return mode;
}

/**
 * Resolve Elasticsearch timeout in milliseconds.
 */
export function resolveSearchElasticTimeoutMs(): number {
  let raw: string | number | undefined = process.env.NIKO_SEARCH_ELASTIC_TIMEOUT_MS;
  if (raw === undefined) {
    raw = Number(getConfigValue('integration.search_elastic_timeout_ms', 300));
  }
  const timeout = parseInt(String(raw), 10);
  return Math.max(Number.isNaN(timeout) ? 300 : timeout, 50);
}

/**
 * Resolve Redis rate limit (limit, window_seconds).
 */
export function resolveRedisRateLimit(): { limit: number; windowSeconds: number } {
  let rawLimit: string | number | undefined = process.env.NIKO_REDIS_RATE_LIMIT;
  let rawWindow: string | number | undefined = process.env.NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS;

  if (rawLimit === undefined) rawLimit = Number(getConfigValue('integration.redis_rate_limit', 120));
  if (rawWindow === undefined) rawWindow = Number(getConfigValue('integration.redis_rate_limit_window_seconds', 60));

  const limit = parseInt(String(rawLimit), 10);
  const windowSeconds = parseInt(String(rawWindow), 10);

  return {
    limit: Math.max(Number.isNaN(limit) ? 120 : limit, 1),
    windowSeconds: Math.max(Number.isNaN(windowSeconds) ? 60 : windowSeconds, 1),
  };
}

/**
 * Resolve Langflow flow name for orchestration hooks.
 */
export function resolveLangflowFlowName(): string {
  let raw = process.env.NIKO_LANGFLOW_FLOW_NAME;
  if (raw === undefined) {
    raw = String(getConfigValue('integration.langflow_flow_name', 'niko-search-pilot'));
  }
  const flowName = raw !== undefined ? raw.trim() : 'niko-search-pilot';
  return flowName || 'niko-search-pilot';
}

/**
 * Check if DBHub governance hook is enabled.
 */
export function resolveGovernanceHookEnabled(): boolean {
  const raw = process.env.NIKO_DBHUB_GOVERNANCE_ENABLED;
  if (raw !== undefined) return isTruthyString(raw);
  return Boolean(getConfigValue('integration.dbhub_governance_enabled', false));
}

/**
 * Resolve Redis cache TTL in seconds.
 */
export function resolveRedisCacheTtlSeconds(): number {
  let raw: string | number | undefined = process.env.NIKO_REDIS_CACHE_TTL_SECONDS;
  if (raw === undefined) raw = Number(getConfigValue('integration.redis_cache_ttl_seconds', 120));
  const ttl = parseInt(String(raw), 10);
  return Math.max(Number.isNaN(ttl) ? 120 : ttl, 1);
}

/**
 * Generate cache key for search results.
 */
export function resolveSearchCacheKey(
  query: string,
  scope: string,
  limit: number,
  profile: string | null,
): string {
  const profilePart = profile ?? 'default';
  return `search:${scope}:${limit}:${profilePart}:${query.trim().toLowerCase()}`;
}

/**
 * Check if UI bridge endpoints are enabled.
 */
export function resolveUiBridgeEnabled(): boolean {
  const raw = process.env.NIKO_UI_BRIDGE_ENABLED;
  if (raw !== undefined) return isTruthyString(raw);
  return Boolean(getConfigValue('gateway.ui_bridge_enabled', false));
}

/**
 * Return standard response when UI bridge is disabled.
 */
export function uiBridgeDisabledResponse(): { statusCode: number; body: Record<string, unknown> } {
  return {
    statusCode: 404,
    body: {
      status: 'disabled',
      reason: 'ui_bridge_disabled',
      hint: 'Set NIKO_UI_BRIDGE_ENABLED=1 or gateway.ui_bridge_enabled=true',
    },
  };
}

/**
 * Parse CORS origins from string or array.
 */
export function parseOrigins(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  return [];
}

/**
 * Resolve CORS origins based on environment.
 */
export function resolveCorsOrigins(): string[] {
  let origins: string[];

  if (isProductionEnv()) {
    const raw = process.env.NIKO_CORS_PROD_ORIGINS;
    origins = raw !== undefined
      ? parseOrigins(raw)
      : parseOrigins(getConfigValue('gateway.cors_prod_origins', []));
  } else {
    const raw = process.env.NIKO_CORS_DEV_ORIGINS;
    origins = raw !== undefined
      ? parseOrigins(raw)
      : parseOrigins(getConfigValue('gateway.cors_dev_origins', ['*']));
  }

  if (origins.length === 0) {
    origins = isProductionEnv() ? [] : ['*'];
  }

  if (isProductionEnv()) {
    const forbidden = new Set(['*', 'http://localhost:3000', 'http://127.0.0.1:3000']);
    origins = origins.filter((o) => !forbidden.has(o));
    if (origins.length === 0) {
      throw new Error(
        'Production CORS origins are empty. Set NIKO_CORS_PROD_ORIGINS or gateway.cors_prod_origins.',
      );
    }
  }

  return origins;
}

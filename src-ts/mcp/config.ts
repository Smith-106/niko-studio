/**
 * MCP Gateway Configuration Resolvers
 *
 * Configuration resolution utilities for the MCP gateway.
 * Pure config resolvers stay side-effect free; runtime probes are injected explicitly.
 *
 * Migrated from src/mcp/config.py
 */

import { getConfigValue as getAppConfigValue } from '../config';

// ============================================================
// Config Value Resolver
// ============================================================

/**
 * Read a config value from the shared config layer while preserving legacy
 * snake_case key access used by the MCP migration surface.
 */
export function getConfigValue<T>(key: string, fallback: T): T {
  return coerceConfigValue(getAppConfigValue(mapLegacyConfigKey(key), fallback), fallback);
}

// ============================================================
// Helpers
// ============================================================

const TRUTHY_STRINGS = new Set(['true', '1', 'yes', 'on']);
const FALSY_STRINGS = new Set(['false', '0', 'no', 'off']);

export function isTruthyString(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return TRUTHY_STRINGS.has(raw.trim().toLowerCase());
}

function coerceConfigValue<T>(rawValue: unknown, fallback: T): T {
  if (typeof fallback === 'boolean') {
    return parseBooleanValue(rawValue, fallback) as T;
  }

  if (typeof fallback === 'number') {
    return parseNumberValue(rawValue, fallback) as T;
  }

  if (typeof fallback === 'string') {
    return (typeof rawValue === 'string' ? rawValue : String(rawValue ?? fallback)) as T;
  }

  return (rawValue ?? fallback) as T;
}

function parseBooleanValue(rawValue: unknown, fallback: boolean): boolean {
  if (typeof rawValue === 'boolean') return rawValue;

  if (typeof rawValue === 'number') {
    if (rawValue === 1) return true;
    if (rawValue === 0) return false;
    return fallback;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (TRUTHY_STRINGS.has(normalized)) return true;
    if (FALSY_STRINGS.has(normalized)) return false;
  }

  return fallback;
}

function parseNumberValue(rawValue: unknown, fallback: number): number {
  if (typeof rawValue === 'number') {
    return Number.isNaN(rawValue) ? fallback : rawValue;
  }

  if (typeof rawValue === 'string') {
    const parsed = Number(rawValue);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return fallback;
}

const LEGACY_CONFIG_KEY_MAP: Record<string, string> = {
  'gateway.localhost_only': 'gateway.localhostOnly',
  'gateway.localhost_only_exempt_paths': 'gateway.localhostOnlyExemptPaths',
  'gateway.ui_bridge_enabled': 'gateway.uiBridgeEnabled',
  'gateway.detection_evasion_guard': 'gateway.detectionEvasionGuard',
  'gateway.cors_prod_origins': 'gateway.corsProdOrigins',
  'gateway.cors_dev_origins': 'gateway.corsDevOrigins',
  'integration.search_route_mode': 'integration.searchRouteMode',
  'integration.search_elastic_timeout_ms': 'integration.searchElasticTimeoutMs',
  'integration.redis_rate_limit': 'integration.redisRateLimit',
  'integration.redis_rate_limit_window_seconds': 'integration.redisRateLimitWindowSeconds',
  'integration.langflow_flow_name': 'integration.langflowFlowName',
  'integration.dbhub_governance_enabled': 'integration.dbhubGovernanceEnabled',
  'integration.redis_cache_ttl_seconds': 'integration.redisCacheTtlSeconds',
};

type LlmAvailabilityProbe = () => boolean;

let llmAvailabilityProbe: LlmAvailabilityProbe | null = null;

export function setLlmAvailabilityProbe(probe: LlmAvailabilityProbe | null): void {
  llmAvailabilityProbe = probe;
}

function mapLegacyConfigKey(key: string): string {
  return LEGACY_CONFIG_KEY_MAP[key] ?? key;
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
const DEFAULT_GATEWAY_PORT = 8000;

export function resolveGatewayHostPort(): { host: string; port: number } {
  let host = process.env.NIKO_GATEWAY_HOST;
  if (host === undefined) {
    host = String(getConfigValue('gateway.host', '0.0.0.0'));
  }
  host = host.trim() || '0.0.0.0';

  let rawPort = process.env.NIKO_GATEWAY_PORT;
  if (rawPort === undefined) {
    rawPort = String(getConfigValue('gateway.port', DEFAULT_GATEWAY_PORT));
  }

  const port = parseInt(String(rawPort).trim(), 10);
  return { host, port: Number.isNaN(port) ? DEFAULT_GATEWAY_PORT : port };
}

/**
 * Check if LLM service is available.
 * Returns true when an injected runtime probe resolves an available LLM service.
 */
export function isLlmAvailable(): boolean {
  if (!llmAvailabilityProbe) {
    return false;
  }

  try {
    return Boolean(llmAvailabilityProbe());
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

  return getConfigValue('gateway.localhost_only', true);
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
  const mode = raw.trim().toLowerCase();
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
  const flowName = raw.trim();
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
    // In Tauri packaged mode, the frontend communicates via IPC (not CORS),
    // so empty origins is acceptable. Add tauri://localhost as a safe default.
    if (origins.length === 0) {
      origins = ['tauri://localhost', 'https://tauri.localhost'];
    }
  }

  return origins;
}

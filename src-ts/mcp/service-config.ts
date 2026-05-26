/**
 * MCP Gateway Service Configuration
 *
 * Service configuration registry and management functions for MCP services.
 *
 * Migrated from src/mcp/service_config.py
 */

// ============================================================
// McpServiceConfig Interface
// ============================================================

export type McpTransport = 'streamable-http' | 'stdio' | 'sse';

export interface McpServiceConfig {
  serviceId: string;
  name: string;
  path: string;
  enabled: boolean;
  builtin: boolean;
  healthUrl: string | null;
  transport: McpTransport;
}

// ============================================================
// Service Configuration Registry
// ============================================================

function makeConfig(
  serviceId: string,
  name: string,
  path: string,
  opts?: Partial<Pick<McpServiceConfig, 'enabled' | 'builtin' | 'healthUrl' | 'transport'>>,
): McpServiceConfig {
  return {
    serviceId,
    name,
    path,
    enabled: opts?.enabled ?? true,
    builtin: opts?.builtin ?? false,
    healthUrl: opts?.healthUrl ?? null,
    transport: opts?.transport ?? 'streamable-http',
  };
}

export const MCP_SERVICE_CONFIGS: Record<string, McpServiceConfig> = {
  memory: makeConfig('memory', 'Memory', '/memory', { builtin: true }),
  graph: makeConfig('graph', 'Graph', '/graph', { builtin: true }),
  search: makeConfig('search', 'Search', '/search', { builtin: true }),
  workflow: makeConfig('workflow', 'Workflow', '/workflow', { builtin: true }),
  critic: makeConfig('critic', 'Critic', '/critic', { builtin: true }),
  agent: makeConfig('agent', 'Agent', '/agent', { builtin: true }),
  skills: makeConfig('skills', 'Skills', '/skills', { builtin: true }),
};

/** Service health status cache. */
export const MCP_SERVICE_HEALTH_CACHE: Record<string, string> = Object.fromEntries(
  Object.keys(MCP_SERVICE_CONFIGS).map((id) => [id, 'unknown']),
);

/** Runtime server order for consistent display. */
export const RUNTIME_SERVER_ORDER: readonly string[] = [
  'memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills',
] as const;

// ============================================================
// Public Functions
// ============================================================

/**
 * Get service runtime status from health check results.
 */
export function serviceRuntimeStatus(
  serviceId: string,
  services: Record<string, string>,
): string {
  const config = MCP_SERVICE_CONFIGS[serviceId];
  if (config && !config.enabled) return 'disabled';
  return services[serviceId] ?? 'unknown';
}

/**
 * Serialize service config to JSON-serializable dict.
 */
export function serializeServiceConfig(
  config: McpServiceConfig,
  services?: Record<string, string>,
): Record<string, unknown> {
  let runtimeStatus = 'unknown';
  if (services !== undefined) {
    runtimeStatus = serviceRuntimeStatus(config.serviceId, services);
  } else if (config.serviceId in MCP_SERVICE_HEALTH_CACHE) {
    runtimeStatus = MCP_SERVICE_HEALTH_CACHE[config.serviceId];
  }

  return {
    id: config.serviceId,
    name: config.name,
    path: config.path,
    enabled: config.enabled,
    builtin: config.builtin,
    transport: config.transport,
    health_url: config.healthUrl,
    status: runtimeStatus,
  };
}

/**
 * Normalize and validate service config payload.
 */
export function normalizeServiceConfigPayload(
  serviceId: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    service_id: serviceId.trim().toLowerCase(),
    name: String(body.name ?? serviceId).trim(),
    path: String(body.path ?? `/${serviceId}`).trim(),
    enabled: Boolean(body.enabled ?? true),
    builtin: Boolean(body.builtin ?? false),
    health_url: body.health_url ?? null,
    transport: String(body.transport ?? 'streamable-http').trim() || 'streamable-http',
  };

  if (!normalized.service_id) {
    throw new Error('service_id is required');
  }
  if (!normalized.path) {
    throw new Error('path is required');
  }
  if (!(normalized.path as string).startsWith('/')) {
    normalized.path = `/${normalized.path}`;
  }
  if (normalized.health_url !== null) {
    normalized.health_url = String(normalized.health_url).trim() || null;
  }

  return normalized;
}

/**
 * Update or create service configuration.
 */
export function updateServiceConfig(
  serviceId: string,
  body: Record<string, unknown>,
  options?: { createIfMissing?: boolean },
): McpServiceConfig {
  const createIfMissing = options?.createIfMissing ?? false;
  const current = MCP_SERVICE_CONFIGS[serviceId];

  if (current === undefined && !createIfMissing) {
    throw new Error(`Unknown service: ${serviceId}`);
  }

  if (current !== undefined) {
    if (current.builtin && body.path !== undefined) {
      throw new Error('builtin service path is immutable');
    }
    if (current.builtin && body.builtin === false) {
      throw new Error('builtin service cannot be downgraded');
    }
  }

  const payload = normalizeServiceConfigPayload(serviceId, body);

  let updated: McpServiceConfig;
  if (current === undefined) {
    updated = {
      serviceId: payload.service_id as string,
      name: payload.name as string,
      path: payload.path as string,
      enabled: payload.enabled as boolean,
      builtin: payload.builtin as boolean,
      healthUrl: payload.health_url as string | null,
      transport: payload.transport as McpTransport,
    };
  } else {
    updated = {
      serviceId: current.serviceId,
      name: payload.name as string,
      path: current.builtin ? current.path : (payload.path as string),
      enabled: payload.enabled as boolean,
      builtin: current.builtin,
      healthUrl: payload.health_url as string | null,
      transport: payload.transport as McpTransport,
    };
  }

  MCP_SERVICE_CONFIGS[updated.serviceId] = updated;
  if (!(updated.serviceId in MCP_SERVICE_HEALTH_CACHE)) {
    MCP_SERVICE_HEALTH_CACHE[updated.serviceId] = 'unknown';
  }
  return updated;
}

/**
 * Enable or disable a service.
 */
export function setServiceEnabled(serviceId: string, enabled: boolean): McpServiceConfig {
  const config = MCP_SERVICE_CONFIGS[serviceId];
  if (config === undefined) {
    throw new Error(`Unknown service: ${serviceId}`);
  }
  if (config.builtin && !enabled) {
    throw new Error('builtin service cannot be disabled');
  }

  const updated: McpServiceConfig = {
    ...config,
    enabled,
  };
  MCP_SERVICE_CONFIGS[serviceId] = updated;
  return updated;
}

/**
 * Refresh the service health status cache.
 */
export function refreshServiceHealthCache(services: Record<string, string>): void {
  for (const serviceId of Object.keys(MCP_SERVICE_CONFIGS)) {
    MCP_SERVICE_HEALTH_CACHE[serviceId] = serviceRuntimeStatus(serviceId, services);
  }
}

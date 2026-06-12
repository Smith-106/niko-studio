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

const VALID_TRANSPORTS: readonly McpTransport[] = ['streamable-http', 'stdio', 'sse'];

export function validateMcpTransport(value: string): McpTransport {
  if (VALID_TRANSPORTS.includes(value as McpTransport)) return value as McpTransport;
  throw new Error(`Invalid transport "${value}". Must be one of: ${VALID_TRANSPORTS.join(', ')}`);
}

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

export const MCP_SERVICE_CONFIGS: Record<string, McpServiceConfig> = {
  memory: {
    serviceId: 'memory',
    name: 'Memory',
    path: '/memory',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  graph: {
    serviceId: 'graph',
    name: 'Graph',
    path: '/graph',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  search: {
    serviceId: 'search',
    name: 'Search',
    path: '/search',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  workflow: {
    serviceId: 'workflow',
    name: 'Workflow',
    path: '/workflow',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  critic: {
    serviceId: 'critic',
    name: 'Critic',
    path: '/critic',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  agent: {
    serviceId: 'agent',
    name: 'Agent',
    path: '/agent',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
  skills: {
    serviceId: 'skills',
    name: 'Skills',
    path: '/skills',
    enabled: true,
    builtin: true,
    healthUrl: null,
    transport: 'streamable-http',
  },
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
): McpServiceConfig {
  const transport = validateMcpTransport(String(body.transport ?? 'streamable-http').trim() || 'streamable-http');
  let serviceIdValue = serviceId.trim().toLowerCase();
  let nameValue = String(body.name ?? serviceId).trim();
  let pathValue = String(body.path ?? `/${serviceId}`).trim();
  const enabledValue = Boolean(body.enabled ?? true);
  const builtinValue = Boolean(body.builtin ?? false);
  const healthUrlValue = body.health_url ?? null;

  if (!serviceIdValue) {
    throw new Error('service_id is required');
  }
  if (!pathValue) {
    throw new Error('path is required');
  }
  if (!pathValue.startsWith('/')) {
    pathValue = `/${pathValue}`;
  }

  return {
    serviceId: serviceIdValue,
    name: nameValue,
    path: pathValue,
    enabled: enabledValue,
    builtin: builtinValue,
    healthUrl: healthUrlValue as string | null,
    transport,
  };
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
    updated = payload;
  } else {
    updated = {
      serviceId: current.serviceId,
      name: payload.name,
      path: current.builtin ? current.path : payload.path,
      enabled: payload.enabled,
      builtin: current.builtin,
      healthUrl: payload.healthUrl,
      transport: payload.transport,
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

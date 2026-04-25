/**
 * MCP module - canonical public surface
 */

// Canonical gateway bootstrap and config authority
export {
  getConfigValue,
  resolveGatewayHostPort,
  resolveReloadEnabled,
  resolveLocalhostOnlyEnabled,
  resolveLocalhostOnlyExemptPaths,
  resolveSearchRouteMode,
  resolveSearchElasticTimeoutMs,
  resolveRedisRateLimit,
  resolveLangflowFlowName,
  resolveGovernanceHookEnabled,
  resolveRedisCacheTtlSeconds,
  resolveSearchCacheKey,
  resolveUiBridgeEnabled,
  resolveCorsOrigins,
  isProductionEnv,
  isLlmAvailable,
  setLlmAvailabilityProbe,
} from './config';

export {
  type GatewayServerStartOptions,
  resolveGatewayServerStartOptions,
  startGatewayServer,
  main,
} from './gateway-bootstrap';

export {
  type GatewayDeps,
  type ConfigAccess,
  type GatewayRuntimeState,
  createGatewayRuntimeState,
  createMcpServiceConfigMap,
  createHealthCacheMap,
  buildConfigAccess,
  buildGatewayDeps,
} from './gateway-state';

export {
  type McpServiceConfig,
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  RUNTIME_SERVER_ORDER,
  serviceRuntimeStatus,
  serializeServiceConfig,
  normalizeServiceConfigPayload,
  updateServiceConfig,
  setServiceEnabled,
  refreshServiceHealthCache,
} from './service-config';

export {
  RUNTIME_SESSION_ID,
  RUNTIME_LAST_PROBE_AT,
  RUNTIME_RECONNECT_ATTEMPTS,
  RUNTIME_LAST_ERROR,
  toRuntimeConnectionState,
  toRuntimeReconnectState,
  toServerRuntimeState,
  buildRuntimeServers,
  serviceIsReady,
  getObservabilitySnapshot,
} from './runtime';

export * from './contract';

// HTTP types (shared)
export type {
  HttpRequest,
  HttpResponse,
} from './http-types';

export {
  jsonResponse,
  parseBody,
} from './http-types';

// Services
export * from './services';

// Endpoints
export * from './endpoints';

// Legacy gateway compatibility surface (explicitly non-canonical)
export {
  McpConfig as LegacyMcpConfig,
  McpRuntime as LegacyMcpRuntime,
  McpMetrics as LegacyMcpMetrics,
  McpContract as LegacyMcpContract,
  McpMethod as LegacyMcpMethod,
  McpParameter as LegacyMcpParameter,
  McpReturn as LegacyMcpReturn,
  McpRequest as LegacyMcpRequest,
  McpResponse as LegacyMcpResponse,
  McpNotification as LegacyMcpNotification,
  HealthResponse as LegacyHealthResponse,
  MetricsResponse as LegacyMetricsResponse,
  createDefaultConfig as createLegacyGatewayConfig,
  getMcpContract as getLegacyMcpContract,
  McpRuntimeState as LegacyMcpRuntimeState,
  McpMetricsCollector as LegacyMcpMetricsCollector,
  McpGateway as LegacyMcpGateway,
  startSidecar as startLegacySidecar,
} from './gateway';

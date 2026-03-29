/**
 * MCP module - barrel exports
 */

// Gateway core
export {
  McpConfig,
  McpRuntime,
  McpMetrics,
  McpContract,
  McpMethod,
  McpParameter,
  McpReturn,
  McpRequest,
  McpResponse,
  McpNotification,
  HealthResponse,
  MetricsResponse,
  createDefaultConfig,
  resolveGatewayHostPort,
  resolveReloadEnabled,
  getMcpContract,
  McpRuntimeState,
  McpMetricsCollector,
  McpGateway,
  startSidecar,
} from './gateway';

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

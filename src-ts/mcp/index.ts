/**
 * MCP module - barrel exports
 */

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

/**
 * MCP Gateway Runtime State
 *
 * Runtime state management and health observability for the MCP gateway.
 *
 * Migrated from src/mcp/runtime.py
 */

import {
  MCP_SERVICE_CONFIGS,
  RUNTIME_SERVER_ORDER,
  serviceRuntimeStatus,
} from './service-config';

// ============================================================
// Runtime State
// ============================================================

export const RUNTIME_SESSION_ID = `gw-${Date.now()}`;
export let RUNTIME_LAST_PROBE_AT: string | null = null;
export let RUNTIME_RECONNECT_ATTEMPTS = 0;
export let RUNTIME_LAST_ERROR: string | null = null;

// ============================================================
// Runtime State Helpers
// ============================================================

/**
 * Convert health status to connection state.
 */
export function toRuntimeConnectionState(
  status: string,
  services: Record<string, string>,
): string {
  if (status === 'healthy') return 'connected';
  const coreServices = ['memory', 'graph', 'search', 'workflow', 'critic'];
  const coreStatuses = coreServices.map((name) => services[name] ?? 'unknown');
  if (coreStatuses.includes('ok')) return 'degraded';
  return 'disconnected';
}

/**
 * Convert connection state to reconnect state.
 */
export function toRuntimeReconnectState(connectionState: string): string {
  if (connectionState === 'connected') return 'idle';
  if (connectionState === 'degraded') return 'probing';
  return 'failed';
}

/**
 * Convert service status and connection state to runtime state.
 */
export function toServerRuntimeState(
  serviceStatus: string,
  connectionState: string,
): string {
  if (serviceStatus === 'ok') return 'connected';
  if (connectionState === 'degraded') return 'degraded';
  if (connectionState === 'disconnected') return 'disconnected';
  return 'reconnecting';
}

/**
 * Build runtime server status for all services.
 */
export function buildRuntimeServers(
  services: Record<string, string>,
  connectionState: string,
  lastError: string | null,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const name of RUNTIME_SERVER_ORDER) {
    const svcStatus = serviceRuntimeStatus(name, services);
    result[name] = {
      state: toServerRuntimeState(services[name] ?? 'unknown', connectionState),
      loading: false,
      lastError: svcStatus !== 'ok' && svcStatus !== 'disabled' ? lastError : null,
      enabled: MCP_SERVICE_CONFIGS[name]?.enabled ?? true,
    };
  }
  return result;
}

/**
 * Check if a service is ready.
 */
export function serviceIsReady(
  serviceId: string,
  services: Record<string, string>,
): boolean {
  const config = MCP_SERVICE_CONFIGS[serviceId];
  if (config && !config.enabled) return false;
  return (services[serviceId] ?? 'unknown') === 'ok';
}

/**
 * Get observability snapshot for health endpoint.
 */
export function getObservabilitySnapshot(
  services: Record<string, string>,
  engineHealth: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const runtimeReady = RUNTIME_SERVER_ORDER.filter(
    (name) => serviceIsReady(name, services),
  ).length;
  const runtimeTotal = RUNTIME_SERVER_ORDER.length;

  const layerStatus: Record<string, string> = {
    memory: services.memory ?? 'unknown',
    retrieval: services.search ?? 'unknown',
    workflow: services.workflow ?? 'unknown',
  };

  const layerHealth: Record<string, Record<string, unknown>> = {
    memory: engineHealth.memory ?? {},
    retrieval: engineHealth.search ?? {},
    workflow: engineHealth.workflow ?? {},
  };

  return {
    runtime: {
      ready: runtimeReady,
      total: runtimeTotal,
      health_ratio: runtimeTotal > 0
        ? Number((runtimeReady / runtimeTotal).toFixed(4))
        : 0.0,
    },
    layers: {
      status: layerStatus,
      health: layerHealth,
    },
  };
}

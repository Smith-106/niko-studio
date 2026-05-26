import { ConfigManager, getConfig as getAppConfig, getConfigValue as getAppConfigValue, setConfigValue as setAppConfigValue } from '../config';
import { ServiceContainer } from '../container/ServiceContainer';
import { loadConfig as loadServicesConfig } from '../knowledge/config';
import { setConfigAccess } from './endpoints/config';
import { setGatewayDeps } from './endpoints/health';
import { getMetricsSnapshot, utcNowIso } from './metrics';
import {
  RUNTIME_SESSION_ID,
  buildRuntimeServers,
  getObservabilitySnapshot,
  toRuntimeConnectionState,
  toRuntimeReconnectState,
} from './runtime';
import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  RUNTIME_SERVER_ORDER,
  refreshServiceHealthCache as refreshSharedServiceHealthCache,
  serializeServiceConfig as serializeSharedServiceConfig,
  serviceRuntimeStatus,
  type McpServiceConfig,
} from './service-config';

export type GatewayDeps = Parameters<typeof setGatewayDeps>[0];
export type ConfigAccess = Parameters<typeof setConfigAccess>[0];

export interface GatewayRuntimeState {
  mcpConfigs: Map<string, McpServiceConfig>;
  healthCache: Map<string, string>;
}

function snakeToCamelSegment(segment: string): string {
  return segment.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function camelToSnakeSegment(segment: string): string {
  return segment.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function mapConfigKeyToSharedKey(key: string): string {
  return key
    .split('.')
    .map((segment) => snakeToCamelSegment(segment))
    .join('.');
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toSnakeCaseValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        camelToSnakeSegment(key),
        toSnakeCaseValue(child),
      ]),
    );
  }

  return value;
}

export function createMcpServiceConfigMap(): Map<string, McpServiceConfig> {
  return new Map(
    Object.entries(MCP_SERVICE_CONFIGS).map(([serviceId, config]) => [
      serviceId,
      { ...config },
    ]),
  );
}

export function createHealthCacheMap(): Map<string, string> {
  return new Map(Object.entries(MCP_SERVICE_HEALTH_CACHE));
}

export function createGatewayRuntimeState(): GatewayRuntimeState {
  return {
    mcpConfigs: createMcpServiceConfigMap(),
    healthCache: createHealthCacheMap(),
  };
}

export function buildConfigAccess(onReload?: () => void): ConfigAccess {
  return {
    getConfig: () => toSnakeCaseValue(getAppConfig()) as Record<string, unknown>,
    getConfigValue: (key: string) => getAppConfigValue(mapConfigKeyToSharedKey(key)),
    setConfigValue: (key: string, value: unknown) => {
      setAppConfigValue(mapConfigKeyToSharedKey(key), value);
    },
    reloadConfig: () => {
      ConfigManager.getInstance().reload();
      onReload?.();
    },
  };
}

export function buildGatewayDeps(
  container: ServiceContainer,
  state: Partial<GatewayRuntimeState> = {},
): GatewayDeps {
  const mcpConfigs = state.mcpConfigs ?? createMcpServiceConfigMap();
  const healthCache = state.healthCache ?? createHealthCacheMap();
  const gatewayVersion = String(getAppConfig().version ?? '1.0.0');

  return {
    version: gatewayVersion,
    getEngine: (name: string) => {
      switch (name) {
        case 'memory':
          return container.memory as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'graph':
          return container.graph as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'search':
          return container.search as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'workflow':
          return container.workflow as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'critic':
          return container.critic as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        default:
          return null;
      }
    },
    getConfigValue: (key: string, defaultValue?: unknown) =>
      getAppConfigValue(mapConfigKeyToSharedKey(key), defaultValue),
    loadServicesConfig: () => {
      const configPath = process.env.NIKO_CONFIG_PATH?.trim();
      return loadServicesConfig(configPath || undefined);
    },
    getMetricsSnapshot: () => getMetricsSnapshot(),
    getObservabilitySnapshot,
    runtimeSessionId: RUNTIME_SESSION_ID,
    runtimeLastProbeAt: null,
    runtimeReconnectAttempts: 0,
    runtimeLastError: null,
    mcpServiceConfigs: mcpConfigs,
    runtimeServerOrder: [...RUNTIME_SERVER_ORDER],
    refreshServiceHealthCache: (services: Record<string, string>) => {
      refreshSharedServiceHealthCache(services);
      for (const [serviceId, status] of Object.entries(services)) {
        healthCache.set(serviceId, status);
      }
    },
    serviceRuntimeStatus,
    toRuntimeConnectionState,
    toRuntimeReconnectState,
    buildRuntimeServers,
    serializeServiceConfig: (config: unknown, services?: Record<string, string> | null) => {
      const candidate = config as (Partial<McpServiceConfig> & { id?: string }) | null;
      const serviceId = String(candidate?.serviceId ?? candidate?.id ?? '').trim().toLowerCase();
      const sharedConfig = serviceId ? MCP_SERVICE_CONFIGS[serviceId] : undefined;

      if (sharedConfig) {
        return serializeSharedServiceConfig(sharedConfig, services ?? undefined);
      }

      return {
        id: serviceId,
        name: String(candidate?.name ?? serviceId),
        path: String(candidate?.path ?? `/${serviceId}`),
        enabled: Boolean(candidate?.enabled ?? true),
        builtin: Boolean(candidate?.builtin ?? false),
        transport: String(candidate?.transport ?? 'streamable-http'),
        health_url: candidate?.healthUrl ?? null,
        status: serviceId && services ? services[serviceId] ?? 'unknown' : 'unknown',
      };
    },
    utcNowIso: () => utcNowIso(),
  };
}

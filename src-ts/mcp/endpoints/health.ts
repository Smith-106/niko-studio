/**
 * Health Check Endpoints
 *
 * Health check, metrics, and tool/model listing endpoints.
 * Ported from src/mcp/endpoints/health.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse } from '../http-types';
import type { ServiceConfig } from '../../knowledge/models';

// ---------------------------------------------------------------
// Gateway imports (will be wired via dependency injection)
// ---------------------------------------------------------------

interface EngineGetter {
  healthCheck?: () => Promise<Record<string, unknown>>;
}

interface GatewayDeps {
  version: string;
  getEngine(name: string): EngineGetter | null;
  getConfigValue(key: string, defaultValue?: unknown): unknown;
  loadServicesConfig(): unknown;
  getMetricsSnapshot(): Record<string, unknown>;
  getObservabilitySnapshot(
    services: Record<string, string>,
    engineHealth: Record<string, Record<string, unknown>>
  ): Record<string, unknown>;
  readonly runtimeSessionId: string;
  runtimeLastProbeAt: string | null;
  runtimeReconnectAttempts: number;
  runtimeLastError: string | null;
  readonly mcpServiceConfigs: Map<string, { enabled: boolean }>;
  readonly runtimeServerOrder: string[];
  refreshServiceHealthCache(services: Record<string, string>): void;
  serviceRuntimeStatus(name: string, services: Record<string, string>): string;
  toRuntimeConnectionState(status: string, services: Record<string, string>): string;
  toRuntimeReconnectState(connectionState: string): string;
  buildRuntimeServers(
    services: Record<string, string>,
    connectionState: string,
    lastError: string | null
  ): Record<string, Record<string, unknown>>;
  serializeServiceConfig(config: unknown, services?: Record<string, string> | null): unknown;
  utcNowIso(): string;
}

let gatewayDeps: GatewayDeps | null = null;

export function setGatewayDeps(deps: GatewayDeps): void {
  gatewayDeps = deps;
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

export async function healthCheck(_request: HttpRequest): Promise<HttpResponse> {
  const gw = gatewayDeps;
  if (!gw) {
    return jsonResponse({ status: 'degraded', error: 'Gateway not initialized' }, 503);
  }

  const engineHealth: Record<string, Record<string, unknown>> = {};
  const dependencyGetters: Array<[string, () => EngineGetter | null]> = [
    ['memory', () => gw.getEngine('memory')],
    ['graph', () => gw.getEngine('graph')],
    ['search', () => gw.getEngine('search')],
    ['workflow', () => gw.getEngine('workflow')],
    ['critic', () => gw.getEngine('critic')],
  ];

  for (const [name, getter] of dependencyGetters) {
    try {
      const engine = getter();
      if (engine && typeof engine.healthCheck === 'function') {
        const health = await engine.healthCheck();
        if (typeof health === 'object' && health !== null) {
          const normalized = { ...health };
          if (!('status' in normalized)) {
            normalized.status = normalized.db_ok === false ? 'error' : 'ok';
          }
          engineHealth[name] = normalized;
        } else {
          engineHealth[name] = { status: 'ok' };
        }
      } else {
        engineHealth[name] = { status: 'ok' };
      }
    } catch (exc) {
      engineHealth[name] = { status: 'error', error: String(exc) };
    }
  }

  const coreDependencies = ['memory', 'graph', 'search', 'workflow', 'critic'];
  const degraded = coreDependencies.some(
    (name) => (engineHealth[name]?.status ?? 'ok') !== 'ok'
  );
  const status = degraded ? 'degraded' : 'healthy';

  const services: Record<string, string> = {
    memory: (engineHealth.memory?.status as string) ?? 'ok',
    graph: (engineHealth.graph?.status as string) ?? 'ok',
    search: (engineHealth.search?.status as string) ?? 'ok',
    workflow: (engineHealth.workflow?.status as string) ?? 'ok',
    critic: (engineHealth.critic?.status as string) ?? 'ok',
    agent: 'ok',
    skills: 'ok',
  };

  for (const [serviceId, config] of gw.mcpServiceConfigs) {
    if (!config.enabled) {
      services[serviceId] = 'disabled';
    }
  }

  gw.refreshServiceHealthCache(services);

  gw.runtimeLastProbeAt = gw.utcNowIso();
  const failingServices = gw.runtimeServerOrder
    .filter(
      (name) =>
        !['ok', 'disabled'].includes(gw.serviceRuntimeStatus(name, services))
    )
    .map((name) => `${name}:${gw.serviceRuntimeStatus(name, services)}`);

  if (failingServices.length > 0) {
    gw.runtimeLastError = failingServices.join('; ');
    gw.runtimeReconnectAttempts += 1;
  } else {
    gw.runtimeLastError = null;
    gw.runtimeReconnectAttempts = 0;
  }

  const connectionState = gw.toRuntimeConnectionState(status, services);
  const reconnectState = gw.toRuntimeReconnectState(connectionState);

  return jsonResponse({
    status,
    version: gw.version,
    services,
    engine_health: engineHealth,
    observability: gw.getObservabilitySnapshot(services, engineHealth),
    agents: [
      'commander', 'architect', 'writer', 'critic',
      'worldbuilding', 'character', 'plot',
    ],
    skills_count: 40,
    mcp_runtime: {
      session_id: gw.runtimeSessionId,
      connection_state: connectionState,
      reconnect_state: reconnectState,
      last_probe_at: gw.runtimeLastProbeAt,
      reconnect_attempts: gw.runtimeReconnectAttempts,
      last_error: gw.runtimeLastError,
      servers: gw.buildRuntimeServers(services, connectionState, gw.runtimeLastError),
      service_configs: Array.from(gw.mcpServiceConfigs.values()).map((config) =>
        gw.serializeServiceConfig(config, services)
      ),
    },
  });
}

export async function metricsEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  const gw = gatewayDeps;
  if (!gw) {
    return jsonResponse({ status: 'disabled' }, 404);
  }

  const metricsEnabled = !!gw.getConfigValue('gateway.metrics_enabled', true);
  if (!metricsEnabled) {
    return jsonResponse({ status: 'disabled' }, 404);
  }

  return jsonResponse({
    status: 'ok',
    metrics: gw.getMetricsSnapshot(),
    runtime: {
      session_id: gw.runtimeSessionId,
      reconnect_attempts: gw.runtimeReconnectAttempts,
      last_probe_at: gw.runtimeLastProbeAt,
      last_error: gw.runtimeLastError,
    },
  });
}

export async function listTools(_request: HttpRequest): Promise<HttpResponse> {
  const tools: Record<string, string[]> = {
    memory: [
      'memory_add', 'memory_search', 'memory_get_temporal',
      'memory_get_conflicts', 'memory_resolve_conflict',
    ],
    graph: [
      'graph_query', 'graph_get_character', 'graph_get_relationships',
      'graph_get_foreshadows', 'graph_add_entity', 'graph_add_relation',
    ],
    search: ['search_hybrid', 'search_iterative', 'search_context'],
    workflow: [
      'workflow_route', 'workflow_plan', 'workflow_execute',
      'checkpoint_create', 'checkpoint_restore', 'checkpoint_list',
    ],
    critic: ['evaluate_content', 'get_improvement_suggestions', 'compare_versions'],
    agent: ['agent_route', 'agent_write', 'agent_revise', 'agent_get_context'],
    skills: ['skills_list', 'skills_match', 'skills_load', 'skills_get_chain'],
    writing_helper: ['process_writing_helper'],
  };
  return jsonResponse(tools);
}

export async function listModels(request: HttpRequest): Promise<HttpResponse> {
  const gw = gatewayDeps;
  if (!gw) {
    return jsonResponse({ error: 'Gateway not initialized' }, 500);
  }

  const providerFilter = (request.query['provider'] ?? '').trim().toLowerCase();

  let serviceConfig: unknown;
  try {
    serviceConfig = gw.loadServicesConfig();
  } catch (exc) {
    return jsonResponse({ error: String(exc) }, 500);
  }

  const providerModels = extractProviderModels(serviceConfig);

  if (providerFilter) {
    if (!(providerFilter in providerModels)) {
      return jsonResponse({
        status: 'not_found',
        error: 'provider_not_found',
        provider: providerFilter,
        models: [],
      }, 404);
    }
    return jsonResponse({
      status: 'ok',
      provider: providerFilter,
      models: providerModels[providerFilter],
    });
  }

  const allModels = [...new Set(Object.values(providerModels).flat())];
  return jsonResponse({
    status: 'ok',
    models: allModels,
    providers: providerModels,
  });
}

function extractProviderModels(serviceConfig: unknown): Record<string, string[]> {
  if (!serviceConfig || typeof serviceConfig !== 'object') {
    return {};
  }

  const config = serviceConfig as Partial<ServiceConfig>;
  const providers = Array.isArray(config.providers) ? config.providers : [];
  const providerModels: Record<string, string[]> = {};

  for (const provider of providers) {
    if (!provider || typeof provider !== 'object') continue;

    const providerId = String((provider as { provider?: unknown }).provider ?? '').trim().toLowerCase();
    if (!providerId) continue;

    const modelMapping = (provider as { modelMapping?: Record<string, unknown> }).modelMapping ?? {};
    const models = [modelMapping.fast, modelMapping.default, modelMapping.powerful]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);

    if (models.length === 0) continue;
    providerModels[providerId] = [...new Set(models)];
  }

  return providerModels;
}

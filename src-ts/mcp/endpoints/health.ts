/**
 * Health Check Endpoints
 *
 * Health check, metrics, and tool/model listing endpoints.
 * Ported from src/mcp/endpoints/health.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse } from '../http-types';
import type { ServiceConfig } from '../../knowledge/models';
import { listSkills } from '../../skills/index.js';

// ---------------------------------------------------------------
// Gateway imports (will be wired via dependency injection)
// ---------------------------------------------------------------

interface EngineGetter {
  healthCheck?: () => Promise<Record<string, unknown>>;
}

interface HealthEngineAccess {
  getEngine(name: string): EngineGetter | null;
}

interface ServiceRegistryAccess {
  readonly mcpServiceConfigs: Map<string, { enabled: boolean }>;
  readonly runtimeServerOrder: string[];
  serviceRuntimeStatus(name: string, services: Record<string, string>): string;
  refreshServiceHealthCache(services: Record<string, string>): void;
  serializeServiceConfig(config: unknown, services?: Record<string, string> | null): unknown;
}

interface RuntimeStateAccess {
  readonly runtimeSessionId: string;
  toRuntimeConnectionState(status: string, services: Record<string, string>): string;
  toRuntimeReconnectState(connectionState: string): string;
  buildRuntimeServers(
    services: Record<string, string>,
    connectionState: string,
    lastError: string | null
  ): Record<string, Record<string, unknown>>;
}

interface ObservabilityAccess {
  getMetricsSnapshot(): Record<string, unknown>;
  getObservabilitySnapshot(
    services: Record<string, string>,
    engineHealth: Record<string, Record<string, unknown>>
  ): Record<string, unknown>;
}

interface ConfigAccess {
  getConfigValue(key: string, defaultValue?: unknown): unknown;
  loadServicesConfig(): unknown;
}

interface GatewayDeps extends HealthEngineAccess, ServiceRegistryAccess, RuntimeStateAccess, ObservabilityAccess, ConfigAccess {
  version: string;
  utcNowIso(): string;
  runtimeTracker: GatewayRuntimeTracker;
}

export class GatewayRuntimeTracker {
  lastProbeAt: string | null = null;
  reconnectAttempts = 0;
  lastError: string | null = null;

  recordProbe(utcNow: string): void {
    this.lastProbeAt = utcNow;
  }

  recordFailure(failingServices: string[]): void {
    this.lastError = failingServices.join('; ');
    this.reconnectAttempts += 1;
  }

  clearFailure(): void {
    this.lastError = null;
    this.reconnectAttempts = 0;
  }
}

let gatewayDeps: GatewayDeps | null = null;

const CORE_RUNTIME_SERVICES = ['memory', 'graph', 'search', 'workflow', 'critic'];

export function setGatewayDeps(deps: GatewayDeps): void {
  gatewayDeps = deps;
}

function normalizeErrorText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function inferDependencyName(text: string): string | null {
  const patterns: Array<[RegExp, string]> = [
    [/pdf-parse/i, 'pdf-parse'],
    [/mammoth/i, 'mammoth'],
    [/sentence[- ]transformers/i, 'sentence-transformers'],
    [/onnxruntime/i, 'onnxruntime'],
    [/sqlite/i, 'sqlite'],
    [/python/i, 'python'],
  ];

  for (const [pattern, dependency] of patterns) {
    if (pattern.test(text)) {
      return dependency;
    }
  }

  return null;
}

function buildGatewayDiagnostic(
  status: string,
  services: Record<string, string>,
  engineHealth: Record<string, Record<string, unknown>>,
  runtimeLastError: string | null,
): Record<string, unknown> | null {
  const affectedServices = CORE_RUNTIME_SERVICES.filter(
    (name) => !['ok', 'disabled'].includes(services[name] ?? 'unknown'),
  );
  const errorText = [
    runtimeLastError,
    ...affectedServices.map((name) => normalizeErrorText(engineHealth[name]?.error)).filter(Boolean),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' | ');

  if (!errorText && affectedServices.length === 0) {
    return null;
  }

  const parserMissing = /(pdf-parse|mammoth|parser|docx|\.docx|\.pdf)/i.test(errorText);
  if (parserMissing) {
    const dependency = inferDependencyName(errorText);
    return {
      failure_class: 'parser_missing',
      summary: 'Document parser prerequisite is missing.',
      detail: errorText,
      action: dependency
        ? `Install ${dependency} in the src-ts runtime environment and retry the document workflow.`
        : 'Install the required document parser in the src-ts runtime environment and retry the document workflow.',
      affected_services: affectedServices,
      prerequisite: {
        kind: 'parser',
        dependency,
        detail: errorText,
        action: dependency
          ? `Install ${dependency} in the src-ts runtime environment and retry the document workflow.`
          : 'Install the required document parser in the src-ts runtime environment and retry the document workflow.',
        install_command: dependency ? `npm install ${dependency}` : null,
      },
    };
  }

  const embeddingUnavailable = /(embedding|embed|vector|sentence[- ]transformers|provider.+model|model.+provider)/i.test(errorText);
  if (embeddingUnavailable) {
    const dependency = inferDependencyName(errorText);
    return {
      failure_class: 'embedding_authority_unavailable',
      summary: 'The authoritative embedding path is unavailable.',
      detail: errorText,
      action: 'Restore the configured embedding provider or local embedding runtime before relying on retrieval flows.',
      affected_services: affectedServices,
      prerequisite: {
        kind: 'embedding',
        dependency,
        service: affectedServices.includes('search') ? 'search' : affectedServices[0] ?? null,
        detail: errorText,
        action: 'Restore the configured embedding provider or local embedding runtime before relying on retrieval flows.',
      },
    };
  }

  const prerequisiteMissing = /(module not found|cannot find module|not installed|install with|dependency|prerequisite|missing package|python|dll|vcruntime|msvcp)/i.test(errorText);
  if (prerequisiteMissing) {
    const dependency = inferDependencyName(errorText);
    return {
      failure_class: 'packaged_prerequisite_missing',
      summary: 'A packaged or runtime prerequisite is missing.',
      detail: errorText,
      action: 'Install the missing runtime prerequisite and retry the packaged or local health flow.',
      affected_services: affectedServices,
      prerequisite: {
        kind: 'package',
        dependency,
        detail: errorText,
        action: 'Install the missing runtime prerequisite and retry the packaged or local health flow.',
        install_command: dependency ? `npm install ${dependency}` : null,
      },
    };
  }

  if (status === 'degraded' || affectedServices.length > 0) {
    return {
      failure_class: 'integration_degraded',
      summary: 'One or more gateway integrations are degraded.',
      detail: errorText || affectedServices.join(', '),
      action: 'Inspect the affected services, fix their health errors, and retry the gateway workflow.',
      affected_services: affectedServices,
      prerequisite: {
        kind: 'integration',
        service: affectedServices[0] ?? null,
        detail: errorText || affectedServices.join(', '),
        action: 'Inspect the affected services, fix their health errors, and retry the gateway workflow.',
      },
    };
  }

  return {
    failure_class: 'runtime_unavailable',
    summary: 'The gateway runtime is unavailable.',
    detail: errorText,
    action: 'Start the local gateway runtime and retry the health check.',
    affected_services: affectedServices,
    prerequisite: {
      kind: 'runtime',
      detail: errorText,
      action: 'Start the local gateway runtime and retry the health check.',
    },
  };
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

  const degraded = CORE_RUNTIME_SERVICES.some(
    (name) => (engineHealth[name]?.status ?? 'ok') !== 'ok'
  );
  const status = degraded ? 'degraded' : 'healthy';

  const runtimeUnavailable = !gw.runtimeSessionId;

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

  gw.runtimeTracker.recordProbe(gw.utcNowIso());
  const failingServices = gw.runtimeServerOrder
    .filter(
      (name) =>
        !['ok', 'disabled'].includes(gw.serviceRuntimeStatus(name, services))
    )
    .map((name) => `${name}:${gw.serviceRuntimeStatus(name, services)}`);

  if (failingServices.length > 0) {
    gw.runtimeTracker.recordFailure(failingServices);
  } else {
    gw.runtimeTracker.clearFailure();
  }

  const effectiveStatus = runtimeUnavailable && status === 'healthy' ? 'degraded' : status;
  const connectionState = runtimeUnavailable
    ? 'disconnected'
    : gw.toRuntimeConnectionState(effectiveStatus, services);
  const reconnectState = runtimeUnavailable
    ? 'failed'
    : gw.toRuntimeReconnectState(connectionState);
  const diagnostic = runtimeUnavailable
    ? {
        failure_class: 'runtime_unavailable',
        summary: 'Gateway runtime session is unavailable.',
        detail: gw.runtimeTracker.lastError ?? 'Gateway runtime session has not been initialized.',
        action: 'Start or reinitialize the local gateway runtime and retry the health check.',
        affected_services: [],
        prerequisite: {
          kind: 'runtime',
          detail: gw.runtimeTracker.lastError ?? 'Gateway runtime session has not been initialized.',
          action: 'Start or reinitialize the local gateway runtime and retry the health check.',
        },
      }
    : buildGatewayDiagnostic(effectiveStatus, services, engineHealth, gw.runtimeTracker.lastError);

  return jsonResponse({
    status: effectiveStatus,
    version: gw.version,
    services,
    engine_health: engineHealth,
    diagnostic,
    observability: gw.getObservabilitySnapshot(services, engineHealth),
    agents: Object.keys(engineHealth).filter(
      (name) => name !== 'memory' && name !== 'graph' && name !== 'search' && name !== 'workflow' && name !== 'critic'
    ).concat(['commander', 'architect', 'writer', 'critic', 'worldbuilding', 'character', 'plot']),
    skills_count: listSkills().length,
    mcp_runtime: {
      session_id: gw.runtimeSessionId,
      connection_state: connectionState,
      reconnect_state: reconnectState,
      last_probe_at: gw.runtimeTracker.lastProbeAt,
      reconnect_attempts: gw.runtimeTracker.reconnectAttempts,
      last_error: gw.runtimeTracker.lastError,
      diagnostic,
      servers: gw.buildRuntimeServers(services, connectionState, gw.runtimeTracker.lastError),
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
      reconnect_attempts: gw.runtimeTracker.reconnectAttempts,
      last_probe_at: gw.runtimeTracker.lastProbeAt,
      last_error: gw.runtimeTracker.lastError,
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

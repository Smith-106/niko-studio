import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(query: Record<string, string> = {}): HttpRequest {
  return {
    method: 'GET',
    url: '/health',
    headers: {},
    body: {},
    query,
    params: {},
  };
}

async function loadHealthModule() {
  vi.resetModules();
  return import('../../mcp/endpoints/health.js');
}

function buildGatewayDeps(
  healthModule: Awaited<ReturnType<typeof loadHealthModule>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    version: 'test',
    getEngine: () => null,
    getConfigValue: (_key: string, defaultValue?: unknown) => defaultValue,
    loadServicesConfig: () => ({}),
    getMetricsSnapshot: () => ({ requests: 0 }),
    getObservabilitySnapshot: () => ({ observers: 'ok' }),
    runtimeSessionId: 'runtime-session',
    runtimeTracker: new healthModule.GatewayRuntimeTracker(),
    mcpServiceConfigs: new Map(),
    runtimeServerOrder: [],
    refreshServiceHealthCache: () => {},
    serviceRuntimeStatus: (_name: string, services: Record<string, string>) => services[_name] ?? 'ok',
    toRuntimeConnectionState: () => 'connected',
    toRuntimeReconnectState: () => 'idle',
    buildRuntimeServers: () => ({ memory: { status: 'ok' } }),
    serializeServiceConfig: (config: unknown) => config,
    utcNowIso: () => '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('health endpoints branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to ok when degraded checks see status-less core engine payloads', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) => ({
          healthCheck: async () => {
            if (name === 'memory') {
              return { db_ok: true };
            }
            return { status: undefined };
          },
        }),
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services).toMatchObject({
      memory: 'ok',
      graph: 'ok',
      search: 'ok',
      workflow: 'ok',
      critic: 'ok',
    });
    expect(body.engine_health.memory.status).toBe('ok');
    expect(body.diagnostic).toBeNull();
  });

  it('uses a null prerequisite service when only runtime tracker errors mention embeddings', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        runtimeServerOrder: ['agent'],
        serviceRuntimeStatus: () => 'embedding provider unavailable',
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.diagnostic).toMatchObject({
      failure_class: 'embedding_authority_unavailable',
      affected_services: [],
      prerequisite: {
        service: null,
      },
    });
    expect(body.mcp_runtime.last_error).toContain('agent:embedding provider unavailable');
  });

  it('treats missing core service entries as unknown in gateway diagnostics', async () => {
    const healthModule = await loadHealthModule();

    const diagnostic = healthModule.__test__.buildGatewayDiagnostic(
      'degraded',
      {},
      {},
      'plain runtime error',
    ) as Record<string, any>;

    expect(diagnostic.failure_class).toBe('integration_degraded');
    expect(diagnostic.affected_services).toContain('memory');
    expect(diagnostic.prerequisite.service).toBe('memory');
  });

  it('falls back to a null integration service when diagnostics have errors but no affected services', async () => {
    const healthModule = await loadHealthModule();

    const diagnostic = healthModule.__test__.buildGatewayDiagnostic(
      'degraded',
      {
        memory: 'ok',
        graph: 'ok',
        search: 'ok',
        workflow: 'ok',
        critic: 'ok',
      },
      {},
      'plain runtime error',
    ) as Record<string, any>;

    expect(diagnostic.failure_class).toBe('integration_degraded');
    expect(diagnostic.affected_services).toEqual([]);
    expect(diagnostic.prerequisite.service).toBeNull();
  });

  it('falls back to ok when the memory engine exposes an explicit undefined status field', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'memory'
            ? {
                healthCheck: async () => ({
                  status: undefined,
                }),
              }
            : null,
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.services.memory).toBe('ok');
    expect(body.engine_health.memory.status).toBeUndefined();
  });
});

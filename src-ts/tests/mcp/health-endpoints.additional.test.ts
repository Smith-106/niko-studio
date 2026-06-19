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
    getMetricsSnapshot: () => ({ requests: 3 }),
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
    utcNowIso: () => '2026-06-05T00:00:00.000Z',
    ...overrides,
  };
}

describe('health endpoints additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns disabled metrics when gateway deps are not initialized', async () => {
    const healthModule = await loadHealthModule();
    const response = await healthModule.metricsEndpoint(makeRequest());

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ status: 'disabled' });
  });

  it('returns a degraded health check when gateway deps are not initialized', async () => {
    const healthModule = await loadHealthModule();
    const response = await healthModule.healthCheck(makeRequest());

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      status: 'degraded',
      error: 'Gateway not initialized',
    });
  });

  it('returns disabled metrics when metrics are turned off', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getConfigValue: (key: string, defaultValue?: unknown) =>
          key === 'gateway.metrics_enabled' ? false : defaultValue,
      }),
    );

    const response = await healthModule.metricsEndpoint(makeRequest());

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ status: 'disabled' });
  });

  it('returns metrics snapshots and runtime metadata when enabled', async () => {
    const healthModule = await loadHealthModule();
    const tracker = new healthModule.GatewayRuntimeTracker();
    tracker.recordProbe('2026-06-05T00:00:00.000Z');
    tracker.recordFailure(['search:error']);

    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        runtimeTracker: tracker,
      }),
    );

    const response = await healthModule.metricsEndpoint(makeRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      metrics: { requests: 3 },
      runtime: {
        session_id: 'runtime-session',
        reconnect_attempts: 1,
        last_probe_at: '2026-06-05T00:00:00.000Z',
        last_error: 'search:error',
      },
    });
  });

  it('returns a healthy runtime payload with no diagnostic when all services are ok', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(buildGatewayDeps(healthModule));

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.diagnostic).toBeNull();
    expect(body.mcp_runtime.connection_state).toBe('connected');
    expect(body.mcp_runtime.reconnect_state).toBe('idle');
  });

  it('lists available tool groups', async () => {
    const healthModule = await loadHealthModule();
    const response = await healthModule.listTools(makeRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      memory: expect.any(Array),
      graph: expect.any(Array),
      workflow: expect.any(Array),
      writing_helper: expect.any(Array),
    });
  });

  it('returns a loadServicesConfig error when model config loading fails', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        loadServicesConfig: () => {
          throw new Error('config exploded');
        },
      }),
    );

    const response = await healthModule.listModels(makeRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Error: config exploded' });
  });

  it('returns a gateway initialization error when listing models without deps', async () => {
    const healthModule = await loadHealthModule();
    const response = await healthModule.listModels(makeRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Gateway not initialized' });
  });

  it('returns empty providers when services config is not an object', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        loadServicesConfig: () => 'not-an-object',
      }),
    );

    const response = await healthModule.listModels(makeRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      models: [],
      providers: {},
    });
  });

  it('classifies embedding authority failures from engine health errors', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'search'
            ? {
                healthCheck: async () => ({
                  status: 'error',
                  error: 'embedding provider model unavailable for vector retrieval',
                }),
              }
            : null,
        runtimeServerOrder: ['search'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'embedding_authority_unavailable',
    });
    expect(body.mcp_runtime.last_error).toContain('search:error');
  });

  it('classifies embedding authority failures for non-search services', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'memory'
            ? {
                healthCheck: async () => ({
                  status: 'error',
                  error: 'vector embedding provider unavailable for authority sync',
                }),
              }
            : null,
        runtimeServerOrder: ['memory'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'embedding_authority_unavailable',
      prerequisite: {
        service: 'memory',
      },
    });
  });

  it('classifies parser failures even when the missing dependency name cannot be inferred', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'search'
            ? {
                healthCheck: async () => ({
                  status: 'error',
                  error: 'custom parser could not open .docx attachment',
                }),
              }
            : null,
        runtimeServerOrder: ['search'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'parser_missing',
      prerequisite: {
        dependency: null,
        install_command: null,
      },
    });
  });

  it('classifies parser failures with an inferred dependency and install command', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'search'
            ? {
                healthCheck: async () => ({
                  status: 'error',
                  error: 'pdf-parse module not found for .pdf parsing',
                }),
              }
            : null,
        runtimeServerOrder: ['search'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'parser_missing',
      action: 'Install pdf-parse in the src-ts runtime environment and retry the document workflow.',
      prerequisite: {
        dependency: 'pdf-parse',
        install_command: 'npm install pdf-parse',
      },
    });
  });

  it('classifies packaged prerequisite failures when engine health throws', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'workflow'
            ? {
                healthCheck: async () => {
                  throw new Error('python dependency missing package');
                },
              }
            : null,
        runtimeServerOrder: ['workflow'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'packaged_prerequisite_missing',
    });
  });

  it('classifies packaged prerequisite failures without an inferred dependency', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'workflow'
            ? {
                healthCheck: async () => {
                  throw new Error('custom prerequisite missing package for local runtime');
                },
              }
            : null,
        runtimeServerOrder: ['workflow'],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'packaged_prerequisite_missing',
      prerequisite: {
        dependency: null,
        install_command: null,
      },
    });
  });

  it('returns the runtime-unavailable diagnostic branch for unknown degraded status without affected services', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: () => null,
        serviceRuntimeStatus: () => 'mystery',
        runtimeServerOrder: ['memory', 'search'],
        toRuntimeConnectionState: () => 'probing',
        toRuntimeReconnectState: () => 'retrying',
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.diagnostic).toMatchObject({
      failure_class: 'runtime_unavailable',
      affected_services: [],
      prerequisite: {
        kind: 'runtime',
      },
    });
  });

  it('treats blank engine errors as degraded integrations without leaking empty diagnostic text', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'search'
            ? {
                healthCheck: async () => ({
                  status: 'error',
                  error: '   ',
                }),
              }
            : null,
        runtimeServerOrder: [],
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'integration_degraded',
      detail: 'search',
    });
  });

  it('reports missing runtime session diagnostics before gateway connection mapping', async () => {
    const healthModule = await loadHealthModule();
    const tracker = new healthModule.GatewayRuntimeTracker();
    tracker.recordFailure(['previous:offline']);
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        runtimeSessionId: '',
        runtimeTracker: tracker,
        runtimeServerOrder: ['memory'],
        serviceRuntimeStatus: () => 'offline',
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.diagnostic).toMatchObject({
      failure_class: 'runtime_unavailable',
      detail: 'memory:offline',
    });
    expect(body.mcp_runtime).toMatchObject({
      session_id: '',
      connection_state: 'disconnected',
      reconnect_state: 'failed',
    });
  });

  it('reports default missing-runtime-session detail when there is no cached runtime error', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        runtimeSessionId: '',
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'runtime_unavailable',
      detail: 'Gateway runtime session has not been initialized.',
      prerequisite: {
        detail: 'Gateway runtime session has not been initialized.',
      },
    });
  });

  it('lists models for filtered providers and skips invalid provider records', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        loadServicesConfig: () => ({
          providers: [
            null,
            { provider: '  ' },
            { provider: 'OpenAI', modelMapping: { fast: 'gpt-fast', default: 'gpt-main', powerful: 'gpt-main' } },
            { provider: 'Empty', modelMapping: {} },
          ],
        }),
      }),
    );

    const filtered = await healthModule.listModels(makeRequest({ provider: ' openai ' }));
    expect(filtered.statusCode).toBe(200);
    expect(filtered.body).toEqual({
      status: 'ok',
      provider: 'openai',
      models: ['gpt-fast', 'gpt-main'],
    });

    const missing = await healthModule.listModels(makeRequest({ provider: 'missing' }));
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toEqual({
      status: 'not_found',
      error: 'provider_not_found',
      provider: 'missing',
      models: [],
    });
  });

  it('returns empty providers when the provider list is malformed and skips sparse provider entries', async () => {
    const healthModule = await loadHealthModule();
    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        loadServicesConfig: () => ({
          providers: 'broken',
        }),
      }),
    );

    const malformed = await healthModule.listModels(makeRequest());
    expect(malformed.statusCode).toBe(200);
    expect(malformed.body).toEqual({
      status: 'ok',
      models: [],
      providers: {},
    });

    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        loadServicesConfig: () => ({
          providers: [
            {},
            { provider: 'MemoryOnly' },
            { provider: 'OpenAI', modelMapping: { default: 'gpt-main' } },
          ],
        }),
      }),
    );

    const filtered = await healthModule.listModels(makeRequest());
    expect(filtered.statusCode).toBe(200);
    expect(filtered.body).toEqual({
      status: 'ok',
      models: ['gpt-main'],
      providers: {
        openai: ['gpt-main'],
      },
    });
  });

  it('marks disabled services and clears prior runtime failures on healthy probes', async () => {
    const healthModule = await loadHealthModule();
    const tracker = new healthModule.GatewayRuntimeTracker();
    tracker.recordFailure(['old:error']);

    healthModule.setGatewayDeps(
      buildGatewayDeps(healthModule, {
        getEngine: (name: string) =>
          name === 'memory'
            ? {
                healthCheck: async () => ({
                  db_ok: false,
                }),
              }
            : {
                healthCheck: async () => 'unexpected-non-object' as unknown as Record<string, unknown>,
              },
        mcpServiceConfigs: new Map([
          ['search', { enabled: false }],
        ]),
        runtimeServerOrder: ['search'],
        runtimeTracker: tracker,
      }),
    );

    const response = await healthModule.healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.services.search).toBe('disabled');
    expect(body.engine_health.memory.status).toBe('error');
    expect(body.engine_health.graph.status).toBe('ok');
    expect(body.mcp_runtime.reconnect_attempts).toBe(0);
    expect(body.mcp_runtime.last_error).toBeNull();
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import { healthCheck, listModels, setGatewayDeps } from '../../mcp/endpoints/health';
import {
  createProviderConfig,
  createServiceConfig,
  ModelTier,
  ProviderType,
} from '../../knowledge/models';

function makeRequest(query: Record<string, string> = {}): HttpRequest {
  return {
    method: 'GET',
    url: '/models',
    headers: {},
    body: {},
    query,
    params: {},
  };
}

function installGatewayDeps(loadServicesConfig: () => unknown): void {
  setGatewayDeps({
    version: 'test',
    getEngine: () => null,
    getConfigValue: () => undefined,
    loadServicesConfig,
    getMetricsSnapshot: () => ({}),
    getObservabilitySnapshot: () => ({}),
    runtimeSessionId: 'test-session',
    runtimeLastProbeAt: null,
    runtimeReconnectAttempts: 0,
    runtimeLastError: null,
    mcpServiceConfigs: new Map(),
    runtimeServerOrder: [],
    refreshServiceHealthCache: () => {},
    serviceRuntimeStatus: () => 'ok',
    toRuntimeConnectionState: () => 'connected',
    toRuntimeReconnectState: () => 'idle',
    buildRuntimeServers: () => [],
    serializeServiceConfig: () => ({}),
    utcNowIso: () => new Date().toISOString(),
  });
}

afterEach(() => {
  installGatewayDeps(() => ({}));
});

describe('health endpoint diagnostics', () => {
  it('reports runtime_unavailable when runtime session is missing', async () => {
    setGatewayDeps({
      version: 'test',
      getEngine: () => null,
      getConfigValue: () => undefined,
      loadServicesConfig: () => ({}),
      getMetricsSnapshot: () => ({}),
      getObservabilitySnapshot: () => ({}),
      runtimeSessionId: '',
      runtimeLastProbeAt: null,
      runtimeReconnectAttempts: 0,
      runtimeLastError: null,
      mcpServiceConfigs: new Map(),
      runtimeServerOrder: [],
      refreshServiceHealthCache: () => {},
      serviceRuntimeStatus: () => 'ok',
      toRuntimeConnectionState: () => 'connected',
      toRuntimeReconnectState: () => 'idle',
      buildRuntimeServers: () => ({}),
      serializeServiceConfig: () => ({}),
      utcNowIso: () => '2026-04-28T10:00:00Z',
    });

    const response = await healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.diagnostic).toMatchObject({
      failure_class: 'runtime_unavailable',
    });
    expect(body.mcp_runtime).toMatchObject({
      connection_state: 'disconnected',
      reconnect_state: 'failed',
    });
  });

  it('classifies parser_missing from engine health errors', async () => {
    setGatewayDeps({
      version: 'test',
      getEngine: (name: string) => name === 'search'
        ? { healthCheck: async () => ({ status: 'error', error: 'mammoth is required for .docx parsing' }) }
        : null,
      getConfigValue: () => undefined,
      loadServicesConfig: () => ({}),
      getMetricsSnapshot: () => ({}),
      getObservabilitySnapshot: () => ({}),
      runtimeSessionId: 'session-1',
      runtimeLastProbeAt: null,
      runtimeReconnectAttempts: 0,
      runtimeLastError: null,
      mcpServiceConfigs: new Map(),
      runtimeServerOrder: ['search'],
      refreshServiceHealthCache: () => {},
      serviceRuntimeStatus: (_name: string, services: Record<string, string>) => services.search ?? 'ok',
      toRuntimeConnectionState: () => 'degraded',
      toRuntimeReconnectState: () => 'retrying',
      buildRuntimeServers: () => ({}),
      serializeServiceConfig: () => ({}),
      utcNowIso: () => '2026-04-28T10:00:00Z',
    });

    const response = await healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'parser_missing',
    });
    expect(body.mcp_runtime?.diagnostic).toMatchObject({
      failure_class: 'parser_missing',
    });
  });

  it('classifies integration_degraded when services fail without prerequisite signature', async () => {
    setGatewayDeps({
      version: 'test',
      getEngine: (name: string) => name === 'search'
        ? { healthCheck: async () => ({ status: 'error', error: 'search timeout' }) }
        : null,
      getConfigValue: () => undefined,
      loadServicesConfig: () => ({}),
      getMetricsSnapshot: () => ({}),
      getObservabilitySnapshot: () => ({}),
      runtimeSessionId: 'session-1',
      runtimeLastProbeAt: null,
      runtimeReconnectAttempts: 0,
      runtimeLastError: null,
      mcpServiceConfigs: new Map(),
      runtimeServerOrder: ['search'],
      refreshServiceHealthCache: () => {},
      serviceRuntimeStatus: (_name: string, services: Record<string, string>) => services.search ?? 'ok',
      toRuntimeConnectionState: () => 'degraded',
      toRuntimeReconnectState: () => 'retrying',
      buildRuntimeServers: () => ({}),
      serializeServiceConfig: () => ({}),
      utcNowIso: () => '2026-04-28T10:00:00Z',
    });

    const response = await healthCheck(makeRequest());
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.diagnostic).toMatchObject({
      failure_class: 'integration_degraded',
      detail: expect.stringContaining('search:error'),
    });
  });
});

describe('health endpoints model listing parity', () => {
  it('lists provider models from the loaded services config', async () => {
    installGatewayDeps(() => createServiceConfig({
      providers: [
        createProviderConfig({
          provider: ProviderType.OPENAI,
          modelMapping: {
            [ModelTier.FAST]: 'gpt-4o-mini',
            [ModelTier.DEFAULT]: 'gpt-4o',
            [ModelTier.POWERFUL]: 'gpt-4-turbo',
          },
        }),
        createProviderConfig({
          provider: ProviderType.ANTHROPIC,
          modelMapping: {
            [ModelTier.FAST]: 'claude-3-haiku-20240307',
            [ModelTier.DEFAULT]: 'claude-3-5-sonnet-20241022',
            [ModelTier.POWERFUL]: 'claude-3-opus-20240229',
          },
        }),
      ],
    }));

    const response = await listModels(makeRequest());

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      models: [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4-turbo',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
      ],
      providers: {
        openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
        anthropic: ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
      },
    });
  });

  it('filters by provider and returns not_found for unknown providers', async () => {
    installGatewayDeps(() => createServiceConfig({
      providers: [
        createProviderConfig({
          provider: ProviderType.OPENAI,
          modelMapping: {
            [ModelTier.FAST]: 'gpt-4o-mini',
            [ModelTier.DEFAULT]: 'gpt-4o',
            [ModelTier.POWERFUL]: 'gpt-4-turbo',
          },
        }),
      ],
    }));

    const filtered = await listModels(makeRequest({ provider: 'openai' }));
    const missing = await listModels(makeRequest({ provider: 'missing' }));

    expect(filtered.statusCode).toBe(200);
    expect(filtered.body).toEqual({
      status: 'ok',
      provider: 'openai',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    });

    expect(missing.statusCode).toBe(404);
    expect(missing.body).toEqual({
      status: 'not_found',
      error: 'provider_not_found',
      provider: 'missing',
      models: [],
    });
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import { listModels, setGatewayDeps } from '../../mcp/endpoints/health';
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

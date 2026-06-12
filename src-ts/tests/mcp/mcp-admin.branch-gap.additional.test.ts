import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import {
  deleteMcpService,
  probeMcpServiceHealth,
  setMcpServiceEnabled,
  setMcpServiceState,
  updateMcpService,
} from '../../mcp/endpoints/mcp-admin';
import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  type McpServiceConfig,
} from '../../mcp/service-config';

const BASE_CONFIGS = structuredClone(MCP_SERVICE_CONFIGS);
const BASE_HEALTH = { ...MCP_SERVICE_HEALTH_CACHE };

let runtimeConfigs: Map<string, McpServiceConfig>;
let runtimeHealth: Map<string, string>;

function restoreSharedRegistry(): void {
  for (const key of Object.keys(MCP_SERVICE_CONFIGS)) {
    delete MCP_SERVICE_CONFIGS[key];
  }
  Object.assign(MCP_SERVICE_CONFIGS, structuredClone(BASE_CONFIGS));

  for (const key of Object.keys(MCP_SERVICE_HEALTH_CACHE)) {
    delete MCP_SERVICE_HEALTH_CACHE[key];
  }
  Object.assign(MCP_SERVICE_HEALTH_CACHE, { ...BASE_HEALTH });
}

function seedRuntimeState(): void {
  runtimeConfigs = new Map(
    Object.entries(MCP_SERVICE_CONFIGS).map(([serviceId, config]) => [serviceId, { ...config }]),
  );
  runtimeHealth = new Map(Object.entries(MCP_SERVICE_HEALTH_CACHE));
  setMcpServiceState(runtimeConfigs, runtimeHealth);
}

function makeRequest(
  options?: Partial<HttpRequest> & {
    body?: Record<string, unknown>;
    query?: Record<string, string>;
    params?: Record<string, string>;
  },
): HttpRequest {
  return {
    method: options?.method ?? 'POST',
    url: options?.url ?? '/admin/mcp/services',
    headers: options?.headers ?? {},
    body: options?.body ?? {},
    query: options?.query ?? {},
    params: options?.params ?? {},
  };
}

beforeEach(() => {
  restoreSharedRegistry();
  seedRuntimeState();
});

afterEach(() => {
  restoreSharedRegistry();
});

describe('mcp admin endpoints branch-gap coverage', () => {
  it('returns parameter validation errors when service ids are missing', async () => {
    const updateResponse = await updateMcpService(makeRequest({
      params: {},
      body: { name: 'ignored' },
    }));
    const deleteMissingResponse = await deleteMcpService(makeRequest({
      method: 'DELETE',
      params: {},
    }));
    const deleteResponse = await deleteMcpService(makeRequest({
      method: 'DELETE',
      params: { service_id: '   ' },
    }));
    const enabledResponse = await setMcpServiceEnabled(makeRequest({
      params: {},
      body: { enabled: true },
    }));
    const probeResponse = await probeMcpServiceHealth(makeRequest({
      params: {},
    }));

    expect(updateResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'service_id is required' },
    });
    expect(deleteMissingResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'service_id is required' },
    });
    expect(deleteResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'service_id is required' },
    });
    expect(enabledResponse).toMatchObject({
      statusCode: 400,
      body: { error: 'service_id is required' },
    });
    expect(probeResponse).toMatchObject({
      statusCode: 404,
      body: { error: "service '' not found" },
    });
  });

  it('reports ok status when probing enabled services', async () => {
    const response = await probeMcpServiceHealth(makeRequest({
      params: { service_id: 'memory' },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      service: expect.objectContaining({
        id: 'memory',
        enabled: true,
        status: 'ok',
      }),
    });
    expect(runtimeHealth.get('memory')).toBe('ok');
    expect(MCP_SERVICE_HEALTH_CACHE['memory']).toBe('ok');
  });
});

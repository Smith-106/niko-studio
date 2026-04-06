import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import {
  createMcpService,
  deleteMcpService,
  listMcpServices,
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

describe('mcp admin endpoints', () => {
  it('lists seeded builtin services with shared metadata and runtime status', async () => {
    runtimeHealth.set('skills', 'ok');

    const response = await listMcpServices(
      makeRequest({
        method: 'GET',
        url: '/admin/mcp/services',
      }),
    );

    expect(response.statusCode).toBe(200);
    const services = (response.body as { services: Record<string, unknown>[] }).services;
    expect(services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skills',
          name: 'Skills',
          path: '/skills',
          enabled: true,
          builtin: true,
          transport: 'streamable-http',
          health_url: null,
          status: 'ok',
        }),
      ]),
    );
  });

  it('creates a custom service with normalized shared config fields', async () => {
    const response = await createMcpService(
      makeRequest({
        body: {
          id: 'orchestration-admin',
          name: 'Langflow Admin',
          path: 'custom/orchestration',
          enabled: false,
          health_url: 'https://example.test/health',
          transport: 'sse',
        },
      }),
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      service: expect.objectContaining({
        id: 'orchestration-admin',
        name: 'Langflow Admin',
        path: '/custom/orchestration',
        enabled: false,
        builtin: false,
        transport: 'sse',
        health_url: 'https://example.test/health',
        status: 'disabled',
      }),
    });
    expect(runtimeConfigs.get('orchestration-admin')).toMatchObject({
      serviceId: 'orchestration-admin',
      path: '/custom/orchestration',
      enabled: false,
      transport: 'sse',
    });
  });

  it('rejects builtin path rewrites through the shared config rules', async () => {
    const response = await updateMcpService(
      makeRequest({
        params: { service_id: 'memory' },
        body: { path: '/memory-v2' },
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'builtin service path is immutable' });
  });

  it('updates runtime state for health probes and custom service deletion', async () => {
    await createMcpService(
      makeRequest({
        body: {
          id: 'shadow-admin',
          name: 'Shadow Admin',
          path: '/shadow-admin',
        },
      }),
    );

    const disableResponse = await setMcpServiceEnabled(
      makeRequest({
        params: { service_id: 'shadow-admin' },
        body: { enabled: false },
      }),
    );
    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.body).toEqual({
      service: expect.objectContaining({
        id: 'shadow-admin',
        enabled: false,
        status: 'disabled',
      }),
    });

    const probeResponse = await probeMcpServiceHealth(
      makeRequest({
        params: { service_id: 'shadow-admin' },
      }),
    );
    expect(probeResponse.statusCode).toBe(200);
    expect(probeResponse.body).toEqual({
      service: expect.objectContaining({
        id: 'shadow-admin',
        enabled: false,
        status: 'disabled',
        path: '/shadow-admin',
      }),
    });
    expect((probeResponse.body as { service: { checked_at: string } }).service.checked_at).toEqual(
      expect.any(String),
    );

    const deleteResponse = await deleteMcpService(
      makeRequest({
        method: 'DELETE',
        params: { service_id: 'shadow-admin' },
      }),
    );
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body).toEqual({ status: 'deleted', service_id: 'shadow-admin' });
    expect(runtimeConfigs.has('shadow-admin')).toBe(false);
    expect(MCP_SERVICE_CONFIGS['shadow-admin']).toBeUndefined();
    expect(MCP_SERVICE_HEALTH_CACHE['shadow-admin']).toBeUndefined();
  });
});

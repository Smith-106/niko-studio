import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';
import {
  createMcpService,
  deleteMcpService,
  listMcpServices,
  probeMcpServiceHealth,
  setMcpServiceEnabled,
  setMcpServiceState,
  updateMcpService,
} from '../../mcp/endpoints/mcp-admin.js';
import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  type McpServiceConfig,
} from '../../mcp/service-config.js';

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

describe('mcp admin endpoints additional coverage', () => {
  it('parses runtime status overrides and ignores malformed query tokens', async () => {
    runtimeHealth.set('skills', 'unknown');
    runtimeHealth.set('agent', 'unknown');

    const response = await listMcpServices(makeRequest({
      method: 'GET',
      query: {
        services: 'skills:ok,malformed-entry,agent:error',
      },
    }));

    expect(response.statusCode).toBe(200);
    const services = (response.body as { services: Array<Record<string, unknown>> }).services;
    expect(services).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'skills', status: 'ok' }),
      expect.objectContaining({ id: 'agent', status: 'error' }),
    ]));
  });

  it('validates service creation payloads and shared transport rules', async () => {
    const missingId = await createMcpService(makeRequest({ body: {} }));
    expect(missingId.statusCode).toBe(400);
    expect(missingId.body).toEqual({ error: 'id is required' });

    const duplicate = await createMcpService(makeRequest({
      body: { id: 'skills', name: 'Duplicate Skills' },
    }));
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toEqual({ error: "service 'skills' already exists" });

    const invalidTransport = await createMcpService(makeRequest({
      body: {
        id: 'bad-transport',
        name: 'Bad Transport',
        path: '/bad-transport',
        transport: 'websocket',
      },
    }));
    expect(invalidTransport.statusCode).toBe(400);
    expect(invalidTransport.body).toEqual({
      error: 'Invalid transport "websocket". Must be one of: streamable-http, stdio, sse',
    });
  });

  it('validates update requests for missing ids, unknown services, and shared rule failures', async () => {
    const missingId = await updateMcpService(makeRequest({
      params: { service_id: '   ' },
      body: {},
    }));
    expect(missingId.statusCode).toBe(400);
    expect(missingId.body).toEqual({ error: 'service_id is required' });

    const missingService = await updateMcpService(makeRequest({
      params: { service_id: 'ghost' },
      body: { name: 'Ghost' },
    }));
    expect(missingService.statusCode).toBe(404);
    expect(missingService.body).toEqual({ error: 'Unknown service: ghost' });

    const builtinDowngrade = await updateMcpService(makeRequest({
      params: { service_id: 'memory' },
      body: { builtin: false },
    }));
    expect(builtinDowngrade.statusCode).toBe(400);
    expect(builtinDowngrade.body).toEqual({ error: 'builtin service cannot be downgraded' });

    await createMcpService(makeRequest({
      body: {
        id: 'custom-admin',
        name: 'Custom Admin',
        path: '/custom-admin',
      },
    }));

    const invalidTransport = await updateMcpService(makeRequest({
      params: { service_id: 'custom-admin' },
      body: { transport: 'websocket' },
    }));
    expect(invalidTransport.statusCode).toBe(400);
    expect(invalidTransport.body).toEqual({
      error: 'Invalid transport "websocket". Must be one of: streamable-http, stdio, sse',
    });
  });

  it('updates a custom service through the success path and returns serialized runtime state', async () => {
    await createMcpService(makeRequest({
      body: {
        id: 'custom-update',
        name: 'Custom Update',
        path: '/custom-update',
      },
    }));

    const response = await updateMcpService(makeRequest({
      params: { service_id: 'custom-update' },
      body: {
        name: 'Custom Update Renamed',
        health_url: 'https://example.test/custom-update/health',
        transport: 'sse',
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      service: expect.objectContaining({
        id: 'custom-update',
        name: 'Custom Update Renamed',
        path: '/custom-update',
        health_url: 'https://example.test/custom-update/health',
        transport: 'sse',
      }),
    });
    expect(runtimeConfigs.get('custom-update')).toMatchObject({
      name: 'Custom Update Renamed',
      healthUrl: 'https://example.test/custom-update/health',
      transport: 'sse',
    });
  });

  it('validates delete, enable, and probe error branches', async () => {
    const missingDeleteId = await deleteMcpService(makeRequest({
      method: 'DELETE',
      params: { service_id: '   ' },
    }));
    expect(missingDeleteId.statusCode).toBe(400);
    expect(missingDeleteId.body).toEqual({ error: 'service_id is required' });

    const unknownDelete = await deleteMcpService(makeRequest({
      method: 'DELETE',
      params: { service_id: 'ghost' },
    }));
    expect(unknownDelete.statusCode).toBe(404);
    expect(unknownDelete.body).toEqual({ error: "service 'ghost' not found" });

    const builtinDelete = await deleteMcpService(makeRequest({
      method: 'DELETE',
      params: { service_id: 'memory' },
    }));
    expect(builtinDelete.statusCode).toBe(400);
    expect(builtinDelete.body).toEqual({ error: 'cannot delete builtin service' });

    const missingEnableId = await setMcpServiceEnabled(makeRequest({
      params: { service_id: '   ' },
      body: { enabled: true },
    }));
    expect(missingEnableId.statusCode).toBe(400);
    expect(missingEnableId.body).toEqual({ error: 'service_id is required' });

    const invalidEnabled = await setMcpServiceEnabled(makeRequest({
      params: { service_id: 'skills' },
      body: { enabled: 'yes' as unknown as boolean },
    }));
    expect(invalidEnabled.statusCode).toBe(400);
    expect(invalidEnabled.body).toEqual({ error: 'enabled must be boolean' });

    const unknownEnable = await setMcpServiceEnabled(makeRequest({
      params: { service_id: 'ghost' },
      body: { enabled: true },
    }));
    expect(unknownEnable.statusCode).toBe(404);
    expect(unknownEnable.body).toEqual({ error: 'Unknown service: ghost' });

    const builtinDisable = await setMcpServiceEnabled(makeRequest({
      params: { service_id: 'skills' },
      body: { enabled: false },
    }));
    expect(builtinDisable.statusCode).toBe(400);
    expect(builtinDisable.body).toEqual({ error: 'builtin service cannot be disabled' });

    const missingProbe = await probeMcpServiceHealth(makeRequest({
      params: { service_id: 'ghost' },
    }));
    expect(missingProbe.statusCode).toBe(404);
    expect(missingProbe.body).toEqual({ error: "service 'ghost' not found" });
  });
});

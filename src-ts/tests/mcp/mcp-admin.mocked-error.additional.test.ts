import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const updateSharedServiceConfigMock = vi.hoisted(() =>
  vi.fn((serviceId: string, body: Record<string, unknown>) => {
    if (body['failString']) throw 'plain failure';
    return {
      serviceId,
      name: String(body.name ?? serviceId),
      path: '/plain',
      enabled: true,
      builtin: false,
      healthUrl: null,
      transport: 'streamable-http',
    };
  }),
);

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/admin/mcp/services',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function loadMockedAdminModule() {
  vi.resetModules();
  updateSharedServiceConfigMock.mockClear();

  vi.doMock('../../mcp/service-config.js', () => ({
    MCP_SERVICE_CONFIGS: {},
    MCP_SERVICE_HEALTH_CACHE: {},
    serializeServiceConfig: (
      config: {
        serviceId: string;
        name: string;
        path: string;
        enabled: boolean;
        builtin: boolean;
        healthUrl: string | null;
        transport: string;
      },
      services?: Record<string, string>,
    ) => ({
      id: config.serviceId,
      name: config.name,
      path: config.path,
      enabled: config.enabled,
      builtin: config.builtin,
      transport: config.transport,
      health_url: config.healthUrl,
      status: services?.[config.serviceId] ?? 'unknown',
    }),
    setServiceEnabled: vi.fn(),
    updateServiceConfig: updateSharedServiceConfigMock,
  }));

  return import('../../mcp/endpoints/mcp-admin.js');
}

describe('mcp admin mocked error coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to unknown runtime status when shared health cache has no entry', async () => {
    const { createMcpService } = await loadMockedAdminModule();
    const response = await createMcpService(makeRequest({
      id: 'plain-service',
      name: 'Plain Service',
    }));

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      service: expect.objectContaining({
        id: 'plain-service',
        status: 'unknown',
      }),
    });
  });

  it('stringifies non-Error exceptions from shared config updates', async () => {
    const { createMcpService } = await loadMockedAdminModule();
    const response = await createMcpService(makeRequest({
      id: 'broken-service',
      failString: true,
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'plain failure' });
  });
});

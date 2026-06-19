import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unmock('../../mcp/service-config.js');
});

describe('mcp/runtime branch-gap coverage', () => {
  it('uses unknown fallbacks for missing core service statuses', async () => {
    vi.resetModules();
    const runtime = await import('../../mcp/runtime.js');

    expect(
      runtime.toRuntimeConnectionState('offline', {
        memory: 'error',
      }),
    ).toBe('disconnected');
    expect(runtime.serviceIsReady('memory', {})).toBe(false);
  });

  it('treats disabled configured services as not ready even when status is ok', async () => {
    vi.resetModules();
    vi.doMock('../../mcp/service-config.js', () => ({
      MCP_SERVICE_CONFIGS: {
        memory: { enabled: false },
      },
      RUNTIME_SERVER_ORDER: ['memory'],
      serviceRuntimeStatus: (serviceId: string, services: Record<string, string>) => (
        services[serviceId] ?? 'unknown'
      ),
    }));

    const runtime = await import('../../mcp/runtime.js');

    expect(runtime.serviceIsReady('memory', { memory: 'ok' })).toBe(false);
    expect(runtime.getObservabilitySnapshot({ memory: 'ok' }, {})).toEqual({
      runtime: {
        ready: 0,
        total: 1,
        health_ratio: 0,
      },
      layers: {
        status: {
          memory: 'ok',
          retrieval: 'unknown',
          workflow: 'unknown',
        },
        health: {
          memory: {},
          retrieval: {},
          workflow: {},
        },
      },
    });
  });

  it('defaults enabled to true for runtime servers missing config entries', async () => {
    vi.resetModules();
    vi.doMock('../../mcp/service-config.js', () => ({
      MCP_SERVICE_CONFIGS: {
        memory: { enabled: true },
      },
      RUNTIME_SERVER_ORDER: ['memory', 'adhoc'],
      serviceRuntimeStatus: (serviceId: string, services: Record<string, string>) => (
        services[serviceId] ?? 'unknown'
      ),
    }));

    const runtime = await import('../../mcp/runtime.js');

    expect(
      runtime.buildRuntimeServers(
        {},
        'disconnected',
        'socket closed',
      ),
    ).toEqual({
      memory: {
        state: 'disconnected',
        loading: false,
        lastError: 'socket closed',
        enabled: true,
      },
      adhoc: {
        state: 'disconnected',
        loading: false,
        lastError: 'socket closed',
        enabled: true,
      },
    });
  });
});

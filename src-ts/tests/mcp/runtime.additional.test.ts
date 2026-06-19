import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unmock('../../mcp/service-config.js');
});

describe('mcp/runtime additional coverage', () => {
  it('covers degraded and disconnected runtime state branches', async () => {
    vi.resetModules();
    const runtime = await import('../../mcp/runtime.js');

    expect(
      runtime.toRuntimeConnectionState('degraded', {
        memory: 'error',
        graph: 'error',
        search: 'ok',
        workflow: 'error',
        critic: 'error',
      }),
    ).toBe('degraded');
    expect(
      runtime.toRuntimeConnectionState('offline', {
        memory: 'error',
        graph: 'error',
        search: 'error',
        workflow: 'error',
        critic: 'error',
      }),
    ).toBe('disconnected');

    expect(runtime.toRuntimeReconnectState('degraded')).toBe('probing');
    expect(runtime.toRuntimeReconnectState('offline')).toBe('failed');

    expect(runtime.toServerRuntimeState('error', 'degraded')).toBe('degraded');
    expect(runtime.toServerRuntimeState('error', 'disconnected')).toBe('disconnected');
    expect(runtime.toServerRuntimeState('error', 'probing')).toBe('reconnecting');
  });

  it('returns a zero health ratio when no runtime servers are configured', async () => {
    vi.resetModules();
    vi.doMock('../../mcp/service-config.js', () => ({
      MCP_SERVICE_CONFIGS: {},
      RUNTIME_SERVER_ORDER: [],
      serviceRuntimeStatus: () => 'unknown',
    }));

    const runtime = await import('../../mcp/runtime.js');

    expect(runtime.getObservabilitySnapshot({}, {})).toEqual({
      runtime: {
        ready: 0,
        total: 0,
        health_ratio: 0,
      },
      layers: {
        status: {
          memory: 'unknown',
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

  it('builds per-service runtime entries with disabled and degraded error handling', async () => {
    vi.resetModules();
    vi.doMock('../../mcp/service-config.js', () => ({
      MCP_SERVICE_CONFIGS: {
        memory: { enabled: true },
        search: { enabled: false },
      },
      RUNTIME_SERVER_ORDER: ['memory', 'search'],
      serviceRuntimeStatus: (serviceId: string, services: Record<string, string>) => {
        if (serviceId === 'search') {
          return 'disabled';
        }
        return services[serviceId] ?? 'unknown';
      },
    }));

    const runtime = await import('../../mcp/runtime.js');
    expect(
      runtime.buildRuntimeServers(
        { memory: 'error' },
        'degraded',
        'network timeout',
      ),
    ).toEqual({
      memory: {
        state: 'degraded',
        loading: false,
        lastError: 'network timeout',
        enabled: true,
      },
      search: {
        state: 'degraded',
        loading: false,
        lastError: null,
        enabled: false,
      },
    });
  });
});

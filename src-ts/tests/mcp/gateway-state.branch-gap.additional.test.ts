import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetConfig = vi.fn();
const mockGetConfigValue = vi.fn();
const mockSetConfigValue = vi.fn();
const mockConfigManagerReload = vi.fn();
const mockLoadServicesConfig = vi.fn();
const mockGetMetricsSnapshot = vi.fn();
const mockUtcNowIso = vi.fn();
const mockSerializeServiceConfig = vi.fn();

vi.mock('../../config', () => ({
  ConfigManager: {
    getInstance: () => ({ reload: mockConfigManagerReload }),
  },
  getConfig: mockGetConfig,
  getConfigValue: mockGetConfigValue,
  setConfigValue: mockSetConfigValue,
}));

vi.mock('../../knowledge/config', () => ({
  loadConfig: mockLoadServicesConfig,
}));

vi.mock('../../mcp/endpoints/config', () => ({
  setConfigAccess: vi.fn(),
}));

vi.mock('../../mcp/endpoints/health', () => ({
  setGatewayDeps: vi.fn(),
  GatewayRuntimeTracker: class {
    lastProbeAt: string | null = null;
    reconnectAttempts = 0;
    lastError: string | null = null;
  },
}));

vi.mock('../../mcp/metrics', () => ({
  getMetricsSnapshot: mockGetMetricsSnapshot,
  utcNowIso: mockUtcNowIso,
}));

vi.mock('../../mcp/runtime', () => ({
  RUNTIME_SESSION_ID: 'test-session-id',
  buildRuntimeServers: vi.fn(() => []),
  getObservabilitySnapshot: vi.fn(() => ({})),
  toRuntimeConnectionState: vi.fn(() => 'connected'),
  toRuntimeReconnectState: vi.fn(() => 'idle'),
}));

vi.mock('../../mcp/service-config', () => ({
  MCP_SERVICE_CONFIGS: {
    memory: { serviceId: 'memory', name: 'Memory', path: '/memory', enabled: true, builtin: true, healthUrl: null, transport: 'streamable-http' },
    graph: { serviceId: 'graph', name: 'Graph', path: '/graph', enabled: true, builtin: true, healthUrl: null, transport: 'streamable-http' },
  },
  MCP_SERVICE_HEALTH_CACHE: { memory: 'unknown', graph: 'unknown' },
  RUNTIME_SERVER_ORDER: ['memory', 'graph'],
  refreshServiceHealthCache: vi.fn(),
  serializeServiceConfig: mockSerializeServiceConfig,
  serviceRuntimeStatus: vi.fn((serviceId: string, services?: Record<string, string>) => services?.[serviceId] ?? 'unknown'),
}));

describe('mcp/gateway-state branch gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ version: '2.0.0' });
    mockGetConfigValue.mockReturnValue(undefined);
    mockGetMetricsSnapshot.mockReturnValue({});
    mockUtcNowIso.mockReturnValue('2026-04-21T00:00:00.000Z');
    mockSerializeServiceConfig.mockImplementation((config: { serviceId: string }) => ({
      id: config.serviceId,
      delegated: true,
    }));
  });

  it('invokes the optional reload callback when config access reloads', async () => {
    const { buildConfigAccess } = await import('../../mcp/gateway-state');
    const onReload = vi.fn();

    buildConfigAccess(onReload).reloadConfig();

    expect(mockConfigManagerReload).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('defaults the gateway version when config.version is missing', async () => {
    mockGetConfig.mockReturnValue({});
    const { buildGatewayDeps } = await import('../../mcp/gateway-state');

    const deps = buildGatewayDeps({} as never);

    expect(deps.version).toBe('1.0.0');
  });

  it('delegates known shared service configs through the shared serializer', async () => {
    const { buildGatewayDeps } = await import('../../mcp/gateway-state');
    const deps = buildGatewayDeps({} as never);

    expect(
      deps.serializeServiceConfig(
        { serviceId: ' memory ' },
        null,
      ),
    ).toEqual({
      id: 'memory',
      delegated: true,
    });
    expect(mockSerializeServiceConfig).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'memory' }),
      undefined,
    );
  });

  it('converts nested array config values to snake_case recursively', async () => {
    mockGetConfig.mockReturnValue({
      version: '2.0.0',
      promptTemplates: [
        { templateName: 'alphaTemplate', nestedValue: { maxTokens: 42 } },
      ],
    });
    const { buildConfigAccess } = await import('../../mcp/gateway-state');

    const config = buildConfigAccess().getConfig();

    expect(config).toEqual({
      version: '2.0.0',
      prompt_templates: [
        { template_name: 'alphaTemplate', nested_value: { max_tokens: 42 } },
      ],
    });
  });

  it('fills fallback fields for unknown services that use serviceId and omit optionals', async () => {
    const { buildGatewayDeps } = await import('../../mcp/gateway-state');
    const deps = buildGatewayDeps({} as never);

    expect(
      deps.serializeServiceConfig({
        serviceId: ' scratch ',
      }),
    ).toEqual({
      id: 'scratch',
      name: 'scratch',
      path: '/scratch',
      enabled: true,
      builtin: false,
      transport: 'streamable-http',
      health_url: null,
      status: 'unknown',
    });
  });

  it('returns a fully default fallback object when config is nullish', async () => {
    const { buildGatewayDeps } = await import('../../mcp/gateway-state');
    const deps = buildGatewayDeps({} as never);

    expect(
      deps.serializeServiceConfig(null),
    ).toEqual({
      id: '',
      name: '',
      path: '/',
      enabled: true,
      builtin: false,
      transport: 'streamable-http',
      health_url: null,
      status: 'unknown',
    });
  });

  it('resolves search, workflow, and critic engines from the container', async () => {
    const { buildGatewayDeps } = await import('../../mcp/gateway-state');
    const search = { healthCheck: vi.fn() };
    const workflow = { healthCheck: vi.fn() };
    const critic = { healthCheck: vi.fn() };
    const deps = buildGatewayDeps({
      search,
      workflow,
      critic,
    } as never);

    expect(deps.getEngine('search')).toBe(search);
    expect(deps.getEngine('workflow')).toBe(workflow);
    expect(deps.getEngine('critic')).toBe(critic);
  });
});

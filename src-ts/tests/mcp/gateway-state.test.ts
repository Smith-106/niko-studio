import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all heavy dependencies before importing gateway-state
const mockGetConfig = vi.fn();
const mockGetConfigValue = vi.fn();
const mockSetConfigValue = vi.fn();
const mockConfigManagerReload = vi.fn();
const mockLoadServicesConfig = vi.fn();
const mockGetMetricsSnapshot = vi.fn();
const mockUtcNowIso = vi.fn();

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
  serializeServiceConfig: vi.fn(() => ({ id: 'memory', name: 'Memory', path: '/memory', enabled: true, builtin: true, transport: 'streamable-http', health_url: null, status: 'unknown' })),
  serviceRuntimeStatus: vi.fn((_, services) => services[_] ?? 'unknown'),
}));

describe('gateway-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockReturnValue({ version: '2.0.0' });
    mockGetConfigValue.mockReturnValue(undefined);
    mockGetMetricsSnapshot.mockReturnValue({});
    mockUtcNowIso.mockReturnValue('2026-04-21T00:00:00.000Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createMcpServiceConfigMap', () => {
    it('creates a Map copy of MCP service configs', async () => {
      const { createMcpServiceConfigMap } = await import('../../mcp/gateway-state');
      const map = createMcpServiceConfigMap();

      expect(map).toBeInstanceOf(Map);
      expect(map.get('memory')).toBeDefined();
      expect(map.get('graph')).toBeDefined();
      expect(map.get('memory')!.serviceId).toBe('memory');
    });

    it('returns independent copies on each call', async () => {
      const { createMcpServiceConfigMap } = await import('../../mcp/gateway-state');
      const map1 = createMcpServiceConfigMap();
      const map2 = createMcpServiceConfigMap();

      map1.set('memory', { ...map1.get('memory')!, name: 'Modified' });
      expect(map2.get('memory')!.name).toBe('Memory');
    });
  });

  describe('createHealthCacheMap', () => {
    it('creates a Map copy of health cache entries', async () => {
      const { createHealthCacheMap } = await import('../../mcp/gateway-state');
      const map = createHealthCacheMap();

      expect(map).toBeInstanceOf(Map);
      expect(map.get('memory')).toBe('unknown');
      expect(map.get('graph')).toBe('unknown');
    });
  });

  describe('createGatewayRuntimeState', () => {
    it('returns state with mcpConfigs and healthCache', async () => {
      const { createGatewayRuntimeState } = await import('../../mcp/gateway-state');
      const state = createGatewayRuntimeState();

      expect(state.mcpConfigs).toBeInstanceOf(Map);
      expect(state.healthCache).toBeInstanceOf(Map);
      expect(state.mcpConfigs.size).toBeGreaterThan(0);
    });
  });

  describe('buildConfigAccess', () => {
    it('provides getConfig, getConfigValue, setConfigValue, and reloadConfig functions', async () => {
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();

      expect(typeof access.getConfig).toBe('function');
      expect(typeof access.getConfigValue).toBe('function');
      expect(typeof access.setConfigValue).toBe('function');
      expect(typeof access.reloadConfig).toBe('function');
    });

    it('getConfig returns the application config in snake_case format', async () => {
      mockGetConfig.mockReturnValue({ version: '2.0.0', gatewayHost: '0.0.0.0' });
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();
      const config = access.getConfig();

      expect(config).toEqual({ version: '2.0.0', gateway_host: '0.0.0.0' });
    });

    it('getConfigValue passes the key through mapConfigKeyToSharedKey', async () => {
      mockGetConfigValue.mockReturnValue('localhost');
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();

      // snake_case segments are converted to camelCase: gateway.host_port -> gateway.hostPort
      const value = access.getConfigValue('gateway.host');
      expect(mockGetConfigValue).toHaveBeenCalledWith('gateway.host');
      expect(value).toBe('localhost');
    });

    it('getConfigValue converts snake_case segments to camelCase', async () => {
      mockGetConfigValue.mockReturnValue(true);
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();

      access.getConfigValue('gateway.localhost_only');
      // localhost_only -> localhostOnly via snakeToCamelSegment
      expect(mockGetConfigValue).toHaveBeenCalledWith('gateway.localhostOnly');
    });

    it('setConfigValue passes the key through mapConfigKeyToSharedKey', async () => {
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();

      access.setConfigValue('gateway.host', 3000);
      expect(mockSetConfigValue).toHaveBeenCalledWith('gateway.host', 3000);
    });

    it('reloadConfig invokes ConfigManager reload', async () => {
      const { buildConfigAccess } = await import('../../mcp/gateway-state');
      const access = buildConfigAccess();

      access.reloadConfig();
      expect(mockConfigManagerReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildGatewayDeps', () => {
    it('returns a gateway deps object with version from config', async () => {
      const { buildGatewayDeps } = await import('../../mcp/gateway-state');
      const mockContainer = {} as unknown as import('../../container/ServiceContainer').ServiceContainer;
      const deps = buildGatewayDeps(mockContainer);

      expect(deps.version).toBe('2.0.0');
      expect(deps.runtimeSessionId).toBe('test-session-id');
      expect(typeof deps.getEngine).toBe('function');
      expect(typeof deps.loadServicesConfig).toBe('function');
    });

    it('getEngine returns null for unknown engine names', async () => {
      const { buildGatewayDeps } = await import('../../mcp/gateway-state');
      const mockContainer = {} as unknown as import('../../container/ServiceContainer').ServiceContainer;
      const deps = buildGatewayDeps(mockContainer);

      expect(deps.getEngine('nonexistent')).toBeNull();
    });

    it('getEngine resolves known engine names from the container', async () => {
      const { buildGatewayDeps } = await import('../../mcp/gateway-state');
      const mockMemory = { healthCheck: () => Promise.resolve({ ok: true }) };
      const mockContainer = {
        memory: mockMemory,
        graph: { healthCheck: () => Promise.resolve({ ok: true }) },
      } as unknown as import('../../container/ServiceContainer').ServiceContainer;
      const deps = buildGatewayDeps(mockContainer);

      expect(deps.getEngine('memory')).toBe(mockMemory);
      expect(deps.getEngine('graph')).toBeDefined();
    });

    it('refreshServiceHealthCache updates the healthCache map in state', async () => {
      const { buildGatewayDeps } = await import('../../mcp/gateway-state');
      const mockContainer = {} as unknown as import('../../container/ServiceContainer').ServiceContainer;
      const state = { healthCache: new Map<string, string>() };
      const deps = buildGatewayDeps(mockContainer, state);

      deps.refreshServiceHealthCache({ memory: 'ok', graph: 'error' });
      expect(state.healthCache.get('memory')).toBe('ok');
      expect(state.healthCache.get('graph')).toBe('error');
    });

    it('utcNowIso delegates to the metrics utility', async () => {
      mockUtcNowIso.mockReturnValue('2026-04-21T12:00:00.000Z');
      const { buildGatewayDeps } = await import('../../mcp/gateway-state');
      const mockContainer = {} as unknown as import('../../container/ServiceContainer').ServiceContainer;
      const deps = buildGatewayDeps(mockContainer);

      expect(deps.utcNowIso()).toBe('2026-04-21T12:00:00.000Z');
    });
  });
});

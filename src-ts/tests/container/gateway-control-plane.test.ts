import { afterEach, describe, expect, it, vi } from 'vitest';

const setGatewayDepsMock = vi.hoisted(() => vi.fn());
const setConfigAccessMock = vi.hoisted(() => vi.fn());
const setMcpServiceStateMock = vi.hoisted(() => vi.fn());
const setUiBridgeEnabledMock = vi.hoisted(() => vi.fn());
const setLlmAvailabilityProbeMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const buildGatewayDepsMock = vi.hoisted(() => vi.fn(() => ({ deps: true })));
const buildConfigAccessMock = vi.hoisted(() => vi.fn(() => ({
  getConfig: () => ({}),
  getConfigValue: () => undefined,
  setConfigValue: () => {},
  reloadConfig: () => {},
})));
const createGatewayRuntimeStateMock = vi.hoisted(() => vi.fn(() => ({
  mcpConfigs: new Map<string, unknown>(),
  healthCache: new Map<string, string>(),
})));

const defaultConfigManager = vi.hoisted(() => ({
  onChange: vi.fn(),
  offChange: vi.fn(),
}));

const configManagerRef = vi.hoisted(() => ({
  current: defaultConfigManager,
}));

const containerRef = vi.hoisted(() => ({
  current: { llm: { id: 'llm' }, workflow: null } as Record<string, unknown>,
}));

vi.mock('../../mcp/endpoints/health', () => ({
  setGatewayDeps: setGatewayDepsMock,
}));

vi.mock('../../mcp/endpoints/config', () => ({
  setConfigAccess: setConfigAccessMock,
}));

vi.mock('../../mcp/endpoints/mcp-admin', () => ({
  setMcpServiceState: setMcpServiceStateMock,
}));

vi.mock('../../mcp/endpoints/workflow', () => ({
  setUiBridgeEnabled: setUiBridgeEnabledMock,
}));

vi.mock('../../mcp/config', () => ({
  resolveUiBridgeEnabled: () => true,
  setLlmAvailabilityProbe: setLlmAvailabilityProbeMock,
}));

vi.mock('../../mcp/gateway-state', () => ({
  buildGatewayDeps: buildGatewayDepsMock,
  buildConfigAccess: buildConfigAccessMock,
  createGatewayRuntimeState: createGatewayRuntimeStateMock,
}));

vi.mock('../../container/ServiceContainer', () => ({
  getContainer: () => containerRef.current,
  ServiceContainer: class ServiceContainer {},
}));

vi.mock('../../container/workflow-runtime-provider', () => ({
  setWorkflowEngineRuntimeProvider: vi.fn(),
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    info: logInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../config', () => ({
  ConfigManager: {
    getInstance: () => configManagerRef.current,
  },
}));

describe('gateway-control-plane', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    containerRef.current = { llm: { id: 'llm' }, workflow: null };
    configManagerRef.current = defaultConfigManager;
  });

  it('initializes with explicit reload and llm probe hooks', async () => {
    const { initializeGatewayControlPlane } = await import('../../container/gateway-control-plane');
    const runtimeContainer = { llm: { id: 'llm' }, workflow: null } as Record<string, unknown>;

    initializeGatewayControlPlane(runtimeContainer as never);

    expect(buildGatewayDepsMock).toHaveBeenCalledTimes(1);
    expect(setGatewayDepsMock).toHaveBeenCalledTimes(1);
    expect(setConfigAccessMock).toHaveBeenCalledTimes(1);
    expect(setMcpServiceStateMock).toHaveBeenCalledTimes(1);
    expect(buildConfigAccessMock).toHaveBeenCalledTimes(1);

    const onReload = buildConfigAccessMock.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(typeof onReload).toBe('function');

    onReload?.();
    expect(setUiBridgeEnabledMock).toHaveBeenCalledWith(true);

    expect(setLlmAvailabilityProbeMock).toHaveBeenCalledTimes(1);
    const probe = setLlmAvailabilityProbeMock.mock.calls[0]?.[0] as (() => boolean) | undefined;
    expect(typeof probe).toBe('function');
    expect(probe?.()).toBe(true);

    runtimeContainer.llm = null;
    expect(probe?.()).toBe(false);

    expect(defaultConfigManager.onChange).toHaveBeenCalledTimes(1);
    expect(defaultConfigManager.offChange).toHaveBeenCalledTimes(0);
  });

  it('rebinds config listeners when manager instance changes', async () => {
    const firstManager = {
      onChange: vi.fn(),
      offChange: vi.fn(),
    };
    const secondManager = {
      onChange: vi.fn(),
      offChange: vi.fn(),
    };

    configManagerRef.current = firstManager;

    const { initializeGatewayControlPlane } = await import('../../container/gateway-control-plane');

    initializeGatewayControlPlane(containerRef.current as never);

    configManagerRef.current = secondManager;
    initializeGatewayControlPlane(containerRef.current as never);

    expect(firstManager.onChange).toHaveBeenCalledTimes(1);
    expect(firstManager.offChange).toHaveBeenCalledTimes(1);
    expect(secondManager.onChange).toHaveBeenCalledTimes(1);
  });

  it('exposes the compatibility shutdown helper', async () => {
    const { shutdownGatewayControlPlane } = await import('../../container/gateway-control-plane');

    await shutdownGatewayControlPlane();

    expect(logInfoMock).toHaveBeenCalledWith('Control plane shutdown complete');
  });
});

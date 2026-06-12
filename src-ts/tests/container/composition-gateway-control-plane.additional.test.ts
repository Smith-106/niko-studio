import { afterEach, describe, expect, it, vi } from 'vitest';

const setConfigAccessMock = vi.hoisted(() => vi.fn());
const setGatewayDepsMock = vi.hoisted(() => vi.fn());
const setMcpServiceStateMock = vi.hoisted(() => vi.fn());
const setUiBridgeEnabledMock = vi.hoisted(() => vi.fn());
const setLlmAvailabilityProbeMock = vi.hoisted(() => vi.fn());
const buildConfigAccessMock = vi.hoisted(() => vi.fn(() => ({ id: 'config-access' })));
const buildGatewayDepsMock = vi.hoisted(() => vi.fn(() => ({ id: 'gateway-deps' })));
const createGatewayRuntimeStateMock = vi.hoisted(() => vi.fn(() => ({
  mcpConfigs: new Map([['memory', { enabled: true }]]),
  healthCache: new Map([['memory', 'ok']]),
})));
const setWorkflowEngineRuntimeProviderMock = vi.hoisted(() => vi.fn());
const setDefaultVectorSearchMock = vi.hoisted(() => vi.fn());
const resolveUiBridgeEnabledMock = vi.hoisted(() => vi.fn(() => true));
const logWarnMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

const defaultConfigManager = vi.hoisted(() => ({
  onChange: vi.fn(),
  offChange: vi.fn(),
}));

const configManagerRef = vi.hoisted(() => ({
  current: defaultConfigManager,
}));

const containerRef = vi.hoisted(() => ({
  current: {
    llm: { id: 'llm' },
    workflow: null,
    vectorSearch: null,
    initializeAll: vi.fn(),
  } as Record<string, unknown>,
}));

vi.mock('../../config', () => ({
  ConfigManager: {
    getInstance: () => configManagerRef.current,
  },
}));

vi.mock('../../graph/graph-manager', () => ({
  GraphManager: {
    setDefaultVectorSearch: setDefaultVectorSearchMock,
  },
}));

vi.mock('../../mcp/endpoints/config', () => ({
  setConfigAccess: setConfigAccessMock,
}));

vi.mock('../../mcp/config', () => ({
  resolveUiBridgeEnabled: resolveUiBridgeEnabledMock,
  setLlmAvailabilityProbe: setLlmAvailabilityProbeMock,
}));

vi.mock('../../mcp/endpoints/health', () => ({
  setGatewayDeps: setGatewayDepsMock,
}));

vi.mock('../../mcp/endpoints/mcp-admin', () => ({
  setMcpServiceState: setMcpServiceStateMock,
}));

vi.mock('../../mcp/endpoints/workflow', () => ({
  setUiBridgeEnabled: setUiBridgeEnabledMock,
}));

vi.mock('../../mcp/gateway-state', () => ({
  buildConfigAccess: buildConfigAccessMock,
  buildGatewayDeps: buildGatewayDepsMock,
  createGatewayRuntimeState: createGatewayRuntimeStateMock,
}));

vi.mock('../../container/ServiceContainer', () => ({
  getContainer: () => containerRef.current,
  ServiceContainer: class ServiceContainer {},
}));

vi.mock('../../container/workflow-runtime-provider', () => ({
  setWorkflowEngineRuntimeProvider: setWorkflowEngineRuntimeProviderMock,
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    warn: logWarnMock,
    error: logErrorMock,
  }),
}));

describe('composition-root/gateway-control-plane additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    resolveUiBridgeEnabledMock.mockReturnValue(true);
    configManagerRef.current = defaultConfigManager;
    containerRef.current = {
      llm: { id: 'llm' },
      workflow: null,
      vectorSearch: null,
      initializeAll: vi.fn(),
    };
  });

  it('initializes runtime wiring with createRuntime workflow providers and vector search adapters', async () => {
    const createRuntime = vi.fn(({ workspace, sessionNamespace }) => ({
      workspace,
      sessionNamespace,
      source: 'factory',
    }));
    const vectorSearch = { add: vi.fn() };
    const container = {
      llm: { id: 'llm' },
      workflow: { createRuntime },
      vectorSearch,
      initializeAll: vi.fn(),
    };

    const { initializeGatewayControlPlane } = await import('../../composition-root/gateway-control-plane.js');
    const state = initializeGatewayControlPlane(container as never);

    expect(setWorkflowEngineRuntimeProviderMock).toHaveBeenCalledTimes(1);
    const provider = setWorkflowEngineRuntimeProviderMock.mock.calls[0]?.[0] as
      | ((args: { workspace: string; sessionNamespace: string }) => unknown)
      | undefined;
    expect(provider?.({ workspace: 'vault', sessionNamespace: 'session' })).toEqual({
      workspace: 'vault',
      sessionNamespace: 'session',
      source: 'factory',
    });
    expect(createRuntime).toHaveBeenCalledWith({
      workspace: 'vault',
      sessionNamespace: 'session',
    });

    expect(setDefaultVectorSearchMock).toHaveBeenCalledWith(vectorSearch);
    expect(buildGatewayDepsMock).toHaveBeenCalledWith(
      container,
      expect.objectContaining({
        mcpConfigs: expect.any(Map),
        healthCache: expect.any(Map),
      }),
    );
    expect(buildConfigAccessMock).toHaveBeenCalledTimes(1);
    expect(setConfigAccessMock).toHaveBeenCalledWith({ id: 'config-access' });
    expect(setGatewayDepsMock).toHaveBeenCalledWith({ id: 'gateway-deps' });
    expect(setMcpServiceStateMock).toHaveBeenCalledWith(state.mcpConfigs, state.healthCache);
    expect(setUiBridgeEnabledMock).toHaveBeenCalledWith(true);
    expect(defaultConfigManager.onChange).toHaveBeenCalledTimes(1);

    const probe = setLlmAvailabilityProbeMock.mock.calls[0]?.[0] as (() => boolean) | undefined;
    expect(probe?.()).toBe(true);
    container.llm = null;
    expect(probe?.()).toBe(false);
    expect(state.container).toBe(container);
  });

  it('falls back to workflow objects directly and clears vector search when unavailable', async () => {
    const workflowRuntime = { kind: 'runtime-object' };
    const container = {
      llm: null,
      workflow: workflowRuntime,
      vectorSearch: { ping: vi.fn() },
      initializeAll: vi.fn(),
    };

    const { initializeGatewayControlPlane } = await import('../../composition-root/gateway-control-plane.js');
    initializeGatewayControlPlane(container as never);

    const provider = setWorkflowEngineRuntimeProviderMock.mock.calls[0]?.[0] as
      | ((args: { workspace: string; sessionNamespace: string }) => unknown)
      | undefined;
    expect(provider?.({ workspace: 'vault', sessionNamespace: 'fallback' })).toBe(workflowRuntime);
    expect(setDefaultVectorSearchMock).toHaveBeenCalledWith(null);
  });

  it('rebinds config listeners when the manager instance changes', async () => {
    const firstManager = { onChange: vi.fn(), offChange: vi.fn() };
    const secondManager = { onChange: vi.fn(), offChange: vi.fn() };

    configManagerRef.current = firstManager;

    const { initializeGatewayControlPlane } = await import('../../composition-root/gateway-control-plane.js');
    initializeGatewayControlPlane(containerRef.current as never);

    configManagerRef.current = secondManager;
    initializeGatewayControlPlane(containerRef.current as never);

    expect(firstManager.onChange).toHaveBeenCalledTimes(1);
    expect(firstManager.offChange).toHaveBeenCalledTimes(1);
    expect(secondManager.onChange).toHaveBeenCalledTimes(1);
  });

  it('logs and disables vector search wiring when the container accessor throws', async () => {
    const container = {
      llm: { id: 'llm' },
      workflow: null,
      initializeAll: vi.fn(),
    } as Record<string, unknown>;

    Object.defineProperty(container, 'vectorSearch', {
      get() {
        throw new Error('vector unavailable');
      },
    });

    const { initializeGatewayControlPlane } = await import('../../composition-root/gateway-control-plane.js');
    initializeGatewayControlPlane(container as never);

    expect(logWarnMock).toHaveBeenCalledWith(
      'VectorSearch → GraphManager wiring skipped',
      { error: 'Error: vector unavailable' },
    );
    expect(setDefaultVectorSearchMock).toHaveBeenCalledWith(null);
  });

  it('prewarms successfully and exposes degraded deps when initialization fails', async () => {
    const { prewarmGatewayControlPlane } = await import('../../composition-root/gateway-control-plane.js');

    const successContainer = {
      initializeAll: vi.fn().mockResolvedValue(undefined),
    };
    await prewarmGatewayControlPlane(successContainer as never);
    expect(successContainer.initializeAll).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    const failingContainer = {
      initializeAll: vi.fn().mockRejectedValue(new Error('warmup failed')),
    };
    await prewarmGatewayControlPlane(failingContainer as never);

    expect(logErrorMock).toHaveBeenCalledWith(
      'Engine pre-warm failed — some services may be unavailable',
      { error: 'Error: warmup failed' },
    );
    expect(createGatewayRuntimeStateMock).toHaveBeenCalledTimes(1);
    expect(buildGatewayDepsMock).toHaveBeenCalledWith(
      failingContainer,
      expect.objectContaining({
        mcpConfigs: expect.any(Map),
        healthCache: expect.any(Map),
      }),
    );
    expect(setGatewayDepsMock).toHaveBeenCalledWith({ id: 'gateway-deps' });
  });
});

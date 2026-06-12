import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveGatewayHostPort = vi.fn();
const mockResolveReloadEnabled = vi.fn();
const mockResolveCorsOrigins = vi.fn();
const mockStartGatewayServer = vi.fn();
const mockGetCanonicalMetricsSnapshot = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockGetConfig = vi.fn();

const ORIGINAL_MCP_PROTOCOL_VERSION = process.env.MCP_PROTOCOL_VERSION;

vi.mock('../../config', () => ({
  getConfig: mockGetConfig,
}));

vi.mock('../../mcp/config', () => ({
  resolveCorsOrigins: mockResolveCorsOrigins,
  resolveGatewayHostPort: mockResolveGatewayHostPort,
  resolveReloadEnabled: mockResolveReloadEnabled,
}));

vi.mock('../../mcp/gateway-bootstrap', () => ({
  startGatewayServer: mockStartGatewayServer,
}));

vi.mock('../../mcp/gateway-http-adapter', () => ({
  API_PROTOCOL_VERSION: 'api-protocol-version',
}));

vi.mock('../../mcp/metrics', () => ({
  getMetricsSnapshot: mockGetCanonicalMetricsSnapshot,
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: vi.fn(() => ({
    info: mockInfo,
    warn: mockWarn,
  })),
}));

function createMockServer(closeImpl?: (callback: (error?: Error | null) => void) => void) {
  return {
    close: vi.fn(closeImpl ?? ((callback) => callback(null))),
  };
}

describe('mcp gateway legacy compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.MCP_PROTOCOL_VERSION = ORIGINAL_MCP_PROTOCOL_VERSION;
    mockGetConfig.mockReturnValue({ version: 'test-config' });
    mockResolveGatewayHostPort.mockReturnValue({ host: '127.0.0.1', port: 8787 });
    mockResolveReloadEnabled.mockReturnValue(true);
    mockResolveCorsOrigins.mockReturnValue(['http://allowed.local']);
    mockGetCanonicalMetricsSnapshot.mockReturnValue({
      requests_total: '7',
      requests_failed_total: '2',
      latency_ms_avg: '14.5',
      latency_ms_max: '30',
    });
    mockStartGatewayServer.mockResolvedValue(createMockServer());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_MCP_PROTOCOL_VERSION === undefined) {
      delete process.env.MCP_PROTOCOL_VERSION;
    } else {
      process.env.MCP_PROTOCOL_VERSION = ORIGINAL_MCP_PROTOCOL_VERSION;
    }
  });

  it('builds default config from canonical resolvers', async () => {
    const gatewayModule = await import('../../mcp/gateway');

    expect(gatewayModule.createDefaultConfig()).toEqual({
      gatewayHost: '127.0.0.1',
      gatewayPort: 8787,
      reloadEnabled: true,
      corsOrigins: ['http://allowed.local'],
      maxConnections: 100,
      requestTimeout: 30000,
    });
    expect(gatewayModule.resolveGatewayHostPort()).toEqual({ host: '127.0.0.1', port: 8787 });
    expect(gatewayModule.resolveReloadEnabled()).toBe(true);
  });

  it('uses env protocol version when building the legacy MCP contract', async () => {
    process.env.MCP_PROTOCOL_VERSION = '2026-06-04';

    const { getMcpContract } = await import('../../mcp/gateway');
    const contract = getMcpContract();

    expect(contract.version).toBe('2026-06-04');
    expect(contract.methods['tools/call']).toEqual({
      description: 'Call a tool',
      parameters: {
        name: { type: 'string', required: true, description: 'Tool name' },
        arguments: { type: 'object', required: false, description: 'Tool arguments' },
      },
      returns: { type: 'CallResult', description: 'Tool call result' },
    });
    expect(contract.methods['completion/complete']?.parameters['max_tokens']).toEqual({
      type: 'number',
      required: false,
      description: 'Max tokens',
    });
  });

  it('falls back to the default protocol version when env is absent', async () => {
    delete process.env.MCP_PROTOCOL_VERSION;

    const { getMcpContract } = await import('../../mcp/gateway');

    expect(getMcpContract().version).toBe('2024-11-05');
  });

  it('tracks runtime state transitions and reconnect counters', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const { McpRuntimeState } = await import('../../mcp/gateway');
    const runtime = new McpRuntimeState();

    expect(runtime.toJSON()).toEqual({
      connectionState: 'disconnected',
      sessionId: null,
      reconnectAttempts: 0,
      lastActivity: null,
    });

    runtime.incrementReconnect();
    runtime.incrementReconnect();
    runtime.connect('session-1');
    runtime.touch();
    runtime.disconnect();
    runtime.resetReconnect();

    expect(runtime.connectionState).toBe('disconnected');
    expect(runtime.sessionId).toBe('session-1');
    expect(runtime.reconnectAttempts).toBe(0);
    expect(runtime.toJSON().lastActivity).toBe(2000);
  });

  it('aggregates request metrics and resets collector state', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(5000);

    const { McpMetricsCollector } = await import('../../mcp/gateway');
    const collector = new McpMetricsCollector();

    collector.recordRequest(10);
    collector.recordRequest(40, true);

    expect(collector.getMetrics()).toEqual({
      requestsTotal: 2,
      requestsFailedTotal: 1,
      latencyMsAvg: 25,
      latencyMsMax: 40,
      uptimeSeconds: 4,
    });

    nowSpy.mockReturnValueOnce(9000);
    collector.reset();
    nowSpy.mockReturnValueOnce(12000);

    expect(collector.getMetrics()).toEqual({
      requestsTotal: 0,
      requestsFailedTotal: 0,
      latencyMsAvg: 0,
      latencyMsMax: 0,
      uptimeSeconds: 3,
    });
  });

  it('starts and stops the legacy gateway with explicit host and port', async () => {
    const server = createMockServer();
    mockStartGatewayServer.mockResolvedValue(server);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1111).mockReturnValueOnce(2222).mockReturnValue(3333);

    const { McpGateway } = await import('../../mcp/gateway');
    const gateway = new McpGateway({
      gatewayHost: '0.0.0.0',
      gatewayPort: 9000,
    });

    await gateway.start();

    expect(mockStartGatewayServer).toHaveBeenCalledWith({
      host: '0.0.0.0',
      port: 9000,
    });
    expect(gateway.getHealth()).toMatchObject({
      status: 'ok',
      version: 'api-protocol-version',
      mcp_runtime: {
        connectionState: 'connected',
        sessionId: 'legacy-2222',
        reconnectAttempts: 0,
        lastActivity: 3333,
      },
    });

    await gateway.stop();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(gateway.getHealth().status).toBe('degraded');
    expect(gateway.getMetricsSnapshot()).toEqual({
      metrics: {
        requestsTotal: 7,
        requestsFailedTotal: 2,
        latencyMsAvg: 14.5,
        latencyMsMax: 30,
        uptimeSeconds: 2.222,
      },
      runtime: {
        connectionState: 'disconnected',
        sessionId: 'legacy-2222',
        reconnectAttempts: 0,
        lastActivity: 3333,
      },
    });
  });

  it('falls back to zero when canonical metrics snapshot omits numeric fields', async () => {
    mockGetCanonicalMetricsSnapshot.mockReturnValue({});
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(4000);

    const { McpGateway } = await import('../../mcp/gateway');
    const gateway = new McpGateway();

    expect(gateway.getMetricsSnapshot()).toEqual({
      metrics: {
        requestsTotal: 0,
        requestsFailedTotal: 0,
        latencyMsAvg: 0,
        latencyMsMax: 0,
        uptimeSeconds: 3,
      },
      runtime: {
        connectionState: 'disconnected',
        sessionId: null,
        reconnectAttempts: 0,
        lastActivity: null,
      },
    });
  });

  it('warns when legacy request handlers are registered before start', async () => {
    const { McpGateway } = await import('../../mcp/gateway');
    const gateway = new McpGateway();

    gateway.registerHandler('tools/list', async (request) => ({
      jsonrpc: '2.0',
      id: request.id,
      result: [],
    }));

    await gateway.start();

    expect(mockWarn).toHaveBeenCalledWith(
      'Legacy McpGateway.registerHandler is ignored; route-based gateway authority is canonical.',
    );
  });

  it('propagates server close failures during stop', async () => {
    const server = createMockServer((callback) => callback(new Error('close-failed')));
    mockStartGatewayServer.mockResolvedValue(server);

    const { McpGateway } = await import('../../mcp/gateway');
    const gateway = new McpGateway();

    await gateway.start();

    await expect(gateway.stop()).rejects.toThrow('close-failed');
    expect(gateway.getHealth().status).toBe('ok');
  });

  it('starts the legacy sidecar via the canonical bootstrap path', async () => {
    const { startSidecar } = await import('../../mcp/gateway');

    await startSidecar();

    expect(mockStartGatewayServer).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 8787,
    });
    expect(mockInfo).toHaveBeenCalledWith(
      'Legacy MCP sidecar started via canonical gateway bootstrap',
    );
  });
});

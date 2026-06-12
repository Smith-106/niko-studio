import { afterEach, describe, expect, it, vi } from 'vitest';

const createServerMock = vi.hoisted(() => vi.fn());
const initializeGatewayControlPlaneMock = vi.hoisted(() => vi.fn());
const prewarmGatewayControlPlaneMock = vi.hoisted(() => vi.fn());
const shutdownGatewayControlPlaneMock = vi.hoisted(() => vi.fn());
const resolveGatewayHostPortMock = vi.hoisted(() => vi.fn());
const createGatewayRequestHandlerMock = vi.hoisted(() => vi.fn());
const initConfigMock = vi.hoisted(() => vi.fn());
const validateConfigMock = vi.hoisted(() => vi.fn());
const ensureEnvironmentMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logWarnMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

async function loadGatewayBootstrapModule() {
  vi.resetModules();

  vi.doMock('node:http', () => ({
    createServer: createServerMock,
  }));

  vi.doMock('../../container/gateway-control-plane', () => ({
    initializeGatewayControlPlane: initializeGatewayControlPlaneMock,
    prewarmGatewayControlPlane: prewarmGatewayControlPlaneMock,
    shutdownGatewayControlPlane: shutdownGatewayControlPlaneMock,
  }));

  vi.doMock('../../mcp/config', () => ({
    resolveGatewayHostPort: resolveGatewayHostPortMock,
  }));

  vi.doMock('../../mcp/gateway-request-handler', () => ({
    createGatewayRequestHandler: createGatewayRequestHandlerMock,
  }));

  vi.doMock('../../mcp/routes', () => ({
    gatewayRoutes: ['route-a'],
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      info: logInfoMock,
      warn: logWarnMock,
      error: logErrorMock,
    }),
  }));

  vi.doMock('../../config/index.js', () => ({
    initConfig: initConfigMock,
    validateConfig: validateConfigMock,
    ensureEnvironment: ensureEnvironmentMock,
  }));

  return import('../../mcp/gateway-bootstrap.js');
}

describe('gateway bootstrap additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('node:http');
    vi.doUnmock('../../container/gateway-control-plane');
    vi.doUnmock('../../mcp/config');
    vi.doUnmock('../../mcp/gateway-request-handler');
    vi.doUnmock('../../mcp/routes');
    vi.doUnmock('../../logger/index.js');
    vi.doUnmock('../../config/index.js');
    vi.resetModules();
  });

  it('starts the gateway server with config init, prewarm, request handler, and websocket relay', async () => {
    const signalHandlers: Record<string, () => Promise<void> | void> = {};
    const server = {
      listen: vi.fn((port: number, host: string, callback: () => void) => callback()),
      close: vi.fn((callback: () => void) => callback()),
    };
    const wsInitializeMock = vi.fn();

    resolveGatewayHostPortMock.mockReturnValue({ host: '0.0.0.0', port: 8787 });
    validateConfigMock.mockReturnValue({ errors: [], warnings: ['warn-1'] });
    initializeGatewayControlPlaneMock.mockReturnValue({
      container: {
        phaseOrchestrator: { id: 'orchestrator' },
        wsRelay: { initialize: wsInitializeMock },
      },
    });
    prewarmGatewayControlPlaneMock.mockResolvedValue(undefined);
    createGatewayRequestHandlerMock.mockReturnValue('request-handler');
    createServerMock.mockReturnValue(server);
    shutdownGatewayControlPlaneMock.mockResolvedValue(undefined);

    const processOnSpy = vi
      .spyOn(process, 'on')
      .mockImplementation(((event: string, handler: () => Promise<void> | void) => {
        signalHandlers[event] = handler;
        return process;
      }) as any);
    const processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => undefined as never) as any);
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: TimerHandler) => {
        void callback;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as any);

    const gatewayBootstrap = await loadGatewayBootstrapModule();
    const result = await gatewayBootstrap.startGatewayServer({
      host: '127.0.0.1',
      port: 9900,
    });

    expect(result).toBe(server);
    expect(initConfigMock).toHaveBeenCalledTimes(1);
    expect(ensureEnvironmentMock).toHaveBeenCalledWith(false);
    expect(prewarmGatewayControlPlaneMock).toHaveBeenCalledWith(
      initializeGatewayControlPlaneMock.mock.results[0]?.value.container,
    );
    expect(createGatewayRequestHandlerMock).toHaveBeenCalledWith(
      ['route-a'],
      initializeGatewayControlPlaneMock.mock.results[0]?.value.container.phaseOrchestrator,
    );
    expect(createServerMock).toHaveBeenCalledWith('request-handler');
    expect(wsInitializeMock).toHaveBeenCalledWith(server);
    expect(server.listen).toHaveBeenCalledWith(9900, '127.0.0.1', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(logWarnMock).toHaveBeenCalledWith('Config warning', { warning: 'warn-1' });
    expect(logInfoMock).toHaveBeenCalledWith('NIKO Studio Gateway started', {
      host: '127.0.0.1',
      port: 9900,
    });

    await signalHandlers['SIGTERM']?.();

    expect(shutdownGatewayControlPlaneMock).toHaveBeenCalledTimes(1);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(processExitSpy).toHaveBeenCalledWith(0);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
  });

  it('throws when config validation fails before server startup', async () => {
    resolveGatewayHostPortMock.mockReturnValue({ host: '0.0.0.0', port: 8787 });
    validateConfigMock.mockReturnValue({
      errors: ['missing api key', 'missing workspace root'],
      warnings: [],
    });

    const gatewayBootstrap = await loadGatewayBootstrapModule();

    await expect(gatewayBootstrap.startGatewayServer()).rejects.toThrow(
      'Config validation errors:\n- missing api key\n- missing workspace root',
    );

    expect(createServerMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith('Config validation failed', {
      errors: ['missing api key', 'missing workspace root'],
    });
  });

  it('logs shutdown failures and still closes the server', async () => {
    const signalHandlers: Record<string, () => Promise<void> | void> = {};
    const server = {
      listen: vi.fn((_port: number, _host: string, callback: () => void) => callback()),
      close: vi.fn((callback: () => void) => callback()),
    };

    resolveGatewayHostPortMock.mockReturnValue({ host: '0.0.0.0', port: 8787 });
    validateConfigMock.mockReturnValue({ errors: [], warnings: [] });
    initializeGatewayControlPlaneMock.mockReturnValue({
      container: {
        phaseOrchestrator: null,
        wsRelay: { initialize: vi.fn() },
      },
    });
    prewarmGatewayControlPlaneMock.mockResolvedValue(undefined);
    createGatewayRequestHandlerMock.mockReturnValue('handler');
    createServerMock.mockReturnValue(server);
    shutdownGatewayControlPlaneMock.mockRejectedValue(new Error('shutdown failed'));

    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => Promise<void> | void) => {
      signalHandlers[event] = handler;
      return process;
    }) as any);
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => undefined as never) as any);
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      void callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as any);

    const gatewayBootstrap = await loadGatewayBootstrapModule();
    await gatewayBootstrap.startGatewayServer();
    await signalHandlers['SIGINT']?.();

    expect(logErrorMock).toHaveBeenCalledWith('Error during control plane shutdown', {
      error: 'Error: shutdown failed',
    });
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('parses CLI overrides in main()', async () => {
    const server = {
      listen: vi.fn((port: number, host: string, callback: () => void) => callback()),
      close: vi.fn(),
    };

    resolveGatewayHostPortMock.mockReturnValue({ host: '0.0.0.0', port: 8787 });
    validateConfigMock.mockReturnValue({ errors: [], warnings: [] });
    initializeGatewayControlPlaneMock.mockReturnValue({
      container: {
        phaseOrchestrator: null,
        wsRelay: { initialize: vi.fn() },
      },
    });
    prewarmGatewayControlPlaneMock.mockResolvedValue(undefined);
    createGatewayRequestHandlerMock.mockReturnValue('handler');
    createServerMock.mockReturnValue(server);
    shutdownGatewayControlPlaneMock.mockResolvedValue(undefined);

    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => Promise<void> | void) => {
      void event;
      void handler;
      return process;
    }) as any);
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      void callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as any);

    const gatewayBootstrap = await loadGatewayBootstrapModule();
    await gatewayBootstrap.main(['--port', '3456', '--host', 'localhost']);

    expect(server.listen).toHaveBeenCalledWith(3456, 'localhost', expect.any(Function));
  });
});

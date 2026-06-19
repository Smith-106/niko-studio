import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mainGatewayMock = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/gateway-bootstrap.js', () => ({
  main: mainGatewayMock,
  startGatewayServer: vi.fn(),
}));

vi.mock('../../mcp/gateway-state.js', () => ({
  buildConfigAccess: vi.fn(),
  buildGatewayDeps: vi.fn(),
}));

vi.mock('../../logger/index.js', () => ({
  logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  },
  createLogger: vi.fn(),
  StructuredLogger: class {},
  LogLevel: {},
}));

describe('gateway-server runtime entry', () => {
  const originalArgv = [...process.argv];
  const modulePath = fileURLToPath(new URL('../../gateway-server.ts', import.meta.url));

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not invoke main when imported as a non-entry module', async () => {
    process.argv = ['node', 'not-gateway-entry.js'];

    await import('../../gateway-server.ts?non-entry');

    expect(mainGatewayMock).not.toHaveBeenCalled();
  });

  it('invokes main when imported as the current entry module', async () => {
    process.argv = ['node', modulePath];
    mainGatewayMock.mockResolvedValueOnce(undefined);

    await import('../../gateway-server.ts');

    expect(mainGatewayMock).toHaveBeenCalledTimes(1);
  });

  it('logs and exits when startup fails', async () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => code as never) as never);
    process.argv = ['node', modulePath];
    mainGatewayMock.mockRejectedValueOnce(new Error('startup failed'));

    await import('../../gateway-server.ts');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockLoggerError).toHaveBeenCalledWith(
      'Gateway failed to start',
      expect.objectContaining({ error: 'startup failed' }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});

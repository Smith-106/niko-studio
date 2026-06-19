import { afterEach, describe, expect, it, vi } from 'vitest';

const errorLog1 = vi.hoisted(() => vi.fn());
const errorLog2 = vi.hoisted(() => vi.fn());
const mockExit = vi.hoisted(() => vi.fn());

const mockLogger1 = vi.hoisted(() => ({
  error: errorLog1,
  info: vi.fn(),
  warn: vi.fn(),
}));

const mockLogger2 = vi.hoisted(() => ({
  error: errorLog2,
  info: vi.fn(),
  warn: vi.fn(),
}));

// Mock process.exit before any module imports to prevent test runner crash
vi.mock('node:process', async () => {
  const actual = await vi.importActual('node:process');
  return {
    ...actual,
    default: {
      ...actual,
      exit: mockExit,
    },
    exit: mockExit,
  };
});

describe('gateway-server branch-gap coverage', () => {
  afterEach(() => {
    vi.resetModules();
    mockExit.mockClear();
  });

  it('logs error with message and stack when main() rejects with an Error instance', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    vi.doMock('../logger/index.js', () => ({
      logger: mockLogger1,
      createLogger: () => mockLogger1,
    }));

    vi.doMock('../mcp/gateway-bootstrap.js', () => ({
      main: () => Promise.reject(new Error('boot failure')),
      startGatewayServer: () => Promise.reject(new Error('boot failure')),
    }));

    const { resolve } = await import('node:path');
    const gatewayPath = resolve(__dirname, '..', 'gateway-server.ts');
    const originalArgv1 = process.argv[1];
    process.argv[1] = gatewayPath;

    try {
      await import('../gateway-server.js');
    } catch {
      // module may throw due to process.exit mock
    }

    // Wait for async catch handler
    await new Promise((r) => setTimeout(r, 100));

    expect(errorLog1).toHaveBeenCalledWith(
      'Gateway failed to start',
      expect.objectContaining({
        error: 'boot failure',
        stack: expect.any(String),
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    process.argv[1] = originalArgv1;
    exitSpy.mockRestore();
  });

  it('logs error with String() when main() rejects with a non-Error value', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    vi.doMock('../logger/index.js', () => ({
      logger: mockLogger2,
      createLogger: () => mockLogger2,
    }));

    vi.doMock('../mcp/gateway-bootstrap.js', () => ({
      main: () => Promise.reject('string failure'),
      startGatewayServer: () => Promise.reject('string failure'),
    }));

    const { resolve } = await import('node:path');
    const gatewayPath = resolve(__dirname, '..', 'gateway-server.ts');
    const originalArgv1 = process.argv[1];
    process.argv[1] = gatewayPath;

    try {
      await import('../gateway-server.js');
    } catch {
      // module may throw due to process.exit mock
    }

    await new Promise((r) => setTimeout(r, 100));

    expect(errorLog2).toHaveBeenCalledWith(
      'Gateway failed to start',
      expect.objectContaining({
        error: 'string failure',
        stack: undefined,
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    process.argv[1] = originalArgv1;
    exitSpy.mockRestore();
  });
});

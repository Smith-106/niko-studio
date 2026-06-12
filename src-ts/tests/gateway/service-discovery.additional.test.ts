import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockReadFile = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: vi.fn(() => ({
    info: mockInfo,
    error: mockError,
  })),
}));

describe('MCPServiceDiscoveryImpl additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    delete process.env.TEST_PROVIDER_DELTA;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TEST_PROVIDER_DELTA;
  });

  it('applies config and environment fallbacks for omitted optional provider fields', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      providers: [
        {
          name: 'alpha',
          endpoint: 'http://alpha.local',
        },
      ],
    }));
    process.env.TEST_PROVIDER_DELTA = 'tools/call,   ';

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn(),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      environmentPrefix: 'TEST_PROVIDER_',
    });

    await expect(discovery.discoverProviders()).resolves.toEqual([
      {
        name: 'alpha',
        capabilities: [],
        endpoint: 'http://alpha.local',
        priority: 0,
        source: 'config',
      },
      {
        name: 'delta',
        capabilities: ['tools/call'],
        endpoint: undefined,
        priority: 0,
        source: 'environment',
      },
    ]);
  });

  it('defaults manual registration priority when the provider omits it', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ providers: [] }));

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn(),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      environmentPrefix: 'TEST_PROVIDER_',
    });

    (discovery as unknown as {
      registerWithRouter: (provider: Record<string, unknown>) => void;
    }).registerWithRouter({
      name: 'manual-provider',
      capabilities: ['tools/call'],
      source: 'manual',
    });

    expect(router.registerProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'manual-provider',
        priority: 0,
        healthStatus: 'healthy',
      }),
    );
  });

  it('logs non-Error scan failures using string coercion', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ providers: [] }));
    let intervalCallback: (() => void) | null = null;
    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation(((callback: TimerHandler) => {
        intervalCallback = callback as () => void;
        return 1 as ReturnType<typeof setInterval>;
      }) as typeof setInterval);

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn(),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      environmentPrefix: 'TEST_PROVIDER_',
      scanIntervalMs: 25,
    });

    await discovery.start();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(intervalCallback).not.toBeNull();
    vi.spyOn(discovery, 'discoverProviders').mockRejectedValue('plain-failure');

    intervalCallback?.();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockError).toHaveBeenCalledWith('Periodic discovery scan failed', {
      error: 'plain-failure',
    });

    discovery.stop();
  });
});

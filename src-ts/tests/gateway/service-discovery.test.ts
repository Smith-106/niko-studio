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

describe('MCPServiceDiscoveryImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    delete process.env.TEST_PROVIDER_BETA;
    delete process.env.TEST_PROVIDER_GAMMA;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.TEST_PROVIDER_BETA;
    delete process.env.TEST_PROVIDER_GAMMA;
  });

  it('discovers providers from config and environment, then auto-registers placeholder handlers', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      providers: [
        {
          name: 'alpha',
          capabilities: ['tools/call'],
          endpoint: 'http://alpha.local',
          priority: 5,
        },
      ],
    }));
    process.env.TEST_PROVIDER_BETA = ' resources/read | tools/call , http://beta.local , not-a-number ';

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn(),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      configPath: '.tmp/test-mcp-config.json',
      environmentPrefix: 'TEST_PROVIDER_',
    });

    const providers = await discovery.discoverProviders();

    expect(providers).toEqual([
      {
        name: 'alpha',
        capabilities: ['tools/call'],
        endpoint: 'http://alpha.local',
        priority: 5,
        source: 'config',
      },
      {
        name: 'beta',
        capabilities: ['resources/read', 'tools/call'],
        endpoint: 'http://beta.local',
        priority: 0,
        source: 'environment',
      },
    ]);
    expect(discovery.getDiscoveredProviders()).toEqual(providers);
    expect(router.registerProvider).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith('mcp:provider-discovered', providers[0]);
    expect(eventBus.publish).toHaveBeenCalledWith('mcp:provider-discovered', providers[1]);

    const registeredSpec = router.registerProvider.mock.calls[0]?.[0] as {
      name: string;
      healthStatus: string;
      priority: number;
      handler: () => Promise<unknown>;
    };
    expect(registeredSpec.name).toBe('alpha');
    expect(registeredSpec.healthStatus).toBe('healthy');
    expect(registeredSpec.priority).toBe(5);
    await expect(registeredSpec.handler()).rejects.toThrow(
      'Provider "alpha" discovered but no handler registered.',
    );
  });

  it('removes stale providers on subsequent discovery passes', async () => {
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({
        providers: [
          { name: 'alpha', capabilities: ['tools/call'], priority: 3 },
        ],
      }))
      .mockResolvedValueOnce(JSON.stringify({ providers: [] }));

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

    expect(await discovery.discoverProviders()).toHaveLength(1);
    expect(await discovery.discoverProviders()).toEqual([]);
    expect(discovery.getDiscoveredProviders()).toEqual([]);
    expect(router.registerProvider).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith('mcp:provider-removed', { name: 'alpha' });
  });

  it('starts periodic discovery, remains idempotent, and stops cleanly', async () => {
    vi.useFakeTimers();
    mockReadFile.mockResolvedValue(JSON.stringify({ providers: [] }));

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn(),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      environmentPrefix: 'TEST_PROVIDER_',
      scanIntervalMs: 50,
    });

    await discovery.start();
    await discovery.start();

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockInfo).toHaveBeenCalledWith('Service discovery started', { scanIntervalMs: 50 });

    await vi.advanceTimersByTimeAsync(50);
    expect(mockReadFile).toHaveBeenCalledTimes(2);

    discovery.stop();
    discovery.stop();
    expect(mockInfo).toHaveBeenCalledWith('Service discovery stopped');

    await vi.advanceTimersByTimeAsync(50);
    expect(mockReadFile).toHaveBeenCalledTimes(2);
  });

  it('logs periodic scan failures when a re-scan discovery pass rejects', async () => {
    vi.useFakeTimers();
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify({ providers: [] }))
      .mockResolvedValueOnce(JSON.stringify({
        providers: [{ name: 'alpha', capabilities: ['tools/call'] }],
      }));

    const router = {
      registerProvider: vi.fn(),
    };
    const eventBus = {
      publish: vi.fn((eventName: string) => {
        if (eventName === 'mcp:provider-discovered') {
          throw new Error('publish-failed');
        }
      }),
    };

    const { MCPServiceDiscoveryImpl } = await import('../../gateway/service-discovery.js');
    const discovery = new MCPServiceDiscoveryImpl(router as never, eventBus as never, {
      environmentPrefix: 'TEST_PROVIDER_',
      scanIntervalMs: 50,
    });

    await discovery.start();
    await vi.advanceTimersByTimeAsync(50);

    expect(mockError).toHaveBeenCalledWith('Periodic discovery scan failed', {
      error: 'publish-failed',
    });

    discovery.stop();
  });

  it('ignores missing or invalid config files during discovery', async () => {
    mockReadFile.mockRejectedValue(new Error('missing-config'));

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

    expect(await discovery.discoverProviders()).toEqual([]);
    expect(discovery.getDiscoveredProviders()).toEqual([]);
    expect(router.registerProvider).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('returns an empty list when the config providers field is not an array', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      providers: { name: 'alpha', capabilities: ['tools/call'] },
    }));

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

    expect(await discovery.discoverProviders()).toEqual([]);
    expect(router.registerProvider).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('supports environment providers without declared capabilities', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ providers: [] }));
    process.env.TEST_PROVIDER_GAMMA = ', http://gamma.local , 7';

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
        name: 'gamma',
        capabilities: [],
        endpoint: 'http://gamma.local',
        priority: 7,
        source: 'environment',
      },
    ]);
  });
});

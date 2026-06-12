import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreakerRegistry } from '../../services/circuit-breaker.js';
import type { MCPProviderSpec } from '../../gateway/mcp-router.js';

const mockInfo = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('../../logger/index.js', () => ({
  createLogger: vi.fn(() => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  })),
}));

function createProvider(
  name: string,
  handler: MCPProviderSpec['handler'],
): MCPProviderSpec {
  return {
    name,
    capabilities: ['health/check'],
    handler,
    priority: 1,
    healthStatus: 'healthy',
  };
}

describe('gateway/health-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns unknown status for unprobed providers and handles missing providers cleanly', async () => {
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    const providers = [
      createProvider('alpha', async () => ({ ok: true })),
    ];
    const router = {
      getProviders: vi.fn(() => providers),
    };
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      unsubscribe: vi.fn(),
    };
    const monitor = new MCPHealthMonitorImpl(
      router as never,
      new CircuitBreakerRegistry(),
      eventBus as never,
    );

    expect(monitor.getHealthStatus()).toEqual({
      alpha: {
        status: 'unknown',
        consecutiveFailures: 0,
        lastProbeTime: 0,
        averageResponseMs: 0,
      },
    });

    await expect(monitor.probeProvider('missing')).resolves.toEqual(
      expect.objectContaining({
        providerName: 'missing',
        healthy: false,
        responseTimeMs: 0,
        error: 'Provider "missing" not found in router',
      }),
    );
  });

  it('times out slow providers and marks them unhealthy after repeated failures', async () => {
    vi.useFakeTimers();
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    const router = {
      getProviders: vi.fn(() => [
        createProvider('slow', async () => new Promise(() => {})),
      ]),
    };
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      unsubscribe: vi.fn(),
    };
    const monitor = new MCPHealthMonitorImpl(
      router as never,
      new CircuitBreakerRegistry({ failureThreshold: 99 }),
      eventBus as never,
      {
        timeoutMs: 25,
        degradationThreshold: 2,
      },
    );

    const firstProbe = monitor.probeProvider('slow');
    await vi.advanceTimersByTimeAsync(25);
    const firstResult = await firstProbe;

    expect(firstResult.healthy).toBe(false);
    expect(firstResult.error).toContain('Probe timed out after 25ms');
    expect(monitor.getHealthStatus()['slow']).toMatchObject({
      status: 'healthy',
      consecutiveFailures: 1,
    });

    for (let index = 0; index < 3; index++) {
      const nextProbe = monitor.probeProvider('slow');
      await vi.advanceTimersByTimeAsync(25);
      await nextProbe;
    }

    expect(monitor.getHealthStatus()['slow']).toMatchObject({
      status: 'unhealthy',
      consecutiveFailures: 4,
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'mcp:provider-degraded',
      expect.objectContaining({
        name: 'slow',
        consecutiveFailures: 2,
        degradationThreshold: 2,
      }),
    );
    expect(mockError).toHaveBeenCalledWith('Provider unhealthy', expect.objectContaining({
      name: 'slow',
      consecutiveFailures: 4,
    }));
  });

  it('tracks rolling averages, probes all providers, and emits recovery events', async () => {
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    let shouldFail = true;
    const router = {
      getProviders: vi.fn(() => [
        createProvider('recovering', async () => {
          if (shouldFail) {
            throw new Error('boom');
          }
          return { ok: true };
        }),
        createProvider('steady', async () => ({ ok: true })),
      ]),
    };
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      unsubscribe: vi.fn(),
    };
    const monitor = new MCPHealthMonitorImpl(
      router as never,
      new CircuitBreakerRegistry({ failureThreshold: 99 }),
      eventBus as never,
      { degradationThreshold: 1 },
    );

    await monitor.probeProvider('recovering');
    expect(monitor.getHealthStatus()['recovering'].status).toBe('degraded');

    shouldFail = false;
    const result = await monitor.probeAllProviders();

    expect(result).toEqual({
      recovering: expect.objectContaining({ healthy: true }),
      steady: expect.objectContaining({ healthy: true }),
    });
    expect(monitor.getHealthStatus()['recovering']).toMatchObject({
      status: 'healthy',
      consecutiveFailures: 0,
    });
    expect(monitor.getHealthStatus()['steady'].averageResponseMs).toBeGreaterThanOrEqual(0);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'mcp:provider-recovered',
      expect.objectContaining({
        name: 'recovering',
        previousStatus: 'degraded',
      }),
    );
    expect(mockInfo).toHaveBeenCalledWith(
      'Provider recovered',
      expect.objectContaining({ name: 'recovering' }),
    );
  });

  it('starts only once, logs periodic probe errors, and stops cleanly', async () => {
    vi.useFakeTimers();
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    const router = {
      getProviders: vi.fn(() => []),
    };
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      unsubscribe: vi.fn(),
    };
    const monitor = new MCPHealthMonitorImpl(
      router as never,
      new CircuitBreakerRegistry(),
      eventBus as never,
      { probeIntervalMs: 50 },
    );

    const probeSpy = vi.spyOn(monitor, 'probeAllProviders');
    probeSpy.mockResolvedValueOnce({});
    probeSpy.mockRejectedValueOnce(new Error('periodic-failure'));

    await monitor.start();
    await monitor.start();

    expect(probeSpy).toHaveBeenCalledTimes(1);
    expect(mockInfo).toHaveBeenCalledWith('Health monitor started', {
      probeIntervalMs: 50,
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(probeSpy).toHaveBeenCalledTimes(2);
    expect(mockError).toHaveBeenCalledWith('Periodic health probe failed', {
      error: 'periodic-failure',
    });

    monitor.stop();
    monitor.stop();
    expect(mockInfo).toHaveBeenCalledWith('Health monitor stopped');

    await vi.advanceTimersByTimeAsync(50);
    expect(probeSpy).toHaveBeenCalledTimes(2);
  });
});

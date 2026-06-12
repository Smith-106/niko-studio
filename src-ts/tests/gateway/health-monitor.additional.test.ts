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

describe('gateway/health-monitor additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps only the latest 20 response time samples in the rolling average', async () => {
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    const samples = [1, ...Array.from({ length: 20 }, () => 100)];
    const router = {
      getProviders: vi.fn(() => [
        createProvider('steady', async () => {
          const sample = samples.shift() ?? 100;
          await vi.advanceTimersByTimeAsync(sample);
          return { ok: true };
        }),
      ]),
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

    for (let index = 0; index < 21; index++) {
      await expect(monitor.probeProvider('steady')).resolves.toMatchObject({
        providerName: 'steady',
        healthy: true,
      });
    }

    expect(monitor.getHealthStatus()['steady']).toMatchObject({
      status: 'healthy',
      consecutiveFailures: 0,
      averageResponseMs: 100,
    });
  });

  it('serializes non-Error provider failures and returns zero averages for missing or empty history', async () => {
    const { MCPHealthMonitorImpl } = await import('../../gateway/health-monitor.js');
    const router = {
      getProviders: vi.fn(() => [
        createProvider('plain', async () => {
          throw 'plain-provider-failure';
        }),
      ]),
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

    await expect(monitor.probeProvider('plain')).resolves.toMatchObject({
      providerName: 'plain',
      healthy: false,
      error: 'plain-provider-failure',
    });

    const internals = monitor as unknown as {
      computeAverageResponseMs: (providerName: string) => number;
      responseTimeHistory: Map<string, number[]>;
    };
    expect(internals.computeAverageResponseMs('missing')).toBe(0);
    internals.responseTimeHistory.set('empty', []);
    expect(internals.computeAverageResponseMs('empty')).toBe(0);
  });

  it('serializes non-Error periodic probe failures through the timer catch path', async () => {
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
      { probeIntervalMs: 25 },
    );

    const probeSpy = vi.spyOn(monitor, 'probeAllProviders');
    probeSpy.mockResolvedValueOnce({});
    probeSpy.mockRejectedValueOnce('plain-periodic-failure');

    await monitor.start();
    await vi.advanceTimersByTimeAsync(25);

    expect(mockError).toHaveBeenCalledWith('Periodic health probe failed', {
      error: 'plain-periodic-failure',
    });

    monitor.stop();
  });
});

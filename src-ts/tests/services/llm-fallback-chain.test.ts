import { describe, expect, it, vi } from 'vitest';

import type { LLMProvider } from '../../protocols/llm';
import { CircuitBreakerRegistry } from '../../services/circuit-breaker.js';
import type { IEventBus } from '../../services/event-bus.js';
import { LLMFallbackChainImpl, ProviderLatencyTracker } from '../../services/llm-fallback-chain.js';
import {
  CircuitOpenError,
  ProviderType,
  ProviderUnavailableError,
} from '../../services/llm-service';

type MockProvider = LLMProvider & {
  complete: ReturnType<typeof vi.fn>;
  streamComplete: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
  getModelForTier: ReturnType<typeof vi.fn>;
};

type MockEventBus = IEventBus & {
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
};

function createProvider(providerType: ProviderType): MockProvider {
  return {
    providerType,
    complete: vi.fn(),
    streamComplete: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
    getModelForTier: vi.fn().mockReturnValue(`${providerType}-model`),
  } as unknown as MockProvider;
}

function createEventBus(throwOnPublish: boolean = false): MockEventBus {
  const publish = throwOnPublish
    ? vi.fn(() => {
        throw new Error('event bus unavailable');
      })
    : vi.fn();

  return {
    publish,
    subscribe: vi.fn(() => () => {}),
    unsubscribe: vi.fn(),
  } as unknown as MockEventBus;
}

describe('services/llm-fallback-chain ProviderLatencyTracker', () => {
  it('tracks sliding windows, reports empty stats, and sorts by average latency', () => {
    const tracker = new ProviderLatencyTracker(3);

    expect(tracker.getStats(ProviderType.OPENAI)).toEqual({
      avgMs: 0,
      p95Ms: 0,
      callCount: 0,
    });

    tracker.recordLatency(ProviderType.OPENAI, 30);
    tracker.recordLatency(ProviderType.OPENAI, 10);
    tracker.recordLatency(ProviderType.OPENAI, 20);
    tracker.recordLatency(ProviderType.OPENAI, 50);
    tracker.recordLatency(ProviderType.ANTHROPIC, 5);

    const stats = tracker.getStats(ProviderType.OPENAI);
    expect(stats.callCount).toBe(3);
    expect(stats.avgMs).toBeCloseTo((10 + 20 + 50) / 3);
    expect(stats.p95Ms).toBe(50);
    expect(tracker.sortByLatency([ProviderType.OPENAI, ProviderType.ANTHROPIC])).toEqual([
      ProviderType.ANTHROPIC,
      ProviderType.OPENAI,
    ]);
  });
});

describe('services/llm-fallback-chain LLMFallbackChainImpl', () => {
  it('prefers the requested provider and ignores event bus publish failures', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 2 });
    const openai = createProvider(ProviderType.OPENAI);
    const anthropic = createProvider(ProviderType.ANTHROPIC);
    const eventBus = createEventBus(true);

    openai.complete.mockResolvedValue({ provider: ProviderType.OPENAI });
    anthropic.complete.mockResolvedValue({ provider: ProviderType.ANTHROPIC });

    const chain = new LLMFallbackChainImpl(
      registry,
      new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
      ]),
      {
        chain: [ProviderType.ANTHROPIC, ProviderType.OPENAI],
        retryPerProvider: 1,
      },
      eventBus,
    );

    const result = await chain.executeWithFallback(
      provider => provider.complete('prompt', 'model'),
      'preferred-op',
      ProviderType.OPENAI,
    );

    expect(result).toEqual({ provider: ProviderType.OPENAI });
    expect(openai.complete).toHaveBeenCalledTimes(1);
    expect(anthropic.complete).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalled();
    expect(chain.getLatencyStats()[ProviderType.OPENAI].callCount).toBe(1);
    expect(chain.getChainConfig()).toMatchObject({
      chain: [ProviderType.ANTHROPIC, ProviderType.OPENAI],
      retryPerProvider: 1,
      enableLatencyRouting: false,
    });
  });

  it('retries a provider before falling back and publishes lifecycle events', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 10 });
    const openai = createProvider(ProviderType.OPENAI);
    const anthropic = createProvider(ProviderType.ANTHROPIC);
    const eventBus = createEventBus();

    openai.complete
      .mockRejectedValueOnce(new Error('openai-fail-1'))
      .mockRejectedValueOnce(new Error('openai-fail-2'));
    anthropic.complete.mockResolvedValue({ provider: ProviderType.ANTHROPIC, ok: true });

    const chain = new LLMFallbackChainImpl(
      registry,
      new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
      ]),
      {
        chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC],
        retryPerProvider: 2,
        latencyWindowSize: 5,
      },
      eventBus,
    );

    const result = await chain.executeWithFallback(
      provider => provider.complete('prompt', 'model'),
      'fallback-op',
    );

    const channels = eventBus.publish.mock.calls.map(([channel]) => channel);

    expect(result).toEqual({ provider: ProviderType.ANTHROPIC, ok: true });
    expect(openai.complete).toHaveBeenCalledTimes(2);
    expect(anthropic.complete).toHaveBeenCalledTimes(1);
    expect(channels.filter(channel => channel === 'llm:fallback-start')).toHaveLength(1);
    expect(channels.filter(channel => channel === 'llm:fallback-attempt')).toHaveLength(3);
    expect(channels.filter(channel => channel === 'llm:fallback-provider-failed')).toHaveLength(2);
    expect(channels.filter(channel => channel === 'llm:fallback-success')).toHaveLength(1);
    expect(channels).not.toContain('llm:fallback-exhausted');
    expect(chain.getLatencyStats()[ProviderType.OPENAI].callCount).toBe(2);
    expect(chain.getLatencyStats()[ProviderType.ANTHROPIC].callCount).toBe(1);
  });

  it('throws ProviderUnavailableError when no configured providers are registered', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 2 });
    const eventBus = createEventBus();
    const operation = vi.fn();

    const chain = new LLMFallbackChainImpl(
      registry,
      new Map(),
      {
        chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC],
        retryPerProvider: 1,
      },
      eventBus,
    );

    await expect(
      chain.executeWithFallback(operation, 'missing-op', ProviderType.OPENAI),
    ).rejects.toThrow(ProviderUnavailableError);

    expect(operation).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      'llm:fallback-exhausted',
      expect.objectContaining({
        operationName: 'missing-op',
        errors: expect.arrayContaining([
          'Provider "openai" not registered',
          'Provider "anthropic" not registered',
        ]),
      }),
    );
  });

  it('throws a combined CircuitOpenError when every provider circuit is open', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 1 });
    const openai = createProvider(ProviderType.OPENAI);
    const anthropic = createProvider(ProviderType.ANTHROPIC);
    const operation = vi.fn();

    registry.recordFailure(ProviderType.OPENAI);
    registry.recordFailure(ProviderType.ANTHROPIC);

    const chain = new LLMFallbackChainImpl(
      registry,
      new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
      ]),
      {
        chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC],
        retryPerProvider: 1,
      },
      createEventBus(),
    );

    await expect(chain.executeWithFallback(operation, 'open-circuit-op')).rejects.toThrow(
      CircuitOpenError,
    );
    await expect(chain.executeWithFallback(operation, 'open-circuit-op')).rejects.toThrow(
      /All provider circuits are open \[openai, anthropic\]/,
    );

    expect(operation).not.toHaveBeenCalled();
  });

  it('includes tracked providers outside the chain in latency stats', () => {
    const chain = new LLMFallbackChainImpl(
      new CircuitBreakerRegistry(),
      new Map([[ProviderType.LOCAL, createProvider(ProviderType.LOCAL)]]),
      {
        chain: [ProviderType.OPENAI],
      },
    );

    (chain as any)._latencyTracker.recordLatency(ProviderType.LOCAL, 7);

    expect(chain.getLatencyStats()[ProviderType.LOCAL]).toMatchObject({
      avgMs: 7,
      p95Ms: 7,
      callCount: 1,
    });
  });

  it('uses latency routing to reorder fallback providers when no preferred provider is set', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 10 });
    const openai = createProvider(ProviderType.OPENAI);
    const anthropic = createProvider(ProviderType.ANTHROPIC);
    const azure = createProvider(ProviderType.AZURE);
    const attempts: ProviderType[] = [];

    openai.complete.mockRejectedValue(new Error('openai down'));
    anthropic.complete.mockResolvedValue({ provider: ProviderType.ANTHROPIC });
    azure.complete.mockResolvedValue({ provider: ProviderType.AZURE });

    const chain = new LLMFallbackChainImpl(
      registry,
      new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
        [ProviderType.AZURE, azure],
      ]),
      {
        chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC, ProviderType.AZURE],
        retryPerProvider: 1,
        enableLatencyRouting: true,
      },
    );

    (chain as any)._latencyTracker.recordLatency(ProviderType.ANTHROPIC, 50);
    (chain as any)._latencyTracker.recordLatency(ProviderType.AZURE, 5);

    const result = await chain.executeWithFallback(
      async provider => {
        attempts.push(provider.providerType as ProviderType);
        return provider.complete('prompt', 'model');
      },
      'latency-routing-op',
    );

    expect(attempts).toEqual([
      ProviderType.OPENAI,
      ProviderType.AZURE,
    ]);
    expect(result).toEqual({ provider: ProviderType.AZURE });
    expect(anthropic.complete).not.toHaveBeenCalled();
  });
});

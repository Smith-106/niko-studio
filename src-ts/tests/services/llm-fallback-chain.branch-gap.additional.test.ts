import { describe, expect, it, vi } from 'vitest';

import type { LLMProvider } from '../../protocols/llm';
import { CircuitBreakerRegistry } from '../../services/circuit-breaker.js';
import type { IEventBus } from '../../services/event-bus.js';
import { LLMFallbackChainImpl } from '../../services/llm-fallback-chain.js';
import { ProviderType } from '../../services/llm-service';

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

function createEventBus(): MockEventBus {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    unsubscribe: vi.fn(),
  } as unknown as MockEventBus;
}

describe('services/llm-fallback-chain branch-gap coverage', () => {
  it('normalizes non-Error failures and keeps preferred-provider latency routing order', async () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 10 });
    const openai = createProvider(ProviderType.OPENAI);
    const anthropic = createProvider(ProviderType.ANTHROPIC);
    const azure = createProvider(ProviderType.AZURE);
    const eventBus = createEventBus();
    const attempts: ProviderType[] = [];

    openai.complete.mockRejectedValueOnce('openai-string-fail');
    anthropic.complete.mockResolvedValue({ provider: ProviderType.ANTHROPIC, ok: true });
    azure.complete.mockResolvedValue({ provider: ProviderType.AZURE, ok: true });

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
      eventBus,
    );

    (chain as any)._latencyTracker.recordLatency(ProviderType.ANTHROPIC, 5);
    (chain as any)._latencyTracker.recordLatency(ProviderType.AZURE, 50);

    const result = await chain.executeWithFallback(
      async (provider) => {
        attempts.push(provider.providerType as ProviderType);
        return provider.complete('prompt', 'model');
      },
      'preferred-latency-op',
      ProviderType.OPENAI,
    );

    expect(attempts).toEqual([ProviderType.OPENAI, ProviderType.ANTHROPIC]);
    expect(result).toEqual({ provider: ProviderType.ANTHROPIC, ok: true });
    expect(azure.complete).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      'llm:fallback-provider-failed',
      expect.objectContaining({
        operationName: 'preferred-latency-op',
        provider: ProviderType.OPENAI,
        error: 'openai-string-fail',
      }),
    );
  });
});

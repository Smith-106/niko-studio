import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypedEventBus } from '../../services/event-bus.js';
import { EventLogImpl } from '../../services/event-log.js';
import { DeadLetterQueueImpl, createDeadLetterEntry } from '../../services/dead-letter-queue.js';
import { CircuitBreakerRegistry, CircuitState } from '../../services/circuit-breaker.js';
import { LLMFallbackChainImpl } from '../../services/llm-fallback-chain.js';
import { ProviderType } from '../../services/llm-service.js';
import type { LLMProvider } from '../../protocols/llm';

// ---------------------------------------------------------------------------
// Stubs / Mocks
// ---------------------------------------------------------------------------

/** Minimal LLMProvider stub for testing fallback chain */
function createStubProvider(providerType: string): LLMProvider {
  return {
    providerType,
    complete: vi.fn(),
    stream: vi.fn(),
    getModels: vi.fn().mockReturnValue([]),
  } as unknown as LLMProvider;
}

function makeProviderMap(
  types: ProviderType[],
): Map<ProviderType, LLMProvider> {
  const map = new Map<ProviderType, LLMProvider>();
  for (const t of types) {
    map.set(t, createStubProvider(t));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Test 1: LLM Fallback Chain + Circuit Breaker + EventBus
// ---------------------------------------------------------------------------

describe('Integration: LLM fallback chain with circuit breaker + EventBus', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;
  let dlq: DeadLetterQueueImpl;
  let circuitRegistry: CircuitBreakerRegistry;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 100 });
    dlq = new DeadLetterQueueImpl({ maxEntries: 100, eventBus: null });
    eventBus = new TypedEventBus(undefined, {
      eventLog,
      deadLetterQueue: dlq,
    });
    circuitRegistry = new CircuitBreakerRegistry({
      failureThreshold: 2,
      cooldownMs: 100,
      halfOpenMaxCalls: 1,
    });
  });

  afterEach(() => {
    eventLog.clear();
    dlq.purge();
  });

  it('provider fails -> circuit opens -> automatic fallback -> verify fallback event published', async () => {
    const providers = makeProviderMap([ProviderType.OPENAI, ProviderType.ANTHROPIC]);

    const openaiStub = providers.get(ProviderType.OPENAI)!;
    const anthropicStub = providers.get(ProviderType.ANTHROPIC)!;

    // openai fails, anthropic succeeds
    (openaiStub.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('OpenAI unavailable'));
    (anthropicStub.complete as ReturnType<typeof vi.fn>).mockResolvedValue({ text: 'anthropic response' });

    const chain = new LLMFallbackChainImpl(
      circuitRegistry,
      providers,
      { chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC], retryPerProvider: 1 },
      eventBus,
    );

    // First call — openai fails, anthropic succeeds
    const result = await chain.executeWithFallback(
      (provider) => provider.complete('test', 'gpt-4'),
      'test-op',
    );

    expect(result).toEqual({ text: 'anthropic response' });
    expect(anthropicStub.complete).toHaveBeenCalled();

    // Circuit for openai should have recorded failures (failureThreshold=2, 1 retry = 1 failure)
    // Need another call to push past threshold
    // Actually with retryPerProvider:1, each call records 1 failure.
    // Let's call again to exceed threshold of 2
    await chain.executeWithFallback(
      (provider) => provider.complete('test2', 'gpt-4'),
      'test-op-2',
    );

    expect(circuitRegistry.getState(ProviderType.OPENAI)).toBe(CircuitState.OPEN);

    // Verify fallback event was published
    const events = eventLog.getEvents({ channel: 'llm:fallback-provider-failed' });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('circuit recovers after cooldown -> verify provider re-enabled', async () => {
    const providers = makeProviderMap([ProviderType.OPENAI, ProviderType.ANTHROPIC]);

    const openaiStub = providers.get(ProviderType.OPENAI)!;
    const anthropicStub = providers.get(ProviderType.ANTHROPIC)!;

    (openaiStub.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (anthropicStub.complete as ReturnType<typeof vi.fn>).mockResolvedValue({ text: 'ok' });

    const chain = new LLMFallbackChainImpl(
      circuitRegistry,
      providers,
      { chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC], retryPerProvider: 1 },
      eventBus,
    );

    // Call twice to open the circuit (failureThreshold=2)
    await chain.executeWithFallback(
      (p) => p.complete('x', 'gpt-4'),
      'open-circuit-1',
    );
    await chain.executeWithFallback(
      (p) => p.complete('x', 'gpt-4'),
      'open-circuit-2',
    );

    expect(circuitRegistry.getState(ProviderType.OPENAI)).toBe(CircuitState.OPEN);

    // Wait for cooldown to expire
    await new Promise((r) => setTimeout(r, 150));

    // Now circuit should transition to HALF_OPEN
    expect(circuitRegistry.getState(ProviderType.OPENAI)).toBe(CircuitState.HALF_OPEN);

    // Make openai succeed now
    (openaiStub.complete as ReturnType<typeof vi.fn>).mockResolvedValue({ text: 'openai-recovered' });

    // Execute again — openai is now in HALF_OPEN and should be tried
    const result = await chain.executeWithFallback(
      (p) => p.complete('y', 'gpt-4'),
      'recover-test',
    );

    expect(result).toEqual({ text: 'openai-recovered' });
    expect(circuitRegistry.getState(ProviderType.OPENAI)).toBe(CircuitState.CLOSED);
  });
});

// ---------------------------------------------------------------------------
// Test 2: EventBus replay + EventLog
// ---------------------------------------------------------------------------

describe('Integration: EventBus → EventLog capture → replay', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 100 });
    eventBus = new TypedEventBus(undefined, { eventLog });
  });

  afterEach(() => {
    eventLog.clear();
  });

  it('publish events → verify event log captures them → replay from sequence → verify handlers receive replayed events', () => {
    const received: Array<{ channel: string; payload: unknown }> = [];

    // Subscribe to a channel
    const unsub = eventBus.subscribe('test:channel', (payload) => {
      received.push({ channel: 'test:channel', payload });
    });

    // Publish several events
    eventBus.publish('test:channel', { seq: 1 });
    eventBus.publish('test:channel', { seq: 2 });
    eventBus.publish('test:channel', { seq: 3 });

    // Verify event log captured them
    const logged = eventLog.getEvents({ channel: 'test:channel' });
    expect(logged.length).toBe(3);
    expect(logged[0].payload).toEqual({ seq: 1 });

    // Unsubscribe and clear received buffer for replay
    unsub();
    received.length = 0;

    // Subscribe again for replay
    eventBus.subscribe('test:channel', (payload) => {
      received.push({ channel: 'test:channel', payload });
    });

    // Replay from sequence 2
    eventBus.replayFrom({ fromSeq: 2, channel: 'test:channel' });

    // Verify handler received replayed events (seq 2 and 3)
    expect(received.length).toBe(2);
    expect((received[0].payload as Record<string, unknown>).seq).toBe(2);
    expect((received[1].payload as Record<string, unknown>).seq).toBe(3);

    // Verify events were not re-persisted to the log
    const afterReplay = eventLog.getEvents({ channel: 'test:channel' });
    expect(afterReplay.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Handler throws → DLQ capture → retry from DLQ
// ---------------------------------------------------------------------------

describe('Integration: Handler error → Dead Letter Queue → retry succeeds', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;
  let dlq: DeadLetterQueueImpl;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 100 });
    dlq = new DeadLetterQueueImpl({ maxEntries: 100, eventBus: null });
    eventBus = new TypedEventBus(undefined, { eventLog, deadLetterQueue: dlq });
  });

  afterEach(() => {
    dlq.purge();
    eventLog.clear();
  });

  it('handler throws → verify event goes to dead-letter queue → retry from DLQ → verify handler succeeds', async () => {
    let callCount = 0;
    const failingHandler = (_payload: unknown) => {
      callCount++;
      throw new Error(`handler failure #${callCount}`);
    };

    eventBus.subscribe('dlq:test', failingHandler);

    // Publish an event that will trigger the handler error
    eventBus.publish('dlq:test', { data: 'important' });

    // Verify DLQ captured the entry
    expect(dlq.getSize()).toBe(1);
    const entries = dlq.getEntries({ channel: 'dlq:test' });
    expect(entries.length).toBe(1);
    expect(entries[0].channel).toBe('dlq:test');
    expect(entries[0].error.message).toContain('handler failure');

    // Unsubscribe the failing handler
    eventBus.unsubscribe('dlq:test', failingHandler);

    // Subscribe a new handler that succeeds
    const received: unknown[] = [];
    eventBus.subscribe('dlq:test', (payload) => {
      received.push(payload);
    });

    // Create a retry-capable DLQ wired to the eventBus
    const retryDlq = new DeadLetterQueueImpl({ maxEntries: 100, eventBus });
    // Copy the entry to the retry DLQ
    retryDlq.record({ ...entries[0] });

    // Retry from DLQ — this re-publishes the event through eventBus
    await retryDlq.retry(entries[0].id);

    // Verify handler received the replayed event
    expect(received.length).toBe(1);
    expect((received[0] as Record<string, unknown>).data).toBe('important');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Backpressure handling
// ---------------------------------------------------------------------------

describe('Integration: Backpressure — many handlers + rapid events', () => {
  it('subscribe many handlers → publish rapid events → verify buffer strategy delivers all', () => {
    const eventLog = new EventLogImpl({ maxRetention: 500 });
    const maxQueueSize = 2;

    const received: unknown[][] = [[], [], []];

    const eventBus = new TypedEventBus(undefined, {
      eventLog,
      backpressure: {
        maxQueueSize,
        strategy: 'buffer',
      },
    });

    // Subscribe 3 handlers
    for (let i = 0; i < 3; i++) {
      eventBus.subscribe('bp:test', (payload) => {
        received[i].push(payload);
      });
    }

    // Rapidly publish 10 events
    for (let j = 0; j < 10; j++) {
      eventBus.publish('bp:test', { idx: j });
    }

    // With 'buffer' strategy, all events should eventually be delivered
    // to all handlers since buffer defers but does not drop
    for (let i = 0; i < 3; i++) {
      expect(received[i].length).toBe(10);
    }
  });

  it('drop-oldest strategy — all events persisted in log even if some dropped from handler', () => {
    const eventLog = new EventLogImpl({ maxRetention: 500 });
    const maxQueueSize = 1;

    const received: unknown[] = [];

    const eventBus = new TypedEventBus(undefined, {
      eventLog,
      backpressure: {
        maxQueueSize,
        strategy: 'drop-oldest',
      },
    });

    eventBus.subscribe('drop:test', (payload) => {
      received.push(payload);
    });

    // Publish rapidly
    for (let j = 0; j < 5; j++) {
      eventBus.publish('drop:test', { idx: j });
    }

    // All events should be in the log regardless of handler delivery
    const logged = eventLog.getEvents({ channel: 'drop:test' });
    expect(logged.length).toBe(5);
  });

  it('sample strategy — all events persisted in log even when sampled', () => {
    const eventLog = new EventLogImpl({ maxRetention: 500 });
    const maxQueueSize = 1;

    const received: unknown[] = [];

    const eventBus = new TypedEventBus(undefined, {
      eventLog,
      backpressure: {
        maxQueueSize,
        strategy: 'sample',
      },
    });

    eventBus.subscribe('sample:test', (payload) => {
      received.push(payload);
    });

    // Publish many events rapidly
    for (let j = 0; j < 20; j++) {
      eventBus.publish('sample:test', { idx: j });
    }

    // All events should still be in the log regardless
    const logged = eventLog.getEvents({ channel: 'sample:test' });
    expect(logged.length).toBe(20);
  });
});
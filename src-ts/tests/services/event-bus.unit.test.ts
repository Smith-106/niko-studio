import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IWebSocketRelayService } from '../../container/types.js';
import { EventLogImpl } from '../../services/event-log.js';
import { TypedEventBus } from '../../services/event-bus.js';

const mockLogError = vi.hoisted(() => vi.fn());
vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    error: mockLogError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  }),
  logger: {
    error: mockLogError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  },
}));

function createRelay(overrides: Partial<IWebSocketRelayService> = {}): IWebSocketRelayService {
  return {
    broadcast: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    isConnected: vi.fn(() => true),
    ...overrides,
  };
}

function getTracker(
  bus: TypedEventBus,
  handler: (payload: unknown) => void,
): { queueDepth: number; queue: Array<{ channel: string; payload: unknown }> } {
  const trackers = (bus as unknown as {
    handlerTrackers: Map<
      (payload: unknown) => void,
      { queueDepth: number; queue: Array<{ channel: string; payload: unknown }> }
    >;
  }).handlerTrackers;

  const tracker = trackers.get(handler);
  if (!tracker) {
    throw new Error('missing tracker');
  }
  return tracker;
}

describe('services/event-bus', () => {
  afterEach(() => {
    mockLogError.mockClear();
  });

  it('supports exact subscriptions and returned unsubscribe callbacks', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('story:saved', handler);

    bus.publish('story:saved', { id: 1 });
    unsubscribe();
    bus.publish('story:saved', { id: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });

  it('supports exact unsubscribe calls and removes empty channel sets', () => {
    const bus = new TypedEventBus();
    const handler = vi.fn();

    bus.subscribe('story:removed', handler);
    bus.unsubscribe('story:removed', handler);
    bus.publish('story:removed', { id: 1 });

    const channels = (bus as unknown as {
      channels: Map<string, Set<(payload: unknown) => void>>;
    }).channels;

    expect(handler).not.toHaveBeenCalled();
    expect(channels.has('story:removed')).toBe(false);
  });

  it('supports wildcard subscriptions and explicit unsubscribe', () => {
    const bus = new TypedEventBus();
    const wildcardHandler = vi.fn();

    bus.subscribe('knowledge:*', wildcardHandler);
    bus.publish('knowledge:entity-added', { entityId: 'hero' });
    bus.unsubscribe('knowledge:*', wildcardHandler);
    bus.publish('knowledge:entity-added', { entityId: 'villain' });

    expect(wildcardHandler).toHaveBeenCalledTimes(1);
    expect(wildcardHandler).toHaveBeenCalledWith({ entityId: 'hero' });
  });

  it('supports wildcard subscriptions via returned unsubscribe callbacks and clears handler trackers', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'buffer',
      },
    });
    const wildcardHandler = vi.fn();

    const unsubscribe = bus.subscribe('knowledge:*', wildcardHandler);
    bus.publish('knowledge:entity-added', { entityId: 'hero' });
    unsubscribe();
    bus.publish('knowledge:entity-added', { entityId: 'villain' });

    const trackers = (bus as unknown as {
      handlerTrackers: Map<(payload: unknown) => void, unknown>;
    }).handlerTrackers;

    expect(wildcardHandler).toHaveBeenCalledTimes(1);
    expect(trackers.has(wildcardHandler)).toBe(false);
  });

  it('mirrors events to the relay and swallows relay failures on publish and replay', () => {
    const eventLog = new EventLogImpl({ maxRetention: 10 });
    eventLog.append('relay:test', { seq: 1 });

    const relay = createRelay({
      broadcast: vi.fn(() => {
        throw new Error('relay unavailable');
      }),
    });
    const bus = new TypedEventBus(relay, { eventLog });
    const handler = vi.fn();
    bus.subscribe('relay:test', handler);

    expect(() => bus.publish('relay:test', { seq: 2 })).not.toThrow();
    expect(() => bus.replayFrom({ fromSeq: 1, channel: 'relay:test' })).not.toThrow();
    expect(relay.broadcast).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, { seq: 2 });
    expect(handler).toHaveBeenNthCalledWith(2, { seq: 1 });
    expect(handler).toHaveBeenNthCalledWith(3, { seq: 2 });
  });

  it('appends to the event log, exposes configured services, and replays without duplicating persisted events', () => {
    const eventLog = new EventLogImpl({ maxRetention: 10 });
    const deadLetterQueue = {
      record: vi.fn(),
      getEntries: vi.fn(() => []),
      retry: vi.fn(),
      retryAll: vi.fn(),
      purge: vi.fn(),
      getSize: vi.fn(() => 0),
    };
    const bus = new TypedEventBus(undefined, { eventLog, deadLetterQueue });
    const exactHandler = vi.fn();
    const wildcardHandler = vi.fn();

    bus.subscribe('workflow:state', exactHandler);
    bus.subscribe('workflow:*', wildcardHandler);

    bus.publish('workflow:state', { step: 1 });
    bus.publish('workflow:state', { step: 2 });
    bus.replayFrom({ fromSeq: 2, channel: 'workflow:state' });

    expect(eventLog.getEvents({ channel: 'workflow:state' })).toHaveLength(2);
    expect(exactHandler).toHaveBeenCalledTimes(3);
    expect(wildcardHandler).toHaveBeenCalledTimes(3);
    expect(bus.getEventLog()).toBe(eventLog);
    expect(bus.getDeadLetterQueue()).toBe(deadLetterQueue);
  });

  it('is a no-op when replay is requested without an event log', () => {
    const bus = new TypedEventBus();

    expect(() => bus.replayFrom({ fromSeq: 1 })).not.toThrow();
    expect(bus.getEventLog()).toBeNull();
    expect(bus.getDeadLetterQueue()).toBeNull();
  });

  it('records failed handler delivery in the dead-letter queue during normal dispatch', () => {
    const deadLetterQueue = {
      record: vi.fn(),
      getEntries: vi.fn(() => []),
      retry: vi.fn(),
      retryAll: vi.fn(),
      purge: vi.fn(),
      getSize: vi.fn(() => 0),
    };
    const bus = new TypedEventBus(undefined, { deadLetterQueue });

    bus.subscribe('dlq:test', () => {
      throw new Error('handler failed');
    });
    bus.subscribe('dlq:test', vi.fn());

    bus.publish('dlq:test', { important: true });

    expect(deadLetterQueue.record).toHaveBeenCalledTimes(1);
    expect(deadLetterQueue.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'dlq:test',
        payload: { important: true },
        handlerIndex: 0,
      }),
    );
  });

  it('logs subscriber failures when no dead-letter queue is configured', () => {
    const bus = new TypedEventBus();
    bus.subscribe('error:test', () => {
      throw new Error('boom');
    });

    bus.publish('error:test', { id: 1 });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber',
      expect.objectContaining({ channel: 'error:test', error: 'boom' }),
    );
  });

  it('logs replay-time subscriber failures when no dead-letter queue is configured', () => {
    const eventLog = new EventLogImpl({ maxRetention: 10 });
    eventLog.append('replay:test', { id: 1 });
    const bus = new TypedEventBus(undefined, { eventLog });

    bus.subscribe('replay:test', () => {
      throw new Error('replay boom');
    });

    bus.replayFrom({ fromSeq: 1, channel: 'replay:test' });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber during replay',
      expect.objectContaining({ channel: 'replay:test', error: 'replay boom' }),
    );
  });

  it('captures replay-time subscriber failures in the dead-letter queue', () => {
    const eventLog = new EventLogImpl({ maxRetention: 10 });
    eventLog.append('replay:dlq', { id: 1 });
    const deadLetterQueue = {
      record: vi.fn(),
      getEntries: vi.fn(() => []),
      retry: vi.fn(),
      retryAll: vi.fn(),
      purge: vi.fn(),
      getSize: vi.fn(() => 0),
    };
    const bus = new TypedEventBus(undefined, { eventLog, deadLetterQueue });

    bus.subscribe('replay:dlq', () => {
      throw new Error('replay dlq boom');
    });

    bus.replayFrom({ fromSeq: 1, channel: 'replay:dlq' });

    expect(deadLetterQueue.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'replay:dlq',
        payload: { id: 1 },
        handlerIndex: 0,
      }),
    );
  });

  it('buffers deferred events when backpressure strategy is buffer', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'buffer',
      },
    });
    const handler = vi.fn();

    bus.subscribe('buffer:test', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;

    bus.publish('buffer:test', { id: 1 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: 1 });
    expect(tracker.queueDepth).toBe(0);
    expect(tracker.queue).toEqual([]);
  });

  it('samples away deferred events when backpressure strategy is sample', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'sample',
      },
    });
    const handler = vi.fn();

    bus.subscribe('sample:test', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;

    bus.publish('sample:test', { id: 1 });

    expect(handler).not.toHaveBeenCalled();
    expect(tracker.queue).toEqual([]);
  });

  it('drops the oldest deferred item when backpressure strategy is drop-oldest', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'drop-oldest',
      },
    });
    const received: unknown[] = [];
    const handler = vi.fn((payload: unknown) => {
      received.push(payload);
    });

    bus.subscribe('drop:test', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;
    tracker.queue.push({ channel: 'drop:test', payload: { id: 0 } });

    bus.publish('drop:test', { id: 1 });

    expect(received).toEqual([{ id: 1 }]);
    expect(tracker.queueDepth).toBe(0);
    expect(tracker.queue).toEqual([]);
  });

  it('captures backpressure flush failures in the dead-letter queue', () => {
    const deadLetterQueue = {
      record: vi.fn(),
      getEntries: vi.fn(() => []),
      retry: vi.fn(),
      retryAll: vi.fn(),
      purge: vi.fn(),
      getSize: vi.fn(() => 0),
    };
    const bus = new TypedEventBus(undefined, {
      deadLetterQueue,
      backpressure: {
        maxQueueSize: 1,
        strategy: 'buffer',
      },
    });
    const handler = vi.fn(() => {
      throw new Error('flush boom');
    });

    bus.subscribe('flush:test', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;

    bus.publish('flush:test', { id: 1 });

    expect(deadLetterQueue.record).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'flush:test',
        payload: { id: 1 },
        handlerIndex: 0,
      }),
    );
  });

  it('logs backpressure flush failures when no dead-letter queue is configured', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'buffer',
      },
    });
    const handler = vi.fn(() => {
      throw new Error('flush console boom');
    });

    bus.subscribe('flush:console', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;

    bus.publish('flush:console', { id: 1 });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber during backpressure flush',
      expect.objectContaining({ channel: 'flush:console', error: 'flush console boom' }),
    );
  });
});

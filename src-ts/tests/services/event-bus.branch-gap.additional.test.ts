import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('services/event-bus branch-gap coverage', () => {
  afterEach(() => {
    mockLogError.mockClear();
  });

  it('logs non-Error subscriber failures during normal dispatch', () => {
    const bus = new TypedEventBus();
    bus.subscribe('string:error', () => {
      throw 'plain-string-error';
    });

    bus.publish('string:error', { id: 1 });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber',
      expect.objectContaining({ channel: 'string:error', error: 'plain-string-error' }),
    );
  });

  it('logs non-Error subscriber failures during replay', () => {
    const eventLog = new EventLogImpl({ maxRetention: 10 });
    eventLog.append('replay:string', { id: 1 });
    const bus = new TypedEventBus(undefined, { eventLog });

    bus.subscribe('replay:string', () => {
      throw 'replay-string-error';
    });

    bus.replayFrom({ fromSeq: 1, channel: 'replay:string' });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber during replay',
      expect.objectContaining({ channel: 'replay:string', error: 'replay-string-error' }),
    );
  });

  it('logs non-Error subscriber failures during backpressure flush', () => {
    const bus = new TypedEventBus(undefined, {
      backpressure: {
        maxQueueSize: 1,
        strategy: 'buffer',
      },
    });
    const handler = vi.fn(() => {
      throw 'flush-string-error';
    });

    bus.subscribe('flush:string', handler);
    const tracker = getTracker(bus, handler);
    tracker.queueDepth = 1;

    bus.publish('flush:string', { id: 1 });

    expect(mockLogError).toHaveBeenCalledWith(
      'Error in subscriber during backpressure flush',
      expect.objectContaining({ channel: 'flush:string', error: 'flush-string-error' }),
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const logWarnMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logDebugMock = vi.hoisted(() => vi.fn());

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    warn: logWarnMock,
    info: logInfoMock,
    debug: logDebugMock,
  }),
}));

import {
  DeadLetterQueueImpl,
  createDeadLetterEntry,
  type DeadLetterEntry,
} from '../../services/dead-letter-queue.js';

function createEntry(id: string, channel = 'writing:error', timestamp = 1000): DeadLetterEntry {
  return {
    id,
    channel,
    payload: { id },
    error: { message: `boom:${id}`, name: 'Error' },
    handlerIndex: 0,
    timestamp,
    retryCount: 0,
    lastRetryAt: null,
  };
}

describe('services/dead-letter-queue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('creates dead-letter entries from Error and non-Error inputs', () => {
    const errorEntry = createDeadLetterEntry('channel:a', { ok: true }, new TypeError('bad type'), 2);
    const scalarEntry = createDeadLetterEntry('channel:b', 'payload', 42, 1);

    expect(errorEntry).toMatchObject({
      channel: 'channel:a',
      payload: { ok: true },
      handlerIndex: 2,
      retryCount: 0,
      lastRetryAt: null,
      error: {
        name: 'TypeError',
        message: 'bad type',
      },
    });
    expect(scalarEntry.error).toMatchObject({
      name: 'Error',
      message: '42',
    });
  });

  it('records entries, evicts the oldest, filters queries, and swallows event-bus publish failures', () => {
    const publish = vi.fn(() => {
      throw new Error('monitoring offline');
    });
    const dlq = new DeadLetterQueueImpl({
      maxEntries: 2,
      eventBus: { publish } as never,
    });

    dlq.record(createEntry('one', 'alpha', 100));
    dlq.record(createEntry('two', 'beta', 200));
    dlq.record(createEntry('three', 'beta', 300));

    expect(dlq.getSize()).toBe(2);
    expect(dlq.getEntries().map((entry) => entry.id)).toEqual(['two', 'three']);
    expect(dlq.getEntries({ channel: 'beta', since: 250, limit: 1 }).map((entry) => entry.id)).toEqual(['three']);
    expect(publish).toHaveBeenCalledWith(
      'eventbus:dead-letter',
      expect.objectContaining({ id: 'three' }),
    );
  });

  it('warns when retrying a missing entry or when no event bus is available', async () => {
    const dlqWithoutBus = new DeadLetterQueueImpl();
    dlqWithoutBus.record(createEntry('solo'));

    await dlqWithoutBus.retry('missing');
    await dlqWithoutBus.retry('solo');

    expect(logWarnMock).toHaveBeenCalledWith('retry failed: entry id=missing not found');
    expect(logWarnMock).toHaveBeenCalledWith('retry failed: no EventBus available for id=solo');
    expect(dlqWithoutBus.getSize()).toBe(1);
  });

  it('retries successfully, retries selectively by channel, and purges specific or all entries', async () => {
    const publish = vi.fn();
    const dlq = new DeadLetterQueueImpl({
      maxEntries: 10,
      eventBus: { publish } as never,
    });

    dlq.record(createEntry('one', 'alpha', 100));
    dlq.record(createEntry('two', 'beta', 200));
    dlq.record(createEntry('three', 'beta', 300));

    await dlq.retry('one');
    expect(publish).toHaveBeenCalledWith('alpha', { id: 'one' });
    expect(dlq.getEntries().map((entry) => entry.id)).toEqual(['two', 'three']);
    expect(logInfoMock).toHaveBeenCalledWith('retry succeeded for entry id=one channel="alpha"');

    await dlq.retryAll('beta');
    expect(publish).toHaveBeenCalledWith('beta', { id: 'two' });
    expect(publish).toHaveBeenCalledWith('beta', { id: 'three' });
    expect(dlq.getSize()).toBe(0);

    dlq.record(createEntry('four', 'gamma', 400));
    dlq.record(createEntry('five', 'delta', 500));
    dlq.purge(['four']);
    expect(dlq.getEntries().map((entry) => entry.id)).toEqual(['five']);

    dlq.purge();
    expect(dlq.getSize()).toBe(0);
    expect(logDebugMock).toHaveBeenCalledWith('purged all dead-letter entries');
  });

  it('keeps failed retries in the queue and logs the failure', async () => {
    const publish = vi.fn(() => {
      throw new Error('publish failed');
    });
    const dlq = new DeadLetterQueueImpl({
      eventBus: { publish } as never,
    });

    dlq.record(createEntry('broken', 'retry:test', 100));
    const beforeRetry = dlq.getEntries()[0];

    await dlq.retry('broken');

    const afterRetry = dlq.getEntries()[0];
    expect(afterRetry.id).toBe('broken');
    expect(afterRetry.retryCount).toBe(1);
    expect(afterRetry.lastRetryAt).not.toBeNull();
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('retry failed for entry id=broken: publish failed'),
    );
    expect(beforeRetry.id).toBe(afterRetry.id);
  });

  it('surfaces non-Error retry failures without wrapping them', async () => {
    const publish = vi.fn(() => {
      throw 'plain failure';
    });
    const dlq = new DeadLetterQueueImpl({
      eventBus: { publish } as never,
    });

    dlq.record(createEntry('stringy', 'retry:test', 100));
    await dlq.retry('stringy');

    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('retry failed for entry id=stringy: plain failure'),
    );
    expect(dlq.getEntries()).toHaveLength(1);
  });
});

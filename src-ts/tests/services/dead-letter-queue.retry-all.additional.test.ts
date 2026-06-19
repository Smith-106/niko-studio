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
  type DeadLetterEntry,
} from '../../services/dead-letter-queue.js';

function createEntry(id: string, channel: string): DeadLetterEntry {
  return {
    id,
    channel,
    payload: { id },
    error: { message: `boom:${id}`, name: 'Error' },
    handlerIndex: 0,
    timestamp: 1000,
    retryCount: 0,
    lastRetryAt: null,
  };
}

describe('services/dead-letter-queue retryAll branch coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('retries every queued entry when no channel filter is provided', async () => {
    const publish = vi.fn();
    const dlq = new DeadLetterQueueImpl({
      eventBus: { publish } as never,
    });

    dlq.record(createEntry('alpha', 'channel:a'));
    dlq.record(createEntry('beta', 'channel:b'));

    await dlq.retryAll();

    expect(publish).toHaveBeenCalledWith('channel:a', { id: 'alpha' });
    expect(publish).toHaveBeenCalledWith('channel:b', { id: 'beta' });
    expect(dlq.getSize()).toBe(0);
    expect(logInfoMock).toHaveBeenCalledWith('retry succeeded for entry id=alpha channel="channel:a"');
    expect(logInfoMock).toHaveBeenCalledWith('retry succeeded for entry id=beta channel="channel:b"');
  });
});

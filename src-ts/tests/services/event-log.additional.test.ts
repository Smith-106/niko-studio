import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventLogImpl } from '../../services/event-log.js';

describe('services/event-log additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('evicts oldest events when retention is exceeded and keeps sequence numbers monotonic', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(30);

    const log = new EventLogImpl({ maxRetention: 2 });

    expect(log.append('story', { id: 1 })).toBe(1);
    expect(log.append('audit', { id: 2 })).toBe(2);
    expect(log.append('story', { id: 3 })).toBe(3);

    expect(log.getLatestSeq()).toBe(3);
    expect(log.getEvents()).toEqual([
      {
        seq: 2,
        channel: 'audit',
        payload: { id: 2 },
        timestamp: 20,
      },
      {
        seq: 3,
        channel: 'story',
        payload: { id: 3 },
        timestamp: 30,
      },
    ]);
  });

  it('supports unlimited retention and layered filters for getEvents', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(300);

    const log = new EventLogImpl({ maxRetention: 0 });

    log.append('story', { id: 1 });
    log.append('audit', { id: 2 });
    log.append('story', { id: 3 });

    expect(log.getEvents({ limit: 0 })).toHaveLength(3);
    expect(
      log.getEvents({
        fromSeq: 2,
        toSeq: 3,
        channel: 'story',
        limit: 1,
      }),
    ).toEqual([
      {
        seq: 3,
        channel: 'story',
        payload: { id: 3 },
        timestamp: 300,
      },
    ]);
  });

  it('replays by sequence and timestamp, then resets cleanly on clear', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    const log = new EventLogImpl();

    log.append('story', { id: 1 });
    log.append('audit', { id: 2 });
    log.append('story', { id: 3 });

    expect(log.replayFrom({ fromSeq: 2, limit: 2 })).toEqual([
      {
        seq: 2,
        channel: 'audit',
        payload: { id: 2 },
        timestamp: 2000,
      },
      {
        seq: 3,
        channel: 'story',
        payload: { id: 3 },
        timestamp: 3000,
      },
    ]);

    expect(
      log.replayFrom({
        fromTimestamp: 1500,
        channel: 'story',
        limit: 1,
      }),
    ).toEqual([
      {
        seq: 3,
        channel: 'story',
        payload: { id: 3 },
        timestamp: 3000,
      },
    ]);

    log.clear();

    expect(log.getLatestSeq()).toBe(0);
    expect(log.getEvents()).toEqual([]);
  });
});

/**
 * EventLog — append-only ring buffer for event persistence and replay.
 *
 * Design:
 * - Array-backed ring buffer with configurable max retention
 * - Monotonically increasing sequence numbers across the entire lifetime
 * - Supports filtering by sequence range, channel, and limit
 * - replayFrom() returns events starting from a given sequence or timestamp
 * - 0 maxRetention = unlimited (no eviction)
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('event-log');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredEvent {
  seq: number;
  channel: string;
  payload: unknown;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IEventLog {
  /**
   * Append an event to the log. Returns the assigned sequence number.
   */
  append(channel: string, payload: unknown): number;

  /**
   * Query stored events with optional filters.
   */
  getEvents(options?: {
    fromSeq?: number;
    toSeq?: number;
    channel?: string;
    limit?: number;
  }): StoredEvent[];

  /**
   * Replay events starting from a given sequence or timestamp,
   * optionally filtered by channel.
   */
  replayFrom(options: {
    fromSeq?: number;
    fromTimestamp?: number;
    channel?: string;
    limit?: number;
  }): StoredEvent[];

  /**
   * Get the current highest sequence number.
   */
  getLatestSeq(): number;

  /**
   * Clear all stored events and reset the sequence counter.
   */
  clear(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class EventLogImpl implements IEventLog {
  private buffer: StoredEvent[] = [];
  private seqCounter = 0;
  private readonly maxRetention: number;

  constructor(options?: { maxRetention?: number }) {
    this.maxRetention = options?.maxRetention ?? 10000;
  }

  append(channel: string, payload: unknown): number {
    this.seqCounter += 1;
    const event: StoredEvent = {
      seq: this.seqCounter,
      channel,
      payload,
      timestamp: Date.now(),
    };

    this.buffer.push(event);

    // Evict oldest when maxRetention is exceeded (0 = unlimited)
    if (this.maxRetention > 0 && this.buffer.length > this.maxRetention) {
      this.buffer.shift();
    }

    _log.debug(`appended event seq=${event.seq} channel="${channel}"`);
    return event.seq;
  }

  getEvents(options?: {
    fromSeq?: number;
    toSeq?: number;
    channel?: string;
    limit?: number;
  }): StoredEvent[] {
    const { fromSeq, toSeq, channel, limit } = options ?? {};

    let results = this.buffer;

    if (fromSeq !== undefined) {
      results = results.filter(e => e.seq >= fromSeq);
    }
    if (toSeq !== undefined) {
      results = results.filter(e => e.seq <= toSeq);
    }
    if (channel !== undefined) {
      results = results.filter(e => e.channel === channel);
    }

    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  replayFrom(options: {
    fromSeq?: number;
    fromTimestamp?: number;
    channel?: string;
    limit?: number;
  }): StoredEvent[] {
    const { fromSeq, fromTimestamp, channel, limit } = options;

    let results = this.buffer;

    if (fromSeq !== undefined) {
      results = results.filter(e => e.seq >= fromSeq);
    }
    if (fromTimestamp !== undefined) {
      results = results.filter(e => e.timestamp >= fromTimestamp);
    }
    if (channel !== undefined) {
      results = results.filter(e => e.channel === channel);
    }

    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  getLatestSeq(): number {
    return this.seqCounter;
  }

  clear(): void {
    this.buffer = [];
    this.seqCounter = 0;
    _log.debug('cleared event log');
  }
}

/**
 * DeadLetterQueue — captures failed event handler deliveries.
 *
 * Design:
 * - Records handler errors with full context (channel, payload, error info)
 * - Supports retry of individual entries or all entries for a channel
 * - Retry re-publishes the original event via the EventBus
 * - Configurable max entries with oldest-eviction policy
 * - Events published to 'eventbus:dead-letter' channel when entries are recorded
 */

import { createLogger } from '../logger/index.js';
import type { IEventBus } from './event-bus';

const _log = createLogger('dead-letter-queue');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeadLetterEntry {
  id: string;
  channel: string;
  payload: unknown;
  error: { message: string; name: string; stack?: string };
  handlerIndex: number;
  timestamp: number;
  retryCount: number;
  lastRetryAt: number | null;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IDeadLetterQueue {
  /**
   * Record a failed handler delivery.
   */
  record(entry: DeadLetterEntry): void;

  /**
   * Query entries with optional filters.
   */
  getEntries(options?: {
    channel?: string;
    limit?: number;
    since?: number;
  }): DeadLetterEntry[];

  /**
   * Retry a single failed entry by re-publishing via the EventBus.
   */
  retry(entryId: string): Promise<void>;

  /**
   * Retry all entries, optionally filtered by channel.
   */
  retryAll(channel?: string): Promise<void>;

  /**
   * Remove entries. All entries removed if no ids specified.
   */
  purge(entryIds?: string[]): void;

  /**
   * Get the current number of entries.
   */
  getSize(): number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function generateEntryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 6);
  return `dlq-${timestamp}-${random}`;
}

export class DeadLetterQueueImpl implements IDeadLetterQueue {
  private entries: DeadLetterEntry[] = [];
  private readonly maxEntries: number;
  private readonly eventBus: IEventBus | null;

  constructor(options?: { maxEntries?: number; eventBus?: IEventBus }) {
    this.maxEntries = options?.maxEntries ?? 1000;
    this.eventBus = options?.eventBus ?? null;
  }

  record(entry: DeadLetterEntry): void {
    this.entries.push(entry);

    // Evict oldest when maxEntries is exceeded
    if (this.maxEntries > 0 && this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    _log.warn(
      `recorded dead-letter entry id=${entry.id} channel="${entry.channel}" error="${entry.error.message}"`,
    );

    // Publish to 'eventbus:dead-letter' channel for monitoring
    if (this.eventBus) {
      try {
        this.eventBus.publish('eventbus:dead-letter', entry);
      } catch {
        // Publishing to dead-letter channel must never throw
      }
    }
  }

  getEntries(options?: {
    channel?: string;
    limit?: number;
    since?: number;
  }): DeadLetterEntry[] {
    const { channel, limit, since } = options ?? {};

    let results = this.entries;

    if (channel !== undefined) {
      results = results.filter(e => e.channel === channel);
    }
    if (since !== undefined) {
      results = results.filter(e => e.timestamp >= since);
    }

    if (limit !== undefined && limit > 0) {
      results = results.slice(0, limit);
    }

    return results;
  }

  async retry(entryId: string): Promise<void> {
    const entry = this.entries.find(e => e.id === entryId);
    if (!entry) {
      _log.warn(`retry failed: entry id=${entryId} not found`);
      return;
    }

    if (!this.eventBus) {
      _log.warn(`retry failed: no EventBus available for id=${entryId}`);
      return;
    }

    entry.retryCount += 1;
    entry.lastRetryAt = Date.now();

    try {
      this.eventBus.publish(entry.channel, entry.payload);
      // Remove entry after successful retry
      this.entries = this.entries.filter(e => e.id !== entryId);
      _log.info(`retry succeeded for entry id=${entryId} channel="${entry.channel}"`);
    } catch (err) {
      _log.warn(
        `retry failed for entry id=${entryId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async retryAll(channel?: string): Promise<void> {
    const matching = channel !== undefined
      ? this.entries.filter(e => e.channel === channel)
      : this.entries;

    for (const entry of matching) {
      await this.retry(entry.id);
    }
  }

  purge(entryIds?: string[]): void {
    if (!entryIds || entryIds.length === 0) {
      this.entries = [];
      _log.debug('purged all dead-letter entries');
    } else {
      this.entries = this.entries.filter(e => !entryIds.includes(e.id));
      _log.debug(`purged ${entryIds.length} dead-letter entries`);
    }
  }

  getSize(): number {
    return this.entries.length;
  }
}

// ---------------------------------------------------------------------------
// Helper — create a DeadLetterEntry from a handler error
// ---------------------------------------------------------------------------

export function createDeadLetterEntry(
  channel: string,
  payload: unknown,
  error: unknown,
  handlerIndex: number,
): DeadLetterEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    id: generateEntryId(),
    channel,
    payload,
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack,
    },
    handlerIndex,
    timestamp: Date.now(),
    retryCount: 0,
    lastRetryAt: null,
  };
}
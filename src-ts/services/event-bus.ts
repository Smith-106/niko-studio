/**
 * Cross-service EventBus — synchronous in-process pub/sub with wildcard support.
 *
 * Design:
 * - Map<string, Set<Handler>> for O(1) channel lookup
 * - Wildcard subscriptions: 'knowledge:*' matches 'knowledge:entity-added'
 * - Subscriber errors are caught and logged, never blocking other subscribers
 * - Optional IWebSocketRelayService mirroring for external browser clients
 * - Optional EventLog for persistence and replay (opt-in)
 * - Optional DeadLetterQueue for failed handler delivery capture (opt-in)
 * - Optional backpressure tracking per handler (opt-in)
 *
 * All new features are opt-in. When no EventBusConfig is provided,
 * behavior is identical to the original implementation.
 */

import type { IWebSocketRelayService } from '../container/types';
import type { IEventLog, StoredEvent } from './event-log';
import type { IDeadLetterQueue, DeadLetterEntry } from './dead-letter-queue';
import { createDeadLetterEntry } from './dead-letter-queue';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IEventBus {
  /**
   * Publish a payload to all subscribers of the given channel.
   * Wildcard subscribers whose pattern matches the channel also receive the event.
   */
  publish(channel: string, payload: unknown): void;

  /**
   * Subscribe to a channel. Returns an unsubscribe function.
   * Channel may end with ':*' to subscribe to all events with that prefix.
   */
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;

  /**
   * Unsubscribe a specific handler from a channel.
   */
  unsubscribe(channel: string, handler: (payload: unknown) => void): void;
}

// ---------------------------------------------------------------------------
// EventBusConfig — opt-in extensions
// ---------------------------------------------------------------------------

export interface EventBusConfig {
  /** Append-only log for event persistence and replay */
  eventLog?: IEventLog;
  /** Dead-letter queue for failed handler deliveries */
  deadLetterQueue?: IDeadLetterQueue;
  /** Backpressure control per handler */
  backpressure?: {
    maxQueueSize: number;
    strategy: 'buffer' | 'sample' | 'drop-oldest';
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

type Handler = (payload: unknown) => void;

interface HandlerTracker {
  handler: Handler;
  queueDepth: number;
  queue: Array<{ channel: string; payload: unknown }>;
}

export class TypedEventBus implements IEventBus {
  private readonly channels = new Map<string, Set<Handler>>();
  private readonly wildcardPrefixes = new Map<string, Set<Handler>>();
  private readonly relay: IWebSocketRelayService | null;
  private readonly eventLog: IEventLog | null;
  private readonly deadLetterQueue: IDeadLetterQueue | null;
  private readonly backpressure: EventBusConfig['backpressure'] | null;
  private readonly handlerTrackers = new Map<Handler, HandlerTracker>();
  private handlerIndexCounter = 0;

  constructor(relay?: IWebSocketRelayService, config?: EventBusConfig) {
    this.relay = relay ?? null;
    this.eventLog = config?.eventLog ?? null;
    this.deadLetterQueue = config?.deadLetterQueue ?? null;
    this.backpressure = config?.backpressure ?? null;
  }

  publish(channel: string, payload: unknown): void {
    // Persist to event log (opt-in)
    if (this.eventLog) {
      this.eventLog.append(channel, payload);
    }

    // Exact-match subscribers
    const exactHandlers = this.channels.get(channel);
    if (exactHandlers) {
      this.dispatch(exactHandlers, channel, payload);
    }

    // Wildcard subscribers — check all registered prefixes
    for (const [prefix, handlers] of this.wildcardPrefixes) {
      if (channel.startsWith(prefix)) {
        this.dispatch(handlers, channel, payload);
      }
    }

    // Mirror to WebSocket relay (if connected)
    if (this.relay) {
      try {
        this.relay.broadcast(channel, payload);
      } catch {
        // Relay mirroring failure must never block the publisher
      }
    }
  }

  subscribe(channel: string, handler: (payload: unknown) => void): () => void {
    // Register handler tracker for backpressure (opt-in)
    if (this.backpressure) {
      this.handlerTrackers.set(handler, {
        handler,
        queueDepth: 0,
        queue: [],
      });
    }

    if (channel.endsWith(':*')) {
      const prefix = channel.slice(0, -1); // 'knowledge:*' → 'knowledge:'
      let handlers = this.wildcardPrefixes.get(prefix);
      if (!handlers) {
        handlers = new Set<Handler>();
        this.wildcardPrefixes.set(prefix, handlers);
      }
      handlers.add(handler);
      return () => {
        const h = this.wildcardPrefixes.get(prefix);
        if (h) {
          h.delete(handler);
          if (h.size === 0) this.wildcardPrefixes.delete(prefix);
        }
        this.handlerTrackers.delete(handler);
      };
    }

    let handlers = this.channels.get(channel);
    if (!handlers) {
      handlers = new Set<Handler>();
      this.channels.set(channel, handlers);
    }
    handlers.add(handler);
    return () => {
      const h = this.channels.get(channel);
      if (h) {
        h.delete(handler);
        if (h.size === 0) this.channels.delete(channel);
      }
      this.handlerTrackers.delete(handler);
    };
  }

  unsubscribe(channel: string, handler: (payload: unknown) => void): void {
    this.handlerTrackers.delete(handler);

    if (channel.endsWith(':*')) {
      const prefix = channel.slice(0, -1);
      const handlers = this.wildcardPrefixes.get(prefix);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) this.wildcardPrefixes.delete(prefix);
      }
      return;
    }

    const handlers = this.channels.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) this.channels.delete(channel);
    }
  }

  /**
   * Replay events from the EventLog without re-persisting to the log.
   * Requires EventLog to be configured; no-op if not available.
   */
  replayFrom(options: {
    fromSeq?: number;
    fromTimestamp?: number;
    channel?: string;
    limit?: number;
  }): void {
    if (!this.eventLog) return;

    const events = this.eventLog.replayFrom(options);
    for (const event of events) {
      // Dispatch directly — bypass eventLog.append() to avoid re-persisting
      const exactHandlers = this.channels.get(event.channel);
      if (exactHandlers) {
        this.dispatchWithoutLog(exactHandlers, event.channel, event.payload);
      }

      for (const [prefix, handlers] of this.wildcardPrefixes) {
        if (event.channel.startsWith(prefix)) {
          this.dispatchWithoutLog(handlers, event.channel, event.payload);
        }
      }

      // Mirror to WebSocket relay (if connected)
      if (this.relay) {
        try {
          this.relay.broadcast(event.channel, event.payload);
        } catch {
          // Relay mirroring failure must never block replay
        }
      }
    }
  }

  /**
   * Get the configured EventLog, or null if not available.
   */
  getEventLog(): IEventLog | null {
    return this.eventLog;
  }

  /**
   * Get the configured DeadLetterQueue, or null if not available.
   */
  getDeadLetterQueue(): IDeadLetterQueue | null {
    return this.deadLetterQueue;
  }

  /**
   * Dispatch to a set of handlers with event logging and DLQ capture.
   * This is the primary dispatch used by publish().
   */
  private dispatch(handlers: Set<Handler>, channel: string, payload: unknown): void {
    let handlerIdx = 0;
    for (const handler of handlers) {
      // Backpressure check (opt-in)
      if (this.backpressure) {
        const tracker = this.handlerTrackers.get(handler);
        if (tracker && tracker.queueDepth >= this.backpressure.maxQueueSize) {
          this.applyBackpressure(tracker, channel, payload);
          handlerIdx++;
          continue;
        }
      }

      try {
        handler(payload);
      } catch (err) {
        // Capture into DeadLetterQueue (opt-in) or log to console
        if (this.deadLetterQueue) {
          const entry = createDeadLetterEntry(channel, payload, err, handlerIdx);
          this.deadLetterQueue.record(entry);
        } else {
          // Subscriber errors are logged but never block other subscribers
          console.error(
            `[EventBus] Error in subscriber for channel "${channel}":`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      handlerIdx++;
    }
  }

  /**
   * Dispatch without appending to the EventLog.
   * Used by replayFrom() to avoid re-persisting events.
   */
  private dispatchWithoutLog(handlers: Set<Handler>, channel: string, payload: unknown): void {
    let handlerIdx = 0;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        if (this.deadLetterQueue) {
          const entry = createDeadLetterEntry(channel, payload, err, handlerIdx);
          this.deadLetterQueue.record(entry);
        } else {
          console.error(
            `[EventBus] Error in subscriber for channel "${channel}" during replay:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      handlerIdx++;
    }
  }

  /**
   * Apply backpressure strategy when a handler's queue is at capacity.
   */
  private applyBackpressure(
    tracker: HandlerTracker,
    channel: string,
    payload: unknown,
  ): void {
    const strategy = this.backpressure!.strategy;

    switch (strategy) {
      case 'drop-oldest':
        // Drop the oldest queued item and add the new one
        if (tracker.queue.length > 0) {
          tracker.queue.shift();
        }
        tracker.queue.push({ channel, payload });
        // Process the queue asynchronously
        this.flushTrackerQueue(tracker);
        break;

      case 'sample':
        // Only deliver if queue depth is below threshold (effectively skip this event)
        // Already at max — drop this event entirely
        break;

      case 'buffer':
        // Buffer beyond maxQueueSize — defer delivery
        tracker.queue.push({ channel, payload });
        tracker.queueDepth = tracker.queue.length;
        this.flushTrackerQueue(tracker);
        break;
    }
  }

  /**
   * Flush a handler's deferred queue by delivering events one at a time.
   */
  private flushTrackerQueue(tracker: HandlerTracker): void {
    while (tracker.queue.length > 0) {
      const item = tracker.queue.shift()!;
      tracker.queueDepth = tracker.queue.length;
      try {
        tracker.handler(item.payload);
      } catch (err) {
        if (this.deadLetterQueue) {
          const entry = createDeadLetterEntry(item.channel, item.payload, err, 0);
          this.deadLetterQueue.record(entry);
        } else {
          console.error(
            `[EventBus] Error in subscriber for channel "${item.channel}" during backpressure flush:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    tracker.queueDepth = 0;
  }
}

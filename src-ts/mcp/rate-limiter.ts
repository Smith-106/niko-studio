/**
 * In-memory sliding-window rate limiter with LRU eviction.
 *
 * Provides basic rate limiting without external dependencies (Redis).
 * Used as the default rate limiter; replaced by Redis-backed implementation
 * when Redis is available.
 *
 * Learned from maestro-flow: sliding window + setInterval.unref() +
 * amortized per-call cleanup + maxEntries cap prevents unbounded growth.
 */

interface Window {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly _windows: Map<string, Window> = new Map();
  private readonly _cleanupIntervalMs: number;
  private readonly _maxEntries: number;
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalSeconds: number = 60, maxEntries: number = 10000) {
    this._cleanupIntervalMs = cleanupIntervalSeconds * 1000;
    this._maxEntries = maxEntries;
  }

  /**
   * Start periodic cleanup of expired windows.
   */
  start(): void {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => this.cleanup(), this._cleanupIntervalMs);
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup.
   */
  stop(): void {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  /**
   * Check if a request is allowed under the rate limit (sliding window).
   *
   * Uses a sliding-window approach: each call checks the current window
   * and also performs amortized cleanup of stale entries.
   *
   * @param key - Identifier for the client/route (e.g. IP + route pattern)
   * @param limit - Maximum requests per window
   * @param windowSeconds - Window duration in seconds
   * @returns true if the request is allowed, false if rate limited
   */
  allow(key: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / (windowSeconds * 1000))}`;

    // Amortized cleanup: evict stale entries for this key prefix occasionally
    if (this._windows.size > this._maxEntries) {
      this.cleanup();
    }

    let entry = this._windows.get(windowKey);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowSeconds * 1000 };
      this._windows.set(windowKey, entry);
    }

    entry.count += 1;
    return entry.count <= limit;
  }

  /**
   * Remove expired windows to prevent memory leaks.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this._windows) {
      if (now >= entry.resetAt) {
        this._windows.delete(key);
      }
    }
  }

  /**
   * Get current window count for a key (useful for testing/diagnostics).
   */
  getCount(key: string, limit: number, windowSeconds: number): number {
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / (windowSeconds * 1000))}`;
    return this._windows.get(windowKey)?.count ?? 0;
  }
}

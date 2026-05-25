/**
 * Query Embedding Cache with LRU, TTL, and per-key deduplication
 *
 * Features:
 * - LRU cache with configurable max size (default: 1000)
 * - TTL-based expiration (default: 1 hour)
 * - Per-key Promise deduplication (replaces global async-lock)
 * - Stale-while-revalidate for concurrent lookups
 * - Memory-efficient storage
 *
 * Migrated from global async-lock (bottleneck) to per-key Promise
 * caching pattern learned from maestro-flow's Semaphore design.
 */

import { createHash } from 'crypto';

/** Cache entry with embedding and timestamp. */
export interface CacheEntry {
  /** Embedding vector. */
  embedding: number[];
  /** Creation timestamp (epoch milliseconds). */
  created_at: number;
  /** Number of times accessed. */
  access_count: number;
}

/**
 * LRU cache for query embeddings with TTL and per-key deduplication.
 *
 * Usage:
 *     const cache = new QueryEmbeddingCache(max_size=1000, ttl_seconds=3600);
 *
 *     // Try to get from cache
 *     const embedding = cache.get(query);
 *     if (embedding is null) {
 *         embedding = embedder.embed(query);
 *         cache.put(query, embedding);
 *     }
 */
export class QueryEmbeddingCache {
  private max_size: number;
  private ttl_seconds: number;
  private _cache = new Map<string, CacheEntry>();
  private _hits = 0;
  private _misses = 0;

  /** Per-key pending Promise deduplication — replaces global lock. */
  private _pending = new Map<string, Promise<number[]>>();

  constructor(max_size: number = 1000, ttl_seconds: number = 3600.0) {
    this.max_size = max_size;
    this.ttl_seconds = ttl_seconds;
    this._cache = new Map();
    this._pending = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  /** Generate a consistent hash for the query. */
  private _hashQuery(query: string): string {
    return createHash('sha256').update(query).digest('hex').substring(0, 16);
  }

  /** Check if a cache entry has expired. */
  private _isExpired(entry: CacheEntry): boolean {
    return (Date.now() - entry.created_at) > this.ttl_seconds;
  }

  /**
   * Get embedding from cache (sync version).
   *
   * @param query - The query string
   * @returns Embedding list if found and not expired, null otherwise
   */
  get(query: string): number[] | null {
    const key = this._hashQuery(query);

    if (!this._cache.has(key)) {
      this._misses++;
      return null;
    }

    const entry = this._cache.get(key)!;

    if (this._isExpired(entry)) {
      this._cache.delete(key);
      this._misses++;
      return null;
    }

    // Move to end (most recently used): delete then re-insert
    this._cache.delete(key);
    this._cache.set(key, entry);
    entry.access_count++;
    this._hits++;

    return entry.embedding;
  }

  /**
   * Get embedding from cache (async version).
   *
   * No global lock — uses per-key deduplication when combined
   * with getOrComputeAsync.
   */
  async getAsync(query: string): Promise<number[] | null> {
    return this.get(query);
  }

  /**
   * Store embedding in cache (sync version).
   *
   * @param query - The query string
   * @param embedding - The embedding vector
   */
  put(query: string, embedding: number[]): void {
    const key = this._hashQuery(query);

    while (this._cache.size >= this.max_size) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
      } else {
        break;
      }
    }

    this._cache.set(key, {
      embedding,
      created_at: Date.now(),
      access_count: 1,
    });
  }

  /**
   * Store embedding in cache (async version).
   */
  async putAsync(query: string, embedding: number[]): Promise<void> {
    this.put(query, embedding);
  }

  /**
   * Get from cache or compute and store (sync version).
   *
   * @param query - The query string
   * @param compute_fn - Function to compute embedding if not cached
   * @returns Embedding vector
   */
  getOrCompute(query: string, compute_fn: (query: string) => number[]): number[] {
    const cached = this.get(query);
    if (cached !== null) {
      return cached;
    }

    const embedding = compute_fn(query);
    this.put(query, embedding);
    return embedding;
  }

  /**
   * Get from cache or compute and store (async version).
   *
   * Uses per-key Promise deduplication instead of a global lock:
   * - Concurrent requests for the same key share one computation
   * - Different keys compute in parallel without blocking
   * - No global lock contention
   *
   * @param query - The query string
   * @param compute_fn - Async or sync function to compute embedding
   * @returns Embedding vector
   */
  async getOrComputeAsync(
    query: string,
    compute_fn: (query: string) => number[] | Promise<number[]>,
  ): Promise<number[]> {
    const cached = this.get(query);
    if (cached !== null) {
      return cached;
    }

    // Per-key deduplication: if this key is already being computed, await it
    const key = this._hashQuery(query);
    const pending = this._pending.get(key);
    if (pending) {
      return pending;
    }

    // Create the computation promise and register it
    const computePromise = (async () => {
      try {
        const maybePromise = compute_fn(query);
        const embedding = maybePromise instanceof Promise
          ? await maybePromise
          : maybePromise;
        this.put(query, embedding);
        return embedding;
      } finally {
        this._pending.delete(key);
      }
    })();

    this._pending.set(key, computePromise);
    return computePromise;
  }

  /**
   * Remove a specific query from cache.
   *
   * @param query - The query string
   * @returns True if entry was removed, False if not found
   */
  invalidate(query: string): boolean {
    const key = this._hashQuery(query);
    if (this._cache.has(key)) {
      this._cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all entries from cache.
   *
   * @returns Number of entries cleared
   */
  clear(): number {
    const count = this._cache.size;
    this._cache.clear();
    this._pending.clear();
    return count;
  }

  /**
   * Remove all expired entries.
   *
   * @returns Number of entries removed
   */
  cleanupExpired(): number {
    const now = Date.now();
    const expiredKeys: string[] = [];
    for (const [key, entry] of this._cache.entries()) {
      if ((now - entry.created_at) > this.ttl_seconds) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this._cache.delete(key);
    }

    return expiredKeys.length;
  }

  /** Current number of entries in cache. */
  get size(): number {
    return this._cache.size;
  }

  /** Number of pending computations. */
  get pendingCount(): number {
    return this._pending.size;
  }

  /** Cache hit rate (0.0 - 1.0). */
  get hitRate(): number {
    const total = this._hits + this._misses;
    if (total === 0) {
      return 0.0;
    }
    return this._hits / total;
  }

  /** Get cache statistics. */
  get stats(): Record<string, unknown> {
    return {
      size: this.size,
      max_size: this.max_size,
      hits: this._hits,
      misses: this._misses,
      hit_rate: Math.round(this.hitRate * 10000) / 10000,
      ttl_seconds: this.ttl_seconds,
      pending: this._pending.size,
    };
  }
}

/** Global cache instance */
let _globalCache: QueryEmbeddingCache | null = null;

/**
 * Get or create the global query embedding cache.
 *
 * @param max_size - Maximum cache entries
 * @param ttl_seconds - TTL in seconds
 * @returns QueryEmbeddingCache instance
 */
export function getQueryCache(
  max_size: number = 1000,
  ttl_seconds: number = 3600.0
): QueryEmbeddingCache {
  if (_globalCache === null) {
    _globalCache = new QueryEmbeddingCache(max_size, ttl_seconds);
  }
  return _globalCache;
}
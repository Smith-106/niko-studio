/**
 * Query Embedding Cache with LRU and TTL
 *
 * Features:
 * - LRU cache with configurable max size (default: 1000)
 * - TTL-based expiration (default: 1 hour)
 * - Thread-safe async operations
 * - Memory-efficient storage
 */

import { createHash } from 'crypto';
import { Lock } from 'async-lock';

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
 * LRU cache for query embeddings with TTL support.
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
  private _lock = new Lock();
  private _hits = 0;
  private _misses = 0;

  constructor(max_size: number = 1000, ttl_seconds: number = 3600.0) {
    this.max_size = max_size;
    this.ttl_seconds = ttl_seconds;
    this._cache = new Map();
    this._lock = new Lock();
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

    // Move to end (most recently used)
    this._cache.delete(key);
    entry.access_count++;
    this._hits++;

    return entry.embedding;
  }

  /**
   * Get embedding from cache (async version).
   *
   * @param query - The query string
   * @returns Embedding list if found and not expired, null otherwise
   */
  async getAsync(query: string): Promise<number[] | null> {
    const release = await this._lock.acquire();
    try {
      return this.get(query);
    } finally {
      release();
    }
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
   *
   * @param query - The query string
   * @param embedding - The embedding vector
   */
  async putAsync(query: string, embedding: number[]): Promise<void> {
    const release = await this._lock.acquire();
    try {
      this.put(query, embedding);
    } finally {
      release();
    }
  }

  /**
   * Get from cache or compute and store.
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
   * @param query - The query string
   * @param compute_fn - Async or sync function to compute embedding
   * @returns Embedding vector
   */
  async getOrComputeAsync(
    query: string,
    compute_fn: (query: string) => number[] | Promise<number[]>,
  ): Promise<number[]> {
    let release = await this._lock.acquire();
    try {
      const cached = this.get(query);
      if (cached !== null) {
        return cached;
      }
    } finally {
      release();
    }

    // Compute outside lock to avoid blocking
    let embedding: number[];
    const maybePromise = compute_fn(query);
    if (maybePromise instanceof Promise) {
      embedding = await maybePromise;
    } else {
      embedding = maybePromise;
    }

    release = await this._lock.acquire();
    try {
      this.put(query, embedding);
    } finally {
      release();
    }

    return embedding;
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
    console.log(
      `Query embedding cache initialized: max_size=${max_size}, ttl=${ttl_seconds}s`
    );
  }
  return _globalCache;
}

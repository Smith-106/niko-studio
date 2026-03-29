/**
 * Knowledge module - embedding cache
 *
 * In-memory LRU embedding cache with TTL expiration and batch operations.
 * Cache keys use content hash to ensure same text+model combination hits.
 */

import * as crypto from 'crypto';

/**
 * Cache entry storing embedding and expiration timestamp
 */
interface CacheEntry {
  embedding: number[];
  expireTime: number;
}

/**
 * In-memory LRU Embedding Cache
 *
 * Features:
 * - LRU eviction policy
 * - TTL expiration support
 * - Batch read/write operations
 * - Hit rate statistics
 */
export class InMemoryEmbeddingCache {
  private _cache: Map<string, CacheEntry>;
  private readonly _maxSize: number;
  private readonly _defaultTTL: number;
  private _hits: number = 0;
  private _misses: number = 0;

  constructor(maxSize: number = 10000, defaultTTL: number = 86400) {
    this._cache = new Map();
    this._maxSize = maxSize;
    this._defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key
   *
   * Uses MD5 hash to ensure consistent key length,
   * avoiding memory issues with long text content.
   */
  private _makeKey(text: string, model: string): string {
    const content = `${model}:${text}`;
    return crypto.createHash('md5').update(content, 'utf-8').digest('hex');
  }

  /**
   * Check if entry is expired
   */
  private _isExpired(expireTime: number): boolean {
    if (expireTime === 0) return false;
    return Date.now() / 1000 > expireTime;
  }

  /**
   * LRU eviction - remove oldest entries when cache is full
   */
  private _evictIfNeeded(): void {
    // Map preserves insertion order; oldest is first entry
    while (this._cache.size >= this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
      }
    }
  }

  /**
   * Get cached vector
   */
  async get(text: string, model: string): Promise<number[] | null> {
    const key = this._makeKey(text, model);

    const entry = this._cache.get(key);
    if (!entry) {
      this._misses++;
      return null;
    }

    if (this._isExpired(entry.expireTime)) {
      this._cache.delete(key);
      this._misses++;
      return null;
    }

    // Move to end (most recently used) - delete and re-insert
    this._cache.delete(key);
    this._cache.set(key, entry);
    this._hits++;
    return entry.embedding;
  }

  /**
   * Set cache entry
   */
  async set(
    text: string,
    model: string,
    embedding: number[],
    ttl?: number | null,
  ): Promise<void> {
    this._evictIfNeeded();

    const key = this._makeKey(text, model);
    const actualTTL = ttl ?? this._defaultTTL;
    const expireTime = actualTTL > 0 ? Date.now() / 1000 + actualTTL : 0;

    // Delete existing entry so re-insert goes to end (LRU ordering)
    this._cache.delete(key);
    this._cache.set(key, { embedding, expireTime });
  }

  /**
   * Batch get cached vectors
   */
  async getBatch(
    texts: string[],
    model: string,
  ): Promise<Record<string, number[] | null>> {
    const results: Record<string, number[] | null> = {};
    for (const text of texts) {
      results[text] = await this.get(text, model);
    }
    return results;
  }

  /**
   * Batch set cache entries
   */
  async setBatch(
    items: Record<string, number[]>,
    model: string,
    ttl?: number | null,
  ): Promise<void> {
    for (const [text, embedding] of Object.entries(items)) {
      await this.set(text, model, embedding, ttl);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this._cache.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<Record<string, unknown>> {
    const total = this._hits + this._misses;
    const hitRate = total > 0 ? this._hits / total : 0.0;

    return {
      size: this._cache.size,
      maxSize: this._maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate,
      defaultTTL: this._defaultTTL,
    };
  }
}

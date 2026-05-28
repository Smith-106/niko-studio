/**
 * Search Cache Manager
 *
 * LRU cache with TTL and event-driven invalidation for search results.
 * Subscribes to knowledge and obsidian change events via IEventBus
 * to automatically invalidate stale cache entries.
 *
 * @module search/cache-manager
 */

import type { IEventBus } from '../container/types';
import type { ScoringConfig, ScoredResult } from './relevance-scorer';
import { createLogger } from '../logger/index.js';

const _log = createLogger('search-cache-manager');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Cache configuration.
 */
export interface CacheConfig {
  /** Maximum number of entries in the cache (default 100) */
  maxSize: number;
  /** Time-to-live in milliseconds for cache entries (default 60000) */
  ttlMs: number;
  /** Common queries to warm the cache on init */
  warmupQueries?: string[];
}

/**
 * A cached search result with metadata.
 */
export interface CachedSearchResult {
  query: string;
  results: ScoredResult[];
  /** Which data sources contributed to these results */
  sources: string[];
  cachedAt: number;
  expiresAt: number;
}

/**
 * Public interface for the search cache manager.
 */
export interface ISearchCacheManager {
  /**
   * Get cached results for a query, or null if not cached or expired.
   */
  get(query: string): CachedSearchResult | null;

  /**
   * Store search results in the cache.
   */
  set(query: string, results: CachedSearchResult): void;

  /**
   * Invalidate a specific query's cache entry.
   * Returns true if an entry was removed.
   */
  invalidate(query: string): boolean;

  /**
   * Invalidate all cache entries that include results from a given source.
   * Returns the number of entries invalidated.
   */
  invalidateBySource(source: string): number;

  /**
   * Invalidate all cache entries.
   */
  invalidateAll(): void;

  /**
   * Execute warmup queries and cache their results.
   */
  warmup(): Promise<void>;

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number; hitRate: number; evictionCount: number };
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 100,
  ttlMs: 60_000,
};

// ---------------------------------------------------------------------------
// Internal cache entry with LRU tracking
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: CachedSearchResult;
  /** Access order for LRU — incremented on each access */
  accessOrder: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Function type for executing warmup queries.
 * Takes a query string and returns the search results.
 */
export type WarmupFn = (query: string) => Promise<CachedSearchResult>;

export class SearchCacheManagerImpl implements ISearchCacheManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly config: CacheConfig;
  private readonly eventBus?: IEventBus;
  private readonly warmupFn?: WarmupFn;
  private accessCounter = 0;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private unsubscribers: Array<() => void> = [];

  constructor(
    config: CacheConfig,
    eventBus?: IEventBus,
    warmupFn?: WarmupFn,
  ) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.eventBus = eventBus;
    this.warmupFn = warmupFn;

    if (this.eventBus) {
      this.subscribeToEvents();
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  get(query: string): CachedSearchResult | null {
    const entry = this.cache.get(query);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL expiration
    if (Date.now() > entry.result.expiresAt) {
      this.cache.delete(query);
      this.missCount++;
      return null;
    }

    // Update LRU access order
    entry.accessOrder = ++this.accessCounter;
    this.hitCount++;
    return entry.result;
  }

  set(query: string, results: CachedSearchResult): void {
    // Evict LRU entry if at capacity and the key is new
    if (!this.cache.has(query) && this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(query, {
      result: results,
      accessOrder: ++this.accessCounter,
    });
  }

  invalidate(query: string): boolean {
    return this.cache.delete(query);
  }

  invalidateBySource(source: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.result.sources.includes(source)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async warmup(): Promise<void> {
    const queries = this.config.warmupQueries;
    if (!queries || queries.length === 0 || !this.warmupFn) {
      return;
    }

    _log.info(`Warming cache with ${queries.length} queries`);

    for (const query of queries) {
      try {
        const result = await this.warmupFn(query);
        this.set(query, result);
      } catch (error) {
        _log.error(`Warmup query failed: "${query}"`, { detail: error });
      }
    }
  }

  getStats(): { size: number; maxSize: number; hitRate: number; evictionCount: number } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: total > 0 ? this.hitCount / total : 0,
      evictionCount: this.evictionCount,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Unsubscribe from all event bus subscriptions.
   * Call this when disposing the cache manager.
   */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Evict the least recently used entry.
   */
  private evictLRU(): void {
    let minOrder = Infinity;
    let minKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.accessOrder < minOrder) {
        minOrder = entry.accessOrder;
        minKey = key;
      }
    }

    if (minKey != null) {
      this.cache.delete(minKey);
      this.evictionCount++;
    }
  }

  /**
   * Subscribe to event bus channels for automatic cache invalidation.
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    const sub = (channel: string, handler: (payload: unknown) => void): void => {
      const unsub = this.eventBus!.subscribe(channel, handler);
      this.unsubscribers.push(unsub);
    };

    // Knowledge entity updates → invalidate knowledge-sourced entries
    sub('knowledge:entity-updated', () => {
      const count = this.invalidateBySource('knowledge');
      if (count > 0) {
        _log.info(`Invalidated ${count} cache entries from knowledge source (entity-updated)`);
      }
    });

    // Knowledge entity creation → invalidate knowledge-sourced entries
    sub('knowledge:entity-created', () => {
      const count = this.invalidateBySource('knowledge');
      if (count > 0) {
        _log.info(`Invalidated ${count} cache entries from knowledge source (entity-created)`);
      }
    });

    // Knowledge entity deletion → invalidate all (deletion affects many queries)
    sub('knowledge:entity-deleted', () => {
      const size = this.cache.size;
      this.invalidateAll();
      if (size > 0) {
        _log.info(`Invalidated all ${size} cache entries (entity-deleted)`);
      }
    });

    // Obsidian file changes → invalidate obsidian-sourced entries
    sub('obsidian:file-changed', () => {
      const count = this.invalidateBySource('obsidian');
      if (count > 0) {
        _log.info(`Invalidated ${count} cache entries from obsidian source (file-changed)`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new SearchCacheManager instance.
 */
export function createSearchCacheManager(
  config?: Partial<CacheConfig>,
  eventBus?: IEventBus,
  warmupFn?: WarmupFn,
): ISearchCacheManager {
  return new SearchCacheManagerImpl(
    { ...DEFAULT_CACHE_CONFIG, ...config },
    eventBus,
    warmupFn,
  );
}

import { describe, expect, it, vi } from 'vitest';

import {
  createSearchCacheManager,
  type CachedSearchResult,
  SearchCacheManagerImpl,
} from '../../search/cache-manager';

class FakeEventBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>();

  publish(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }

  subscribe(channel: string, handler: (payload: unknown) => void): () => void {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(handler);
    this.handlers.set(channel, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(channel);
      }
    };
  }

  unsubscribe(channel: string, handler: (payload: unknown) => void): void {
    this.handlers.get(channel)?.delete(handler);
  }
}

function makeCachedResult(
  query: string,
  sources: string[],
  expiresAt = Date.now() + 60_000,
): CachedSearchResult {
  return {
    query,
    results: [
      {
        id: `result-${query}`,
        content: `content for ${query}`,
        source: sources[0] ?? 'knowledge',
        baseScore: 0.5,
        relevanceScore: 0.9,
        signals: {},
        timestamp: Date.now(),
      },
    ],
    sources,
    cachedAt: Date.now(),
    expiresAt,
  };
}

describe('search/cache-manager additional coverage', () => {
  it('evicts the least recently used entry when capacity is exceeded', () => {
    const cache = new SearchCacheManagerImpl({ maxSize: 2, ttlMs: 60_000 });

    cache.set('q1', makeCachedResult('q1', ['knowledge']));
    cache.set('q2', makeCachedResult('q2', ['knowledge']));
    expect(cache.get('q1')).not.toBeNull();

    cache.set('q3', makeCachedResult('q3', ['obsidian']));

    expect(cache.get('q1')).not.toBeNull();
    expect(cache.get('q2')).toBeNull();
    expect(cache.get('q3')).not.toBeNull();
    expect(cache.getStats()).toMatchObject({
      size: 2,
      maxSize: 2,
      evictionCount: 1,
    });
  });

  it('returns early from warmup when queries or warmupFn are missing', async () => {
    const noQueries = new SearchCacheManagerImpl(
      { maxSize: 2, ttlMs: 60_000 },
      undefined,
      vi.fn(),
    );
    const noWarmupFn = new SearchCacheManagerImpl({
      maxSize: 2,
      ttlMs: 60_000,
      warmupQueries: ['hero'],
    });

    await expect(noQueries.warmup()).resolves.toBeUndefined();
    await expect(noWarmupFn.warmup()).resolves.toBeUndefined();
    expect(noQueries.getStats().size).toBe(0);
    expect(noWarmupFn.getStats().size).toBe(0);
  });

  it('returns early when subscribeToEvents is invoked without an event bus', () => {
    const cache = new SearchCacheManagerImpl({ maxSize: 2, ttlMs: 60_000 });

    expect(() =>
      (cache as unknown as { subscribeToEvents(): void }).subscribeToEvents(),
    ).not.toThrow();
    expect(cache.getStats().size).toBe(0);
  });

  it('continues warming the cache when one warmup query fails', async () => {
    const warmupFn = vi.fn().mockImplementation(async (query: string) => {
      if (query === 'bad') {
        throw new Error('warmup exploded');
      }
      return makeCachedResult(query, ['knowledge']);
    });
    const cache = new SearchCacheManagerImpl({
      maxSize: 5,
      ttlMs: 60_000,
      warmupQueries: ['ok', 'bad'],
    }, undefined, warmupFn);

    await cache.warmup();

    expect(warmupFn).toHaveBeenCalledTimes(2);
    expect(cache.get('ok')).not.toBeNull();
    expect(cache.get('bad')).toBeNull();
    expect(cache.getStats().size).toBe(1);
  });

  it('invalidates caches on create and delete events and dispose removes subscriptions', () => {
    const bus = new FakeEventBus();
    const cache = new SearchCacheManagerImpl({ maxSize: 5, ttlMs: 60_000 }, bus as never);

    cache.set('knowledge', makeCachedResult('knowledge', ['knowledge']));
    cache.set('web', makeCachedResult('web', ['web']));

    bus.publish('knowledge:entity-created', { id: 'entity-1' });
    expect(cache.get('knowledge')).toBeNull();
    expect(cache.get('web')).not.toBeNull();

    cache.set('knowledge', makeCachedResult('knowledge', ['knowledge']));
    cache.set('obsidian', makeCachedResult('obsidian', ['obsidian']));
    bus.publish('knowledge:entity-deleted', { id: 'entity-2' });
    expect(cache.getStats().size).toBe(0);

    cache.set('knowledge', makeCachedResult('knowledge', ['knowledge']));
    cache.dispose();
    bus.publish('knowledge:entity-created', { id: 'entity-3' });
    expect(cache.get('knowledge')).not.toBeNull();
  });

  it('creates a usable manager through the factory helper', async () => {
    const bus = new FakeEventBus();
    const warmupFn = vi.fn().mockResolvedValue(makeCachedResult('hero', ['knowledge']));

    const cache = createSearchCacheManager(
      { maxSize: 1, ttlMs: 60_000, warmupQueries: ['hero'] },
      bus as never,
      warmupFn,
    );

    await cache.warmup();
    expect(warmupFn).toHaveBeenCalledWith('hero');
    expect(cache.get('hero')).not.toBeNull();

    bus.publish('obsidian:file-changed', { path: 'note.md' });
    expect(cache.invalidateBySource('knowledge')).toBe(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('memory/query-cache additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('deduplicates concurrent async computation per query key', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(10, 1_000);

    let resolveCompute!: (value: number[]) => void;
    const compute = vi.fn(
      () =>
        new Promise<number[]>((resolve) => {
          resolveCompute = resolve;
        }),
    );

    const first = cache.getOrComputeAsync('same-query', compute);
    const second = cache.getOrComputeAsync('same-query', compute);

    expect(cache.pendingCount).toBe(1);
    await Promise.resolve();
    expect(compute).toHaveBeenCalledTimes(1);

    resolveCompute([1, 2, 3]);

    await expect(first).resolves.toEqual([1, 2, 3]);
    await expect(second).resolves.toEqual([1, 2, 3]);
    expect(cache.pendingCount).toBe(0);
    expect(cache.size).toBe(1);
  });

  it('clears pending state after async computation rejection and allows retry', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(10, 1_000);

    const failingCompute = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(cache.getOrComputeAsync('retry-query', failingCompute)).rejects.toThrow('boom');
    expect(cache.pendingCount).toBe(0);

    const retryCompute = vi.fn(() => [4, 5, 6]);
    await expect(cache.getOrComputeAsync('retry-query', retryCompute)).resolves.toEqual([4, 5, 6]);
    expect(retryCompute).toHaveBeenCalledTimes(1);
    expect(cache.pendingCount).toBe(0);
  });

  it('reports zero hit rate before any access and exposes rounded stats', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(2, 50);

    expect(cache.hitRate).toBe(0);
    expect(cache.stats).toMatchObject({
      size: 0,
      max_size: 2,
      hits: 0,
      misses: 0,
      hit_rate: 0,
      ttl_seconds: 50,
      pending: 0,
    });

    expect(cache.get('missing-query')).toBeNull();
    cache.put('cached-query', [9, 9, 9]);
    expect(cache.get('cached-query')).toEqual([9, 9, 9]);
    expect(cache.hitRate).toBe(0.5);
    expect(cache.stats).toMatchObject({
      hits: 1,
      misses: 1,
      hit_rate: 0.5,
    });
  });

  it('invalidates missing entries and removes only expired entries during cleanup', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(4, 0.01);

    expect(cache.invalidate('not-found')).toBe(false);

    cache.put('stale-query', [1]);
    vi.advanceTimersByTime(11);
    cache.put('fresh-query', [2]);

    expect(cache.cleanupExpired()).toBe(1);
    expect(cache.get('stale-query')).toBeNull();
    expect(cache.get('fresh-query')).toEqual([2]);
    expect(cache.invalidate('fresh-query')).toBe(true);
    expect(cache.size).toBe(0);
  });

  it('reuses the global singleton cache instance', async () => {
    const { getQueryCache } = await import('../../memory/query-cache');

    const first = getQueryCache(1, 10);
    const second = getQueryCache(99, 999);

    expect(first).toBe(second);
    expect(first.stats).toMatchObject({
      max_size: 1,
      ttl_seconds: 10,
    });
  });

  it('breaks cleanly when max size is zero and no eviction candidate exists', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(0, 10);

    cache.put('zero-capacity', [7, 8, 9]);

    expect(cache.size).toBe(1);
    expect(cache.get('zero-capacity')).toEqual([7, 8, 9]);
  });

  it('returns cached values from getOrComputeAsync without recomputing', async () => {
    const { QueryEmbeddingCache } = await import('../../memory/query-cache');
    const cache = new QueryEmbeddingCache(2, 10);
    const compute = vi.fn(() => [3, 2, 1]);

    cache.put('cached-async-query', [1, 1, 1]);

    await expect(cache.getOrComputeAsync('cached-async-query', compute)).resolves.toEqual([1, 1, 1]);
    expect(compute).not.toHaveBeenCalled();
  });
});

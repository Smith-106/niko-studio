import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TieredEmbeddingCache } from '../../knowledge/cache';

async function createCache(maxSize = 1) {
  const root = await mkdtemp(join(tmpdir(), 'niko-cache-early-return-'));
  const cache = new TieredEmbeddingCache(maxSize, 60, join(root, 'cache.db'));
  return { cache, root };
}

describe('TieredEmbeddingCache early-return additional coverage', () => {
  const caches: TieredEmbeddingCache[] = [];
  const roots: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    while (caches.length > 0) {
      caches.pop()?.close();
    }
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it('returns early when cold-tier eviction runs before sqlite is initialized', async () => {
    const { cache, root } = await createCache();
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _evictColdTier: () => void;
    };

    expect(() => internal._evictColdTier()).not.toThrow();
  });

  it('breaks cleanly when hot-tier eviction sees an empty cache', async () => {
    const { cache, root } = await createCache(0);
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _evictIfNeeded: () => void;
    };

    expect(() => internal._evictIfNeeded()).not.toThrow();
  });

  it('returns an empty result for empty getBatch requests', async () => {
    const { cache, root } = await createCache();
    caches.push(cache);
    roots.push(root);

    await expect(cache.getBatch([], 'model')).resolves.toEqual({});
  });

  it('returns early for empty setBatch payloads', async () => {
    const { cache, root } = await createCache();
    caches.push(cache);
    roots.push(root);

    await expect(cache.setBatch({}, 'model')).resolves.toBeUndefined();
    await expect(cache.stats()).resolves.toMatchObject({
      size: 0,
      coldSize: 0,
      hits: 0,
      misses: 0,
    });
  });

  it('breaks cleanly when bulk eviction is asked to evict from an empty cache', async () => {
    const { cache, root } = await createCache();
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _evictBulk: (count: number) => void;
    };

    expect(() => internal._evictBulk(1)).not.toThrow();
  });

  it('breaks cleanly when bulk eviction sees an iterator with an undefined first key', async () => {
    const { cache, root } = await createCache();
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _cache: {
        size: number;
        keys: () => { next: () => { value: undefined } };
        delete: (key: string) => boolean;
        get: (key: string) => { embedding: number[]; expireTime: number } | undefined;
      };
      _evictBulk: (count: number) => void;
    };

    internal._cache = {
      size: 1,
      keys: () => ({
        next: () => ({ value: undefined }),
      }),
      delete: () => false,
      get: () => undefined,
    };

    expect(() => internal._evictBulk(1)).not.toThrow();
  });
});

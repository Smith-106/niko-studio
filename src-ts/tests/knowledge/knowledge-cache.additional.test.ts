import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { TieredEmbeddingCache } from '../../knowledge/cache';

async function createTestCache(maxSize = 2, defaultTTL = 60, nested = false) {
  const root = await mkdtemp(join(tmpdir(), 'niko-cache-additional-'));
  const dbPath = nested
    ? join(root, 'nested', 'cold-tier', 'embedding-cache.db')
    : join(root, 'embedding-cache.db');
  const cache = new TieredEmbeddingCache(maxSize, defaultTTL, dbPath);
  return { cache, root, dbPath };
}

describe('TieredEmbeddingCache additional coverage', () => {
  const caches: TieredEmbeddingCache[] = [];
  const roots: string[] = [];

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    while (caches.length > 0) {
      caches.pop()?.close();
    }
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it('creates missing cold-tier directories when eviction initializes the sqlite store', async () => {
    const { cache, root, dbPath } = await createTestCache(1, 120, true);
    caches.push(cache);
    roots.push(root);

    await cache.set('first', 'model', [1]);
    await cache.set('second', 'model', [2]);

    expect(existsSync(dirname(dbPath))).toBe(true);
    expect(await cache.get('first', 'model')).toEqual([1]);
  });

  it('expires hot-tier entries deterministically for both get and getBatch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));

    const { cache, root } = await createTestCache(3, 10);
    caches.push(cache);
    roots.push(root);

    await cache.set('expired-single', 'model', [1], 1);
    await cache.set('expired-batch', 'model', [2], 1);
    await cache.set('fresh', 'model', [3], 30);

    vi.advanceTimersByTime(1_500);

    await expect(cache.get('expired-single', 'model')).resolves.toBeNull();

    await expect(
      cache.getBatch(['expired-batch', 'fresh', 'missing'], 'model'),
    ).resolves.toEqual({
      'expired-batch': null,
      fresh: [3],
      missing: null,
    });

    await expect(cache.stats()).resolves.toMatchObject({
      hits: 1,
      misses: 3,
    });
  });

  it('promotes cold-tier hits during batch lookup and bulk-evicts once when space is needed', async () => {
    const { cache, root } = await createTestCache(2, 120);
    caches.push(cache);
    roots.push(root);

    await cache.set('cold-a', 'model', [1]);
    await cache.set('hot-b', 'model', [2]);
    await cache.set('hot-c', 'model', [3]);

    const internal = cache as TieredEmbeddingCache & {
      _stmtDelete: { run: (key: string) => void };
    };
    vi.spyOn(internal._stmtDelete, 'run').mockImplementation(() => {
      throw new Error('delete failed');
    });

    await expect(cache.getBatch(['cold-a', 'missing'], 'model')).resolves.toEqual({
      'cold-a': [1],
      missing: null,
    });

    await expect(cache.stats()).resolves.toMatchObject({
      hits: 1,
      misses: 1,
      coldHits: 1,
      size: 1,
    });
  });

  it('reuses existing hot keys during setBatch and keeps capacity bounded after one bulk eviction', async () => {
    const { cache, root } = await createTestCache(3, 120);
    caches.push(cache);
    roots.push(root);

    await cache.set('a', 'model', [1]);
    await cache.set('b', 'model', [2]);
    await cache.set('c', 'model', [3]);

    await cache.setBatch(
      {
        c: [30],
        d: [4],
      },
      'model',
    );

    await expect(cache.stats()).resolves.toMatchObject({
      size: 3,
      coldSize: 1,
    });

    await expect(cache.get('a', 'model')).resolves.toEqual([1]);
    await expect(cache.get('b', 'model')).resolves.toEqual([2]);
    await expect(cache.get('c', 'model')).resolves.toEqual([30]);
    await expect(cache.get('d', 'model')).resolves.toEqual([4]);
    await expect(cache.stats()).resolves.toMatchObject({ size: 3 });
  });

  it('covers cold-tier helper failure paths without surfacing internal exceptions', async () => {
    const { cache, root } = await createTestCache(1, 120);
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _cache: Map<string, { embedding: number[]; expireTime: number }>;
      _db: {
        prepare: (sql: string) => { run?: (value?: number) => void; get?: () => { cnt: number } };
        exec: (sql: string) => void;
        close: () => void;
      } | null;
      _stmtGet: { get: (key: string) => { embedding: Buffer } | undefined };
      _stmtSet: { run: (key: string, blob: Buffer, accessedAt: number) => void };
      _stmtDelete: { run: (key: string) => void };
      _ensureColdTier: () => void;
      _evictColdTier: () => void;
      _evictIfNeeded: () => void;
      _getFromCold: (key: string) => number[] | null;
      _promoteToHot: (key: string, embedding: number[], expireTime: number) => void;
    };

    const staleDeleteRun = vi.fn();
    const trimRun = vi.fn();
    internal._db = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return { get: () => ({ cnt: 50_001 }) };
        }
        if (sql.includes('ORDER BY accessed_at DESC LIMIT ?')) {
          return { run: trimRun };
        }
        return { run: staleDeleteRun };
      }),
      exec: vi.fn(() => {
        throw new Error('clear failed');
      }),
      close: vi.fn(() => {
        throw new Error('close failed');
      }),
    };

    internal._evictColdTier();
    expect(staleDeleteRun).toHaveBeenCalledTimes(1);
    expect(trimRun).toHaveBeenCalledWith(50_000);

    internal._db.prepare = vi.fn(() => {
      throw new Error('evict failed');
    });
    internal._evictColdTier();

    internal._ensureColdTier = vi.fn();
    internal._stmtGet = {
      get: vi.fn(() => {
        throw new Error('read failed');
      }),
    };
    expect(internal._getFromCold('missing')).toBeNull();

    internal._stmtDelete = {
      run: vi.fn(() => {
        throw new Error('delete failed');
      }),
    };
    internal._cache.clear();
    internal._promoteToHot('promoted', [9], 0);
    expect(internal._cache.get('promoted')?.embedding).toEqual([9]);

    internal._stmtSet = {
      run: vi.fn(() => {
        throw new Error('write failed');
      }),
    };
    internal._cache.clear();
    internal._cache.set('old', {
      embedding: [7],
      expireTime: Date.now() / 1000 + 60,
    });
    internal._evictIfNeeded();
    expect(internal._cache.size).toBe(0);

    await expect(cache.clear()).resolves.toBeUndefined();

    internal._db.prepare = vi.fn(() => {
      throw new Error('count failed');
    });
    await expect(cache.stats()).resolves.toMatchObject({
      coldSize: 0,
      size: 0,
    });

    expect(() => cache.close()).not.toThrow();
  });
});

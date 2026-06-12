import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { TieredEmbeddingCache } from '../../knowledge/cache';

async function createBulkEvictTestCache() {
  const root = await mkdtemp(join(tmpdir(), 'niko-cache-bulk-evict-'));
  const dbPath = join(root, 'embedding-cache.db');
  const cache = new TieredEmbeddingCache(1, 120, dbPath);
  return { cache, root };
}

describe('TieredEmbeddingCache bulk-evict additional coverage', () => {
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

  it('swallows cold-tier write failures during bulk eviction', async () => {
    const { cache, root } = await createBulkEvictTestCache();
    caches.push(cache);
    roots.push(root);

    const internal = cache as TieredEmbeddingCache & {
      _cache: Map<string, { embedding: number[]; expireTime: number }>;
      _ensureColdTier: () => void;
      _stmtSet: { run: (key: string, blob: Buffer, accessedAt: number) => void };
      _evictBulk: (count: number) => void;
    };

    internal._ensureColdTier = vi.fn();
    internal._stmtSet = {
      run: vi.fn(() => {
        throw new Error('cold write failed');
      }),
    };
    internal._cache.clear();
    internal._cache.set('oldest', {
      embedding: [1, 2, 3],
      expireTime: Date.now() / 1000 + 60,
    });

    expect(() => internal._evictBulk(1)).not.toThrow();
    expect(internal._cache.size).toBe(0);
  });
});

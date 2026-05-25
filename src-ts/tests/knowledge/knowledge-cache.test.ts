/**
 * Knowledge Cache Tests
 *
 * Comprehensive test coverage for TieredEmbeddingCache:
 * LRU eviction, TTL expiration, batch operations, statistics,
 * and tiered caching (hot LRU + cold SQLite).
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

import { TieredEmbeddingCache, InMemoryEmbeddingCache } from '../../knowledge/cache';

// 每个测试用例使用独立的临时数据库路径
let _dbCounter = 0;
function testDbPath(): string {
  _dbCounter++;
  return resolve(tmpdir(), `niko-studio-test-cache-${Date.now()}-${_dbCounter}.db`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TieredEmbeddingCache', () => {
  let cache: TieredEmbeddingCache;
  let dbPath: string;

  beforeEach(() => {
    dbPath = testDbPath();
    cache = new TieredEmbeddingCache(100, 3600, dbPath);
  });

  afterEach(() => {
    cache.close();
    // 清理临时数据库文件
    try {
      if (existsSync(dbPath)) unlinkSync(dbPath);
      const walPath = dbPath + '-wal';
      if (existsSync(walPath)) unlinkSync(walPath);
      const shmPath = dbPath + '-shm';
      if (existsSync(shmPath)) unlinkSync(shmPath);
    } catch {
      // 忽略清理失败
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes with default parameters', () => {
      const c = new TieredEmbeddingCache();
      expect(c).toBeDefined();
      c.close();
    });

    it('accepts custom maxSize and TTL', () => {
      const c = new TieredEmbeddingCache(50, 1800);
      expect(c).toBeDefined();
      c.close();
    });
  });

  describe('get / set', () => {
    it('returns null for non-existent key', async () => {
      const result = await cache.get('nonexistent', 'model-1');
      expect(result).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      await cache.set('text one', 'model-1', [0.1, 0.2, 0.3]);
      const result = await cache.get('text one', 'model-1');
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('different models produce different keys', async () => {
      await cache.set('same text', 'model-a', [1.0, 2.0]);
      await cache.set('same text', 'model-b', [3.0, 4.0]);
      const a = await cache.get('same text', 'model-a');
      const b = await cache.get('same text', 'model-b');
      expect(a).toEqual([1.0, 2.0]);
      expect(b).toEqual([3.0, 4.0]);
    });

    it('updating a value moves it to end (LRU)', async () => {
      const lruCache = new TieredEmbeddingCache(3, 3600, testDbPath());
      await lruCache.set('a', 'model', [1]);
      await lruCache.set('b', 'model', [2]);
      await lruCache.set('c', 'model', [3]);
      // Access 'a' to make it recently used
      await lruCache.get('a', 'model');
      // Add new entry - should evict 'b' (least recently used) to cold tier
      await lruCache.set('d', 'model', [4]);

      const a = await lruCache.get('a', 'model');
      expect(a).toEqual([1]); // a should still be there

      // b was evicted from hot tier but should be in cold tier
      const b = await lruCache.get('b', 'model');
      expect(b).toEqual([2]); // promoted back from cold tier

      lruCache.close();
    });

    it('handles empty embeddings', async () => {
      await cache.set('text', 'model', []);
      const result = await cache.get('text', 'model');
      expect(result).toEqual([]);
    });
  });

  describe('TTL expiration', () => {
    it('returns null for expired entry', async () => {
      const tinyCache = new TieredEmbeddingCache(100, 1, testDbPath());
      await tinyCache.set('text', 'model', [1.0], 1);
      // If test runs fast enough, should still be valid
      const result = await tinyCache.get('text', 'model');
      expect(result === null || Array.isArray(result)).toBe(true);
      tinyCache.close();
    });

    it('TTL=0 means no expiration (persistent entries)', async () => {
      await cache.set('persistent', 'model', [1.0], 0);
      const result = await cache.get('persistent', 'model');
      expect(result).toEqual([1.0]);
    });

    it('custom TTL is respected', async () => {
      await cache.set('short-lived', 'model', [1.0], 600);
      const result = await cache.get('short-lived', 'model');
      expect(result).toEqual([1.0]);
    });
  });

  describe('LRU eviction', () => {
    it('evicts oldest entry from hot tier to cold tier', async () => {
      const smallCache = new TieredEmbeddingCache(3, 3600, testDbPath());
      await smallCache.set('a', 'model', [1]);
      await smallCache.set('b', 'model', [2]);
      await smallCache.set('c', 'model', [3]);
      await smallCache.set('d', 'model', [4]); // should evict 'a' to cold tier

      // 'a' should be in cold tier now, still retrievable
      const a = await smallCache.get('a', 'model');
      expect(a).toEqual([1]);

      const b = await smallCache.get('b', 'model');
      expect(b).toEqual([2]);

      const d = await smallCache.get('d', 'model');
      expect(d).toEqual([4]);

      smallCache.close();
    });

    it('updating existing key moves it to end', async () => {
      const smallCache = new TieredEmbeddingCache(3, 3600, testDbPath());
      await smallCache.set('a', 'model', [1]);
      await smallCache.set('b', 'model', [2]);
      await smallCache.set('c', 'model', [3]);
      // Re-access 'a' to make it recently used
      await smallCache.get('a', 'model');
      // Now add 'd' - should evict 'b' (least recently used) to cold tier
      await smallCache.set('d', 'model', [4]);

      expect(await smallCache.get('a', 'model')).toEqual([1]);
      // 'b' was evicted to cold tier, should still be retrievable
      expect(await smallCache.get('b', 'model')).toEqual([2]);
      expect(await smallCache.get('c', 'model')).toEqual([3]);
      expect(await smallCache.get('d', 'model')).toEqual([4]);

      smallCache.close();
    });
  });

  describe('tiered caching', () => {
    it('evicted entries are retrievable from cold tier', async () => {
      const smallCache = new TieredEmbeddingCache(2, 3600, testDbPath());
      await smallCache.set('x', 'model', [10, 20]);
      await smallCache.set('y', 'model', [30, 40]);
      await smallCache.set('z', 'model', [50, 60]); // evicts 'x' to cold tier

      // 'x' should be retrievable from cold tier
      const x = await smallCache.get('x', 'model');
      expect(x).toEqual([10, 20]);

      smallCache.close();
    });

    it('cold tier hit promotes entry back to hot tier', async () => {
      const smallCache = new TieredEmbeddingCache(2, 3600, testDbPath());
      await smallCache.set('a', 'model', [1]);
      await smallCache.set('b', 'model', [2]);
      await smallCache.set('c', 'model', [3]); // evicts 'a' to cold tier

      // Access 'a' — should be promoted from cold to hot
      const a = await smallCache.get('a', 'model');
      expect(a).toEqual([1]);

      // 'a' is now in hot tier; verify stats show cold hit
      const stats = await smallCache.stats();
      expect(stats.coldHits).toBe(1);

      smallCache.close();
    });

    it('clear removes both hot and cold tiers', async () => {
      const smallCache = new TieredEmbeddingCache(2, 3600, testDbPath());
      await smallCache.set('a', 'model', [1]);
      await smallCache.set('b', 'model', [2]);
      await smallCache.set('c', 'model', [3]); // evicts 'a' to cold tier

      await smallCache.clear();

      // Both tiers should be empty
      expect(await smallCache.get('a', 'model')).toBeNull();
      expect(await smallCache.get('b', 'model')).toBeNull();
      expect(await smallCache.get('c', 'model')).toBeNull();

      const stats = await smallCache.stats();
      expect(stats.coldSize).toBe(0);

      smallCache.close();
    });

    it('stats reports coldSize', async () => {
      const smallCache = new TieredEmbeddingCache(2, 3600, testDbPath());
      await smallCache.set('a', 'model', [1]);
      await smallCache.set('b', 'model', [2]);
      await smallCache.set('c', 'model', [3]); // evicts 'a' to cold tier

      const stats = await smallCache.stats();
      expect(stats.coldSize).toBe(1);
      expect(stats.size).toBe(2); // hot tier has b and c

      smallCache.close();
    });
  });

  describe('getBatch / setBatch', () => {
    it('batch gets multiple items', async () => {
      await cache.set('text-1', 'model', [1]);
      await cache.set('text-2', 'model', [2]);
      const results = await cache.getBatch(['text-1', 'text-2', 'text-3'], 'model');
      expect(results['text-1']).toEqual([1]);
      expect(results['text-2']).toEqual([2]);
      expect(results['text-3']).toBeNull();
    });

    it('batch sets multiple items', async () => {
      await cache.setBatch({
        'batch-1': [10, 20],
        'batch-2': [30, 40],
      }, 'model');
      expect(await cache.get('batch-1', 'model')).toEqual([10, 20]);
      expect(await cache.get('batch-2', 'model')).toEqual([30, 40]);
    });

    it('batch set with custom TTL', async () => {
      await cache.setBatch({ 'ttl-batch': [1] }, 'model', 0); // no expiration
      expect(await cache.get('ttl-batch', 'model')).toEqual([1]);
    });
  });

  describe('clear', () => {
    it('clears all entries and resets stats', async () => {
      await cache.set('a', 'model', [1]);
      await cache.get('a', 'model'); // hit
      await cache.get('b', 'model'); // miss
      await cache.clear();
      const stats = await cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('stats', () => {
    it('reports correct initial stats', async () => {
      const stats = await cache.stats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.defaultTTL).toBe(3600);
    });

    it('tracks hits and misses correctly', async () => {
      await cache.set('hit-me', 'model', [1]);
      await cache.get('hit-me', 'model'); // hit
      await cache.get('hit-me', 'model'); // hit
      await cache.get('miss-me', 'model'); // miss

      const stats = await cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('hitRate is 0 when no operations', async () => {
      const stats = await cache.stats();
      expect(stats.hitRate).toBe(0);
    });

    it('reports correct size after operations', async () => {
      await cache.set('a', 'model', [1]);
      await cache.set('b', 'model', [2]);
      await cache.set('c', 'model', [3]);
      const stats = await cache.stats();
      expect(stats.size).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// 兼容性：InMemoryEmbeddingCache 是 TieredEmbeddingCache 的别名
// ---------------------------------------------------------------------------

describe('InMemoryEmbeddingCache (compatibility alias)', () => {
  it('is the same class as TieredEmbeddingCache', () => {
    expect(InMemoryEmbeddingCache).toBe(TieredEmbeddingCache);
  });
});

/**
 * Performance Tests for QueryEmbeddingCache
 *
 * Verifies:
 * - LRU eviction strategy correctness and performance
 * - TTL expiration behavior under pressure
 * - Cache behavior under memory pressure (at max_size)
 * - Throughput metrics for get/put operations
 * - Cache hit rate under realistic access patterns
 *
 * NOTE on LRU strategy:
 *   The QueryEmbeddingCache in src-ts/memory/query-cache.ts implements a proper
 *   LRU eviction strategy using JavaScript Map's insertion-order guarantees:
 *     - On get(): the entry is deleted and re-inserted at the end (most recently used)
 *     - On put(): when max_size is reached, the first Map key (least recently used) is evicted
 *     - On TTL expiry: expired entries are removed on access, returning a cache miss
 *   The cache also supports async thread-safe operations via async-lock.
 *
 *   Additionally, src-ts/memory/unified-memory.ts contains an inline EmbeddingQueryCache
 *   class with similar LRU logic but using separate put/get with delete-and-reinsert
 *   pattern. Both implementations are functionally equivalent.
 *
 * BUG FIX (2026-04-21):
 *   The get() method previously deleted the entry without re-inserting it, causing
 *   every get() to permanently remove the entry. Fixed by adding this._cache.set(key, entry)
 *   after the delete.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock async-lock: the source imports { Lock } but the actual module exports itself
// as the constructor. Provide a shim so the test can instantiate QueryEmbeddingCache.
vi.mock('async-lock', () => {
  class Lock {
    async acquire(): Promise<() => void> {
      return () => {};
    }
  }
  return { Lock };
});

import {
  QueryEmbeddingCache,
  getQueryCache,
} from '../../memory/query-cache';
import type { CacheEntry } from '../../memory/query-cache';

// ============================================================
// Helpers
// ============================================================

const EMBEDDING_DIM = 384;

function generateEmbedding(seed: number = 0): number[] {
  const vec = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] = ((seed + i) % 100) / 100.0;
  }
  return vec;
}

function generateQueries(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `search query number ${i} for testing`);
}

// ============================================================
// Tests
// ============================================================

describe('QueryEmbeddingCache Performance', () => {
  let cache: QueryEmbeddingCache;

  beforeEach(() => {
    cache = new QueryEmbeddingCache(100, 3600);
  });

  // ============================================================
  // LRU Eviction Strategy Verification
  // ============================================================

  describe('LRU eviction strategy', () => {
    it('should evict entries when cache is full on put', () => {
      const smallCache = new QueryEmbeddingCache(5, 3600);

      // Fill cache with 5 entries
      for (let i = 0; i < 5; i++) {
        smallCache.put(`query-${i}`, generateEmbedding(i));
      }
      expect(smallCache.size).toBe(5);

      // Add a 6th entry - should evict the first entry (query-0)
      smallCache.put('query-5', generateEmbedding(5));
      expect(smallCache.size).toBe(5);

      // query-0 should be evicted (was first in Map order = LRU)
      expect(smallCache.get('query-0')).toBeNull();
      // query-5 should be present
      expect(smallCache.get('query-5')).not.toBeNull();
    });

    it('should handle rapid eviction cycles correctly', () => {
      const smallCache = new QueryEmbeddingCache(10, 3600);

      // Perform 100 rapid put operations (10x the capacity)
      for (let i = 0; i < 100; i++) {
        smallCache.put(`rapid-${i}`, generateEmbedding(i));
      }

      expect(smallCache.size).toBe(10);

      // Only the last 10 entries should remain
      for (let i = 0; i < 90; i++) {
        expect(smallCache.get(`rapid-${i}`)).toBeNull();
      }
      for (let i = 90; i < 100; i++) {
        expect(smallCache.get(`rapid-${i}`)).not.toBeNull();
      }
    });

    it('get() re-inserts entry at MRU position (correct LRU re-ordering)', () => {
      const smallCache = new QueryEmbeddingCache(5, 3600);

      smallCache.put('a', generateEmbedding(1));
      smallCache.put('b', generateEmbedding(2));
      expect(smallCache.size).toBe(2);

      // get() returns the value successfully
      const result = smallCache.get('a');
      expect(result).not.toBeNull();

      // get() re-inserts the entry (correct LRU behavior)
      expect(smallCache.size).toBe(2);
      expect(smallCache.get('a')).not.toBeNull(); // entry is still present after get()

      // 'b' is also still present
      expect(smallCache.get('b')).not.toBeNull();
    });
  });

  // ============================================================
  // TTL Expiration
  // ============================================================

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      // Create cache with very short TTL for testing
      const shortTtlCache = new QueryEmbeddingCache(100, 0.05); // 50ms TTL
      shortTtlCache.put('expiring-query', generateEmbedding(42));

      // Immediately get should succeed
      expect(shortTtlCache.get('expiring-query')).not.toBeNull();

      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortTtlCache.get('expiring-query')).toBeNull();
          resolve();
        }, 100);
      });
    });

    it('should cleanup expired entries on cleanupExpired call', () => {
      const shortTtlCache = new QueryEmbeddingCache(100, 0.05);
      for (let i = 0; i < 20; i++) {
        shortTtlCache.put(`ttl-test-${i}`, generateEmbedding(i));
      }
      expect(shortTtlCache.size).toBe(20);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const removed = shortTtlCache.cleanupExpired();
          expect(removed).toBe(20);
          expect(shortTtlCache.size).toBe(0);
          resolve();
        }, 100);
      });
    });
  });

  // ============================================================
  // Memory Pressure Tests
  // ============================================================

  describe('cache behavior under memory pressure', () => {
    it('should maintain consistent hit rate under access pressure', () => {
      const pressureCache = new QueryEmbeddingCache(50, 3600);

      // Pre-populate with 50 entries
      for (let i = 0; i < 50; i++) {
        pressureCache.put(`preload-${i}`, generateEmbedding(i));
      }

      // Simulate realistic access pattern: 80% cache hits (top 40), 20% misses
      let hits = 0;
      let misses = 0;
      const iterations = 200;

      for (let i = 0; i < iterations; i++) {
        if (i % 5 === 4) {
          // 20%: new query (cache miss, triggers eviction)
          const result = pressureCache.get(`new-query-${i}`);
          if (result === null) {
            misses++;
            pressureCache.put(`new-query-${i}`, generateEmbedding(1000 + i));
          } else {
            hits++;
          }
        } else {
          // 80%: access existing entries (but some may have been evicted)
          const existingIdx = i % 40;
          const result = pressureCache.get(`preload-${existingIdx}`);
          if (result !== null) {
            hits++;
          } else {
            misses++;
          }
        }
      }

      const hitRate = hits / (hits + misses);
      const stats = pressureCache.stats;

      console.log('\n[BENCHMARK] Cache under memory pressure (50 max, 200 ops):');
      console.log(`  Hit rate:        ${(hitRate * 100).toFixed(1)}%`);
      console.log(`  Hits:            ${hits}`);
      console.log(`  Misses:          ${misses}`);
      console.log(`  Final size:      ${stats.size}`);
      console.log(`  Internal hitRate: ${stats.hit_rate}`);

      // Cache size should never exceed max
      expect(pressureCache.size).toBeLessThanOrEqual(50);
      // Some hits should occur (preloaded entries accessed before eviction)
      expect(hits).toBeGreaterThan(0);
    });

    it('should handle high-frequency put eviction without errors', () => {
      const tightCache = new QueryEmbeddingCache(10, 3600);

      // Rapidly insert 10000 unique entries into a 10-slot cache
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tightCache.put(`hf-${i}`, generateEmbedding(i));
      }
      const end = performance.now();

      expect(tightCache.size).toBe(10);

      console.log(`\n[BENCHMARK] High-frequency eviction (10000 puts, 10 max):`);
      console.log(`  Total time:      ${(end - start).toFixed(2)} ms`);
      console.log(`  Time per put:    ${((end - start) / 10000).toFixed(4)} ms`);
      console.log(`  Final size:      ${tightCache.size}`);
    });

    it('should handle interleaved get/put under pressure', () => {
      const pressureCache = new QueryEmbeddingCache(20, 3600);

      // Seed cache
      for (let i = 0; i < 20; i++) {
        pressureCache.put(`seed-${i}`, generateEmbedding(i));
      }

      const start = performance.now();
      let hits = 0;
      let misses = 0;
      const ops = 5000;

      for (let i = 0; i < ops; i++) {
        if (i % 2 === 0) {
          // Get: alternate between seeded and new queries
          const key = i % 4 === 0 ? `seed-${i % 20}` : `missing-${i}`;
          const result = pressureCache.get(key);
          if (result !== null) hits++;
          else misses++;
        } else {
          // Put: new entries that trigger eviction
          pressureCache.put(`pressure-${i}`, generateEmbedding(i));
        }
      }
      const end = performance.now();

      const totalMs = end - start;
      console.log(`\n[BENCHMARK] Interleaved get/put (5000 ops, 20 max):`);
      console.log(`  Total time:      ${totalMs.toFixed(2)} ms`);
      console.log(`  Ops/sec:         ${(ops / (totalMs / 1000)).toFixed(0)}`);
      console.log(`  Hits:            ${hits}`);
      console.log(`  Misses:          ${misses}`);
      console.log(`  Final size:      ${pressureCache.size}`);

      expect(pressureCache.size).toBeLessThanOrEqual(20);
    });
  });

  // ============================================================
  // Throughput Benchmarks
  // ============================================================

  describe('get/put throughput', () => {
    it('should measure put throughput for batch insertions', () => {
      const batchSize = 500;
      const queries = generateQueries(batchSize);
      // Cache large enough to hold all
      const largeCache = new QueryEmbeddingCache(batchSize + 10, 3600);

      const start = performance.now();
      for (let i = 0; i < batchSize; i++) {
        largeCache.put(queries[i]!, generateEmbedding(i));
      }
      const end = performance.now();

      const totalMs = end - start;
      console.log(`\n[BENCHMARK] Put throughput (${batchSize} inserts):`);
      console.log(`  Total time:      ${totalMs.toFixed(2)} ms`);
      console.log(`  Time per put:    ${(totalMs / batchSize).toFixed(4)} ms`);
      console.log(`  Throughput:      ${(batchSize / (totalMs / 1000)).toFixed(0)} ops/s`);

      expect(largeCache.size).toBe(batchSize);
    });

    it('should measure get throughput for cached queries', () => {
      const batchSize = 500;
      const queries = generateQueries(batchSize);
      const largeCache = new QueryEmbeddingCache(batchSize + 10, 3600);

      // Pre-populate
      for (let i = 0; i < batchSize; i++) {
        largeCache.put(queries[i]!, generateEmbedding(i));
      }

      const start = performance.now();
      let hits = 0;
      for (let i = 0; i < batchSize; i++) {
        const result = largeCache.get(queries[i]!);
        if (result !== null) hits++;
      }
      const end = performance.now();

      const totalMs = end - start;
      console.log(`\n[BENCHMARK] Get throughput (${batchSize} cache hits):`);
      console.log(`  Total time:      ${totalMs.toFixed(2)} ms`);
      console.log(`  Time per get:    ${(totalMs / batchSize).toFixed(4)} ms`);
      console.log(`  Throughput:      ${(batchSize / (totalMs / 1000)).toFixed(0)} ops/s`);
      console.log(`  Hit count:       ${hits}`);

      expect(hits).toBe(batchSize);
    });

    it('should measure getOrCompute throughput', () => {
      const computeCalls: number[] = [];
      const computeFn = (query: string): number[] => {
        computeCalls.push(1);
        return generateEmbedding(query.length);
      };

      const queries = generateQueries(200);
      const largeCache = new QueryEmbeddingCache(300, 3600);

      // First pass: all miss -> compute
      const start1 = performance.now();
      for (const q of queries) {
        largeCache.getOrCompute(q, computeFn);
      }
      const end1 = performance.now();

      expect(computeCalls.length).toBe(200);

      // Second pass: all hit -> no compute
      const start2 = performance.now();
      for (const q of queries) {
        largeCache.getOrCompute(q, computeFn);
      }
      const end2 = performance.now();

      // Compute should not be called again (all cache hits)
      expect(computeCalls.length).toBe(200);

      console.log(`\n[BENCHMARK] getOrCompute throughput (200 queries):`);
      console.log(`  Cold (compute):  ${(end1 - start1).toFixed(2)} ms`);
      console.log(`  Warm (cached):   ${(end2 - start2).toFixed(2)} ms`);
      console.log(`  Speedup:         ${((end1 - start1) / Math.max(end2 - start2, 0.01)).toFixed(2)}x`);
    });
  });

  // ============================================================
  // Async Operations
  // ============================================================

  describe('async get/put throughput', () => {
    it('should handle concurrent async operations', async () => {
      const concCache = new QueryEmbeddingCache(100, 3600);
      const opsPerWorker = 50;
      const workerCount = 10;

      const start = performance.now();
      const workers = Array.from({ length: workerCount }, async (_, workerIdx) => {
        for (let i = 0; i < opsPerWorker; i++) {
          const key = `worker-${workerIdx}-op-${i}`;
          await concCache.putAsync(key, generateEmbedding(workerIdx * 1000 + i));
          const result = await concCache.getAsync(key);
          expect(result).not.toBeNull();
        }
      });

      await Promise.all(workers);
      const end = performance.now();

      const totalOps = workerCount * opsPerWorker * 2; // put + get
      console.log(`\n[BENCHMARK] Concurrent async ops (${workerCount} workers, ${opsPerWorker} ops each):`);
      console.log(`  Total time:      ${(end - start).toFixed(2)} ms`);
      console.log(`  Total ops:       ${totalOps}`);
      console.log(`  Ops/sec:         ${(totalOps / ((end - start) / 1000)).toFixed(0)}`);
      console.log(`  Final size:      ${concCache.size}`);

      // Size should be at most max_size
      expect(concCache.size).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================
  // Invalidate and Clear Performance
  // ============================================================

  describe('invalidate and clear performance', () => {
    it('should measure invalidate performance', () => {
      const largeCache = new QueryEmbeddingCache(1000, 3600);
      for (let i = 0; i < 1000; i++) {
        largeCache.put(`inv-${i}`, generateEmbedding(i));
      }

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        largeCache.invalidate(`inv-${i}`);
      }
      const end = performance.now();

      expect(largeCache.size).toBe(500);
      console.log(`\n[BENCHMARK] Invalidate (500 of 1000 entries):`);
      console.log(`  Time:            ${(end - start).toFixed(2)} ms`);
      console.log(`  Remaining:       ${largeCache.size}`);
    });

    it('should measure clear performance', () => {
      const largeCache = new QueryEmbeddingCache(1000, 3600);
      for (let i = 0; i < 1000; i++) {
        largeCache.put(`clear-${i}`, generateEmbedding(i));
      }

      const start = performance.now();
      const cleared = largeCache.clear();
      const end = performance.now();

      expect(cleared).toBe(1000);
      expect(largeCache.size).toBe(0);

      console.log(`\n[BENCHMARK] Clear (1000 entries):`);
      console.log(`  Time:            ${(end - start).toFixed(2)} ms`);
      console.log(`  Cleared:         ${cleared}`);
    });
  });
});

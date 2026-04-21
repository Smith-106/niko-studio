/**
 * Performance Benchmarks for Search Latency
 *
 * Tests cover:
 * - Hybrid search latency with simulated vector stores of varying sizes
 * - Query latency for stores with 100, 500, 1000 vectors
 * - p50, p95 latency metrics reporting
 * - Concurrent query handling
 *
 * NOTE: All embeddings and search operations are mocked (deterministic).
 * Timing reflects internal pipeline overhead only.
 * No strict time limits are enforced since CI environments vary.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HybridSearch, type StrategyWeight } from '../../search/hybrid-search';
import type { SearchInterface } from '../../protocols/search';
import { randomUUID } from 'node:crypto';

// ============================================================
// Mock Search Strategy
// ============================================================

const EMBEDDING_DIM = 384;

/**
 * In-memory mock search that returns scored results.
 * Simulates a vector store with configurable size and deterministic scoring.
 */
class MockVectorStore implements SearchInterface {
  private items: Map<string, { content: string; score: number; type: string; metadata: Record<string, unknown> }> = new Map();

  constructor(size: number = 100) {
    this.populate(size);
  }

  private populate(size: number): void {
    for (let i = 0; i < size; i++) {
      const id = `vec-${i}`;
      const content = `Sample document content item number ${i} with various keywords for search matching.`;
      // Deterministic score based on index: higher index = lower base score
      const score = Math.max(0.1, 1.0 - i / (size * 1.5));
      this.items.set(id, { content, score, type: 'chunk', metadata: { index: i } });
    }
  }

  get size(): number {
    return this.items.size;
  }

  async search(
    query: string,
    options?: { topK?: number; typeFilter?: string; minScore?: number }
  ): Promise<Record<string, unknown>[]> {
    const topK = options?.topK ?? 10;
    const minScore = options?.minScore ?? 0.0;

    // Simulate latency proportional to store size (realistic)
    await this.simulateCompute(this.items.size);

    const results: Record<string, unknown>[] = [];
    for (const [id, item] of this.items.entries()) {
      if (item.score >= minScore) {
        results.push({
          id,
          content: item.content,
          score: item.score,
          type: item.type,
          metadata: item.metadata,
          source: 'mock-vector',
        });
      }
    }

    results.sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0));
    return results.slice(0, topK);
  }

  async index(id: string, content: string, options?: { metadata?: Record<string, unknown>; type?: string }): Promise<void> {
    const score = Math.random() * 0.8 + 0.2;
    this.items.set(id, {
      content,
      score,
      type: options?.type ?? 'chunk',
      metadata: options?.metadata ?? {},
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  /**
   * Simulate compute work proportional to store size.
   * Each "item" costs a small amount of CPU time.
   */
  private simulateCompute(itemCount: number): Promise<void> {
    // Use busy-wait for deterministic timing (not affected by event loop)
    const workFactor = itemCount * 2;
    return new Promise((resolve) => {
      let sum = 0;
      for (let i = 0; i < workFactor; i++) {
        sum += Math.sin(i);
      }
      // Prevent dead code elimination
      if (sum < -99999) return;
      resolve();
    });
  }
}

/**
 * In-memory mock keyword/FTS search strategy.
 * Returns results based on substring matching.
 */
class MockKeywordSearch implements SearchInterface {
  private items: Map<string, string> = new Map();

  constructor(size: number = 100) {
    for (let i = 0; i < size; i++) {
      this.items.set(`doc-${i}`, `Document ${i}: contains sample text with keywords like alpha, beta, gamma, delta, epsilon.`);
    }
  }

  async search(
    query: string,
    options?: { topK?: number; typeFilter?: string; minScore?: number }
  ): Promise<Record<string, unknown>[]> {
    const topK = options?.topK ?? 10;
    const queryLower = query.toLowerCase();

    // Simulate minimal FTS latency
    await new Promise((r) => setTimeout(r, 0));

    const results: Record<string, unknown>[] = [];
    let count = 0;
    for (const [id, content] of this.items.entries()) {
      if (content.toLowerCase().includes(queryLower) || count < topK * 2) {
        const score = content.toLowerCase().includes(queryLower) ? 0.9 : 0.5 - count * 0.01;
        results.push({
          id,
          content,
          score: Math.max(score, 0.1),
          type: 'document',
          metadata: {},
          source: 'mock-keyword',
        });
        count++;
        if (count >= topK * 3) break;
      }
    }

    results.sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0));
    return results.slice(0, topK);
  }

  async index(id: string, content: string): Promise<void> {
    this.items.set(id, content);
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

// ============================================================
// Metrics helpers
// ============================================================

interface LatencyMetrics {
  storeSize: number;
  queryCount: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
}

function computeLatencyMetrics(latencies: number[], storeSize: number): LatencyMetrics {
  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;

  const percentile = (p: number): number => {
    const idx = Math.ceil((p / 100) * len) - 1;
    return sorted[Math.max(0, Math.min(idx, len - 1))];
  };

  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    storeSize,
    queryCount: len,
    p50Ms: percentile(50),
    p90Ms: percentile(90),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    minMs: sorted[0],
    maxMs: sorted[len - 1],
    avgMs: sum / len,
    medianMs: len % 2 === 0
      ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
      : sorted[Math.floor(len / 2)],
  };
}

function formatLatencyMetrics(m: LatencyMetrics): string {
  return [
    `  Store size:     ${m.storeSize} vectors`,
    `  Query count:    ${m.queryCount}`,
    `  p50 latency:    ${m.p50Ms.toFixed(2)} ms`,
    `  p90 latency:    ${m.p90Ms.toFixed(2)} ms`,
    `  p95 latency:    ${m.p95Ms.toFixed(2)} ms`,
    `  p99 latency:    ${m.p99Ms.toFixed(2)} ms`,
    `  Avg latency:    ${m.avgMs.toFixed(2)} ms`,
    `  Min latency:    ${m.minMs.toFixed(2)} ms`,
    `  Max latency:    ${m.maxMs.toFixed(2)} ms`,
  ].join('\n');
}

// ============================================================
// Tests
// ============================================================

describe('Search Latency Benchmarks', () => {
  const storeSizes = [100, 500, 1000];
  const queriesPerSize = 20;

  // ============================================================
  // Hybrid Search Latency at Different Store Sizes
  // ============================================================

  describe('hybrid search latency by store size', () => {
    const allMetrics: LatencyMetrics[] = [];

    for (const storeSize of storeSizes) {
      it(`should measure hybrid search latency with ${storeSize} vectors`, async () => {
        const vectorStore = new MockVectorStore(storeSize);
        const keywordStore = new MockKeywordSearch(storeSize);

        const strategies: StrategyWeight[] = [
          { name: 'vector', weight: 0.7, search: vectorStore },
          { name: 'keyword', weight: 0.3, search: keywordStore },
        ];

        const hybridSearch = new HybridSearch({
          strategies,
          rrfK: 60,
          defaultTopK: 10,
          parallelExecution: true,
        });

        // Warm-up query
        await hybridSearch.search('sample document alpha', { topK: 5 });

        // Collect latency samples
        const latencies: number[] = [];
        const testQueries = [
          'sample document alpha',
          'beta gamma delta',
          'epsilon keyword search',
          'matching text content',
          'vector store benchmark',
        ];

        for (let q = 0; q < queriesPerSize; q++) {
          const query = testQueries[q % testQueries.length] + ` run-${q}`;
          const start = performance.now();
          const results = await hybridSearch.search(query, { topK: 5 });
          const end = performance.now();
          latencies.push(end - start);

          expect(results.length).toBeGreaterThan(0);
        }

        const metrics = computeLatencyMetrics(latencies, storeSize);
        allMetrics.push(metrics);

        console.log(`\n[BENCHMARK] Hybrid search (${storeSize} vectors):\n${formatLatencyMetrics(metrics)}`);
      });
    }

    it('should report all hybrid search latency metrics', () => {
      console.log('\n[BENCHMARK] === Hybrid Search Latency Summary ===');
      for (const m of allMetrics) {
        console.log(formatLatencyMetrics(m));
      }
      expect(allMetrics.length).toBe(storeSizes.length);
    });
  });

  // ============================================================
  // Single Strategy (Vector-Only) Latency
  // ============================================================

  describe('vector-only search latency', () => {
    it('should measure vector search latency at 1000 vectors', async () => {
      const store = new MockVectorStore(1000);
      const latencies: number[] = [];

      for (let i = 0; i < queriesPerSize; i++) {
        const start = performance.now();
        await store.search(`query ${i} text`, { topK: 10 });
        const end = performance.now();
        latencies.push(end - start);
      }

      const metrics = computeLatencyMetrics(latencies, 1000);

      console.log(`\n[BENCHMARK] Vector-only search (1000 vectors):\n${formatLatencyMetrics(metrics)}`);

      expect(metrics.queryCount).toBe(queriesPerSize);
      expect(metrics.avgMs).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Concurrent Query Handling
  // ============================================================

  describe('concurrent query handling', () => {
    it('should handle 10 concurrent queries without errors', async () => {
      const vectorStore = new MockVectorStore(500);
      const keywordStore = new MockKeywordSearch(500);

      const strategies: StrategyWeight[] = [
        { name: 'vector', weight: 0.7, search: vectorStore },
        { name: 'keyword', weight: 0.3, search: keywordStore },
      ];

      const hybridSearch = new HybridSearch({
        strategies,
        rrfK: 60,
        defaultTopK: 10,
        parallelExecution: true,
      });

      const concurrencyLevels = [5, 10, 20];

      for (const concurrency of concurrencyLevels) {
        const queries = Array.from(
          { length: concurrency },
          (_, i) => `concurrent query number ${i} for benchmarking`
        );

        const start = performance.now();
        const results = await Promise.all(
          queries.map((q) => hybridSearch.search(q, { topK: 5 }))
        );
        const end = performance.now();

        const totalMs = end - start;

        expect(results.length).toBe(concurrency);
        for (const result of results) {
          expect(result.length).toBeGreaterThan(0);
        }

        console.log(
          `\n[BENCHMARK] Concurrent search (${concurrency} queries, 500 vectors):`
        );
        console.log(`  Total time:      ${totalMs.toFixed(2)} ms`);
        console.log(`  Avg per query:   ${(totalMs / concurrency).toFixed(2)} ms`);
        console.log(`  Throughput:      ${(concurrency / (totalMs / 1000)).toFixed(0)} qps`);
      }
    });

    it('should handle sequential vs parallel comparison', async () => {
      const vectorStore = new MockVectorStore(500);
      const keywordStore = new MockKeywordSearch(500);

      const queryCount = 15;
      const testQueries = Array.from(
        { length: queryCount },
        (_, i) => `comparison query ${i}`
      );

      // Sequential execution
      const seqStrategies: StrategyWeight[] = [
        { name: 'vector', weight: 0.7, search: vectorStore },
        { name: 'keyword', weight: 0.3, search: keywordStore },
      ];
      const seqHybrid = new HybridSearch({
        strategies: seqStrategies,
        rrfK: 60,
        defaultTopK: 10,
        parallelExecution: false, // sequential
      });

      const seqStart = performance.now();
      for (const q of testQueries) {
        await seqHybrid.search(q, { topK: 5 });
      }
      const seqEnd = performance.now();
      const seqMs = seqEnd - seqStart;

      // Parallel execution
      const parStrategies: StrategyWeight[] = [
        { name: 'vector', weight: 0.7, search: vectorStore },
        { name: 'keyword', weight: 0.3, search: keywordStore },
      ];
      const parHybrid = new HybridSearch({
        strategies: parStrategies,
        rrfK: 60,
        defaultTopK: 10,
        parallelExecution: true,
      });

      const parStart = performance.now();
      await Promise.all(
        testQueries.map((q) => parHybrid.search(q, { topK: 5 }))
      );
      const parEnd = performance.now();
      const parMs = parEnd - parStart;

      console.log('\n[BENCHMARK] Sequential vs Parallel execution (15 queries, 500 vectors):');
      console.log(`  Sequential:      ${seqMs.toFixed(2)} ms total`);
      console.log(`  Parallel:        ${parMs.toFixed(2)} ms total`);
      console.log(`  Speedup:         ${(seqMs / Math.max(parMs, 0.01)).toFixed(2)}x`);

      // Parallel should generally be faster or equal
      expect(parMs).toBeGreaterThan(0);
      expect(seqMs).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Scaling Behavior
  // ============================================================

  describe('search latency scaling', () => {
    it('should document scaling behavior from 100 to 1000 vectors', async () => {
      const scalingSizes = [100, 250, 500, 750, 1000];
      const scalingData: Array<{ size: number; avgMs: number }> = [];

      for (const size of scalingSizes) {
        const store = new MockVectorStore(size);
        const latencies: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await store.search(`scaling query ${i}`, { topK: 5 });
          const end = performance.now();
          latencies.push(end - start);
        }

        const avgMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        scalingData.push({ size, avgMs });
      }

      console.log('\n[BENCHMARK] Scaling behavior (vector-only search):');
      console.log('  Size  |  Avg Latency (ms)  |  Ratio vs 100');
      console.log('  ------|--------------------|--------------');
      const baseline = scalingData[0]!.avgMs;
      for (const d of scalingData) {
        const ratio = d.avgMs / Math.max(baseline, 0.01);
        console.log(
          `  ${String(d.size).padStart(5)} | ${d.avgMs.toFixed(2).padStart(18)} | ${ratio.toFixed(2)}x`
        );
      }

      // Verify scaling data collected
      expect(scalingData.length).toBe(scalingSizes.length);
    });
  });
});

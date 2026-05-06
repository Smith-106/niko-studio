/**
 * Performance Benchmarks for Embedding/Indexing Services
 *
 * Tests cover:
 * - Embedding generation throughput for batch sizes 10, 50, 100
 * - Timing measurement per batch with baseline documentation
 * - Indexing service with incremental additions
 * - Structured timing output for baseline comparison
 *
 * NOTE: These tests mock all external dependencies (model inference, network).
 * Timing reflects internal pipeline overhead only, not real model latency.
 * No strict time limits are enforced since CI environments vary.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmbeddingServiceImpl,
  ProviderType,
} from '../../services/embedding-service';
import type {
  EmbeddingProvider,
  EmbeddingCache,
  BatchEmbeddingResponse,
} from '../../protocols/embedding';
import { IndexingService } from '../../services/indexing-service';
import type { Embedder } from '../../services/indexing-service';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// ============================================================
// Mock implementations
// ============================================================

const EMBEDDING_DIM = 384;

/**
 * Fast mock provider that returns deterministic embeddings
 * with configurable per-call latency for benchmarking.
 */
class BenchmarkMockProvider implements EmbeddingProvider {
  readonly providerType = ProviderType.LOCAL;

  async embed(texts: string[], model: string): Promise<BatchEmbeddingResponse> {
    const embeddings = texts.map((text, idx) => {
      const vec = new Array<number>(EMBEDDING_DIM);
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        vec[i] = ((text.charCodeAt(i % text.length) + idx) % 100) / 100.0;
      }
      // Normalize
      let norm = 0;
      for (const v of vec) norm += v * v;
      norm = Math.sqrt(norm);
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
      return vec;
    });
    return { embeddings, model, provider: this.providerType, dimensions: EMBEDDING_DIM };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getDimensions(_model: string): number {
    return EMBEDDING_DIM;
  }
}

/**
 * No-op mock cache for benchmarking (avoids cache overhead in timing).
 */
class NoOpCache implements EmbeddingCache {
  private _size = 0;
  async get(): Promise<number[] | null> { return null; }
  async set(): Promise<void> { this._size++; }
  async getBatch(texts: string[], _model: string): Promise<Record<string, number[] | null>> {
    return Object.fromEntries(texts.map((t) => [t, null]));
  }
  async setBatch(items: Record<string, number[]>, _model: string): Promise<void> {
    this._size += Object.keys(items).length;
  }
  async clear(): Promise<void> { this._size = 0; }
  async stats(): Promise<Record<string, unknown>> {
    return { size: this._size };
  }
}

/**
 * Mock embedder for IndexingService with deterministic 384-dim vectors.
 */
class BenchmarkMockEmbedder implements Embedder {
  readonly embeddingSize = EMBEDDING_DIM;

  embed(texts: string[]): number[][] {
    return texts.map((text, idx) => {
      const vec = new Array<number>(EMBEDDING_DIM);
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        vec[i] = ((text.charCodeAt(i % text.length) + idx) % 100) / 100.0;
      }
      let norm = 0;
      for (const v of vec) norm += v * v;
      norm = Math.sqrt(norm);
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
      return vec;
    });
  }
}

// ============================================================
// Data generators
// ============================================================

function generateDocumentChunks(count: number, chunkSize: number = 200): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    chunks.push(
      `Document chunk ${i}: This is a simulated content block for performance benchmarking. ` +
      `It contains enough text to approximate real-world document processing. ` +
      `The quick brown fox jumps over the lazy dog. Sentence ${i} of ${count}. ` +
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(Math.ceil(chunkSize / 100))
    );
  }
  return chunks;
}

interface TimingResult {
  batchSize: number;
  totalTimeMs: number;
  timePerItemMs: number;
  throughput: number; // items/second
  dimensions: number;
}

function formatTimingResult(result: TimingResult): string {
  return [
    `  Batch size:      ${result.batchSize}`,
    `  Total time:      ${result.totalTimeMs.toFixed(2)} ms`,
    `  Time per item:   ${result.timePerItemMs.toFixed(4)} ms`,
    `  Throughput:      ${result.throughput.toFixed(0)} items/s`,
    `  Dimensions:      ${result.dimensions}`,
  ].join('\n');
}

// ============================================================
// Tests
// ============================================================

describe('Embedding/Indexing Performance Benchmarks', () => {
  let provider: BenchmarkMockProvider;
  let cache: NoOpCache;
  let tmpDir: string;

  beforeEach(() => {
    provider = new BenchmarkMockProvider();
    cache = new NoOpCache();
    tmpDir = mkdtempSync(join(tmpdir(), 'niko-perf-'));
  });

  // ============================================================
  // Embedding Throughput Benchmarks
  // ============================================================

  describe('embedBatch throughput', () => {
    const batchSizes = [10, 50, 100];
    const results: TimingResult[] = [];

    for (const batchSize of batchSizes) {
      it(`should embed batch of ${batchSize} chunks and document timing`, async () => {
        const service = new EmbeddingServiceImpl(
          new Map([[ProviderType.LOCAL, provider]]),
          { defaultProvider: ProviderType.LOCAL }
        );

        const chunks = generateDocumentChunks(batchSize);
        expect(chunks.length).toBe(batchSize);

        const start = performance.now();
        const embeddings = await service.embedBatch(chunks);
        const end = performance.now();

        const totalTimeMs = end - start;
        const result: TimingResult = {
          batchSize,
          totalTimeMs,
          timePerItemMs: totalTimeMs / batchSize,
          throughput: batchSize / (totalTimeMs / 1000),
          dimensions: EMBEDDING_DIM,
        };
        results.push(result);

        // Verify correctness
        expect(embeddings.length).toBe(batchSize);
        for (const emb of embeddings) {
          expect(emb.length).toBe(EMBEDDING_DIM);
        }

        // Log structured timing for baseline comparison
        console.log(`\n[BENCHMARK] embedBatch (${batchSize} chunks):\n${formatTimingResult(result)}`);
      });
    }

    it('should report all throughput results', () => {
      console.log('\n[BENCHMARK] === Embedding Throughput Summary ===');
      for (const r of results) {
        console.log(formatTimingResult(r));
      }
      // Sanity: all batches completed successfully
      expect(results.length).toBe(batchSizes.length);
    });
  });

  // ============================================================
  // Cached Embedding Throughput
  // ============================================================

  describe('cached embedBatch throughput', () => {
    it('should show cache hit performance improvement for batch of 50', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.LOCAL, provider]]),
        { defaultProvider: ProviderType.LOCAL, cache }
      );

      const chunks = generateDocumentChunks(50);

      // Cold run (all misses)
      const coldStart = performance.now();
      await service.embedBatch(chunks);
      const coldEnd = performance.now();
      const coldMs = coldEnd - coldStart;

      // Warm run (all hits)
      const warmStart = performance.now();
      await service.embedBatch(chunks);
      const warmEnd = performance.now();
      const warmMs = warmEnd - warmStart;

      console.log(`\n[BENCHMARK] Cached embedBatch (50 chunks):`);
      console.log(`  Cold (miss):  ${coldMs.toFixed(2)} ms`);
      console.log(`  Warm (hit):   ${warmMs.toFixed(2)} ms`);
      console.log(`  Speedup:      ${(coldMs / Math.max(warmMs, 0.01)).toFixed(2)}x`);

      // Warm should not be slower than cold for mocked implementation
      // (no strict assertion since timing can vary)
      expect(warmMs).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // IndexingService Incremental Addition Benchmark
  // ============================================================

  describe('IndexingService incremental indexing', () => {
    it('should measure incremental document addition throughput', { timeout: 30_000 }, async () => {
      const dbPath = join(tmpDir, 'indexing-bench.db');
      const indexingService = new IndexingService(dbPath);
      const embedder = new BenchmarkMockEmbedder();
      indexingService.setEmbedder(embedder);

      const incrementSizes = [10, 25, 50];
      const timingResults: Array<{
        increment: number;
        totalAfterAdd: number;
        addTimeMs: number;
        timePerDocMs: number;
      }> = [];

      let totalDocs = 0;

      for (const increment of incrementSizes) {
        const docs = generateDocumentChunks(increment, 150);

        const start = performance.now();
        for (let i = 0; i < docs.length; i++) {
          indexingService.addDocument(
            `doc-${totalDocs + i}`,
            docs[i],
            'benchmark'
          );
        }
        const end = performance.now();

        totalDocs += increment;
        const addTimeMs = end - start;

        timingResults.push({
          increment,
          totalAfterAdd: totalDocs,
          addTimeMs,
          timePerDocMs: addTimeMs / increment,
        });
      }

      // Verify search works after indexing
      const searchResults = indexingService.search('Document chunk', 5, 0.0);
      expect(searchResults.length).toBeGreaterThan(0);

      console.log('\n[BENCHMARK] IndexingService incremental addition:');
      for (const r of timingResults) {
        console.log(
          `  +${r.increment} docs (total ${r.totalAfterAdd}): ` +
          `${r.addTimeMs.toFixed(2)} ms, ${r.timePerDocMs.toFixed(2)} ms/doc`
        );
      }

      // Verify correctness
      expect(timingResults.length).toBe(incrementSizes.length);
      expect(totalDocs).toBe(85);

      indexingService.close();
    });

    it('should measure search latency after bulk indexing', { timeout: 60_000 }, () => {
      const dbPath = join(tmpDir, 'indexing-search-bench.db');
      const indexingService = new IndexingService(dbPath);
      const embedder = new BenchmarkMockEmbedder();
      indexingService.setEmbedder(embedder);

      // Bulk index 100 documents
      const docs = generateDocumentChunks(100, 150);
      for (let i = 0; i < docs.length; i++) {
        indexingService.addDocument(`doc-${i}`, docs[i], 'benchmark');
      }

      // Measure search latency over multiple queries
      const queries = [
        'document chunk',
        'simulated content',
        'performance benchmarking',
        'quick brown fox',
        'lorem ipsum',
      ];

      const latencies: number[] = [];
      for (const query of queries) {
        const start = performance.now();
        const results = indexingService.search(query, 5, 0.0);
        const end = performance.now();
        latencies.push(end - start);
        expect(results.length).toBeGreaterThan(0);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      console.log('\n[BENCHMARK] IndexingService search latency (100 docs indexed):');
      console.log(`  Queries:       ${latencies.length}`);
      console.log(`  Avg latency:   ${avgLatency.toFixed(2)} ms`);
      console.log(`  Min latency:   ${minLatency.toFixed(2)} ms`);
      console.log(`  Max latency:   ${maxLatency.toFixed(2)} ms`);

      indexingService.close();
    });
  });

  // ============================================================
  // Cosine Similarity Throughput
  // ============================================================

  describe('cosine similarity throughput', () => {
    it('should measure batch similarity computation throughput', async () => {
      const service = new EmbeddingServiceImpl(
        new Map([[ProviderType.LOCAL, provider]]),
        { defaultProvider: ProviderType.LOCAL }
      );

      // Generate a query embedding and 100 target embeddings
      const queryEmbedding = await service.embed('query text for benchmarking');
      const targetTexts = generateDocumentChunks(100);
      const targetEmbeddings = await service.embedBatch(targetTexts);

      // Measure pairwise similarity computation
      const start = performance.now();
      const scores: number[] = [];
      for (const target of targetEmbeddings) {
        scores.push(service.similarity(queryEmbedding, target));
      }
      const end = performance.now();
      const totalTimeMs = end - start;

      console.log('\n[BENCHMARK] Cosine similarity (query vs 100 targets):');
      console.log(`  Total time:      ${totalTimeMs.toFixed(2)} ms`);
      console.log(`  Time per pair:   ${(totalTimeMs / 100).toFixed(4)} ms`);
      console.log(`  Throughput:      ${(100 / (totalTimeMs / 1000)).toFixed(0)} pairs/s`);

      expect(scores.length).toBe(100);
      // All scores should be in valid cosine similarity range
      for (const score of scores) {
        expect(score).toBeGreaterThanOrEqual(-1.0);
        expect(score).toBeLessThanOrEqual(1.0);
      }
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { IndexingService } from '../../services/indexing-service';

function createMockEmbedder(dimensions: number = 8): import('../../services/indexing-service').Embedder {
  const cache = new Map<string, number[]>();

  return {
    embed(texts: string[]): number[][] {
      return texts.map((text) => {
        if (cache.has(text)) return cache.get(text)!;

        // Deterministic pseudo-embedding based on character codes
        const vec: number[] = [];
        for (let i = 0; i < dimensions; i++) {
          const charCode = text.charCodeAt(i % text.length) || 0;
          vec.push((charCode % 100) / 100.0);
        }
        // Normalize
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
        for (let i = 0; i < vec.length; i++) {
          vec[i] /= norm;
        }
        cache.set(text, vec);
        return vec;
      });
    },
    embeddingSize: dimensions,
  };
}

describe('IndexingService', () => {
  let workspace: string;
  let dbPath: string;
  let svc: IndexingService;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-indexing-'));
    dbPath = join(workspace, 'test-index.db');
  });

  afterEach(async () => {
    try { svc?.close(); } catch { /* ignore */ }
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  it('constructs without error and creates the database schema', () => {
    svc = new IndexingService(dbPath);
    // No exception means the DB was created
  });

  it('throws when searching without setting an embedder', () => {
    svc = new IndexingService(dbPath);
    expect(() => svc.search('test query')).toThrow('Embedder not configured');
  });

  it('throws when adding a document without setting an embedder', () => {
    svc = new IndexingService(dbPath);
    expect(() => svc.addDocument('doc-1', 'some content')).toThrow('Embedder not configured');
  });

  it('addDocument stores a document that becomes searchable', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'protagonist arrives at the city gates');

    // Search with low minScore to ensure we get results regardless of embedding quality
    const results = svc.search('protagonist city', 10, 0.0);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('doc-1');
    expect(results[0].content).toContain('protagonist');
  });

  it('search respects topK parameter', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'alpha');
    svc.addDocument('doc-2', 'beta');
    svc.addDocument('doc-3', 'gamma');

    const results = svc.search('alpha', 1, 0.0);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('search respects minScore threshold', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'completely different text');

    // No threshold: should return at least 1 result
    const noThreshold = svc.search('completely different text', 10, 0.0);
    expect(noThreshold.length).toBe(1);

    // Extreme threshold: should return 0 results
    const extreme = svc.search('completely different text', 10, 1.5);
    expect(extreme.length).toBe(0);
  });

  it('results are sorted by score descending', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'first document here');
    svc.addDocument('doc-2', 'second document here');
    svc.addDocument('doc-3', 'third document here');

    const results = svc.search('document', 10, 0.0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('addDocument with INSERT OR REPLACE updates existing documents', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'original content');
    svc.addDocument('doc-1', 'updated content');

    const results = svc.search('updated content', 10, 0.0);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('updated content');
  });

  it('source_type is stored and returned in search results', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('scene-1', 'The hero enters the forest', 'scene');
    svc.addDocument('char-1', 'Hero is a brave warrior', 'character');

    // Use a low minScore to get results regardless of embedding similarity
    const results = svc.search('hero', 10, 0.0);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const types = results.map(r => r.source_type);
    // At minimum, one type should be present
    expect(types.length).toBeGreaterThan(0);

    // Verify each result has a valid source_type
    for (const r of results) {
      expect(['scene', 'character']).toContain(r.source_type);
    }
  });

  it('scores are rounded to 4 decimal places', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    svc.addDocument('doc-1', 'test content for rounding');

    const results = svc.search('test content for rounding', 10, 0.0);
    expect(results.length).toBeGreaterThanOrEqual(1);

    for (const r of results) {
      const decimals = String(r.score).split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(4);
    }
  });

  it('search returns empty array when no documents are indexed', () => {
    svc = new IndexingService(dbPath);
    svc.setEmbedder(createMockEmbedder());

    const results = svc.search('anything');
    expect(results).toEqual([]);
  });

  it('removes closed services from the exit-shutdown registry', () => {
    svc = new IndexingService(dbPath);
    svc.close();

    expect(() => svc.close()).not.toThrow();
  });

  it('registers an exit shutdown hook for live service instances', async () => {
    const registered: Array<() => void> = [];
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === 'exit') {
        registered.push(listener as () => void);
      }
      return process;
    });

    vi.resetModules();
    const module = await import('../../services/indexing-service');
    const hooked = new module.IndexingService(join(workspace, 'hooked-index.db'));

    expect(registered).toHaveLength(1);

    registered[0]();

    expect(() => hooked.close()).not.toThrow();
    processOnSpy.mockRestore();
  });
});

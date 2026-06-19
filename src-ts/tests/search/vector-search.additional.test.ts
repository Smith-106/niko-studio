import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DatabaseError,
  EmbeddingError,
  VectorSearch,
  VectorSearchError,
} from '../../search/vector-search';
import type { EmbeddingService } from '../../protocols/embedding';

class ScriptedEmbeddingService implements EmbeddingService {
  public readonly embedCalls: Array<{ text: string; model?: string }> = [];
  public readonly getDimensionsCalls: Array<string | undefined> = [];
  public rejectNext: Error | null = null;
  public vectors = new Map<string, number[]>();

  constructor(private readonly dimensions = 3) {}

  async embed(text: string, options?: { model?: string }): Promise<number[]> {
    this.embedCalls.push({ text, model: options?.model });
    if (this.rejectNext) {
      const error = this.rejectNext;
      this.rejectNext = null;
      throw error;
    }
    return [...(this.vectors.get(text) ?? this.defaultVector(text))];
  }

  async embedBatch(
    texts: string[],
    options?: { model?: string; batchSize?: number }
  ): Promise<number[][]> {
    void options;
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  async embedWithMetadata(request: { text: string; model?: string }) {
    const embedding = await this.embed(request.text, { model: request.model });
    return {
      embedding,
      metadata: {
        dimensions: embedding.length,
        model: request.model ?? 'scripted-model',
      },
    };
  }

  similarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
    const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
    return normA === 0 || normB === 0 ? 0 : dot / (normA * normB);
  }

  getDimensions(model?: string): number {
    this.getDimensionsCalls.push(model);
    return this.dimensions;
  }

  private defaultVector(text: string): number[] {
    if (text.includes('beta')) return [0, 1, 0];
    if (text.includes('zero')) return [0, 0, 0];
    return [1, 0, 0];
  }
}

describe('VectorSearch additional coverage', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.splice(0).forEach((dir) => {
      rmSync(dir, { recursive: true, force: true });
    });
    vi.restoreAllMocks();
  });

  function createSearch(service = new ScriptedEmbeddingService()): VectorSearch {
    return new VectorSearch({
      dbPath: ':memory:',
      embeddingService: service,
      dimension: 3,
      modelName: 'scripted-model',
    });
  }

  function createTempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'niko-vector-search-extra-'));
    tempDirs.push(dir);
    return join(dir, 'nested', 'vectors.db');
  }

  it('derives defaults and creates parent directories for file databases', async () => {
    const service = new ScriptedEmbeddingService(3);
    const dbPath = createTempDbPath();
    const search = new VectorSearch({
      dbPath,
      embeddingService: service,
      hnsw: { efSearch: 7 },
    });

    try {
      await search.add('alpha-1', 'alpha default item');
      const stats = await search.getStats();

      expect(existsSync(dbPath)).toBe(true);
      expect(stats.dimension).toBe(3);
      expect(stats.dbPath).toBe(dbPath);
      expect(service.getDimensionsCalls[0]).toBe('BAAI/bge-small-en-v1.5');
      expect(service.embedCalls[0]).toEqual({
        text: 'alpha default item',
        model: 'BAAI/bge-small-en-v1.5',
      });
      expect((search as any).hnswConfig.efSearch).toBe(7);
    } finally {
      search.close();
    }
  });

  it('keeps explicit vector dimension errors unwrapped on add and query', async () => {
    const service = new ScriptedEmbeddingService();
    const search = createSearch(service);

    try {
      await expect(
        search.add('short', 'alpha short vector', undefined, 'chunk', [1, 0])
      ).rejects.toBeInstanceOf(VectorSearchError);

      service.vectors.set('bad query', [1, 0]);
      await expect(search.vectorSearch('bad query')).rejects.toBeInstanceOf(VectorSearchError);
    } finally {
      search.close();
    }
  });

  it('wraps add-time embedding failures as DatabaseError', async () => {
    const service = new ScriptedEmbeddingService();
    const search = createSearch(service);

    try {
      service.rejectNext = new Error('embedding backend down');

      await expect(search.add('bad-add', 'alpha add failure')).rejects.toMatchObject({
        name: 'DatabaseError',
        message: 'Failed to add item bad-add',
      });
    } finally {
      search.close();
    }
  });

  it('wraps query embedding failures as EmbeddingError', async () => {
    const service = new ScriptedEmbeddingService();
    const search = createSearch(service);

    try {
      await search.add('alpha-1', 'alpha searchable', undefined, 'chunk');
      service.rejectNext = new Error('query embedding backend down');

      await expect(search.vectorSearch('alpha query')).rejects.toBeInstanceOf(EmbeddingError);
    } finally {
      search.close();
    }
  });

  it('filters vector and keyword fallback results by type', async () => {
    const search = createSearch();

    try {
      await search.add('chunk-alpha', 'alpha chunk item', undefined, 'chunk');
      await search.add('memory-alpha', 'alpha memory item', undefined, 'memory');
      await search.add('memory-quoted', 'memory "quoted" alpha item', undefined, 'memory');
      await search.add('chunk-quoted', 'chunk "quoted" alpha item', undefined, 'chunk');

      const vectorResults = await search.vectorSearch('alpha query', {
        topK: 5,
        typeFilter: 'memory',
      });
      expect(vectorResults.map((result) => result.id)).toContain('memory-alpha');
      expect(vectorResults.every((result) => result.type === 'memory')).toBe(true);

      const fallbackResults = await search.keywordSearch('"', {
        topK: 5,
        typeFilter: 'memory',
      });
      expect(fallbackResults.map((result) => result.id)).toEqual(['memory-quoted']);
      expect(fallbackResults[0]?.source).toBe('fuzzy');
    } finally {
      search.close();
    }
  });

  it('normalizes metadata, locations, invalid JSON, and zero-vector scores', async () => {
    const service = new ScriptedEmbeddingService();
    const search = createSearch(service);

    try {
      await search.add(
        'alpha-meta',
        'alpha metadata item',
        {
          doc_id: 'doc-1',
          surface: 'draft',
          loc: { kind: 'range', start: 'not-a-number', end: 'bad-end' },
          chunk_index: 0,
        },
        'chunk',
        [1, 0, 0]
      );
      await search.add(
        'alpha-loc-defaults',
        'alpha location defaults',
        {
          loc: { start: '5', end: '9' },
        },
        'chunk',
        [1, 0, 0]
      );
      await search.add(
        'alpha-loc-open',
        'alpha open location',
        {
          loc: { kind: 'line', start: '6' },
        },
        'chunk',
        [1, 0, 0]
      );
      await search.add('zero-item', 'zero vector item', undefined, 'chunk', [0, 0, 0]);

      const db = (search as any).getDatabase();
      db.prepare(`
        INSERT INTO vector_items (id, content, metadata, embedding, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'bad-json',
        'alpha invalid json',
        '{bad json',
        (search as any).vectorToBuffer([1, 0, 0]),
        'chunk',
        Date.now()
      );

      const results = await search.vectorSearch('alpha query', { topK: 5 });
      const metadataResult = results.find((result) => result.id === 'alpha-meta');
      const badJsonResult = results.find((result) => result.id === 'bad-json');

      expect(metadataResult?.metadata).toMatchObject({
        doc_id: 'doc-1',
        surface: 'draft',
        chunk_index: 0,
        extra: {},
      });
      expect(metadataResult?.loc).toEqual({ kind: 'range', start: 0, end: undefined });
      expect(metadataResult?.metadata.loc).toEqual({ kind: 'range', start: 0, end: undefined });
      expect(badJsonResult?.metadata.extra).toEqual({});
      expect(results.find((result) => result.id === 'alpha-loc-defaults')?.loc).toEqual({
        kind: 'char',
        start: 5,
        end: 9,
      });
      expect(results.find((result) => result.id === 'alpha-loc-open')?.loc).toEqual({
        kind: 'line',
        start: 6,
        end: undefined,
      });
      expect((search as any).buildMetadata(undefined)).toEqual({
        path: undefined,
        doc_id: undefined,
        surface: undefined,
        loc: undefined,
        chunk_index: undefined,
        extra: {},
      });
      expect((search as any).parseMetadata('')).toEqual({});

      const zeroResults = await search.vectorSearch('zero query', { topK: 5 });
      expect(zeroResults.find((result) => result.id === 'zero-item')?.score).toBe(0);

      const minScoreResults = await search.vectorSearch('zero query', { minScore: 0.01 });
      expect(minScoreResults.map((result) => result.id)).not.toContain('zero-item');
    } finally {
      search.close();
    }
  });

  it('falls back to vector search when hybrid search dependencies fail', async () => {
    const search = createSearch();

    try {
      await search.add('alpha-1', 'alpha vector-only item', undefined, 'chunk');
      vi.spyOn(search, 'keywordSearch').mockRejectedValueOnce(new Error('fts unavailable'));

      const results = await search.hybridSearch('alpha query', { topK: 1 });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'alpha-1',
        source: 'vector',
        mode_used: 'vector',
      });
    } finally {
      search.close();
    }
  });

  it('uses default search options and skips rows without stored embeddings', async () => {
    const search = createSearch();

    try {
      await search.add('alpha-1', 'alpha default hybrid item', undefined, 'chunk');
      await search.add('beta-1', 'beta default hybrid item', undefined, 'chunk');

      const originalQueryRows = (search as any).queryRows.bind(search);
      vi.spyOn(search as any, 'queryRows').mockReturnValueOnce([
        {
          id: 'missing-embedding',
          content: 'alpha missing embedding',
          metadata: '{}',
          embedding: null,
          type: 'chunk',
          created_at: Date.now(),
        },
        ...originalQueryRows((search as any).getDatabase()),
      ]);

      const vectorResults = await search.vectorSearch('alpha query');
      expect(vectorResults.map((result) => result.id)).not.toContain('missing-embedding');

      const hybridResults = await search.hybridSearch('alpha query');
      expect(hybridResults.length).toBeGreaterThan(0);
      expect(hybridResults[0]?.source).toBe('hybrid');

      const keywordResults = await search.keywordSearch('alpha');
      expect(keywordResults.length).toBeGreaterThan(0);

      const likeResults = await (search as any).likeSearch('alpha');
      expect(likeResults.length).toBeGreaterThan(0);
    } finally {
      search.close();
    }
  });

  it('normalizes keyword rows with missing rank values', async () => {
    const search = createSearch();

    try {
      vi.spyOn(search as any, 'getDatabase').mockReturnValueOnce({
        prepare: () => ({
          all: () => [
            {
              id: 'rankless',
              content: 'rankless alpha row',
              metadata: JSON.stringify({ path: '/rankless.md' }),
              type: 'chunk',
            },
          ],
        }),
      });

      const results = await search.keywordSearch('alpha');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'rankless',
        score: 1,
        source: 'fuzzy',
        metadata: { path: '/rankless.md' },
      });
    } finally {
      search.close();
    }
  });

  it('covers LIKE wildcard fallback scores and direct fusion branches', async () => {
    const search = createSearch();

    try {
      await search.add('alpha-1', 'alpha first item', undefined, 'chunk');
      await search.add('beta-1', 'beta second item', undefined, 'chunk');

      const likeResults = await (search as any).likeSearch('%', { topK: 2 });
      expect(likeResults).toHaveLength(2);
      expect(likeResults.every((result: { score: number }) => result.score > 0)).toBe(true);

      const fused = (search as any).reciprocalRankFusion(
        [
          { id: 'shared', content: 'shared', score: 1, type: 'chunk', source: 'vector', mode_used: 'vector', metadata: { extra: {} }, snapshot_query: 'q' },
          { id: 'shared', content: 'shared duplicate', score: 0.9, type: 'chunk', source: 'vector', mode_used: 'vector', metadata: { extra: {} }, snapshot_query: 'q' },
        ],
        [
          { id: 'shared', content: 'shared', score: 1, type: 'chunk', source: 'fuzzy', mode_used: 'fuzzy', metadata: { extra: {} }, snapshot_query: 'q' },
          { id: 'keyword-only', content: 'keyword', score: 1, type: 'chunk', source: 'fuzzy', mode_used: 'fuzzy', metadata: { extra: {} }, snapshot_query: 'q' },
        ],
        0.7,
        0.3,
        60,
        2
      );

      expect(fused.map((result: { id: string }) => result.id)).toEqual(['shared', 'keyword-only']);
      expect(fused.every((result: { source: string; mode_used: string }) => result.source === 'hybrid' && result.mode_used === 'hybrid')).toBe(true);
    } finally {
      search.close();
    }
  });

  it('wraps delete database failures without masking explicit vector errors', async () => {
    const search = createSearch();

    try {
      vi.spyOn(search as any, 'getDatabase').mockReturnValueOnce({
        prepare: () => ({
          run: () => {
            throw new Error('delete unavailable');
          },
        }),
      });
      await expect(search.delete('delete-db-error')).rejects.toMatchObject({
        name: 'DatabaseError',
        message: 'Failed to delete item delete-db-error',
      });

      vi.spyOn(search as any, 'getDatabase').mockReturnValueOnce({
        prepare: () => ({
          run: () => {
            throw new VectorSearchError('delete vector error');
          },
        }),
      });
      await expect(search.delete('delete-vector-error')).rejects.toBeInstanceOf(VectorSearchError);
    } finally {
      search.close();
    }
  });

  it('wraps database failures and tolerates repeated close calls', async () => {
    const search = createSearch();

    try {
      vi.spyOn(search as any, 'getDatabase').mockReturnValueOnce({
        prepare: () => {
          throw new Error('stats unavailable');
        },
      });

      await expect(search.getStats()).rejects.toBeInstanceOf(DatabaseError);
    } finally {
      search.close();
      expect(() => search.close()).not.toThrow();
    }
  });
});

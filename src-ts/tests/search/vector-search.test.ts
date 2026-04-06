import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createVectorSearch,
  DatabaseError,
  EmbeddingError,
  VectorSearch,
  VectorSearchError,
} from '../../search/vector-search';
import type { EmbeddingService } from '../../protocols/embedding';

class MockEmbeddingService implements EmbeddingService {
  async embed(text: string): Promise<number[]> {
    const base = Array(384).fill(0);
    if (text.toLowerCase().includes('alpha')) base[0] = 1;
    if (text.toLowerCase().includes('beta')) base[1] = 1;
    if (text.toLowerCase().includes('gamma')) base[2] = 1;
    if (base.every((value) => value === 0)) base[3] = 1;
    return base;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  async embedWithMetadata(request: { text: string; model?: string }): Promise<{ embedding: number[]; metadata: Record<string, unknown> }> {
    const embedding = await this.embed(request.text);
    return {
      embedding,
      metadata: {
        model: request.model ?? 'test-model',
        dimensions: embedding.length,
      },
    };
  }

  similarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getDimensions(): number {
    return 384;
  }
}

describe('VectorSearch', () => {
  let vectorSearch: VectorSearch;
  let embeddingService: MockEmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService = new MockEmbeddingService();
    vectorSearch = new VectorSearch({
      dbPath: ':memory:',
      embeddingService,
      dimension: 384,
      modelName: 'test-model',
    });
  });

  afterEach(() => {
    vectorSearch.close();
  });

  it('stores and retrieves indexed items through vector search', async () => {
    await vectorSearch.add('alpha-1', 'alpha content', { path: '/alpha.md', extra: { chapter: 1 } }, 'chunk');
    await vectorSearch.add('beta-1', 'beta content', { path: '/beta.md' }, 'memory');

    const results = await vectorSearch.vectorSearch('alpha query', { topK: 5 });
    expect(results[0]?.id).toBe('alpha-1');
    expect(results[0]?.metadata.path).toBe('/alpha.md');
    expect(results[0]?.metadata.extra).toEqual({ chapter: 1 });
  });

  it('supports SearchInterface search/index/delete lifecycle', async () => {
    await vectorSearch.index('alpha-1', 'alpha content', { metadata: { path: '/alpha.md' }, type: 'chunk' });
    let results = await vectorSearch.search('alpha', { topK: 5 });
    expect(results.map((item) => item['id'])).toContain('alpha-1');

    const deleted = await vectorSearch.delete('alpha-1');
    expect(deleted).toBe(true);

    results = await vectorSearch.search('alpha', { topK: 5 });
    expect(results.map((item) => item['id'])).not.toContain('alpha-1');
  });

  it('supports keyword and like fallback search', async () => {
    await vectorSearch.add('doc-1', 'gamma phrase appears here', { path: '/gamma.md' }, 'chunk');
    await vectorSearch.add('doc-2', 'unrelated content', { path: '/other.md' }, 'chunk');

    const keywordResults = await vectorSearch.keywordSearch('gamma', { topK: 5 });
    expect(keywordResults[0]?.id).toBe('doc-1');

    const likeResults = await (vectorSearch as any).likeSearch('unrelated', { topK: 5 });
    expect(likeResults[0]?.id).toBe('doc-2');
  });

  it('supports hybrid search with fused results', async () => {
    await vectorSearch.add('alpha-1', 'alpha keyword content', { path: '/alpha.md' }, 'chunk');
    await vectorSearch.add('beta-1', 'beta keyword content', { path: '/beta.md' }, 'chunk');

    const results = await vectorSearch.hybridSearch('alpha keyword', { topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.source).toBe('hybrid');
    expect(results[0]?.mode_used).toBe('hybrid');
  });

  it('reports stats for indexed content', async () => {
    await vectorSearch.add('alpha-1', 'alpha content', undefined, 'chunk');
    await vectorSearch.add('beta-1', 'beta content', undefined, 'memory');

    const stats = await vectorSearch.getStats();
    expect(stats.totalItems).toBe(2);
    expect(stats.byType).toEqual({ chunk: 1, memory: 1 });
    expect(stats.dimension).toBe(384);
  });

  it('keeps vector utility helpers working', () => {
    const vector = [1.5, 2.5, 3.5, 4.5];
    const buffer = (vectorSearch as any).vectorToBuffer(vector);
    const roundTrip = (vectorSearch as any).bufferToVector(buffer);
    expect(roundTrip).toHaveLength(vector.length);
    for (let i = 0; i < vector.length; i += 1) {
      expect(roundTrip[i]).toBeCloseTo(vector[i], 5);
    }
  });

  it('throws VectorSearchError for mismatched vector dimensions', () => {
    expect(() => (vectorSearch as any).cosineSimilarity([1, 2], [1, 2, 3])).toThrow(VectorSearchError);
  });

  it('preserves explicit error causes', () => {
    const dbError = new DatabaseError('db failed', new Error('cause'));
    const embeddingError = new EmbeddingError('embed failed', new Error('cause'));
    expect(dbError.cause).toBeInstanceOf(Error);
    expect(embeddingError.cause).toBeInstanceOf(Error);
  });

  it('factory function creates usable VectorSearch instances', async () => {
    const instance = createVectorSearch(':memory:', embeddingService, { dimension: 384 });
    await instance.add('alpha-1', 'alpha content');
    const results = await instance.search('alpha', { topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    instance.close();
  });
});

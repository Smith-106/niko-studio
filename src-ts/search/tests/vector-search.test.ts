import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createVectorSearch,
  DatabaseError,
  EmbeddingError,
  VectorSearch,
  VectorSearchError,
} from '../vector-search';
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

describe('search/vector-search legacy path', () => {
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

  it('supports add/search/delete on the legacy search test path', async () => {
    await vectorSearch.add('alpha-1', 'alpha content', { path: '/alpha.md' }, 'chunk');
    let results = await vectorSearch.search('alpha', { topK: 5 });
    expect(results[0]?.['id']).toBe('alpha-1');

    expect(await vectorSearch.delete('alpha-1')).toBe(true);
    results = await vectorSearch.search('alpha', { topK: 5 });
    expect(results.map((row) => row['id'])).not.toContain('alpha-1');
  });

  it('supports keyword, vector, and hybrid retrieval', async () => {
    await vectorSearch.add('alpha-1', 'alpha keyword content');
    await vectorSearch.add('beta-1', 'beta keyword content');

    const vectorResults = await vectorSearch.vectorSearch('alpha');
    const keywordResults = await vectorSearch.keywordSearch('beta');
    const hybridResults = await vectorSearch.hybridSearch('alpha keyword');

    expect(vectorResults.length).toBeGreaterThan(0);
    expect(keywordResults.length).toBeGreaterThan(0);
    expect(hybridResults.length).toBeGreaterThan(0);
  });

  it('reports stats and keeps helper errors intact', async () => {
    await vectorSearch.add('alpha-1', 'alpha content', undefined, 'chunk');
    const stats = await vectorSearch.getStats();
    expect(stats.totalItems).toBe(1);
    expect(() => (vectorSearch as any).cosineSimilarity([1], [1, 2])).toThrow(VectorSearchError);
    expect(new DatabaseError('db failed', new Error('cause')).cause).toBeInstanceOf(Error);
    expect(new EmbeddingError('embed failed', new Error('cause')).cause).toBeInstanceOf(Error);
  });

  it('factory function produces working instances', async () => {
    const instance = createVectorSearch(':memory:', embeddingService);
    await instance.add('gamma-1', 'gamma content');
    const results = await instance.search('gamma', { topK: 5 });
    expect(results.length).toBeGreaterThan(0);
    instance.close();
  });
});

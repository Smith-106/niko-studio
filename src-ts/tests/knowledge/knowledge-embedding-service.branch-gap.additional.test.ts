import { describe, expect, it } from 'vitest';

import { EmbeddingServiceImpl } from '../../knowledge/embedding-service';
import {
  createEmbeddingRequest,
  ProviderType,
  type EmbeddingProvider,
} from '../../knowledge/models';
import type { EmbeddingCache } from '../../protocols/embedding';

class SparseEmbeddingProvider implements EmbeddingProvider {
  readonly providerType = ProviderType.OPENAI;

  async embed(texts: string[], _model?: string): Promise<number[][]> {
    if (texts[0] === 'missing-first') {
      return [undefined as unknown as number[], [2, 2]];
    }
    if (texts[0] === 'zero-first') {
      return [0 as unknown as number[], [3, 3]];
    }
    return texts.map((_text, index) => [index + 1, index + 1]);
  }

  getModel(): string {
    return 'text-embedding-3-small';
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

class GetterEdgeCaseCache implements EmbeddingCache {
  private readonly store = new Map<string, number[]>();

  async get(text: string, model: string): Promise<number[] | null> {
    return this.store.get(`${model}::${text}`) ?? null;
  }

  async set(text: string, model: string, embedding: number[]): Promise<void> {
    this.store.set(`${model}::${text}`, embedding);
  }

  async getBatch(texts: string[], model: string): Promise<Record<string, number[] | null>> {
    const result: Record<string, number[] | null> = {};
    for (const text of texts) {
      if (text === 'ghost') {
        let reads = 0;
        Object.defineProperty(result, text, {
          configurable: true,
          enumerable: true,
          get() {
            reads += 1;
            return reads === 1 ? [5, 5] : undefined;
          },
        });
        continue;
      }
      result[text] = await this.get(text, model);
    }
    return result;
  }

  async setBatch(items: Record<string, number[]>, model: string): Promise<void> {
    for (const [text, vector] of Object.entries(items)) {
      await this.set(text, model, vector);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async stats(): Promise<Record<string, unknown>> {
    return { size: this.store.size };
  }
}

describe('knowledge/embedding-service branch gap coverage', () => {
  it('falls back to an empty embedding and zero dimensions when the provider omits the first vector', async () => {
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, new SparseEmbeddingProvider()]]),
    });

    const response = await service.embedWithMetadata(createEmbeddingRequest({
      texts: ['missing-first', 'present-second'],
      modelOverride: 'text-embedding-3-small',
    }));

    expect(response.embeddings).toEqual([[], [2, 2]]);
    expect(response.dimensions).toBe(0);
    expect(response.cacheHits).toBe(0);
  });

  it('treats malformed falsy first embeddings as zero-dimension metadata results', async () => {
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, new SparseEmbeddingProvider()]]),
    });

    const response = await service.embedWithMetadata(createEmbeddingRequest({
      texts: ['zero-first', 'present-second'],
      modelOverride: 'text-embedding-3-small',
    }));

    expect(response.embeddings).toEqual([0, [3, 3]]);
    expect(response.dimensions).toBe(0);
    expect(response.cacheHits).toBe(0);
  });

  it('uses merge fallbacks when a cache getter turns undefined on the second read', async () => {
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, new SparseEmbeddingProvider()]]),
      cache: new GetterEdgeCaseCache(),
    });

    const response = await service.embedWithMetadata(createEmbeddingRequest({
      texts: ['ghost'],
      modelOverride: 'text-embedding-3-small',
    }));

    expect(response.embeddings).toEqual([[]]);
    expect(response.dimensions).toBe(0);
    expect(response.cacheHits).toBe(1);
  });

  it('returns zero dimensions for an empty metadata request through the all-cache-hits branch', async () => {
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, new SparseEmbeddingProvider()]]),
      cache: new GetterEdgeCaseCache(),
    });

    const response = await service.embedWithMetadata(createEmbeddingRequest({
      texts: [],
      modelOverride: 'text-embedding-3-small',
    }));

    expect(response.embeddings).toEqual([]);
    expect(response.dimensions).toBe(0);
    expect(response.cacheHits).toBe(0);
  });
});

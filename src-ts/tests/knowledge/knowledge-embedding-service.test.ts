import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EmbeddingServiceImpl } from '../../knowledge/embedding-service';
import {
  createEmbeddingRequest,
  EmbeddingError,
  ProviderType,
  type EmbeddingProvider,
} from '../../knowledge/models';
import type { EmbeddingCache } from '../../protocols/embedding';

class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly providerType: string;
  readonly calls: Array<{ texts: string[]; model: string }> = [];
  private readonly _vectors = new Map<string, number[]>();

  constructor(providerType: string) {
    this.providerType = providerType;
  }

  setVector(text: string, vector: number[], model?: string): void {
    if (model) {
      this._vectors.set(`${model}::${text}`, vector);
    }
    this._vectors.set(text, vector);
  }

  getModel(): string {
    return `${this.providerType}-model`;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    this.calls.push({ texts: [...texts], model: model ?? '' });
    return texts.map((text, index) => {
      return this._vectors.get(`${model}::${text}`)
        ?? this._vectors.get(text)
        ?? [index + 1, text.length];
    });
  }
}

class FakeEmbeddingCache implements EmbeddingCache {
  private readonly _store = new Map<string, number[]>();

  private _key(text: string, model: string): string {
    return `${model}::${text}`;
  }

  seed(text: string, model: string, vector: number[]): void {
    this._store.set(this._key(text, model), vector);
  }

  async get(text: string, model: string): Promise<number[] | null> {
    return this._store.get(this._key(text, model)) ?? null;
  }

  async set(text: string, model: string, embedding: number[]): Promise<void> {
    this._store.set(this._key(text, model), embedding);
  }

  async getBatch(texts: string[], model: string): Promise<Record<string, number[] | null>> {
    const result: Record<string, number[] | null> = {};
    for (const text of texts) {
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
    this._store.clear();
  }

  async stats(): Promise<Record<string, unknown>> {
    return { size: this._store.size };
  }
}

describe('knowledge/embedding-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses provider-specific default models and falls back to the first available provider', async () => {
    const openai = new FakeEmbeddingProvider(ProviderType.OPENAI);
    const local = new FakeEmbeddingProvider(ProviderType.LOCAL);
    const anthropic = new FakeEmbeddingProvider(ProviderType.ANTHROPIC);
    const openaiService = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, openai]]),
    });
    const localService = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.LOCAL, local]]),
    });
    const anthropicService = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.ANTHROPIC, anthropic]]),
    });
    const fallbackService = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.ANTHROPIC, openai]]),
      defaultProvider: ProviderType.OPENAI,
    });

    await openaiService.embed('alpha');
    await localService.embed('beta');
    await anthropicService.embed('delta');
    await fallbackService.embed('gamma');

    expect(openai.calls[0].model).toBe('text-embedding-3-small');
    expect(local.calls[0].model).toBe('BAAI/bge-small-en-v1.5');
    expect(anthropic.calls[0].model).toBe('text-embedding-3-small');
    expect(openai.calls[1].model).toBe('text-embedding-3-small');
  });

  it('throws when no providers are available', async () => {
    const service = new EmbeddingServiceImpl({
      providers: new Map(),
    });

    await expect(service.embed('none')).rejects.toThrow(EmbeddingError);
  });

  it('preserves duplicate order when batching with partial cache hits', async () => {
    const provider = new FakeEmbeddingProvider(ProviderType.OPENAI);
    provider.setVector('dup', [9, 9], 'text-embedding-3-small');
    provider.setVector('cached', [4, 2], 'text-embedding-3-small');
    const cache = new FakeEmbeddingCache();
    cache.seed('cached', 'text-embedding-3-small', [4, 2]);
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      cache,
    });

    const result = await service.embedBatch(['dup', 'cached', 'dup']);

    expect(result).toEqual([
      [9, 9],
      [4, 2],
      [9, 9],
    ]);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].texts).toEqual(['dup', 'dup']);
  });

  it('returns metadata results both without cache and with full cache hits', async () => {
    const provider = new FakeEmbeddingProvider(ProviderType.OPENAI);
    provider.setVector('first', [1, 0], 'custom-model');
    provider.setVector('second', [0, 1], 'custom-model');
    provider.setVector('cached-1', [7, 7], 'text-embedding-3-small');
    provider.setVector('cached-2', [8, 8], 'text-embedding-3-small');
    const cache = new FakeEmbeddingCache();
    cache.seed('cached-1', 'text-embedding-3-small', [7, 7]);
    cache.seed('cached-2', 'text-embedding-3-small', [8, 8]);
    const serviceWithoutCache = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
    });
    const serviceWithCache = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      cache,
    });

    const uncached = await serviceWithoutCache.embedWithMetadata(createEmbeddingRequest({
      texts: ['first', 'second'],
      modelOverride: 'custom-model',
    }));
    const cached = await serviceWithCache.embedWithMetadata(createEmbeddingRequest({
      texts: ['cached-1', 'cached-2'],
    }));

    expect(uncached.embeddings).toEqual([[1, 0], [0, 1]]);
    expect(uncached.dimensions).toBe(2);
    expect(uncached.cacheHits).toBe(0);
    expect(cached.embeddings).toEqual([[7, 7], [8, 8]]);
    expect(cached.dimensions).toBe(2);
    expect(cached.cacheHits).toBe(2);
  });

  it('supports empty batches, similarity edge cases, and dimension probing', async () => {
    const provider = new FakeEmbeddingProvider(ProviderType.LOCAL);
    provider.setVector('test', [1, 2, 3], 'probe-model');
    const service = new EmbeddingServiceImpl({
      providers: new Map([[ProviderType.LOCAL, provider]]),
      defaultModel: 'probe-model',
    });

    await expect(service.embedBatch([])).resolves.toEqual([]);
    expect(service.similarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(service.similarity([0, 0], [1, 0])).toBe(0);
    expect(() => service.similarity([1, 0], [1])).toThrow('Embeddings must have the same dimensions');
    await expect(service.getDimensions()).resolves.toBe(3);
  });
});

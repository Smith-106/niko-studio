import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProviderType } from '../../knowledge/models';

async function importProviderWithMocks(options?: {
  fastembed?: Record<string, unknown> | 'throw';
  transformers?: Record<string, unknown> | 'throw';
}) {
  vi.resetModules();
  vi.doUnmock('fastembed');
  vi.doUnmock('@xenova/transformers');

  if (options?.fastembed === 'throw' || options?.fastembed === undefined) {
    vi.doMock('fastembed', () => {
      throw new Error('mocked fastembed import failure');
    });
  } else {
    vi.doMock('fastembed', () => ({
      __esModule: true,
      ...(options.fastembed as Record<string, unknown>),
    }));
  }

  if (options?.transformers === 'throw' || options?.transformers === undefined) {
    vi.doMock('@xenova/transformers', () => {
      throw new Error('mocked transformers import failure');
    });
  } else {
    vi.doMock('@xenova/transformers', () => ({
      __esModule: true,
      ...(options.transformers as Record<string, unknown>),
    }));
  }

  const mod = await import('../../knowledge/providers/local-embedding.js');
  return mod.LocalEmbeddingProvider;
}

function createFastembedModule(model: unknown) {
  return {
    FlagEmbedding: {
      init: vi.fn().mockResolvedValue(model),
    },
    EmbeddingModel: {
      BGESmallZH: 'BGESmallZH',
      BGESmallENV15: 'BGESmallENV15',
      BGEBaseENV15: 'BGEBaseENV15',
      BGEBaseEN: 'BGEBaseEN',
      BGESmallEN: 'BGESmallEN',
      AllMiniLML6V2: 'AllMiniLML6V2',
    },
  };
}

describe('knowledge/providers/local-embedding additional branches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('fastembed');
    vi.doUnmock('@xenova/transformers');
  });

  it('defaults to fastembed and falls back to BGESmallZH for unmapped models', async () => {
    const fastembed = createFastembedModule({
      embed: vi.fn().mockResolvedValue([Float32Array.from([1, 2, 3])]),
    });
    const LocalEmbeddingProvider = await importProviderWithMocks({ fastembed });

    const provider = new LocalEmbeddingProvider({
      modelName: 'custom-unmapped-model',
    });
    const response = await provider.embed(['alpha'], '');

    expect(response.provider).toBe(ProviderType.LOCAL);
    expect(response.modelUsed).toBe('custom-unmapped-model');
    expect(response.dimensions).toBe(3);
    expect((fastembed.FlagEmbedding as { init: ReturnType<typeof vi.fn> }).init).toHaveBeenCalledWith({
      model: 'BGESmallZH',
    });
  });

  it('maps missing fastembed exports to the install guidance error', async () => {
    const LocalEmbeddingProvider = await importProviderWithMocks({
      fastembed: {
        EmbeddingModel: createFastembedModule({}).EmbeddingModel,
      },
    });

    await expect(
      new LocalEmbeddingProvider({ backend: 'fastembed' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/fastembed package not installed/);
  });

  it('maps missing sentence-transformers exports to the install guidance error', async () => {
    const LocalEmbeddingProvider = await importProviderWithMocks({
      transformers: {},
    });

    await expect(
      new LocalEmbeddingProvider({ backend: 'sentence-transformers' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/@xenova\/transformers package not installed/);
  });

  it('handles iterable sentence-transformer results and empty embeddings', async () => {
    const iterableEncoder = vi.fn().mockResolvedValue(new Set([[11, 12]]));
    const emptyEncoder = vi.fn().mockResolvedValue([]);
    const pipeline = vi
      .fn()
      .mockResolvedValueOnce(iterableEncoder)
      .mockResolvedValueOnce(emptyEncoder);
    const LocalEmbeddingProvider = await importProviderWithMocks({
      transformers: { pipeline },
    });

    const iterableProvider = new LocalEmbeddingProvider({
      backend: 'sentence-transformers',
    });
    const iterableResponse = await iterableProvider.embed(['alpha'], 'iterable-model');
    expect(iterableResponse.embeddings).toEqual([[11, 12]]);
    expect(iterableResponse.dimensions).toBe(2);

    const emptyProvider = new LocalEmbeddingProvider({
      backend: 'sentence-transformers',
    });
    const emptyResponse = await emptyProvider.embed(['beta'], 'empty-model');
    expect(emptyResponse.embeddings).toEqual([]);
    expect(emptyResponse.dimensions).toBe(0);
  });
});

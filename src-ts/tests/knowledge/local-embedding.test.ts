import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProviderType } from '../../knowledge/models';

function createAsyncEmbeddingResult(chunks: number[][]): AsyncIterable<Float32Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield Float32Array.from(chunk);
      }
    },
  };
}

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

describe('knowledge/providers/local-embedding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('fastembed');
    vi.doUnmock('@xenova/transformers');
  });

  it('reports provider type and resolves exact, fuzzy, and default dimensions', async () => {
    const LocalEmbeddingProvider = await importProviderWithMocks();
    const provider = new LocalEmbeddingProvider({
      modelName: 'BAAI/bge-small-en-v1.5',
      backend: 'fastembed',
    });

    expect(provider.providerType).toBe(ProviderType.LOCAL);
    expect(provider.getDimensions('BAAI/bge-small-en-v1.5')).toBe(384);
    expect(provider.getDimensions('prefix/BAAI/bge-small-en-v1.5/suffix')).toBe(384);
    expect(provider.getDimensions('mystery-model')).toBe(768);
  });

  it('loads fastembed models and handles async iterator results', async () => {
    const fastembed = createFastembedModule({
      embed: vi.fn().mockResolvedValue(createAsyncEmbeddingResult([
        [1, 2],
        [3, 4],
      ])),
    });
    const LocalEmbeddingProvider = await importProviderWithMocks({
      fastembed,
    });

    const provider = new LocalEmbeddingProvider({
      modelName: 'BAAI/bge-small-en-v1.5',
      backend: 'fastembed',
    });
    const response = await provider.embed(['alpha', 'beta'], 'custom-fast-model');

    expect(response.embeddings).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(response.modelUsed).toBe('custom-fast-model');
    expect(response.provider).toBe(ProviderType.LOCAL);
    expect(response.dimensions).toBe(2);
    expect(response.usage.totalTokens).toBe(0);
    expect((fastembed.FlagEmbedding as { init: ReturnType<typeof vi.fn> }).init).toHaveBeenCalledWith({
      model: 'BGESmallENV15',
    });
  });

  it('maps array-based fastembed results and missing embed methods', async () => {
    const arrayModule = createFastembedModule({
      embed: vi.fn().mockResolvedValue([
        Float32Array.from([5, 6]),
        Float32Array.from([7, 8]),
      ]),
    });
    const LocalEmbeddingProvider = await importProviderWithMocks({
      fastembed: arrayModule,
    });

    const provider = new LocalEmbeddingProvider({ backend: 'fastembed' });
    const response = await provider.embed(['alpha', 'beta'], '');

    expect(response.embeddings).toEqual([
      [5, 6],
      [7, 8],
    ]);
    expect(response.modelUsed).toBe('BAAI/bge-small-zh-v1.5');

    const missingEmbedModule = createFastembedModule({});
    const MissingEmbedProvider = await importProviderWithMocks({
      fastembed: missingEmbedModule,
    });
    const missingEmbedProvider = new MissingEmbedProvider({ backend: 'fastembed' });

    await expect(missingEmbedProvider.embed(['alpha'], 'model')).rejects.toMatchObject({
      name: 'EmbeddingError',
      provider: ProviderType.LOCAL,
    });
    await expect(missingEmbedProvider.embed(['alpha'], 'model')).rejects.toThrow(
      /Model does not have embed method/,
    );
  });

  it('maps fastembed export and import failures to install guidance errors', async () => {
    const missingExportModule = {
      EmbeddingModel: createFastembedModule({}).EmbeddingModel,
    };
    const MissingExportProvider = await importProviderWithMocks({
      fastembed: missingExportModule,
    });

    await expect(
      new MissingExportProvider({ backend: 'fastembed' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/fastembed package not installed/);

    const ImportFailureProvider = await importProviderWithMocks({
      fastembed: 'throw',
    });
    await expect(
      new ImportFailureProvider({ backend: 'fastembed' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/fastembed package not installed/);
  });

  it('loads sentence-transformers models and handles tolist results', async () => {
    const pipeline = vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
      tolist: () => [[0.1, 0.2]],
    }));
    const LocalEmbeddingProvider = await importProviderWithMocks({
      transformers: { pipeline },
    });

    const provider = new LocalEmbeddingProvider({
      modelName: 'sentence-transformers/all-MiniLM-L6-v2',
      backend: 'sentence-transformers',
    });
    const response = await provider.embed(['alpha'], '');

    expect(response.embeddings).toEqual([[0.1, 0.2]]);
    expect(response.modelUsed).toBe('sentence-transformers/all-MiniLM-L6-v2');
    expect(response.dimensions).toBe(2);
    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'sentence-transformers/all-MiniLM-L6-v2',
    );
  });

  it('handles sentence-transformers array and data results', async () => {
    const arrayEncoder = vi.fn().mockResolvedValue([
      [1, 2],
      [3, 4],
    ]);
    const dataEncoder = vi.fn().mockResolvedValue({
      data: [[9, 10]],
    });
    const pipeline = vi
      .fn()
      .mockResolvedValueOnce(arrayEncoder)
      .mockResolvedValueOnce(dataEncoder);

    const LocalEmbeddingProvider = await importProviderWithMocks({
      transformers: { pipeline },
    });

    const arrayProvider = new LocalEmbeddingProvider({ backend: 'sentence-transformers' });
    const arrayResponse = await arrayProvider.embed(['alpha', 'beta'], 'array-model');
    expect(arrayResponse.embeddings).toEqual([
      [1, 2],
      [3, 4],
    ]);

    const dataProvider = new LocalEmbeddingProvider({ backend: 'sentence-transformers' });
    const dataResponse = await dataProvider.embed(['gamma'], 'data-model');
    expect(dataResponse.embeddings).toEqual([[9, 10]]);
  });

  it('maps sentence-transformers export and import failures to install guidance errors', async () => {
    const MissingPipelineProvider = await importProviderWithMocks({
      transformers: {},
    });
    await expect(
      new MissingPipelineProvider({ backend: 'sentence-transformers' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/@xenova\/transformers package not installed/);

    const ImportFailureProvider = await importProviderWithMocks({
      transformers: 'throw',
    });
    await expect(
      new ImportFailureProvider({ backend: 'sentence-transformers' }).embed(['alpha'], 'model'),
    ).rejects.toThrow(/@xenova\/transformers package not installed/);
  });

  it('rejects unknown backends and reports healthCheck status', async () => {
    const LocalEmbeddingProvider = await importProviderWithMocks();
    const unknownProvider = new LocalEmbeddingProvider({ backend: 'mystery-backend' });

    await expect(unknownProvider.embed(['alpha'], 'model')).rejects.toMatchObject({
      name: 'EmbeddingError',
      provider: ProviderType.LOCAL,
    });
    await expect(unknownProvider.embed(['alpha'], 'model')).rejects.toThrow(/Unknown backend/);
    await expect(unknownProvider.healthCheck()).resolves.toBe(false);

    const healthyModule = createFastembedModule({
      embed: vi.fn().mockResolvedValue([Float32Array.from([1, 2, 3])]),
    });
    const HealthyProvider = await importProviderWithMocks({
      fastembed: healthyModule,
    });
    await expect(new HealthyProvider({ backend: 'fastembed' }).healthCheck()).resolves.toBe(true);
  });

  it('maps backend runtime exceptions to EmbeddingError', async () => {
    const fastembed = createFastembedModule({
      embed: vi.fn().mockRejectedValue(new Error('embed exploded')),
    });
    const LocalEmbeddingProvider = await importProviderWithMocks({
      fastembed,
    });

    await expect(
      new LocalEmbeddingProvider({ backend: 'fastembed' }).embed(['alpha'], 'model'),
    ).rejects.toMatchObject({
      name: 'EmbeddingError',
      provider: ProviderType.LOCAL,
      message: expect.stringContaining('embed exploded'),
    });
  });
});

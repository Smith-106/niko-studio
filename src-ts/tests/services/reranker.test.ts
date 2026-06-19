import { afterEach, describe, expect, it, vi } from 'vitest';

import { RerankerFactory } from '../../services/reranker/factory.js';
import { RerankerStrategy } from '../../services/reranker/base.js';
import {
  DEFAULT_RERANKER_CONFIG,
  RerankerError,
  RerankerType,
  type RankedDocument,
  type RerankerConfig,
} from '../../services/reranker/models.js';
import { JinaReranker } from '../../services/reranker/strategies/jina-reranker.js';
import { VoyageReranker } from '../../services/reranker/strategies/voyage-reranker.js';
import { TEIReranker } from '../../services/reranker/strategies/tei-reranker.js';
import { BailianReranker } from '../../services/reranker/strategies/bailian-reranker.js';

function makeConfig(
  rerankerType: RerankerType,
  overrides: Partial<RerankerConfig> = {},
): RerankerConfig {
  return {
    rerankerType,
    timeout: 1,
    maxRetries: 3,
    batchSize: 10,
    ...overrides,
  };
}

class TestReranker extends RerankerStrategy {
  private readonly _results: RankedDocument[];
  private readonly _shouldThrow: boolean;

  constructor(results: RankedDocument[], shouldThrow = false) {
    super(makeConfig(RerankerType.JINA, { apiKey: 'test-key' }));
    this._results = results;
    this._shouldThrow = shouldThrow;
  }

  get rerankerType(): RerankerType {
    return RerankerType.JINA;
  }

  async rerank(
    _query: string,
    _documents: string[],
  ): Promise<RankedDocument[]> {
    if (this._shouldThrow) {
      throw new Error('health failed');
    }
    return this._results;
  }

  exposeBuildRankedDocuments(
    documents: string[],
    scores: number[],
    indices: number[],
    topK: number,
    documentIds?: string[],
    metadataList?: Record<string, unknown>[],
  ): RankedDocument[] {
    return this.buildRankedDocuments(documents, scores, indices, topK, documentIds, metadataList);
  }
}

describe('services/reranker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.RERANKER_TYPE;
    delete process.env.RERANKER_MODEL;
    delete process.env.RERANKER_TIMEOUT;
    delete process.env.RERANKER_MAX_RETRIES;
    delete process.env.JINA_API_KEY;
    delete process.env.JINA_BASE_URL;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_BASE_URL;
    delete process.env.TEI_API_KEY;
    delete process.env.TEI_BASE_URL;
    delete process.env.TEI_RERANKER_URL;
    delete process.env.NIKO_TEI_RERANKER_URL;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_BASE_URL;
  });

  it('supports health checks and ranked document construction in the abstract base class', async () => {
    const healthy = new TestReranker([
      { id: 'doc-1', content: 'alpha', score: 0.9, metadata: {}, originalIndex: 0 },
    ]);
    const unhealthy = new TestReranker([], true);

    await expect(healthy.healthCheck()).resolves.toBe(true);
    await expect(unhealthy.healthCheck()).resolves.toBe(false);
    await expect(healthy.close()).resolves.toBeUndefined();

    expect(
      healthy.exposeBuildRankedDocuments(
        ['alpha', 'beta'],
        [0.8, 0.3],
        [1, 0],
        1,
        ['doc-a', 'doc-b'],
        [{ lane: 'a' }, { lane: 'b' }],
      ),
    ).toEqual([
      {
        id: 'doc-b',
        content: 'beta',
        score: 0.8,
        metadata: { lane: 'b' },
        originalIndex: 1,
      },
    ]);
  });

  it('builds Jina rerank requests, clamps scores, and validates API keys', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [
          { index: 1, relevance_score: 1.8 },
          { index: 0, relevance_score: -0.5 },
        ],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reranker = new JinaReranker(makeConfig(RerankerType.JINA, {
      apiKey: 'jina-key',
    }));

    await expect(reranker.rerank('hero', ['alpha', 'beta'], 2, {
      documentIds: ['doc-a', 'doc-b'],
      metadataList: [{ lane: 'a' }, { lane: 'b' }],
    })).resolves.toEqual([
      {
        id: 'doc-b',
        content: 'beta',
        score: 1,
        metadata: { lane: 'b' },
        originalIndex: 1,
      },
      {
        id: 'doc-a',
        content: 'alpha',
        score: 0,
        metadata: { lane: 'a' },
        originalIndex: 0,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.jina.ai/v1/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jina-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    await expect(reranker.rerank('hero', [], 2)).resolves.toEqual([]);
    await expect(new JinaReranker(makeConfig(RerankerType.JINA)).rerank('hero', ['alpha'])).rejects.toThrow(
      '[jina] Jina API key is required',
    );
  });

  it('wraps Jina transport failures in a typed reranker error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));

    const reranker = new JinaReranker(makeConfig(RerankerType.JINA, {
      apiKey: 'jina-key',
    }));

    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[jina] Jina API request error: offline',
    );
  });

  it('builds Voyage requests and surfaces HTTP failures', async () => {
    const successFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { index: 0, relevance_score: 0.95 },
        { index: 1, relevance_score: 0.15 },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', successFetch);

    const reranker = new VoyageReranker(makeConfig(RerankerType.VOYAGE, {
      apiKey: 'voyage-key',
      baseUrl: 'https://voyage.example/v1',
      model: 'voyage-model',
    }));

    const results = await reranker.rerank('hero', ['alpha', 'beta']);

    expect(successFetch).toHaveBeenCalledWith(
      'https://voyage.example/v1/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer voyage-key',
        }),
      }),
    );
    expect(results[0]).toMatchObject({
      id: 'doc_0',
      content: 'alpha',
      score: 0.95,
      originalIndex: 0,
    });

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('bad gateway', { status: 502 })));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[voyage] (HTTP 502) Voyage API request failed: bad gateway',
    );
    await expect(new VoyageReranker(makeConfig(RerankerType.VOYAGE)).rerank('hero', ['alpha'])).rejects.toThrow(
      '[voyage] Voyage API key is required',
    );
  });

  it('uses TEI defaults, normalizes raw scores, and surfaces HTTP failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify([
      { index: 0, score: 0 },
      { index: 1, score: 2 },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reranker = new TEIReranker(makeConfig(RerankerType.TEI, {
      apiKey: 'tei-key',
    }));

    const results = await reranker.rerank('hero', ['alpha', 'beta'], 2, {
      documentIds: ['doc-a', 'doc-b'],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tei-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(results[0].score).toBeCloseTo(0.5, 5);
    expect(results[1].score).toBeCloseTo(0.88079, 4);
    expect(results[1].id).toBe('doc-b');

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('busy', { status: 503 })));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[tei] (HTTP 503) TEI API request failed: busy',
    );
    await expect(reranker.rerank('hero', [])).resolves.toEqual([]);
  });

  it('uses TEI env base URL, defaults missing scores, and wraps transport failures', async () => {
    vi.resetModules();
    process.env.TEI_RERANKER_URL = 'https://tei.env';

    const successFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify([
      { index: 0 },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', successFetch);

    const { TEIReranker: IsolatedTEIReranker } = await import(
      '../../services/reranker/strategies/tei-reranker.js'
    );
    const reranker = new IsolatedTEIReranker(makeConfig(RerankerType.TEI, {
      apiKey: 'tei-key',
    }));

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([
      {
        id: 'doc_0',
        content: 'alpha',
        score: 0.5,
        metadata: {},
        originalIndex: 0,
      },
    ]);

    expect(successFetch).toHaveBeenCalledWith(
      'https://tei.env/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tei-key',
        }),
      }),
    );

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('tei offline')));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[tei] TEI API request error: tei offline',
    );
  });

  it('prefers an explicit TEI baseUrl over environment fallbacks', async () => {
    vi.resetModules();
    process.env.TEI_RERANKER_URL = 'https://tei.env';

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify([
      { index: 0, score: 1 },
    ]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { TEIReranker: IsolatedTEIReranker } = await import(
      '../../services/reranker/strategies/tei-reranker.js'
    );
    const reranker = new IsolatedTEIReranker(makeConfig(RerankerType.TEI, {
      apiKey: 'tei-key',
      baseUrl: 'https://tei.explicit',
    }));

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([
      {
        id: 'doc_0',
        content: 'alpha',
        score: 0.7310585786300049,
        metadata: {},
        originalIndex: 0,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://tei.explicit/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tei-key',
        }),
      }),
    );
  });

  it('handles Bailian success, business errors, and missing credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      code: '200',
      output: {
        results: [
          { index: 0, relevance_score: 0.6 },
        ],
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reranker = new BailianReranker(makeConfig(RerankerType.BAILIAN, {
      apiKey: 'dashscope-key',
      baseUrl: 'https://dashscope.example/api/v1',
      model: 'gte-rerank-custom',
    }));

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([
      {
        id: 'doc_0',
        content: 'alpha',
        score: 0.6,
        metadata: {},
        originalIndex: 0,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://dashscope.example/api/v1/services/rerank/text-rerank/rerank',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer dashscope-key',
        }),
      }),
    );

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: '400',
      message: 'invalid payload',
    }), { status: 200 })));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[bailian] Bailian API error: invalid payload',
    );
    await expect(new BailianReranker(makeConfig(RerankerType.BAILIAN)).rerank('hero', ['alpha'])).rejects.toThrow(
      '[bailian] Bailian API key (DashScope) is required',
    );
  });

  it('covers Bailian empty inputs, score clamping, HTTP errors, and transport failures', async () => {
    const reranker = new BailianReranker(makeConfig(RerankerType.BAILIAN, {
      apiKey: 'dashscope-key',
    }));

    await expect(reranker.rerank('hero', [])).resolves.toEqual([]);

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      output: {
        results: [
          { index: 0, relevance_score: 1.5 },
          { index: 1, relevance_score: -0.5 },
          { index: 2 },
        ],
      },
    }), { status: 200 })));

    await expect(reranker.rerank('hero', ['alpha', 'beta', 'gamma'], 3, {
      documentIds: ['a', 'b', 'c'],
      metadataList: [{ tag: 'A' }, { tag: 'B' }, { tag: 'C' }],
    })).resolves.toEqual([
      { id: 'a', content: 'alpha', score: 1, metadata: { tag: 'A' }, originalIndex: 0 },
      { id: 'b', content: 'beta', score: 0, metadata: { tag: 'B' }, originalIndex: 1 },
      { id: 'c', content: 'gamma', score: 0, metadata: { tag: 'C' }, originalIndex: 2 },
    ]);

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('too many requests', { status: 429 })));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[bailian] (HTTP 429) Bailian API request failed: too many requests',
    );

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('socket down')));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[bailian] Bailian API request error: socket down',
    );

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      code: '500',
    }), { status: 200 })));
    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[bailian] Bailian API error: Unknown error',
    );
  });

  it('falls back to an empty result list when Bailian returns a success payload without output results', async () => {
    const reranker = new BailianReranker(makeConfig(RerankerType.BAILIAN, {
      apiKey: 'dashscope-key',
    }));

    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      code: '200',
      output: {},
    }), { status: 200 })));

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([]);
  });

  it('creates rerankers from dictionaries, environment variables, and explicit overrides', () => {
    const fromDict = RerankerFactory.fromDict({
      type: 'voyage',
      api_key: 'dict-key',
      base_url: 'https://voyage.from-dict',
      model: 'voyage-dict',
      timeout: 12,
      max_retries: 5,
      batch_size: 25,
    });

    expect(fromDict).toBeInstanceOf(VoyageReranker);
    expect(fromDict.config).toMatchObject({
      rerankerType: RerankerType.VOYAGE,
      apiKey: 'dict-key',
      baseUrl: 'https://voyage.from-dict',
      model: 'voyage-dict',
      timeout: 12,
      maxRetries: 5,
      batchSize: 25,
    });

    process.env.VOYAGE_API_KEY = 'env-voyage-key';
    process.env.VOYAGE_BASE_URL = 'https://voyage.from-env';
    process.env.RERANKER_MODEL = 'env-model';
    process.env.RERANKER_TIMEOUT = '11.5';
    process.env.RERANKER_MAX_RETRIES = '7';

    const detected = RerankerFactory.fromEnv();
    expect(detected).toBeInstanceOf(VoyageReranker);
    expect(detected.config).toMatchObject({
      rerankerType: RerankerType.VOYAGE,
      apiKey: 'env-voyage-key',
      baseUrl: 'https://voyage.from-env',
      model: 'env-model',
      timeout: 11.5,
      maxRetries: 7,
      batchSize: DEFAULT_RERANKER_CONFIG.batchSize,
    });

    process.env.DASHSCOPE_API_KEY = 'dashscope-env-key';
    process.env.DASHSCOPE_BASE_URL = 'https://dashscope.from-env';

    const explicit = RerankerFactory.fromEnv('bailian');
    expect(explicit).toBeInstanceOf(BailianReranker);
    expect(explicit.config).toMatchObject({
      rerankerType: RerankerType.BAILIAN,
      apiKey: 'dashscope-env-key',
      baseUrl: 'https://dashscope.from-env',
    });
    expect(RerankerFactory.availableTypes()).toEqual(Object.values(RerankerType));
  });

  it('rejects invalid reranker types and unsupported explicit configurations', () => {
    expect(() => RerankerFactory.fromDict({ type: 'unknown' })).toThrow(RerankerError);
    expect(() => RerankerFactory.fromEnv('unknown')).toThrow('Unknown reranker type: unknown');
    expect(() => RerankerFactory.create({
      ...makeConfig('unsupported' as RerankerType),
      rerankerType: 'unsupported' as RerankerType,
    })).toThrow('Unsupported reranker type: unsupported');
  });
});

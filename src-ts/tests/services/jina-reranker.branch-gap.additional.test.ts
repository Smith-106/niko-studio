import { afterEach, describe, expect, it, vi } from 'vitest';

import { RerankerType, type RerankerConfig } from '../../services/reranker/models.js';
import { JinaReranker } from '../../services/reranker/strategies/jina-reranker.js';

function makeConfig(overrides: Partial<RerankerConfig> = {}): RerankerConfig {
  return {
    rerankerType: RerankerType.JINA,
    timeout: 1,
    maxRetries: 3,
    batchSize: 10,
    apiKey: 'jina-key',
    ...overrides,
  };
}

describe('services/reranker/jina-reranker branch-gap coverage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an empty list when the Jina payload omits results', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    ));

    const reranker = new JinaReranker(makeConfig());

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([]);
  });

  it('defaults omitted scores to zero and passes through explicit ids and metadata', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [
          { index: 1 },
          { index: 0, relevance_score: 0.33 },
        ],
      }), { status: 200 }),
    ));

    const reranker = new JinaReranker(makeConfig());

    await expect(reranker.rerank('hero', ['alpha', 'beta'], 2, {
      documentIds: ['doc-a', 'doc-b'],
      metadataList: [{ lane: 'A' }, { lane: 'B' }],
    })).resolves.toEqual([
      {
        id: 'doc-b',
        content: 'beta',
        score: 0,
        metadata: { lane: 'B' },
        originalIndex: 1,
      },
      {
        id: 'doc-a',
        content: 'alpha',
        score: 0.33,
        metadata: { lane: 'A' },
        originalIndex: 0,
      },
    ]);
  });

  it('surfaces HTTP failures through the typed reranker error path', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('forbidden', { status: 403 }),
    ));

    const reranker = new JinaReranker(makeConfig());

    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[jina] (HTTP 403) Jina API request failed: forbidden',
    );
  });
});

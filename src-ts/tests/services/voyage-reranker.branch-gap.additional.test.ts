import { afterEach, describe, expect, it, vi } from 'vitest';

import { RerankerType, type RerankerConfig } from '../../services/reranker/models.js';
import { VoyageReranker } from '../../services/reranker/strategies/voyage-reranker.js';

function makeConfig(overrides: Partial<RerankerConfig> = {}): RerankerConfig {
  return {
    rerankerType: RerankerType.VOYAGE,
    timeout: 1,
    maxRetries: 3,
    batchSize: 10,
    apiKey: 'voyage-key',
    ...overrides,
  };
}

describe('services/reranker/voyage-reranker branch-gap coverage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns early for empty document lists before requiring credentials', async () => {
    const reranker = new VoyageReranker(makeConfig({ apiKey: undefined }));

    await expect(reranker.rerank('hero', [])).resolves.toEqual([]);
  });

  it('handles missing voyage data, omitted scores, and undefined optional lists', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { index: 1 },
          { index: 0, relevance_score: 0.42 },
        ],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reranker = new VoyageReranker(makeConfig());

    await expect(reranker.rerank('hero', ['alpha'])).resolves.toEqual([]);
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
        score: 0.42,
        metadata: { lane: 'A' },
        originalIndex: 0,
      },
    ]);
  });

  it('wraps transport failures that are not already reranker errors', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('socket down')));

    const reranker = new VoyageReranker(makeConfig());

    await expect(reranker.rerank('hero', ['alpha'])).rejects.toThrow(
      '[voyage] Voyage API request error: socket down',
    );
  });
});

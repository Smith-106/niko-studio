import { describe, expect, it, vi } from 'vitest';

import { RetrievalPipeline } from '../../search/retrieval-pipeline.js';

type MockEmbedding = {
  embedBatch: ReturnType<typeof vi.fn>;
  embed: ReturnType<typeof vi.fn>;
  isReady: boolean;
};

type MockSearch = {
  upsert: ReturnType<typeof vi.fn>;
  hybridSearch: ReturnType<typeof vi.fn>;
  ftsSearch: ReturnType<typeof vi.fn>;
};

function createPipeline(options?: {
  embedding?: Partial<MockEmbedding>;
  search?: Partial<MockSearch>;
}) {
  const embedding: MockEmbedding = {
    embedBatch: vi.fn(async (chunks: string[]) => chunks.map(() => ({ embedding: [0.1, 0.2] }))),
    embed: vi.fn(async () => ({ embedding: [0.25, 0.75] })),
    isReady: true,
    ...options?.embedding,
  };
  const search: MockSearch = {
    upsert: vi.fn(),
    hybridSearch: vi.fn(),
    ftsSearch: vi.fn(),
    ...options?.search,
  };

  return new RetrievalPipeline(embedding as never, search as never);
}

describe('search/retrieval-pipeline branch-gap coverage', () => {
  it('falls back to empty content and source fields for hybrid results', async () => {
    const pipeline = createPipeline({
      search: {
        hybridSearch: vi.fn(() => [
          {
            id: 'hybrid-missing-meta',
            score: 0.42,
            metadata: {},
          },
        ]),
      },
    });

    await expect(pipeline.searchNotes('atlas')).resolves.toEqual([
      {
        id: 'hybrid-missing-meta',
        content: '',
        score: 0.42,
        source: '',
        metadata: {},
      },
    ]);
  });

  it('falls back to empty content and source fields for fts results', async () => {
    const pipeline = createPipeline({
      embedding: { isReady: false },
      search: {
        ftsSearch: vi.fn(() => [
          {
            id: 'fts-missing-meta',
            score: 0.24,
            metadata: {},
          },
        ]),
      },
    });

    await expect(pipeline.searchNotes('atlas')).resolves.toEqual([
      {
        id: 'fts-missing-meta',
        content: '',
        score: 0.24,
        source: '',
        metadata: {},
      },
    ]);
  });

  it('returns zero similarity when token splitting yields an empty union', () => {
    const pipeline = createPipeline();
    const originalSplit = String.prototype.split;
    const splitSpy = vi
      .spyOn(String.prototype, 'split')
      .mockImplementation(function (
        this: string,
        separator: string | RegExp,
        limit?: number,
      ): string[] {
        if (this.toString() === '__empty__') {
          return [];
        }
        return originalSplit.call(this, separator as never, limit);
      });

    expect(
      (
        pipeline as unknown as {
          computeSimilarity: (a: string, b: string) => number;
        }
      ).computeSimilarity('__empty__', '__empty__'),
    ).toBe(0);

    splitSpy.mockRestore();
  });
});

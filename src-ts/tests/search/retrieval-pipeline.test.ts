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
    embedBatch: vi.fn(async (chunks: string[]) => chunks.map((_, index) => ({ embedding: [index, index + 1] }))),
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

  return {
    pipeline: new RetrievalPipeline(embedding as never, search as never),
    embedding,
    search,
  };
}

describe('search/retrieval-pipeline', () => {
  it('chunks indexed notes, stores every chunk, and emits completion events', async () => {
    const { pipeline, embedding, search } = createPipeline();
    const events: Array<{ path: string; chunks: number }> = [];

    (pipeline as unknown as { chunkSize: number }).chunkSize = 12;
    (pipeline as unknown as { chunkOverlap: number }).chunkOverlap = 2;
    pipeline.on('index:note-complete', (payload) => events.push(payload as { path: string; chunks: number }));

    await pipeline.indexNote(
      'notes/chapter-01.md',
      '# Intro\n1234567890\nabcdef\n# Outro\nuvwxyz',
    );

    const chunks = embedding.embedBatch.mock.calls[0][0] as string[];
    expect(chunks.length).toBeGreaterThan(1);
    expect(search.upsert).toHaveBeenCalledTimes(chunks.length);
    expect(search.upsert.mock.calls[0][0]).toMatch(/^[a-f0-9]{16}$/);
    expect(search.upsert.mock.calls[0][2]).toMatchObject({
      source: 'notes/chapter-01.md',
      chunkIndex: 0,
      totalChunks: chunks.length,
    });
    expect(events).toEqual([{ path: 'notes/chapter-01.md', chunks: chunks.length }]);
  });

  it('maps hybrid search results when embeddings are ready', async () => {
    const { pipeline, embedding, search } = createPipeline({
      search: {
        hybridSearch: vi.fn(() => [
          {
            id: 'hit-1',
            score: 0.88,
            metadata: { content: 'Atlas memory', source: 'memory', tag: 'hero' },
          },
        ]),
      },
    });

    const results = await pipeline.searchNotes('atlas', 5);

    expect(embedding.embed).toHaveBeenCalledWith('atlas');
    expect(search.hybridSearch).toHaveBeenCalledWith([0.25, 0.75], 'atlas', 5);
    expect(results).toEqual([
      {
        id: 'hit-1',
        content: 'Atlas memory',
        score: 0.88,
        source: 'memory',
        metadata: { content: 'Atlas memory', source: 'memory', tag: 'hero' },
      },
    ]);
  });

  it('flushes the current chunk when a new heading starts after the size limit', () => {
    const { pipeline } = createPipeline();
    const pipelineAny = pipeline as never as {
      chunkContent: (content: string) => string[];
      chunkOverlap: number;
      chunkSize: number;
    };

    pipelineAny.chunkSize = 10;
    pipelineAny.chunkOverlap = 100;

    expect(
      pipelineAny.chunkContent('intro line\nbody line\n# Next\nTail'),
    ).toEqual([
      'intro line\nbody line',
      '# Next\nTail',
    ]);
  });

  it('falls back to FTS-only search when embeddings are not ready', async () => {
    const { pipeline, search } = createPipeline({
      embedding: { isReady: false },
      search: {
        ftsSearch: vi.fn(() => [
          {
            id: 'fts-1',
            score: 0.5,
            metadata: { content: 'Keyword hit', source: 'fts' },
          },
        ]),
      },
    });

    const results = await pipeline.searchNotes('keyword');

    expect(search.hybridSearch).not.toHaveBeenCalled();
    expect(search.ftsSearch).toHaveBeenCalledWith('keyword', 10);
    expect(results).toEqual([
      {
        id: 'fts-1',
        content: 'Keyword hit',
        score: 0.5,
        source: 'fts',
        metadata: { content: 'Keyword hit', source: 'fts' },
      },
    ]);
  });

  it('filters writing context by keyword extraction, diversity, and token budget', async () => {
    const { pipeline } = createPipeline();
    const searchSpy = vi.spyOn(pipeline, 'searchNotes').mockResolvedValue([
      { id: 'a', content: 'alpha beta gamma', score: 0.9, source: 'memory', metadata: {} },
      { id: 'b', content: 'alpha beta gamma', score: 0.8, source: 'memory', metadata: {} },
      { id: 'c', content: 'delta epsilon zeta eta theta', score: 0.7, source: 'memory', metadata: {} },
    ]);

    const results = await pipeline.getContextForWriting('Alpha and the delta, gamma！', 4);

    expect(searchSpy).toHaveBeenCalledWith('alpha delta gamma', 20);
    expect(results).toEqual([
      { id: 'a', content: 'alpha beta gamma', score: 0.9, source: 'memory', metadata: {} },
    ]);
  });

  it('exposes safe behavior for empty keyword sets and helper methods', async () => {
    const { pipeline } = createPipeline();

    await expect(pipeline.getContextForWriting('the and 的 是', 10)).resolves.toEqual([]);
    expect((pipeline as never as { chunkContent: (content: string) => string[] }).chunkContent('')).toEqual(['']);
    expect((pipeline as never as { computeSimilarity: (a: string, b: string) => number }).computeSimilarity('', '')).toBe(1);
    expect((pipeline as never as { computeChunkId: (notePath: string, chunkIndex: number) => string }).computeChunkId('notes/demo.md', 2)).toMatch(/^[a-f0-9]{16}$/);
  });
});

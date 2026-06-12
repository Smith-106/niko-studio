import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ChunkBuffer,
  ChunkSplitter,
  ChunkedMemoryAdapter,
  MemoryChunk,
  TextChunker,
  getChunkBuffer,
  getTextChunker,
  resetChunkBuffer,
  resetTextChunker,
} from '../../memory/memory-chunk';
import type { EmbedderEngine } from '../../memory/memory-chunk';

afterEach(() => {
  resetChunkBuffer();
  resetTextChunker();
  vi.restoreAllMocks();
});

describe('memory-chunk additional coverage', () => {
  it('falls back to single-item embedding when embedBatch is unavailable', async () => {
    const buffer = new ChunkBuffer();
    buffer.add(MemoryChunk.create('alpha'));
    buffer.add(MemoryChunk.create('beta'));

    const embed = vi
      .fn<[string], number[]>()
      .mockImplementation((text) => [text.length]);
    const embedder: EmbedderEngine = { embed };

    const results = await buffer.flush(embedder);

    expect(embed).toHaveBeenCalledTimes(2);
    expect(results.map((chunk) => chunk.embedding)).toEqual([[5], [4]]);
    expect(results.every((chunk) => chunk.embedded)).toBe(true);
  });

  it('returns early for empty internal batches and rethrows embedding errors', async () => {
    const buffer = new ChunkBuffer();

    await expect((buffer as any)._embedBatch([], {})).resolves.toEqual([]);

    const failingChunk = MemoryChunk.create('boom');
    await expect((buffer as any)._embedBatch([failingChunk], {})).rejects.toThrow(
      'Embedder must have embed or embedBatch method',
    );

    buffer.add(MemoryChunk.create('fails publicly'));
    const embedder: EmbedderEngine = {
      embedBatch: vi.fn().mockRejectedValue(new Error('batch failed')),
    };

    await expect(buffer.flush(embedder)).rejects.toThrow('batch failed');
  });

  it('returns early when a custom iterable buffer expands to no chunks', async () => {
    const buffer = new ChunkBuffer();
    (buffer as any)._buffer = {
      length: 1,
      [Symbol.iterator]: function* emptyIterator() {
        return;
      },
    };

    await expect(buffer.flush({ embed: vi.fn() })).resolves.toEqual([]);
  });

  it('flushes pending small paragraphs before splitting an oversized paragraph', () => {
    const chunker = new TextChunker({ chunkSize: 45 });
    const text = [
      'short intro',
      'This is a very large paragraph. It has several sentences. It should be split.',
    ].join('\n\n');

    const chunks = chunker.chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.content).toBe('short intro');
  });

  it('handles whitespace-only sentence input and overlap guards', () => {
    const splitter = new ChunkSplitter({ minChunkLength: 1, overlapSentences: 5 });

    const whitespaceChunks = splitter.splitBySentences('   ', {
      sourceId: 'sent-whitespace',
      metadata: { lane: 'whitespace' },
    });
    expect(whitespaceChunks).toHaveLength(1);
    expect(whitespaceChunks[0]?.metadata.chunk_method).toBe('sentences');
    expect(whitespaceChunks[0]?.content).toBe('   ');

    const overlapped = splitter.splitBySentences(
      'First sentence. Second sentence. Third sentence.',
      { maxSentences: 2 },
    );
    expect(overlapped).toHaveLength(2);
    expect(overlapped[1]?.content).toContain('Third sentence.');
  });

  it('handles whitespace-only paragraphs and merges all-short paragraphs', () => {
    const splitter = new ChunkSplitter({ minChunkLength: 10 });

    const whitespaceChunks = splitter.splitByParagraphs(' \n \n ');
    expect(whitespaceChunks).toHaveLength(1);
    expect(whitespaceChunks[0]?.metadata.chunk_method).toBe('paragraphs');

    const mergedChunks = splitter.splitByParagraphs('a\n\nbb\n\nccc');
    expect(mergedChunks).toHaveLength(1);
    expect(mergedChunks[0]?.content).toBe('a\n\nbb\n\nccc');
  });

  it('finds punctuation boundaries and falls back to the provided end position', () => {
    const splitter = new ChunkSplitter();

    expect((splitter as any)._findSentenceBoundary('Alpha. Beta', 0, 7)).toBe(6);
    expect((splitter as any)._findSentenceBoundary('abcdef', 0, 6)).toBe(6);
  });

  it('returns empty status when the adapter chunker yields no chunks', async () => {
    const adapter = new ChunkedMemoryAdapter({ embedder: {} });
    vi.spyOn(adapter.chunker, 'chunkText').mockReturnValue([]);

    await expect(adapter.addChunked({ content: 'ignored' })).resolves.toEqual(
      expect.objectContaining({
        chunk_ids: [],
        status: 'empty',
      }),
    );
  });

  it('reuses singleton helpers until reset and clears buffered state on reset', () => {
    const firstBuffer = getChunkBuffer({ batchSize: 2, maxBufferSize: 3 });
    const secondBuffer = getChunkBuffer({ batchSize: 99, maxBufferSize: 100 });
    expect(secondBuffer).toBe(firstBuffer);
    expect((firstBuffer as any)._batchSize).toBe(2);
    expect((firstBuffer as any)._maxBufferSize).toBe(3);

    firstBuffer.add(MemoryChunk.create('singleton chunk'));
    expect(firstBuffer.size).toBe(1);
    resetChunkBuffer();

    const thirdBuffer = getChunkBuffer();
    expect(thirdBuffer).not.toBe(firstBuffer);
    expect(thirdBuffer.size).toBe(0);

    const firstChunker = getTextChunker({ chunkSize: 12, chunkOverlap: 4 });
    const secondChunker = getTextChunker({ chunkSize: 200, chunkOverlap: 20 });
    expect(secondChunker).toBe(firstChunker);
    expect(firstChunker.chunkSize).toBe(12);
    expect(firstChunker.chunkOverlap).toBe(4);

    resetTextChunker();

    const thirdChunker = getTextChunker();
    expect(thirdChunker).not.toBe(firstChunker);
    expect(thirdChunker.chunkSize).toBe(512);
    expect(thirdChunker.chunkOverlap).toBe(50);
  });

  it('reports batch readiness only when the buffer reaches the configured threshold', () => {
    const buffer = new ChunkBuffer({ batchSize: 2 });

    expect(buffer.isBatchReady).toBe(false);
    buffer.add(MemoryChunk.create('first'));
    expect(buffer.isBatchReady).toBe(false);
    buffer.add(MemoryChunk.create('second'));
    expect(buffer.isBatchReady).toBe(true);
  });
});

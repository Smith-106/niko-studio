import { describe, expect, it, vi } from 'vitest';

import { ChunkBuffer, ChunkSplitter, MemoryChunk } from '../../memory/memory-chunk';
import type { EmbedderEngine } from '../../memory/memory-chunk';

describe('memory-chunk branch-gap coverage', () => {
  it('accepts synchronous batch embeddings', async () => {
    const buffer = new ChunkBuffer();
    buffer.add(MemoryChunk.create('alpha'));
    buffer.add(MemoryChunk.create('beta'));

    const embedder: EmbedderEngine = {
      embedBatch: vi.fn().mockReturnValue([[1], [2]]),
    };

    const embedded = await buffer.flush(embedder);

    expect(embedder.embedBatch).toHaveBeenCalledWith(['alpha', 'beta']);
    expect(embedded.map((chunk) => chunk.embedding)).toEqual([[1], [2]]);
    expect(embedded.every((chunk) => chunk.embedded)).toBe(true);
  });

  it('awaits asynchronous single-item embeddings when batch embedding is unavailable', async () => {
    const buffer = new ChunkBuffer();
    buffer.add(MemoryChunk.create('atlas'));
    buffer.add(MemoryChunk.create('hero'));

    const embed = vi.fn(async (text: string) => [text.length]);
    const embedder: EmbedderEngine = { embed };

    const embedded = await buffer.flush(embedder);

    expect(embed).toHaveBeenCalledTimes(2);
    expect(embedded.map((chunk) => chunk.embedding)).toEqual([[5], [4]]);
    expect(embedded.every((chunk) => chunk.embedded)).toBe(true);
  });

  it('uses an empty metadata fallback for whitespace-only sentence chunks', () => {
    const splitter = new ChunkSplitter();

    const chunks = splitter.splitBySentences('   ');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('   ');
    expect(chunks[0]?.metadata).toEqual({ chunk_method: 'sentences' });
  });
});

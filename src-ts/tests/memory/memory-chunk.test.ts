/**
 * MemoryChunk Tests
 *
 * Tests MemoryChunk data structure, ChunkBuffer, TextChunker,
 * ChunkSplitter, and ChunkedMemoryAdapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MemoryChunk,
  ChunkBuffer,
  TextChunker,
  ChunkSplitter,
  ChunkedMemoryAdapter,
  resetChunkBuffer,
  resetTextChunker,
} from '../../memory/memory-chunk';
import type { EmbedderEngine } from '../../memory/memory-chunk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEmbedder(embeddings: number[][]): EmbedderEngine {
  return {
    embedBatch: vi.fn().mockResolvedValue(embeddings),
    embed: vi.fn(),
    similarity: vi.fn().mockReturnValue(0.95),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  resetChunkBuffer();
  resetTextChunker();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MemoryChunk', () => {
  it('constructs with defaults', () => {
    const chunk = new MemoryChunk({ id: 'c1', content: 'Hello world' });
    expect(chunk.id).toBe('c1');
    expect(chunk.content).toBe('Hello world');
    expect(chunk.embedding).toBeNull();
    expect(chunk.metadata).toEqual({});
    expect(chunk.sourceId).toBeNull();
    expect(chunk.chunkIndex).toBe(0);
    expect(chunk.totalChunks).toBe(1);
    expect(chunk.embedded).toBe(false);
    expect(chunk.createdAt).toBeInstanceOf(Date);
  });

  it('constructs with all parameters', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const chunk = new MemoryChunk({
      id: 'c2',
      content: 'Full content',
      embedding: [0.1, 0.2, 0.3],
      metadata: { chapter: 1 },
      createdAt: now,
      sourceId: 'src-1',
      chunkIndex: 2,
      totalChunks: 5,
      embedded: true,
    });
    expect(chunk.id).toBe('c2');
    expect(chunk.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(chunk.metadata).toEqual({ chapter: 1 });
    expect(chunk.sourceId).toBe('src-1');
    expect(chunk.chunkIndex).toBe(2);
    expect(chunk.totalChunks).toBe(5);
    expect(chunk.embedded).toBe(true);
  });

  it('creates via static create() with auto-generated ID', () => {
    const chunk = MemoryChunk.create('Test content', 'src-1', 0, 3, { key: 'val' });
    expect(chunk.id).toBeTruthy();
    expect(chunk.content).toBe('Test content');
    expect(chunk.sourceId).toBe('src-1');
    expect(chunk.chunkIndex).toBe(0);
    expect(chunk.totalChunks).toBe(3);
    expect(chunk.metadata).toEqual({ key: 'val' });
    expect(chunk.embedded).toBe(false);
  });

  it('computes content hash for deduplication', () => {
    const chunk1 = new MemoryChunk({ id: 'h1', content: 'Same content' });
    const chunk2 = new MemoryChunk({ id: 'h2', content: 'Same content' });
    const chunk3 = new MemoryChunk({ id: 'h3', content: 'Different content' });

    expect(chunk1.contentHash).toBe(chunk2.contentHash);
    expect(chunk1.contentHash).not.toBe(chunk3.contentHash);
    expect(chunk1.contentHash).toHaveLength(16);
  });

  it('round-trips through toDict and fromDict', () => {
    const now = new Date('2026-03-15T10:00:00Z');
    const original = new MemoryChunk({
      id: 'rt-1',
      content: 'Round trip content',
      embedding: [0.5, 0.5],
      metadata: { tags: ['test'] },
      createdAt: now,
      sourceId: 'src-rt',
      chunkIndex: 1,
      totalChunks: 3,
      embedded: true,
    });
    const dict = original.toDict();
    expect(dict.id).toBe('rt-1');
    expect(dict.content).toBe('Round trip content');
    expect(dict.created_at).toBe(now.toISOString());
    expect(dict.source_id).toBe('src-rt');
    expect(dict.chunk_index).toBe(1);
    expect(dict.total_chunks).toBe(3);
    expect(dict.embedded).toBe(true);
    expect(dict.content_hash).toBeTruthy();

    const restored = MemoryChunk.fromDict(dict);
    expect(restored.id).toBe('rt-1');
    expect(restored.content).toBe('Round trip content');
    expect(restored.sourceId).toBe('src-rt');
    expect(restored.chunkIndex).toBe(1);
    expect(restored.totalChunks).toBe(3);
    expect(restored.embedded).toBe(true);
  });

  it('fromDict handles Date instance for created_at', () => {
    const now = new Date();
    const dict = { id: 'd1', content: 'Date test', created_at: now };
    const chunk = MemoryChunk.fromDict(dict);
    expect(chunk.createdAt).toBe(now);
  });

  it('fromDict handles missing optional fields gracefully', () => {
    const dict: Record<string, unknown> = { id: 'minimal', content: 'minimal content' };
    const chunk = MemoryChunk.fromDict(dict);
    expect(chunk.embedding).toBeNull();
    expect(chunk.metadata).toEqual({});
    expect(chunk.sourceId).toBeNull();
    expect(chunk.chunkIndex).toBe(0);
    expect(chunk.totalChunks).toBe(1);
    expect(chunk.embedded).toBe(false);
    expect(chunk.createdAt).toBeInstanceOf(Date);
  });
});

describe('ChunkBuffer', () => {
  it('adds a chunk to the buffer', () => {
    const buffer = new ChunkBuffer();
    const chunk = MemoryChunk.create('Test content');
    expect(buffer.add(chunk)).toBe(true);
    expect(buffer.size).toBe(1);
  });

  it('deduplicates chunks with same content hash', () => {
    const buffer = new ChunkBuffer();
    const chunk1 = MemoryChunk.create('Same content');
    const chunk2 = MemoryChunk.create('Same content');
    expect(buffer.add(chunk1)).toBe(true);
    expect(buffer.add(chunk2)).toBe(false);
    expect(buffer.size).toBe(1);
    expect(buffer.stats.total_deduplicated).toBe(1);
  });

  it('rejects chunks when buffer is full', () => {
    const buffer = new ChunkBuffer({ maxBufferSize: 2 });
    buffer.add(MemoryChunk.create('chunk 1'));
    buffer.add(MemoryChunk.create('chunk 2'));
    expect(buffer.add(MemoryChunk.create('chunk 3'))).toBe(false);
    expect(buffer.size).toBe(2);
  });

  it('addMany returns count of successfully added chunks', () => {
    const buffer = new ChunkBuffer();
    const chunks = [
      MemoryChunk.create('alpha'),
      MemoryChunk.create('beta'),
      MemoryChunk.create('gamma'),
    ];
    expect(buffer.addMany(chunks)).toBe(3);
    expect(buffer.size).toBe(3);
  });

  it('flush embeds all buffered chunks', async () => {
    const buffer = new ChunkBuffer();
    buffer.add(MemoryChunk.create('Hello world'));
    buffer.add(MemoryChunk.create('Second chunk'));

    const embedder = createMockEmbedder([[0.1], [0.2]]);
    const results = await buffer.flush(embedder);

    expect(results).toHaveLength(2);
    expect(results[0].embedded).toBe(true);
    expect(results[1].embedded).toBe(true);
    expect(embedder.embedBatch).toHaveBeenCalledWith(['Hello world', 'Second chunk']);
    expect(buffer.size).toBe(0);
  });

  it('flush returns empty array for empty buffer', async () => {
    const buffer = new ChunkBuffer();
    const embedder = createMockEmbedder([]);
    const results = await buffer.flush(embedder);
    expect(results).toEqual([]);
  });

  it('flushBatch only processes when batch size is reached', async () => {
    const buffer = new ChunkBuffer({ batchSize: 3 });
    buffer.add(MemoryChunk.create('one'));
    buffer.add(MemoryChunk.create('two'));

    const embedder = createMockEmbedder([[0.1], [0.2], [0.3]]);
    let results = await buffer.flushBatch(embedder);
    expect(results).toHaveLength(0);

    buffer.add(MemoryChunk.create('three'));
    results = await buffer.flushBatch(embedder);
    expect(results).toHaveLength(3);
  });

  it('stats track totals correctly', () => {
    const buffer = new ChunkBuffer();
    const c1 = MemoryChunk.create('unique1');
    const c2 = MemoryChunk.create('unique2');
    const c3 = MemoryChunk.create('unique1'); // duplicate

    buffer.add(c1);
    buffer.add(c3);
    buffer.add(c2);

    const stats = buffer.stats;
    expect(stats.buffer_size).toBe(2);
    expect(stats.total_added).toBe(2);
    expect(stats.total_deduplicated).toBe(1);
  });

  it('clear removes all buffered chunks', () => {
    const buffer = new ChunkBuffer();
    buffer.add(MemoryChunk.create('a'));
    buffer.add(MemoryChunk.create('b'));
    buffer.clear();
    expect(buffer.size).toBe(0);
  });
});

describe('TextChunker', () => {
  it('returns single chunk for short text', () => {
    const chunker = new TextChunker({ chunkSize: 512 });
    const chunks = chunker.chunkText('Short text');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Short text');
    expect(chunks[0].totalChunks).toBe(1);
  });

  it('splits long text into multiple chunks by paragraph', () => {
    const chunker = new TextChunker({ chunkSize: 50 });
    const text = 'Paragraph one with some content here.\n\nParagraph two with more content.\n\nParagraph three.';
    const chunks = chunker.chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.metadata.chunk_method === 'paragraph')).toBe(true);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
      expect(chunks[i].totalChunks).toBe(chunks.length);
    }
  });

  it('splits large paragraphs by sentence', () => {
    const chunker = new TextChunker({ chunkSize: 80 });
    const text = 'This is a very long paragraph. It contains multiple sentences. Each sentence adds to the total length. Eventually it should exceed the chunk size and be split.';
    const chunks = chunker.chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('passes sourceId and metadata to chunks', () => {
    const chunker = new TextChunker();
    const chunks = chunker.chunkText('Hello', 'src-42', { chapter: 3 });
    expect(chunks[0].sourceId).toBe('src-42');
    expect(chunks[0].metadata.chapter).toBe(3);
  });
});

describe('ChunkSplitter', () => {
  it('splits by tokens', () => {
    const splitter = new ChunkSplitter({ minChunkLength: 10 });
    const text = 'A'.repeat(2000);
    const chunks = splitter.splitByTokens(text, { maxTokens: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.metadata.chunk_method === 'tokens')).toBe(true);
  });

  it('splits by sentences', () => {
    const splitter = new ChunkSplitter({ minChunkLength: 10, overlapSentences: 0 });
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence.';
    const chunks = splitter.splitBySentences(text, { maxSentences: 2 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('splits by paragraphs', () => {
    const splitter = new ChunkSplitter({ minChunkLength: 1 });
    const text = 'Para one.\n\nPara two.\n\nPara three.';
    const chunks = splitter.splitByParagraphs(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for empty text', () => {
    const splitter = new ChunkSplitter();
    expect(splitter.splitByTokens('')).toEqual([]);
    expect(splitter.splitBySentences('')).toEqual([]);
    expect(splitter.splitByParagraphs('')).toEqual([]);
  });
});

describe('ChunkedMemoryAdapter', () => {
  it('creates with memoryService and chunker/buffer', () => {
    const mockService = { embedder: createMockEmbedder([[0.1]]) };
    const adapter = new ChunkedMemoryAdapter(mockService);
    expect(adapter.memoryService).toBe(mockService);
    expect(adapter.chunker).toBeInstanceOf(TextChunker);
    expect(adapter.buffer).toBeInstanceOf(ChunkBuffer);
  });

  it('addChunked returns chunk_ids and status created', async () => {
    const mockService = {
      embedder: createMockEmbedder([[0.1], [0.2], [0.3]]),
    };
    const adapter = new ChunkedMemoryAdapter(mockService);
    // Use varied content to avoid deduplication from overlapping chunks
    const content = Array.from({ length: 1000 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('');
    const result = await adapter.addChunked({
      content,
      namespace: 'test',
      importance: 0.8,
    });
    expect(result.status).toBe('created');
    expect(result.source_id).toBeTruthy();
    expect(result.chunk_ids.length).toBeGreaterThan(0);
    expect(result.total_chunks).toBe(result.chunk_ids.length);
  });

  it('addChunked creates chunks even for short content', async () => {
    const mockService = { embedder: createMockEmbedder([[0.1]]) };
    const adapter = new ChunkedMemoryAdapter(mockService);
    const result = await adapter.addChunked({ content: '' });
    // Empty content still produces one chunk (short text path)
    expect(result.status).toBe('created');
  });
});

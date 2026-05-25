/**
 * MemoryChunk - Memory chunking system
 *
 * Implements chunked storage and batch embedding generation:
 * - MemoryChunk: Memory chunk data structure
 * - ChunkBuffer: Buffer management for pending embedding chunks
 * - Batch embedding generation optimization
 * - Integration with MemoryService.add()
 *
 * Dependencies:
 * - EmbeddingEngine: Vector embedding generation
 * - MemoryService: Memory storage service
 */

import { createHash, randomUUID } from "crypto";
import { createLogger } from "../logger/index.js";

const _log = createLogger("chunk");

// ============================================================
// MemoryChunk data structure
// ============================================================

/**
 * Memory chunk data structure
 */
export class MemoryChunk {
  id: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  createdAt: Date;

  // Chunk info
  sourceId: string | null;
  chunkIndex: number;
  totalChunks: number;

  // Status
  embedded: boolean;

  constructor(params: {
    id: string;
    content: string;
    embedding?: number[] | null;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    sourceId?: string | null;
    chunkIndex?: number;
    totalChunks?: number;
    embedded?: boolean;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.embedding = params.embedding ?? null;
    this.metadata = params.metadata ?? {};
    this.createdAt = params.createdAt ?? new Date();
    this.sourceId = params.sourceId ?? null;
    this.chunkIndex = params.chunkIndex ?? 0;
    this.totalChunks = params.totalChunks ?? 1;
    this.embedded = params.embedded ?? false;
  }

  /** Create a new memory chunk */
  static create(
    content: string,
    sourceId?: string | null,
    chunkIndex: number = 0,
    totalChunks: number = 1,
    metadata?: Record<string, unknown> | null
  ): MemoryChunk {
    const chunkId = randomUUID();
    return new MemoryChunk({
      id: chunkId,
      content,
      sourceId: sourceId ?? null,
      chunkIndex,
      totalChunks,
      metadata: metadata ?? {},
      createdAt: new Date(),
      embedded: false,
    });
  }

  /** Content hash (for deduplication) */
  get contentHash(): string {
    return createHash("sha256").update(this.content).digest("hex").slice(0, 16);
  }

  /** Convert to plain object */
  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      content: this.content,
      embedding: this.embedding,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      source_id: this.sourceId,
      chunk_index: this.chunkIndex,
      total_chunks: this.totalChunks,
      embedded: this.embedded,
      content_hash: this.contentHash,
    };
  }

  /** Create from plain object */
  static fromDict(data: Record<string, unknown>): MemoryChunk {
    let createdAt: Date;
    const rawDate = data["created_at"];
    if (typeof rawDate === "string") {
      createdAt = new Date(rawDate);
    } else if (rawDate instanceof Date) {
      createdAt = rawDate;
    } else {
      createdAt = new Date();
    }

    return new MemoryChunk({
      id: data["id"] as string,
      content: data["content"] as string,
      embedding: (data["embedding"] as number[] | undefined) ?? null,
      metadata: (data["metadata"] as Record<string, unknown>) ?? {},
      createdAt,
      sourceId: (data["source_id"] as string | undefined) ?? null,
      chunkIndex: (data["chunk_index"] as number) ?? 0,
      totalChunks: (data["total_chunks"] as number) ?? 1,
      embedded: (data["embedded"] as boolean) ?? false,
    });
  }
}

// ============================================================
// Embedder interface for type safety
// ============================================================

/** Interface for embedder engines */
export interface EmbedderEngine {
  embed?(text: string): Promise<number[]> | number[];
  embedBatch?(texts: string[]): Promise<number[][]> | number[][];
  similarity?(vecA: number[], vecB: number[]): number;
}

// ============================================================
// ChunkBuffer - Buffer management for pending embedding chunks
// ============================================================

/**
 * Buffer management for pending embedding chunks
 *
 * Features:
 * - Batch collect chunks pending embedding
 * - Trigger batch embedding when threshold is reached
 * - Support manual flush
 * - Deduplication
 *
 * @example
 * const buffer = new ChunkBuffer({ batchSize: 32 });
 * buffer.add(chunk1);
 * buffer.add(chunk2);
 * // When batch_size is reached, embedding is auto-triggered
 * // Or flush manually
 * const embeddedChunks = await buffer.flush(embedder);
 */
export class ChunkBuffer {
  private _buffer: MemoryChunk[] = [];
  private _seenHashes: Set<string> = new Set();
  private _batchSize: number;
  private _maxBufferSize: number;
  private _onBatchReady: ((chunks: MemoryChunk[]) => void) | null;

  // Statistics
  private _totalAdded = 0;
  private _totalDeduplicated = 0;
  private _totalEmbedded = 0;

  constructor(params: {
    batchSize?: number;
    maxBufferSize?: number;
    onBatchReady?: (chunks: MemoryChunk[]) => void;
  } = {}) {
    this._batchSize = params.batchSize ?? 32;
    this._maxBufferSize = params.maxBufferSize ?? 1000;
    this._onBatchReady = params.onBatchReady ?? null;
  }

  /**
   * Add chunk to buffer
   *
   * @returns Whether the chunk was added (may fail after deduplication)
   */
  add(chunk: MemoryChunk): boolean {
    // Deduplication check
    const contentHash = chunk.contentHash;
    if (this._seenHashes.has(contentHash)) {
      this._totalDeduplicated += 1;
      return false;
    }

    // Capacity check
    if (this._buffer.length >= this._maxBufferSize) {
      _log.warn(`Buffer full (${this._maxBufferSize}), rejecting chunk`);
      return false;
    }

    this._buffer.push(chunk);
    this._seenHashes.add(contentHash);
    this._totalAdded += 1;

    return true;
  }

  /**
   * Batch add chunks
   *
   * @returns Number of chunks successfully added
   */
  addMany(chunks: MemoryChunk[]): number {
    let added = 0;
    for (const chunk of chunks) {
      if (this.add(chunk)) {
        added += 1;
      }
    }
    return added;
  }

  /**
   * Flush buffer, generate embeddings for all pending chunks
   *
   * @param embedder - Embedding engine (needs embed or embedBatch method)
   * @returns List of embedded chunks
   */
  async flush(embedder: EmbedderEngine): Promise<MemoryChunk[]> {
    if (this._buffer.length === 0) {
      return [];
    }

    // Take all chunks (including un-embedded)
    const chunksToEmbed = [...this._buffer];
    if (chunksToEmbed.length === 0) {
      return [];
    }

    _log.info(`Flushing buffer: ${chunksToEmbed.length} chunks`);

    // Batch generate embeddings
    const embeddedChunks = await this._embedBatch(chunksToEmbed, embedder);

    // Update statistics
    this._totalEmbedded += embeddedChunks.length;

    // Clear buffer
    this._buffer = [];
    this._seenHashes.clear();

    return embeddedChunks;
  }

  /**
   * Flush one batch, generate embeddings for batch_size chunks
   *
   * @returns List of embedded chunks
   */
  async flushBatch(embedder: EmbedderEngine): Promise<MemoryChunk[]> {
    if (this._buffer.length < this._batchSize) {
      return [];
    }

    // Take one batch
    const batch = this._buffer.splice(0, this._batchSize);

    // Batch generate embeddings
    const embeddedChunks = await this._embedBatch(batch, embedder);
    this._totalEmbedded += embeddedChunks.length;

    return embeddedChunks;
  }

  /**
   * Batch generate embeddings
   */
  private async _embedBatch(
    chunks: MemoryChunk[],
    embedder: EmbedderEngine
  ): Promise<MemoryChunk[]> {
    if (chunks.length === 0) {
      return [];
    }

    const texts = chunks.map((c) => c.content);

    try {
      let embeddings: number[][];

      // Try batch embedding
      if (embedder.embedBatch) {
        const result = embedder.embedBatch(texts);
        embeddings = result instanceof Promise ? await result : result;
      } else if (embedder.embed) {
        // Fallback to single embedding
        embeddings = [];
        for (const text of texts) {
          const result = embedder.embed(text);
          const emb = result instanceof Promise ? await result : result;
          embeddings.push(emb);
        }
      } else {
        throw new Error("Embedder must have embed or embedBatch method");
      }

      // Update chunk embeddings
      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = embeddings[i];
        chunks[i].embedded = true;
      }

      _log.info(`Embedded ${chunks.length} chunks`);
      return chunks;
    } catch (e) {
      _log.error(`Batch embedding failed: ${e}`);
      throw e;
    }
  }

  /** Current buffer size */
  get size(): number {
    return this._buffer.length;
  }

  /** Whether a full batch is ready */
  get isBatchReady(): boolean {
    return this._buffer.length >= this._batchSize;
  }

  /** Statistics */
  get stats(): Record<string, number> {
    return {
      buffer_size: this._buffer.length,
      total_added: this._totalAdded,
      total_deduplicated: this._totalDeduplicated,
      total_embedded: this._totalEmbedded,
    };
  }

  /** Clear buffer */
  clear(): void {
    this._buffer = [];
    this._seenHashes.clear();
  }
}

// ============================================================
// TextChunker - Text chunking utility
// ============================================================

/**
 * Text chunking utility
 *
 * Splits long text into smaller chunks suitable for embedding.
 *
 * Chunking strategy:
 * - Split by paragraphs
 * - Split by sentences
 * - Split by fixed length (with overlap)
 */
export class TextChunker {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;

  constructor(params: {
    chunkSize?: number;
    chunkOverlap?: number;
    minChunkSize?: number;
  } = {}) {
    this.chunkSize = params.chunkSize ?? 512;
    this.chunkOverlap = params.chunkOverlap ?? 50;
    this.minChunkSize = params.minChunkSize ?? 50;
  }

  /**
   * Split text into chunks
   *
   * @param text - Source text
   * @param sourceId - Source memory ID
   * @param metadata - Shared metadata
   * @returns MemoryChunk list
   */
  chunkText(
    text: string,
    sourceId?: string | null,
    metadata?: Record<string, unknown> | null
  ): MemoryChunk[] {
    if (!text || text.length <= this.chunkSize) {
      // Text is short enough, no chunking needed
      return [
        MemoryChunk.create(text, sourceId, 0, 1, metadata),
      ];
    }

    // Split by paragraphs
    const paragraphs = this._splitParagraphs(text);

    // Merge small paragraphs, split large ones
    const chunksText = this._mergeAndSplit(paragraphs);

    // Create MemoryChunk objects
    const totalChunks = chunksText.length;
    const chunks: MemoryChunk[] = [];
    for (let i = 0; i < chunksText.length; i++) {
      const chunk = MemoryChunk.create(
        chunksText[i],
        sourceId,
        i,
        totalChunks,
        { ...(metadata ?? {}), chunk_method: "paragraph" }
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /** Split by paragraphs */
  private _splitParagraphs(text: string): string[] {
    const paragraphs = text.split("\n\n");
    return paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
  }

  /** Merge small paragraphs, split large paragraphs */
  private _mergeAndSplit(paragraphs: string[]): string[] {
    const result: string[] = [];
    let currentChunk = "";

    for (const para of paragraphs) {
      // If paragraph itself exceeds chunkSize, need further splitting
      if (para.length > this.chunkSize) {
        // Save currently accumulated content first
        if (currentChunk) {
          result.push(currentChunk);
          currentChunk = "";
        }

        // Split large paragraph
        const subChunks = this._splitBySentence(para);
        result.push(...subChunks);
      } else {
        // Try to merge
        if (currentChunk.length + para.length + 2 <= this.chunkSize) {
          if (currentChunk) {
            currentChunk += "\n\n" + para;
          } else {
            currentChunk = para;
          }
        } else {
          // Current chunk is full, save and start new one
          if (currentChunk) {
            result.push(currentChunk);
          }
          currentChunk = para;
        }
      }
    }

    // Save last chunk
    if (currentChunk) {
      result.push(currentChunk);
    }

    return result;
  }

  /** Split by sentence (for large paragraphs) */
  private _splitBySentence(text: string): string[] {
    const sentenceRe = /(?<=[.!?])\s*/;
    const sentences = text.split(sentenceRe).map((s) => s.trim()).filter((s) => s.length > 0);

    const result: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= this.chunkSize) {
        if (currentChunk) {
          currentChunk += " " + sentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        if (currentChunk) {
          result.push(currentChunk);
        }
        // If a single sentence exceeds limit, split by fixed length
        if (sentence.length > this.chunkSize) {
          result.push(...this._splitByLength(sentence));
          currentChunk = "";
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk) {
      result.push(currentChunk);
    }

    return result;
  }

  /** Split by fixed length (with overlap) */
  private _splitByLength(text: string): string[] {
    const result: string[] = [];
    let start = 0;
    const step = Math.max(1, this.chunkSize - this.chunkOverlap);

    while (start < text.length) {
      const end = start + this.chunkSize;
      const chunk = text.slice(start, end);

      if (chunk.length >= this.minChunkSize) {
        result.push(chunk);
      }

      // Move with overlap, ensure cursor advances monotonically
      start += step;
    }

    return result;
  }
}

// ============================================================
// ChunkSplitter - Chunking strategies
// ============================================================

/**
 * Chunking strategy class
 *
 * Provides multiple text chunking strategies:
 * - splitByTokens: Split by token count
 * - splitBySentences: Split by sentence count
 * - splitByParagraphs: Split by paragraph
 *
 * @example
 * const splitter = new ChunkSplitter();
 * const chunks = splitter.splitByTokens(text, { maxTokens: 256 });
 * const chunks = splitter.splitBySentences(text, { maxSentences: 5 });
 * const chunks = splitter.splitByParagraphs(text);
 */
export class ChunkSplitter {
  overlapTokens: number;
  overlapSentences: number;
  minChunkLength: number;

  constructor(params: {
    overlapTokens?: number;
    overlapSentences?: number;
    minChunkLength?: number;
  } = {}) {
    this.overlapTokens = params.overlapTokens ?? 20;
    this.overlapSentences = params.overlapSentences ?? 1;
    this.minChunkLength = params.minChunkLength ?? 50;
  }

  /**
   * Split text by token count
   *
   * Uses simple character estimation (~2.5 characters/token for mixed CJK/English)
   */
  splitByTokens(
    text: string,
    params: {
      maxTokens?: number;
      sourceId?: string | null;
      metadata?: Record<string, unknown> | null;
    } = {}
  ): MemoryChunk[] {
    const { maxTokens = 256, sourceId = null, metadata = null } = params;

    if (!text) {
      return [];
    }

    // Estimate character count (mixed CJK/English average ~2.5 chars/token)
    const charsPerToken = 2.5;
    const maxChars = Math.floor(maxTokens * charsPerToken);
    const overlapChars = Math.floor(this.overlapTokens * charsPerToken);

    const chunksText: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxChars, text.length);

      // Try to break at sentence boundary
      if (end < text.length) {
        const boundary = this._findSentenceBoundary(text, start, end);
        if (boundary > start) {
          end = boundary;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length >= this.minChunkLength) {
        chunksText.push(chunkText);
      }

      // Move with overlap
      start = Math.max(start + 1, end - overlapChars);
    }

    return this._createChunks(chunksText, sourceId, metadata, "tokens");
  }

  /**
   * Split text by sentence count
   */
  splitBySentences(
    text: string,
    params: {
      maxSentences?: number;
      sourceId?: string | null;
      metadata?: Record<string, unknown> | null;
    } = {}
  ): MemoryChunk[] {
    const { maxSentences = 5, sourceId = null, metadata = null } = params;

    if (!text) {
      return [];
    }

    // CJK/English sentence separators
    const sentenceRe = /(?<=[.!?])\s*/;
    let sentences = text.split(sentenceRe).map((s) => s.trim()).filter((s) => s.length > 0);

    if (sentences.length === 0) {
      return [
        MemoryChunk.create(text, sourceId, 0, 1, {
          ...(metadata ?? {}),
          chunk_method: "sentences",
        }),
      ];
    }

    const chunksText: string[] = [];
    let i = 0;

    while (i < sentences.length) {
      // Take maxSentences sentences
      const endIdx = Math.min(i + maxSentences, sentences.length);
      const chunkSentences = sentences.slice(i, endIdx);
      const chunkText = chunkSentences.join(" ");

      if (chunkText.length >= this.minChunkLength) {
        chunksText.push(chunkText);
      }

      // Move with overlap
      let next = endIdx - this.overlapSentences;
      if (next <= endIdx - maxSentences) {
        next = endIdx; // Prevent infinite loop
      }
      i = next;
    }

    return this._createChunks(chunksText, sourceId, metadata, "sentences");
  }

  /**
   * Split text by paragraphs
   *
   * Each paragraph becomes an independent chunk
   */
  splitByParagraphs(
    text: string,
    params: {
      sourceId?: string | null;
      metadata?: Record<string, unknown> | null;
    } = {}
  ): MemoryChunk[] {
    const { sourceId = null, metadata = null } = params;

    if (!text) {
      return [];
    }

    // Split by double or single newline
    const paragraphs = text
      .split(/\n\s*\n|\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return [
        MemoryChunk.create(text, sourceId, 0, 1, {
          ...(metadata ?? {}),
          chunk_method: "paragraphs",
        }),
      ];
    }

    // Filter out too-short paragraphs
    const validParagraphs = paragraphs.filter(
      (p) => p.length >= this.minChunkLength
    );

    // If no valid paragraphs after filtering, merge all short ones
    if (validParagraphs.length === 0 && paragraphs.length > 0) {
      const merged = paragraphs.join("\n\n");
      return [
        MemoryChunk.create(merged, sourceId, 0, 1, {
          ...(metadata ?? {}),
          chunk_method: "paragraphs",
        }),
      ];
    }

    return this._createChunks(validParagraphs, sourceId, metadata, "paragraphs");
  }

  /** Find the nearest sentence boundary within a range */
  private _findSentenceBoundary(
    text: string,
    start: number,
    end: number
  ): number {
    const searchText = text.slice(start, end);
    const sentenceEndRe = /[.!?]/g;
    let lastMatch: RegExpExecArray | null;
    let lastMatchIndex = -1;

    while ((lastMatch = sentenceEndRe.exec(searchText)) !== null) {
      lastMatchIndex = lastMatch.index + 1;
    }

    if (lastMatchIndex >= 0) {
      return start + lastMatchIndex;
    }

    return end;
  }

  /** Create MemoryChunk objects list */
  private _createChunks(
    chunksText: string[],
    sourceId: string | null,
    metadata: Record<string, unknown> | null,
    method: string
  ): MemoryChunk[] {
    const totalChunks = chunksText.length;
    const chunks: MemoryChunk[] = [];

    for (let i = 0; i < chunksText.length; i++) {
      const chunk = MemoryChunk.create(
        chunksText[i],
        sourceId,
        i,
        totalChunks,
        { ...(metadata ?? {}), chunk_method: method }
      );
      chunks.push(chunk);
    }

    return chunks;
  }
}

// ============================================================
// ChunkedMemoryAdapter - MemoryService integration
// ============================================================

/**
 * Chunked memory adapter
 *
 * Integrates chunking functionality with MemoryService.
 *
 * @example
 * const adapter = new ChunkedMemoryAdapter(service);
 * await adapter.addChunked(longText, { namespace: "writing" });
 */
export class ChunkedMemoryAdapter {
  memoryService: unknown;
  chunker: TextChunker;
  buffer: ChunkBuffer;

  constructor(
    memoryService: unknown,
    params: { chunkSize?: number; batchSize?: number } = {}
  ) {
    this.memoryService = memoryService;
    this.chunker = new TextChunker({ chunkSize: params.chunkSize ?? 512 });
    this.buffer = new ChunkBuffer({ batchSize: params.batchSize ?? 32 });
  }

  /**
   * Add chunked memory
   */
  async addChunked(params: {
    content: string;
    namespace?: string;
    importance?: number;
    tags?: string[] | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Record<string, unknown>> {
    const {
      content,
      namespace = "default",
      importance = 0.5,
      tags = null,
      metadata = null,
    } = params;

    const sourceId = randomUUID();

    // Chunk
    const chunks = this.chunker.chunkText(content, sourceId, {
      ...(metadata ?? {}),
      namespace,
      importance,
      tags: tags ?? [],
    });

    if (chunks.length === 0) {
      return { source_id: sourceId, chunk_ids: [], status: "empty" };
    }

    // Add to buffer
    this.buffer.addMany(chunks);

    // Generate embeddings
    const embedder = (this.memoryService as Record<string, unknown>)
      .embedder as EmbedderEngine;
    const embeddedChunks = await this.buffer.flush(embedder);

    // Store chunk IDs (actual MemoryService integration would go here)
    const chunkIds: string[] = [];
    for (const chunk of embeddedChunks) {
      chunkIds.push(chunk.id);
    }

    _log.info(
      `Added chunked memory: ${sourceId.slice(0, 8)}... (${chunkIds.length} chunks)`
    );

    return {
      source_id: sourceId,
      chunk_ids: chunkIds,
      total_chunks: chunks.length,
      status: "created",
    };
  }
}

// ============================================================
// Factory functions (singleton instances)
// ============================================================

let _chunkBuffer: ChunkBuffer | null = null;
let _textChunker: TextChunker | null = null;

/** Get ChunkBuffer singleton */
export function getChunkBuffer(
  params: { batchSize?: number; maxBufferSize?: number } = {}
): ChunkBuffer {
  if (_chunkBuffer === null) {
    _chunkBuffer = new ChunkBuffer({
      batchSize: params.batchSize ?? 32,
      maxBufferSize: params.maxBufferSize ?? 1000,
    });
  }
  return _chunkBuffer;
}

/** Get TextChunker singleton */
export function getTextChunker(
  params: { chunkSize?: number; chunkOverlap?: number } = {}
): TextChunker {
  if (_textChunker === null) {
    _textChunker = new TextChunker({
      chunkSize: params.chunkSize ?? 512,
      chunkOverlap: params.chunkOverlap ?? 50,
    });
  }
  return _textChunker;
}

/** Reset ChunkBuffer singleton (for testing only) */
export function resetChunkBuffer(): void {
  if (_chunkBuffer) {
    _chunkBuffer.clear();
  }
  _chunkBuffer = null;
}

/** Reset TextChunker singleton (for testing only) */
export function resetTextChunker(): void {
  _textChunker = null;
}

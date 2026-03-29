/**
 * VectorSearch - SQLite-based Vector Search with Hybrid Support
 *
 * TypeScript implementation migrated from src/search/vector_search.py.
 *
 * Features:
 * - Vector storage and search using SQLite (with optional sqlite-vec extension)
 * - Cosine similarity for vector search
 * - FTS5 full-text search for keyword matching
 * - Hybrid search with RRF (Reciprocal Rank Fusion)
 * - Integration with EmbeddingService
 */

import type { SearchInterface } from '../protocols/search';
import type { EmbeddingService } from '../protocols/embedding';
import type { SmartSearchResult, SearchResultMetadata, SearchResultLocation } from './smart-search';

/**
 * HNSW index configuration (for future sqlite-vec extension support)
 */
export interface HNSWConfig {
  dimension: number;
  efConstruction: number;
  efSearch: number;
  m: number;
}

/**
 * VectorSearch configuration
 */
export interface VectorSearchConfig {
  dbPath: string;
  dimension?: number;
  modelName?: string;
  embeddingService: EmbeddingService;
  hnsw?: Partial<HNSWConfig>;
}

/**
 * Vector item stored in database
 */
interface VectorItem {
  id: string;
  content: string;
  metadata: string; // JSON string
  embedding: Buffer | null;
  type: string;
  createdAt: number;
}

/**
 * VectorSearch Error Types
 */
export class VectorSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VectorSearchError';
  }
}

export class DatabaseError extends VectorSearchError {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class EmbeddingError extends VectorSearchError {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Default HNSW configuration
 */
const DEFAULT_HNSW_CONFIG: HNSWConfig = {
  dimension: 384,
  efConstruction: 200,
  efSearch: 100,
  m: 16,
};

const DEFAULT_MODEL_NAME = 'BAAI/bge-small-en-v1.5';
const SAMPLE_SEARCH_QUERY = 'search_result_sample_query';

/**
 * VectorSearch Implementation
 *
 * Implements SearchInterface with SQLite-based vector storage and search.
 * Supports hybrid search combining vector similarity and keyword matching.
 */
export class VectorSearch implements SearchInterface {
  private readonly dbPath: string;
  private readonly dimension: number;
  private readonly modelName: string;
  private readonly embeddingService: EmbeddingService;
  private readonly hnswConfig: HNSWConfig;

  // Database connection (lazy initialization)
  private db: unknown = null;

  constructor(config: VectorSearchConfig) {
    this.dbPath = config.dbPath;
    this.dimension = config.dimension ?? 384;
    this.modelName = config.modelName ?? DEFAULT_MODEL_NAME;
    this.embeddingService = config.embeddingService;
    this.hnswConfig = { ...DEFAULT_HNSW_CONFIG, ...config.hnsw, dimension: this.dimension };

    // Initialize database schema
    this.initializeDatabase();
  }

  // ============================================================
  // Database Operations
  // ============================================================

  /**
   * Initialize SQLite database with schema
   */
  private initializeDatabase(): void {
    // This will be implemented with better-sqlite3
    // For now, we prepare the schema definition
    const schema = `
      CREATE TABLE IF NOT EXISTS vector_items (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        embedding BLOB,
        type TEXT DEFAULT 'chunk',
        created_at REAL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS vector_items_fts USING fts5(
        id, content, type,
        content='vector_items',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS vector_items_ai AFTER INSERT ON vector_items BEGIN
        INSERT INTO vector_items_fts(rowid, id, content, type)
        VALUES (new.rowid, new.id, new.content, new.type);
      END;

      CREATE TRIGGER IF NOT EXISTS vector_items_ad AFTER DELETE ON vector_items BEGIN
        INSERT INTO vector_items_fts(vector_items_fts, rowid, id, content, type)
        VALUES ('delete', old.rowid, old.id, old.content, old.type);
      END;

      CREATE TRIGGER IF NOT EXISTS vector_items_au AFTER UPDATE ON vector_items BEGIN
        INSERT INTO vector_items_fts(vector_items_fts, rowid, id, content, type)
        VALUES ('delete', old.rowid, old.id, old.content, old.type);
        INSERT INTO vector_items_fts(rowid, id, content, type)
        VALUES (new.rowid, new.id, new.content, new.type);
      END;
    `;

    // Schema will be executed when database is initialized
    // This is a placeholder for better-sqlite3 integration
  }

  /**
   * Get database connection (lazy initialization)
   * Note: Will be implemented with better-sqlite3
   */
  private getDatabase(): unknown {
    if (!this.db) {
      // Database initialization will happen here
      // For now, return null as placeholder
      throw new DatabaseError('Database not initialized. better-sqlite3 integration required.');
    }
    return this.db;
  }

  // ============================================================
  // SearchInterface Implementation
  // ============================================================

  /**
   * Execute vector search
   */
  async search(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
      minScore?: number;
    }
  ): Promise<Record<string, unknown>[]> {
    const results = await this.vectorSearch(query, options);
    return results.map(r => this.searchResultToRecord(r));
  }

  /**
   * Index document with embedding
   */
  async index(
    id: string,
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      type?: string;
    }
  ): Promise<void> {
    await this.add(id, content, options?.metadata, options?.type);
  }

  /**
   * Delete document by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.deleteById(id);
  }

  // ============================================================
  // Vector Operations
  // ============================================================

  /**
   * Add item to vector index
   */
  async add(
    id: string,
    content: string,
    metadata?: Record<string, unknown>,
    type: string = 'chunk',
    embedding?: number[]
  ): Promise<void> {
    try {
      // Generate embedding if not provided
      const vector = embedding ?? (await this.embeddingService.embed(content));
      const vectorBuffer = this.vectorToBuffer(vector);

      const now = Date.now();
      const metadataJson = JSON.stringify(metadata ?? {});

      // Database insertion will be implemented with better-sqlite3
      // Placeholder for now
      throw new DatabaseError('Database operations require better-sqlite3 integration');
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new DatabaseError(`Failed to add item ${id}`, error as Error);
    }
  }

  /**
   * Vector search with optional filters
   */
  async vectorSearch(
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
      typeFilter?: string;
    }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const minScore = options?.minScore ?? 0.0;
    const typeFilter = options?.typeFilter;

    try {
      // Generate query embedding
      const queryVector = await this.embeddingService.embed(query);

      // Perform vector search
      // Will be implemented with better-sqlite3
      throw new DatabaseError('Vector search requires better-sqlite3 integration');
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new EmbeddingError('Failed to generate query embedding', error as Error);
    }
  }

  /**
   * Delete item by ID
   */
  private async deleteById(id: string): Promise<boolean> {
    try {
      // Database deletion will be implemented with better-sqlite3
      throw new DatabaseError('Database operations require better-sqlite3 integration');
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete item ${id}`, error as Error);
    }
  }

  // ============================================================
  // Hybrid Search
  // ============================================================

  /**
   * Hybrid search combining vector and keyword search with RRF
   */
  async hybridSearch(
    query: string,
    options?: {
      topK?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      minScore?: number;
      typeFilter?: string;
      rrfK?: number;
    }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const vectorWeight = options?.vectorWeight ?? 0.7;
    const keywordWeight = options?.keywordWeight ?? 0.3;
    const minScore = options?.minScore ?? 0.0;
    const typeFilter = options?.typeFilter;
    const rrfK = options?.rrfK ?? 60;

    try {
      // Perform both searches in parallel
      const [vectorResults, keywordResults] = await Promise.all([
        this.vectorSearch(query, { topK: topK * 2, minScore, typeFilter }),
        this.keywordSearch(query, { topK: topK * 2, typeFilter }),
      ]);

      // Apply RRF fusion
      return this.reciprocalRankFusion(
        vectorResults,
        keywordResults,
        vectorWeight,
        keywordWeight,
        rrfK,
        topK
      );
    } catch (error) {
      // Fallback to vector search only if keyword search fails
      console.warn('Hybrid search failed, falling back to vector search:', error);
      return this.vectorSearch(query, { topK, minScore, typeFilter });
    }
  }

  /**
   * Keyword search using FTS5
   */
  async keywordSearch(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
    }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const typeFilter = options?.typeFilter;

    try {
      // FTS5 search will be implemented with better-sqlite3
      throw new DatabaseError('Keyword search requires better-sqlite3 integration');
    } catch (error) {
      // Fallback to LIKE search
      console.warn('FTS5 search failed, using LIKE fallback:', error);
      return this.likeSearch(query, { topK, typeFilter });
    }
  }

  /**
   * Fallback LIKE-based keyword search
   */
  private async likeSearch(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
    }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const typeFilter = options?.typeFilter;

    // LIKE search will be implemented with better-sqlite3
    throw new DatabaseError('LIKE search requires better-sqlite3 integration');
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new VectorSearchError('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0.0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Convert vector to Buffer for storage
   */
  private vectorToBuffer(vector: number[]): Buffer {
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }
    return buffer;
  }

  /**
   * Convert Buffer to vector
   */
  private bufferToVector(buffer: Buffer): number[] {
    const vector: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      vector.push(buffer.readFloatLE(i));
    }
    return vector;
  }

  /**
   * Reciprocal Rank Fusion for hybrid search
   */
  private reciprocalRankFusion(
    vectorResults: SmartSearchResult[],
    keywordResults: SmartSearchResult[],
    vectorWeight: number,
    keywordWeight: number,
    rrfK: number,
    topK: number
  ): SmartSearchResult[] {
    const scores = new Map<string, { result: SmartSearchResult; score: number }>();

    // Score vector results
    vectorResults.forEach((result, index) => {
      const rrfScore = vectorWeight / (rrfK + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });

    // Score keyword results
    keywordResults.forEach((result, index) => {
      const rrfScore = keywordWeight / (rrfK + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });

    // Sort by fused score
    const sorted = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // Update scores and sources
    return sorted.map(item => ({
      ...item.result,
      score: item.score,
      source: 'hybrid',
      mode_used: 'hybrid',
    }));
  }

  /**
   * Build normalized search result
   */
  private buildSearchResult(
    id: string,
    content: string,
    score: number,
    type: string,
    source: string,
    metadata?: Record<string, unknown>,
    loc?: SearchResultLocation
  ): SmartSearchResult {
    return {
      id,
      content,
      score: Math.round(score * 10000) / 10000, // Round to 4 decimals
      type,
      metadata: this.buildMetadata(metadata),
      source,
      mode_used: source,
      loc,
      snapshot_query: SAMPLE_SEARCH_QUERY,
    };
  }

  /**
   * Build normalized metadata
   */
  private buildMetadata(metadata?: Record<string, unknown>): SearchResultMetadata {
    const meta = metadata ?? {};
    return {
      path: (meta.path as string) ?? undefined,
      doc_id: (meta.doc_id as string) ?? undefined,
      surface: (meta.surface as string) ?? undefined,
      loc: this.normalizeLoc(meta.loc as Record<string, unknown> | undefined),
      chunk_index: (meta.chunk_index as number) ?? undefined,
      extra: (meta.extra as Record<string, unknown>) ?? {},
    };
  }

  /**
   * Normalize location
   */
  private normalizeLoc(loc?: Record<string, unknown>): SearchResultLocation | undefined {
    if (!loc) return undefined;

    const kind = (loc.kind as string) ?? 'char';
    const start = Number(loc.start) ?? 0;
    const end = loc.end != null ? Number(loc.end) : undefined;

    return {
      kind: kind as 'line' | 'char' | 'range',
      start,
      end,
    };
  }

  /**
   * Convert SmartSearchResult to Record for SearchInterface
   */
  private searchResultToRecord(result: SmartSearchResult): Record<string, unknown> {
    return {
      id: result.id,
      content: result.content,
      score: result.score,
      type: result.type,
      source: result.source,
      mode_used: result.mode_used,
      metadata: result.metadata,
      loc: result.loc,
      snapshot_query: result.snapshot_query,
    };
  }

  // ============================================================
  // Statistics and Management
  // ============================================================

  /**
   * Get index statistics
   */
  async getStats(): Promise<{
    totalItems: number;
    byType: Record<string, number>;
    dimension: number;
    dbPath: string;
  }> {
    // Will be implemented with better-sqlite3
    throw new DatabaseError('Statistics require better-sqlite3 integration');
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      // Database cleanup will be implemented with better-sqlite3
      this.db = null;
    }
  }
}

// ============================================================
// Factory Functions
// ============================================================

/**
 * Create VectorSearch instance with configuration
 */
export function createVectorSearch(
  dbPath: string,
  embeddingService: EmbeddingService,
  options?: {
    dimension?: number;
    modelName?: string;
  }
): VectorSearch {
  return new VectorSearch({
    dbPath,
    embeddingService,
    dimension: options?.dimension,
    modelName: options?.modelName,
  });
}

/**
 * VectorSearch - SQLite-based Vector Search with Hybrid Support
 *
 * TypeScript implementation migrated from src/search/vector_search.py.
 *
 * Features:
 * - Vector storage and search using SQLite (better-sqlite3)
 * - Cosine similarity for vector search
 * - FTS5 full-text search for keyword matching
 * - Hybrid search with RRF (Reciprocal Rank Fusion)
 * - Integration with EmbeddingService
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import type { SearchInterface } from '../protocols/search';
import type { EmbeddingService } from '../protocols/embedding';
import type { SmartSearchResult, SearchResultMetadata, SearchResultLocation } from './smart-search';

export interface HNSWConfig {
  dimension: number;
  efConstruction: number;
  efSearch: number;
  m: number;
}

export interface VectorSearchConfig {
  dbPath: string;
  dimension?: number;
  modelName?: string;
  embeddingService: EmbeddingService;
  hnsw?: Partial<HNSWConfig>;
}

interface VectorItemRow {
  id: string;
  content: string;
  metadata: string;
  embedding: Buffer | null;
  type: string;
  created_at: number;
}

interface CountRow {
  count: number;
}

interface TypeCountRow {
  type: string;
  count: number;
}

interface FtsRow {
  id: string;
  content: string;
  metadata: string;
  type: string;
  rank: number;
}

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

const DEFAULT_HNSW_CONFIG: HNSWConfig = {
  dimension: 384,
  efConstruction: 200,
  efSearch: 100,
  m: 16,
};

const DEFAULT_MODEL_NAME = 'BAAI/bge-small-en-v1.5';
const SAMPLE_SEARCH_QUERY = 'search_result_sample_query';

export class VectorSearch implements SearchInterface {
  private readonly dbPath: string;
  private readonly dimension: number;
  private readonly modelName: string;
  private readonly embeddingService: EmbeddingService;
  private readonly hnswConfig: HNSWConfig;
  private db: Database.Database | null = null;

  constructor(config: VectorSearchConfig) {
    this.dbPath = config.dbPath;
    this.dimension = config.dimension ?? 384;
    this.modelName = config.modelName ?? DEFAULT_MODEL_NAME;
    this.embeddingService = config.embeddingService;
    this.hnswConfig = { ...DEFAULT_HNSW_CONFIG, ...config.hnsw, dimension: this.dimension };

    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    const db = this.getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS vector_items (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        embedding BLOB NOT NULL,
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

      CREATE INDEX IF NOT EXISTS idx_vector_items_type ON vector_items(type);
      CREATE INDEX IF NOT EXISTS idx_vector_items_created_at ON vector_items(created_at);
    `);
  }

  private getDatabase(): Database.Database {
    if (!this.db) {
      if (this.dbPath !== ':memory:') {
        mkdirSync(dirname(this.dbPath), { recursive: true });
      }
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
    }
    return this.db;
  }

  async search(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
      minScore?: number;
    }
  ): Promise<Record<string, unknown>[]> {
    const results = await this.vectorSearch(query, options);
    return results.map((result) => this.searchResultToRecord(result));
  }

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

  async delete(id: string): Promise<boolean> {
    return this.deleteById(id);
  }

  async add(
    id: string,
    content: string,
    metadata?: Record<string, unknown>,
    type: string = 'chunk',
    embedding?: number[]
  ): Promise<void> {
    try {
      const vector = embedding ?? (await this.embeddingService.embed(content, { model: this.modelName }));
      this.assertVectorDimensions(vector);
      const vectorBuffer = this.vectorToBuffer(vector);
      const now = Date.now();
      const metadataJson = JSON.stringify(metadata ?? {});

      const db = this.getDatabase();
      db.prepare(`
        INSERT INTO vector_items (id, content, metadata, embedding, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          metadata = excluded.metadata,
          embedding = excluded.embedding,
          type = excluded.type,
          created_at = excluded.created_at
      `).run(id, content, metadataJson, vectorBuffer, type, now);
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new DatabaseError(`Failed to add item ${id}`, error as Error);
    }
  }

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
      const queryVector = await this.embeddingService.embed(query, { model: this.modelName });
      this.assertVectorDimensions(queryVector);

      const db = this.getDatabase();
      const rows = this.queryRows(db, typeFilter);
      const ranked = rows
        .map((row) => {
          const embeddingBuffer = row.embedding;
          if (!embeddingBuffer) return null;
          const score = this.cosineSimilarity(queryVector, this.bufferToVector(embeddingBuffer));
          if (score < minScore) return null;
          const parsedMetadata = this.parseMetadata(row.metadata);
          return this.buildSearchResult(
            row.id,
            row.content,
            score,
            row.type,
            'vector',
            parsedMetadata,
            this.normalizeLoc(parsedMetadata.loc as Record<string, unknown> | undefined)
          );
        })
        .filter((row): row is SmartSearchResult => row !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return ranked;
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new EmbeddingError('Failed to generate query embedding', error as Error);
    }
  }

  private async deleteById(id: string): Promise<boolean> {
    try {
      const db = this.getDatabase();
      const result = db.prepare('DELETE FROM vector_items WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      if (error instanceof VectorSearchError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete item ${id}`, error as Error);
    }
  }

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
      const [vectorResults, keywordResults] = await Promise.all([
        this.vectorSearch(query, { topK: topK * 2, minScore, typeFilter }),
        this.keywordSearch(query, { topK: topK * 2, typeFilter }),
      ]);

      return this.reciprocalRankFusion(
        vectorResults,
        keywordResults,
        vectorWeight,
        keywordWeight,
        rrfK,
        topK
      );
    } catch (error) {
      console.warn('Hybrid search failed, falling back to vector search:', error);
      return this.vectorSearch(query, { topK, minScore, typeFilter });
    }
  }

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
      const db = this.getDatabase();
      const filters = this.buildTypeFilterSql(typeFilter);
      const rows = db.prepare(`
        SELECT v.id, v.content, v.metadata, v.type, bm25(vector_items_fts) AS rank
        FROM vector_items_fts
        JOIN vector_items v ON v.rowid = vector_items_fts.rowid
        WHERE vector_items_fts MATCH ?
        ${filters.clause}
        ORDER BY rank
        LIMIT ?
      `).all(query, ...filters.params, topK) as FtsRow[];

      return rows.map((row) => {
        const parsedMetadata = this.parseMetadata(row.metadata);
        const bm25Score = Math.abs(Number(row.rank ?? 0));
        const normalizedScore = 1.0 / (1.0 + bm25Score);
        return this.buildSearchResult(
          row.id,
          row.content,
          normalizedScore,
          row.type,
          'fuzzy',
          parsedMetadata,
          this.normalizeLoc(parsedMetadata.loc as Record<string, unknown> | undefined)
        );
      });
    } catch (error) {
      console.warn('FTS5 search failed, using LIKE fallback:', error);
      return this.likeSearch(query, { topK, typeFilter });
    }
  }

  private async likeSearch(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
    }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 5;
    const typeFilter = options?.typeFilter;
    const db = this.getDatabase();
    const filters = this.buildTypeFilterSql(typeFilter);
    const rows = db.prepare(`
      SELECT id, content, metadata, type, created_at
      FROM vector_items
      WHERE LOWER(content) LIKE LOWER(?)
      ${filters.clause}
      ORDER BY created_at DESC
      LIMIT ?
    `).all(`%${query}%`, ...filters.params, topK) as VectorItemRow[];

    const loweredQuery = query.toLowerCase();
    return rows.map((row, index) => {
      const parsedMetadata = this.parseMetadata(row.metadata);
      const loweredContent = row.content.toLowerCase();
      const exactIndex = loweredContent.indexOf(loweredQuery);
      const score = exactIndex >= 0
        ? Math.max(0.1, 1 - exactIndex / Math.max(loweredContent.length, 1))
        : Math.max(0.01, 1 / (index + 2));

      return this.buildSearchResult(
        row.id,
        row.content,
        score,
        row.type,
        'fuzzy',
        parsedMetadata,
        this.normalizeLoc(parsedMetadata.loc as Record<string, unknown> | undefined)
      );
    });
  }

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

  private vectorToBuffer(vector: number[]): Buffer {
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }
    return buffer;
  }

  private bufferToVector(buffer: Buffer): number[] {
    const vector: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      vector.push(buffer.readFloatLE(i));
    }
    return vector;
  }

  private reciprocalRankFusion(
    vectorResults: SmartSearchResult[],
    keywordResults: SmartSearchResult[],
    vectorWeight: number,
    keywordWeight: number,
    rrfK: number,
    topK: number
  ): SmartSearchResult[] {
    const scores = new Map<string, { result: SmartSearchResult; score: number }>();

    vectorResults.forEach((result, index) => {
      const rrfScore = vectorWeight / (rrfK + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });

    keywordResults.forEach((result, index) => {
      const rrfScore = keywordWeight / (rrfK + index + 1);
      const existing = scores.get(result.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(result.id, { result, score: rrfScore });
      }
    });

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        ...item.result,
        score: item.score,
        source: 'hybrid',
        mode_used: 'hybrid',
      }));
  }

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
      score: Math.round(score * 10000) / 10000,
      type,
      metadata: this.buildMetadata(metadata),
      source,
      mode_used: source,
      loc,
      snapshot_query: SAMPLE_SEARCH_QUERY,
    };
  }

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

  async getStats(): Promise<{
    totalItems: number;
    byType: Record<string, number>;
    dimension: number;
    dbPath: string;
  }> {
    try {
      const db = this.getDatabase();
      const totalItems = (db.prepare('SELECT COUNT(*) as count FROM vector_items').get() as CountRow).count;
      const byTypeRows = db.prepare(`
        SELECT type, COUNT(*) as count
        FROM vector_items
        GROUP BY type
      `).all() as TypeCountRow[];

      return {
        totalItems,
        byType: Object.fromEntries(byTypeRows.map((row) => [row.type, row.count])),
        dimension: this.dimension,
        dbPath: this.dbPath,
      };
    } catch (error) {
      throw new DatabaseError('Failed to collect vector search statistics', error as Error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private assertVectorDimensions(vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new VectorSearchError(`Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`);
    }
  }

  private parseMetadata(metadata: string): Record<string, unknown> {
    try {
      return JSON.parse(metadata || '{}') as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private buildTypeFilterSql(typeFilter?: string): { clause: string; params: unknown[] } {
    if (!typeFilter) {
      return { clause: '', params: [] };
    }

    return {
      clause: 'AND type = ?',
      params: [typeFilter],
    };
  }

  private queryRows(db: Database.Database, typeFilter?: string): VectorItemRow[] {
    const filters = this.buildTypeFilterSql(typeFilter);
    return db.prepare(`
      SELECT id, content, metadata, embedding, type, created_at
      FROM vector_items
      ${filters.clause ? `WHERE ${filters.clause.slice(4)}` : ''}
    `).all(...filters.params) as VectorItemRow[];
  }
}

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

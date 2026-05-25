/**
 * IndexingService - Semantic Search Service
 *
 * Migrated from src/services/indexing_service.py.
 *
 * Uses FastEmbed for embeddings and SQLite for vector storage (as BLOBs).
 * Architecture inspired by Claude Code Workflow's CodexLens.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

import { createLogger } from "../logger/index.js";
const _log = createLogger("svc-indexing");

/**
 * Search result from the indexing service
 */
export interface IndexSearchResult {
  id: string;
  content: string;
  source_type: string;
  score: number;
}

/**
 * Embedder interface for generating text embeddings
 */
export interface Embedder {
  embed(texts: string[]): number[][];
  embeddingSize?: number;
}

/**
 * IndexingService - Semantic Search based on vector embeddings and SQLite storage.
 */
export class IndexingService {
  private readonly dbPath: string;
  private readonly modelName: string;
  private _embedder: Embedder | null = null;
  private _db: Database.Database | null = null;

  constructor(dbPath: string, modelName: string = 'BAAI/bge-small-zh-v1.5') {
    this.dbPath = dbPath;
    this.modelName = modelName;
    this._initDb();
  }

  /**
   * Initialize SQLite database with vector storage schema.
   */
  private _initDb(): void {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const db = this._getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        source_type TEXT,
        content TEXT,
        embedding BLOB,
        created_at REAL
      )
    `);
  }

  /**
   * Get or create database connection
   */
  private _getDb(): Database.Database {
    if (this._db === null) {
      this._db = new Database(this.dbPath);
    }
    return this._db;
  }

  /**
   * Set the embedder instance (dependency injection)
   */
  setEmbedder(embedder: Embedder): void {
    this._embedder = embedder;
  }

  /**
   * Get the embedder (lazy-load pattern)
   */
  get embedder(): Embedder {
    if (this._embedder === null) {
      throw new Error('Embedder not configured. Call setEmbedder() first.');
    }
    return this._embedder;
  }

  /**
   * Convert a Float32Array to a Buffer for BLOB storage
   */
  private _float32ArrayToBuffer(values: number[]): Buffer {
    const float32 = new Float32Array(values);
    return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
  }

  /**
   * Convert a BLOB back to a number array
   */
  private _bufferToFloat32Array(buffer: Buffer): number[] {
    const float32 = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    return Array.from(float32);
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private _cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
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
      return 0;
    }
    return dotProduct / (normA * normB);
  }

  /**
   * Embed and store a document chunk.
   *
   * @param docId - Unique identifier for the chunk
   * @param content - The text content to embed
   * @param sourceType - Category of the document (e.g., 'scene', 'character', 'plot')
   */
  addDocument(docId: string, content: string, sourceType: string = 'general'): void {
    const startTime = Date.now();

    // Generate embedding
    const embeddingVectors = this.embedder.embed([content]);
    const embeddingVector = embeddingVectors[0];

    // Convert to buffer for storage
    const embeddingBytes = this._float32ArrayToBuffer(embeddingVector);

    // Store in DB
    const db = this._getDb();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO document_chunks (id, source_id, source_type, content, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(docId, docId, sourceType, content, embeddingBytes, Date.now() / 1000);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(4);
    _log.info(`Indexed document ${docId} in ${elapsed}s`);
  }

  /**
   * Perform semantic search using cosine similarity.
   *
   * @param query - The search text
   * @param topK - Number of results to return
   * @param minScore - Minimum similarity threshold (0-1)
   * @returns List of matches with content and score
   */
  search(query: string, topK: number = 5, minScore: number = 0.5): IndexSearchResult[] {
    if (!existsSync(this.dbPath)) {
      return [];
    }

    // Embed query
    const queryVectors = this.embedder.embed([query]);
    const queryVector = queryVectors[0];

    // Retrieve candidates and compute similarity
    const db = this._getDb();
    const rows = db.prepare(
      'SELECT id, content, source_type, embedding FROM document_chunks WHERE embedding IS NOT NULL'
    ).all() as Array<{ id: string; content: string; source_type: string; embedding: Buffer }>;

    const matches: IndexSearchResult[] = [];
    for (const row of rows) {
      const embArray = this._bufferToFloat32Array(row.embedding);
      const score = this._cosineSimilarity(queryVector, embArray);

      if (score >= minScore) {
        matches.push({
          id: row.id,
          content: row.content,
          source_type: row.source_type,
          score: Math.round(score * 10000) / 10000,
        });
      }
    }

    // Sort by score descending and limit
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

/**
 * MemoryService - Vector memory service
 *
 * Migrated from src/services/memory_service.py.
 * Provides CRUD operations and hybrid search (vector + keyword + RRF fusion).
 */

import Database from 'better-sqlite3';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_EMBEDDING_MODEL = 'BAAI/bge-small-zh-v1.5';
const DEFAULT_MIN_SCORE = 0.3;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface Message {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  timestamp?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface AddOptions {
  namespace: string;
  tags?: string[] | null;
  importance: number;
  ttl?: number | null;
}

export interface SearchOptions {
  namespace: string;
  limit: number;
  threshold: number;
  includeMetadata: boolean;
  timeRange?: [Date, Date] | null;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  source: string;
  chunkIndex?: number | null;
}

export interface Memory {
  id: string;
  content: string;
  embedding?: number[] | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// SimpleEmbedder (fallback)
// ---------------------------------------------------------------------------

export class SimpleEmbedder implements Embedder {
  private readonly _dim: number;

  constructor(dim = 384) {
    this._dim = dim;
  }

  async embed(text: string): Promise<number[]> {
    const hashBytes = createHash('sha256').update(text).digest();
    const embedding: number[] = [];
    for (let i = 0; i < this._dim; i++) {
      embedding.push((hashBytes[i % hashBytes.length] - 128) / 128.0);
    }
    return embedding;
  }

  similarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
    const dot = vecA.reduce((s, a, i) => s + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((s, a) => s + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((s, b) => s + b * b, 0));
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }
}

// ---------------------------------------------------------------------------
// MemoryService
// ---------------------------------------------------------------------------

export class MemoryService {
  private readonly _dbPath: string;
  private _db: Database.Database | null = null;
  private _embedderInstance: Embedder | null = null;
  private readonly _externalEmbedder: Embedder | null;

  constructor(
    dbPath?: string,
    embeddingService?: Embedder | null,
    _vectorSearch?: unknown,
    _config?: unknown,
  ) {
    this._dbPath = resolve(dbPath ?? '.writing/memory_service.db');
    mkdirSync(join(this._dbPath, '..'), { recursive: true });
    this._externalEmbedder = embeddingService ?? null;
    this._initDb();
  }

  // -----------------------------------------------------------------
  // Embedder lazy init
  // -----------------------------------------------------------------

  private _getEmbedder(): Embedder {
    if (!this._embedderInstance) {
      this._embedderInstance = this._externalEmbedder ?? new SimpleEmbedder();
    }
    return this._embedderInstance;
  }

  private async _embedText(text: string): Promise<number[]> {
    const embedder = this._getEmbedder();
    if (embedder.embedBatch) {
      const embeddings = await embedder.embedBatch([text]);
      return embeddings[0];
    }
    return embedder.embed(text);
  }

  // -----------------------------------------------------------------
  // IMemoryService interface
  // -----------------------------------------------------------------

  async add(messages: Message[], options: AddOptions): Promise<string> {
    const contentParts = messages.map((msg) => {
      const prefix = msg.role ? `[${msg.role}]` : '';
      return `${prefix} ${msg.content}`;
    });
    const content = contentParts.join('\n');

    const embedding = await this._embedText(content);
    const memoryId = randomUUID();
    const now = new Date();

    let expiresAt: string | null = null;
    if (options.ttl) {
      expiresAt = new Date(now.getTime() + options.ttl * 1000).toISOString();
    }

    const metadata: Record<string, unknown> = {
      messageCount: messages.length,
      roles: [...new Set(messages.map((m) => m.role))],
      firstTimestamp: messages[0]?.timestamp?.toISOString() ?? null,
      lastTimestamp: messages[messages.length - 1]?.timestamp?.toISOString() ?? null,
    };

    for (const msg of messages) {
      if (msg.metadata) {
        Object.assign(metadata, msg.metadata);
      }
    }

    const db = this._getDb();
    db.prepare(`
      INSERT INTO memories (
        id, content, embedding, namespace, importance, tags,
        ttl, expires_at, metadata, created_at, updated_at,
        embedding_blob, embedding_model, embedding_dim, content_hash, last_accessed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      memoryId,
      content,
      JSON.stringify(embedding),
      options.namespace,
      options.importance,
      JSON.stringify(options.tags ?? []),
      options.ttl ?? null,
      expiresAt,
      JSON.stringify(metadata),
      now.toISOString(),
      now.toISOString(),
      packEmbedding(embedding),
      DEFAULT_EMBEDDING_MODEL,
      embedding.length,
      createHash('sha256').update(content).digest('hex'),
      now.toISOString(),
    );

    return memoryId;
  }

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const queryEmbedding = await this._embedText(query);
    this._cleanupExpired();

    const db = this._getDb();

    let sql = `
      SELECT id, content, embedding, embedding_blob, namespace, importance, tags, metadata, created_at, expires_at, last_accessed_at
      FROM memories
      WHERE namespace = ?
      AND (expires_at IS NULL OR expires_at > ?)
    `;
    const params: unknown[] = [options.namespace, new Date().toISOString()];

    if (options.timeRange) {
      sql += ' AND created_at >= ? AND created_at <= ?';
      params.push(options.timeRange[0].toISOString(), options.timeRange[1].toISOString());
    }

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    const threshold = options.threshold ?? DEFAULT_MIN_SCORE;
    const nowIso = new Date().toISOString();
    const queryNorm = Math.sqrt(queryEmbedding.reduce((s, v) => s + v * v, 0));

    const updateStmt = db.prepare(
      'UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?',
    );

    const results: SearchResult[] = [];

    for (const row of rows) {
      let embedding: number[] = [];
      if (row.embedding_blob instanceof Buffer) {
        embedding = unpackEmbedding(row.embedding_blob);
      } else if (row.embedding) {
        try { embedding = JSON.parse(row.embedding as string); } catch { /* empty */ }
      }

      const embeddingNorm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
      const score = cosineSimilarityWithNorms(queryEmbedding, embedding, queryNorm, embeddingNorm);

      if (score >= threshold) {
        const rowMetadata: Record<string, unknown> = JSON.parse((row.metadata as string) || '{}');
        rowMetadata['created_at'] ??= row.created_at;
        rowMetadata['expires_at'] ??= row.expires_at;
        rowMetadata['last_accessed_at'] ??= row.last_accessed_at;

        if (options.includeMetadata) {
          rowMetadata['importance'] = row.importance;
          try { rowMetadata['tags'] = JSON.parse((row.tags as string) || '[]'); } catch { /* empty */ }
        }

        updateStmt.run(nowIso, nowIso, row.id);

        results.push({
          id: row.id as string,
          content: row.content as string,
          score: Math.round(score * 10_000) / 10_000,
          metadata: rowMetadata,
          source: `memory:${options.namespace}`,
          chunkIndex: null,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.limit);
  }

  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const opts = options ?? {
      namespace: 'default',
      limit: 10,
      threshold: 0.7,
      includeMetadata: true,
    };

    // 1. Vector search with relaxed threshold
    const vectorResults = await this.search(query, {
      namespace: opts.namespace,
      limit: opts.limit * 2,
      threshold: opts.threshold * 0.8,
      includeMetadata: opts.includeMetadata,
    });

    // 2. Keyword search
    const keywordResults = await this._keywordSearch(query, opts);

    // 3. RRF fusion
    const fusedResults = rrfFusion([vectorResults, keywordResults], 60);
    return fusedResults.slice(0, opts.limit);
  }

  async addHistory(sessionId: string, messages: Message[]): Promise<void> {
    const db = this._getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO session_history (session_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)',
    );

    for (const msg of messages) {
      const timestamp = msg.timestamp?.toISOString() ?? now;
      stmt.run(sessionId, msg.role, msg.content, timestamp, JSON.stringify(msg.metadata ?? {}));
    }
  }

  async getHistory(sessionId: string, limit = 50, before?: Date): Promise<Message[]> {
    let sql = 'SELECT role, content, timestamp, metadata FROM session_history WHERE session_id = ?';
    const params: unknown[] = [sessionId];

    if (before) {
      sql += ' AND timestamp < ?';
      params.push(before.toISOString());
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const db = this._getDb();
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

    return rows.reverse().map((row) => ({
      role: row.role as string,
      content: row.content as string,
      timestamp: row.timestamp ? new Date(row.timestamp as string) : null,
      metadata: (() => { try { return JSON.parse((row.metadata as string) || 'null'); } catch { return null; } })(),
    }));
  }

  async get(memoryId: string): Promise<Memory | null> {
    const db = this._getDb();
    const row = db.prepare(
      'SELECT id, content, embedding, embedding_blob, metadata, created_at, updated_at FROM memories WHERE id = ?',
    ).get(memoryId) as Record<string, unknown> | undefined;

    if (!row) return null;

    let embedding: number[] = [];
    if (row.embedding_blob instanceof Buffer) {
      embedding = unpackEmbedding(row.embedding_blob);
    } else if (row.embedding) {
      try { embedding = JSON.parse(row.embedding as string); } catch { /* empty */ }
    }

    return {
      id: row.id as string,
      content: row.content as string,
      embedding: embedding.length > 0 ? embedding : null,
      metadata: (() => { try { return JSON.parse((row.metadata as string) || 'null'); } catch { return null; } })(),
      createdAt: row.created_at ? new Date(row.created_at as string) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
    };
  }

  async delete(memoryId: string): Promise<boolean> {
    const db = this._getDb();
    const result = db.prepare('DELETE FROM memories WHERE id = ?').run(memoryId);
    return result.changes > 0;
  }

  async update(
    memoryId: string,
    content?: string,
    metadata?: Record<string, unknown>,
    importance?: number,
    tags?: string[],
  ): Promise<boolean> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (content !== undefined) {
      const embedding = await this._embedText(content);
      updates.push('content = ?');
      params.push(content);
      updates.push('embedding = ?');
      params.push(JSON.stringify(embedding));
      updates.push('embedding_blob = ?');
      params.push(packEmbedding(embedding));
      updates.push('embedding_model = ?');
      params.push(DEFAULT_EMBEDDING_MODEL);
      updates.push('embedding_dim = ?');
      params.push(embedding.length);
      updates.push('content_hash = ?');
      params.push(createHash('sha256').update(content).digest('hex'));
    }

    if (metadata !== undefined) {
      updates.push('metadata = ?');
      params.push(JSON.stringify(metadata));
    }

    if (importance !== undefined) {
      updates.push('importance = ?');
      params.push(importance);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) return false;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(memoryId);

    const db = this._getDb();
    const result = db.prepare(`UPDATE memories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return result.changes > 0;
  }

  async listNamespaces(): Promise<string[]> {
    const db = this._getDb();
    const rows = db.prepare('SELECT DISTINCT namespace FROM memories').all() as Array<{ namespace: string }>;
    return rows.map((r) => r.namespace);
  }

  async count(namespace?: string): Promise<number> {
    const db = this._getDb();
    if (namespace) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM memories WHERE namespace = ?').get(namespace) as { cnt: number };
      return row.cnt;
    }
    const row = db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number };
    return row.cnt;
  }

  // -----------------------------------------------------------------
  // Retrieval profile & cache
  // -----------------------------------------------------------------

  getRetrievalProfile(profileName: string): Record<string, unknown> | null {
    const db = this._getDb();
    const row = db.prepare(
      'SELECT profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at FROM retrieval_profiles WHERE profile_name = ?',
    ).get(profileName) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      profileName: row.profile_name,
      sourceWeights: (() => { try { return JSON.parse((row.source_weights_json as string) || '{}'); } catch { return {}; } })(),
      thresholds: (() => { try { return JSON.parse((row.thresholds_json as string) || '{}'); } catch { return {}; } })(),
      budget: (() => { try { return JSON.parse((row.budget_json as string) || '{}'); } catch { return {}; } })(),
      enabled: !!row.enabled,
      updatedAt: row.updated_at,
    };
  }

  upsertRetrievalProfile(
    profileName: string,
    sourceWeights: Record<string, unknown>,
    thresholds: Record<string, unknown>,
    budget: Record<string, unknown>,
    enabled = true,
  ): void {
    const db = this._getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO retrieval_profiles (profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_name) DO UPDATE SET
        source_weights_json = excluded.source_weights_json,
        thresholds_json = excluded.thresholds_json,
        budget_json = excluded.budget_json,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(
      profileName,
      JSON.stringify(sourceWeights ?? {}),
      JSON.stringify(thresholds ?? {}),
      JSON.stringify(budget ?? {}),
      enabled ? 1 : 0,
      now,
    );
  }

  cachePack(cacheKey: string, payload: Record<string, unknown>, ttlSeconds = 300, status = 'ready'): void {
    const db = this._getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Math.max(ttlSeconds, 1) * 1000).toISOString();
    db.prepare(`
      INSERT INTO retrieval_cache (cache_key, payload_json, status, created_at, expires_at, hit_count)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json = excluded.payload_json,
        status = excluded.status,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at
    `).run(cacheKey, JSON.stringify(payload), status, now.toISOString(), expiresAt);
  }

  cacheRead(cacheKey: string): Record<string, unknown> | null {
    const db = this._getDb();
    const row = db.prepare(
      'SELECT payload_json, status, expires_at, hit_count FROM retrieval_cache WHERE cache_key = ?',
    ).get(cacheKey) as Record<string, unknown> | undefined;

    if (!row) return null;

    if (row.expires_at && (row.expires_at as string) <= new Date().toISOString()) {
      this.cacheRelease(cacheKey);
      return null;
    }

    db.prepare('UPDATE retrieval_cache SET hit_count = hit_count + 1 WHERE cache_key = ?').run(cacheKey);

    return {
      payload: (() => { try { return JSON.parse((row.payload_json as string) || '{}'); } catch { return {}; } })(),
      status: row.status,
      expiresAt: row.expires_at,
      hitCount: Number(row.hit_count) + 1,
    };
  }

  cacheStatus(cacheKey: string): string | null {
    const db = this._getDb();
    const row = db.prepare('SELECT status FROM retrieval_cache WHERE cache_key = ?').get(cacheKey) as { status: string } | undefined;
    return row?.status ?? null;
  }

  cacheRelease(cacheKey: string): void {
    const db = this._getDb();
    db.prepare('DELETE FROM retrieval_cache WHERE cache_key = ?').run(cacheKey);
  }

  cacheCleanup(): number {
    const db = this._getDb();
    const result = db.prepare('DELETE FROM retrieval_cache WHERE expires_at <= ?').run(new Date().toISOString());
    return result.changes;
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  private _getDb(): Database.Database {
    if (!this._db) {
      this._db = new Database(this._dbPath);
      this._db.pragma('journal_mode = WAL');
    }
    return this._db;
  }

  private _initDb(): void {
    const db = this._getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT,
        namespace TEXT DEFAULT 'default',
        importance REAL DEFAULT 0.5,
        tags TEXT DEFAULT '[]',
        ttl INTEGER,
        expires_at TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
      CREATE INDEX IF NOT EXISTS idx_session_history_session ON session_history(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_history_timestamp ON session_history(timestamp);
    `);

    this._ensureColumn(db, 'memories', 'embedding_blob', 'BLOB');
    this._ensureColumn(db, 'memories', 'embedding_model', 'TEXT');
    this._ensureColumn(db, 'memories', 'embedding_dim', 'INTEGER');
    this._ensureColumn(db, 'memories', 'content_hash', 'TEXT');
    this._ensureColumn(db, 'memories', 'last_accessed_at', 'TEXT');

    db.exec(`
      CREATE TABLE IF NOT EXISTS retrieval_profiles (
        profile_name TEXT PRIMARY KEY,
        source_weights_json TEXT NOT NULL,
        thresholds_json TEXT NOT NULL,
        budget_json TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS retrieval_cache (
        cache_key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        hit_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_retrieval_cache_expires ON retrieval_cache(expires_at);
    `);
  }

  private _ensureColumn(db: Database.Database, table: string, column: string, type: string): void {
    const rows = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    const columns = new Set(rows.map((r) => r.name));
    if (!columns.has(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  private _cleanupExpired(): void {
    const db = this._getDb();
    db.prepare('DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?').run(new Date().toISOString());
  }

  private async _keywordSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const keywords = extractKeywords(query);
    if (keywords.length === 0) return [];

    const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
    const params: unknown[] = [options.namespace, new Date().toISOString(), ...keywords.map((kw) => `%${kw}%`)];

    const sql = `
      SELECT id, content, embedding, embedding_blob, namespace, importance, tags, metadata, created_at, expires_at, last_accessed_at
      FROM memories
      WHERE namespace = ?
      AND (expires_at IS NULL OR expires_at > ?)
      AND (${conditions})
    `;

    const db = this._getDb();
    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    const nowIso = new Date().toISOString();
    const updateStmt = db.prepare('UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?');

    const results: SearchResult[] = [];

    for (const row of rows) {
      const contentLower = (row.content as string).toLowerCase();
      const matchCount = keywords.filter((kw) => contentLower.includes(kw.toLowerCase())).length;
      const score = matchCount / keywords.length;

      if (score > 0) {
        let rowMetadata: Record<string, unknown> = {};
        try { rowMetadata = JSON.parse((row.metadata as string) || '{}'); } catch { /* skip corrupted metadata */ }
        rowMetadata['created_at'] ??= row.created_at;
        rowMetadata['expires_at'] ??= row.expires_at;
        rowMetadata['last_accessed_at'] ??= row.last_accessed_at;

        if (options.includeMetadata) {
          rowMetadata['importance'] = row.importance;
          try { rowMetadata['tags'] = JSON.parse((row.tags as string) || '[]'); } catch { /* empty */ }
          rowMetadata['keywordMatches'] = matchCount;
        }

        updateStmt.run(nowIso, nowIso, row.id);

        results.push({
          id: row.id as string,
          content: row.content as string,
          score: Math.round(score * 10_000) / 10_000,
          metadata: rowMetadata,
          source: `keyword:${options.namespace}`,
          chunkIndex: null,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.limit * 2);
  }
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function packEmbedding(values: number[] | null): Buffer | null {
  if (!values || values.length === 0) return null;
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buf.writeFloatLE(values[i], i * 4);
  }
  return buf;
}

function unpackEmbedding(blob: Buffer | null): number[] {
  if (!blob || blob.length === 0) return [];
  const count = Math.floor(blob.length / 4);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(blob.readFloatLE(i * 4));
  }
  return result;
}

function cosineSimilarityWithNorms(
  vecA: number[],
  vecB: number[],
  normA?: number,
  normB?: number,
): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  const a = normA ?? Math.sqrt(vecA.reduce((s, v) => s + v * v, 0));
  const b = normB ?? Math.sqrt(vecB.reduce((s, v) => s + v * v, 0));
  if (a === 0 || b === 0) return 0;
  const dot = vecA.reduce((s, v, i) => s + v * vecB[i], 0);
  return dot / (a * b);
}

function extractKeywords(text: string): string[] {
  const cleaned = text.replace(/[^\w\s]/g, ' ');
  const words = cleaned.split(/\s+/);

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
  ]);

  return words
    .filter((w) => w.length >= 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 10);
}

function rrfFusion(
  resultLists: Array<SearchResult[]>,
  k = 60,
): SearchResult[] {
  const scores = new Map<string, number>();
  const resultMap = new Map<string, SearchResult>();

  for (const results of resultLists) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = 1.0 / (k + rank + 1);
      scores.set(result.id, (scores.get(result.id) ?? 0) + rrfScore);
      if (!resultMap.has(result.id)) {
        resultMap.set(result.id, result);
      }
    }
  }

  const sortedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  return sortedIds.map((id) => {
    const original = resultMap.get(id)!;
    return {
      ...original,
      score: Math.round((scores.get(id) ?? 0) * 10_000) / 10_000,
      metadata: { ...original.metadata, original_score: original.score, fusion: 'rrf' },
    };
  });
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: MemoryService | null = null;
let _engineProvider: (() => unknown) | null = null;

export function configureMemoryEngineProvider(provider: (() => unknown) | null): void {
  _engineProvider = provider;
}

export function getMemoryService(dbPath?: string, config?: unknown): MemoryService {
  if (!_instance) {
    let embedder: Embedder | undefined;
    if (_engineProvider) {
      try {
        const engine = _engineProvider() as { embedder?: Embedder } | null;
        embedder = engine?.embedder ?? undefined;
      } catch { /* fallback to default */ }
    }
    _instance = new MemoryService(dbPath, embedder, undefined, config);
  }
  return _instance;
}

export function resetMemoryService(): void {
  if (_instance) {
    _instance.close();
  }
  _instance = null;
  _engineProvider = null;
}

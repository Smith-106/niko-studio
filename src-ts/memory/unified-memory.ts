/**
 * Unified Memory Engine - Merges Mem0 4-layer + LobeHub 6-dimensional + Zep temporal
 *
 * Core features:
 * 1. Four-layer memory (vertical dimension - lifecycle)
 * 2. Six-dimensional memory (horizontal dimension - content type)
 * 3. Temporal tracking (Zep Graphiti model)
 * 4. Conflict detection and resolution
 * 5. Scope isolation
 * 6. Query embedding cache (performance optimization)
 *
 * TypeScript implementation migrated from src/memory/unified_memory.py.
 */

import BetterSqlite3 from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

import { getQueryCache } from "./query-cache";

type DatabaseType = InstanceType<typeof BetterSqlite3>;

// ============================================================
// Configuration defaults
// ============================================================

/** Configuration provider function type */
export type ConfigProvider = (key: string, defaultValue?: unknown) => unknown;

let _configProvider: ConfigProvider = (_key: string, defaultValue?: unknown) =>
  defaultValue;

/** Set the configuration provider (called once during app bootstrap). */
export function setConfigProvider(provider: ConfigProvider): void {
  _configProvider = provider;
}

function getConfigValue(key: string, defaultValue?: unknown): unknown {
  return _configProvider(key, defaultValue);
}

const DEFAULT_EMBEDDING_MODEL = String(
  getConfigValue("memory.embedding_model", "BAAI/bge-small-zh-v1.5")
);
const DEFAULT_MIN_SCORE = Number(
  getConfigValue("memory.min_score", 0.3)
);

// ============================================================
// Enums
// ============================================================

/** Four-layer memory (vertical dimension - lifecycle) */
export enum MemoryLayer {
  EPHEMERAL = "ephemeral", // Temporary (< 1 hour)
  SESSION = "session", // Current task
  USER = "user", // Long-term preferences
  PROJECT = "project", // Novel-level scope
}

/** Six-dimensional memory (horizontal dimension - content type) */
export enum MemoryDimension {
  TIMELINE = "timeline", // Event timeline
  CONTEXT = "context", // Story context
  CHARACTER = "character", // Character identity
  WORLDVIEW = "worldview", // World settings
  PREFERENCE = "preference", // Creative preferences
  EXPERIENCE = "experience", // Writing experience
}

// ============================================================
// Embedding pack/unpack utilities
// ============================================================

/**
 * Pack float array into a Buffer (little-endian 32-bit floats).
 */
function packEmbedding(values: number[]): Buffer {
  if (!values || values.length === 0) {
    return Buffer.alloc(0);
  }
  const buffer = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buffer.writeFloatLE(values[i], i * 4);
  }
  return buffer;
}

/**
 * Unpack a Buffer of little-endian 32-bit floats into a number array.
 */
function unpackEmbedding(blob: Buffer): number[] {
  if (!blob || blob.length === 0) {
    return [];
  }
  const count = Math.floor(blob.length / 4);
  if (count <= 0) {
    return [];
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(blob.readFloatLE(i * 4));
  }
  return result;
}

// ============================================================
// UnifiedMemory data structure
// ============================================================

/**
 * Unified memory structure.
 */
export class UnifiedMemory {
  id: string;
  content: string;

  // Vertical dimension: lifecycle
  layer: string;

  // Horizontal dimension: content type
  dimension: string | null;

  // Temporal tracking (Zep Graphiti)
  entityId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  supersedes: string | null;
  supersededBy: string | null;

  // Scope isolation
  userId: string | null;
  projectId: string | null;
  sessionId: string | null;

  // Metadata
  embedding: number[];
  embeddingBlob: Buffer | null;
  embeddingModel: string | null;
  embeddingDim: number | null;
  contentHash: string | null;
  lastAccessedAt: string | null;
  importance: number;
  confidence: number;
  source: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;

  constructor(params: {
    id: string;
    content: string;
    layer?: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    supersedes?: string | null;
    supersededBy?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    embedding?: number[];
    embeddingBlob?: Buffer | null;
    embeddingModel?: string | null;
    embeddingDim?: number | null;
    contentHash?: string | null;
    lastAccessedAt?: string | null;
    importance?: number;
    confidence?: number;
    source?: string;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
  }) {
    const now = new Date().toISOString();
    this.id = params.id;
    this.content = params.content;
    this.layer = params.layer ?? "session";
    this.dimension = params.dimension ?? null;
    this.entityId = params.entityId ?? null;
    this.validFrom = params.validFrom ?? null;
    this.validUntil = params.validUntil ?? null;
    this.supersedes = params.supersedes ?? null;
    this.supersededBy = params.supersededBy ?? null;
    this.userId = params.userId ?? null;
    this.projectId = params.projectId ?? null;
    this.sessionId = params.sessionId ?? null;
    this.embedding = params.embedding ?? [];
    this.embeddingBlob = params.embeddingBlob ?? null;
    this.embeddingModel = params.embeddingModel ?? null;
    this.embeddingDim = params.embeddingDim ?? null;
    this.contentHash = params.contentHash ?? null;
    this.lastAccessedAt = params.lastAccessedAt ?? null;
    this.importance = params.importance ?? 0.5;
    this.confidence = params.confidence ?? 1.0;
    this.source = params.source ?? "user";
    this.tags = params.tags ?? [];
    this.createdAt = params.createdAt ?? now;
    this.updatedAt = params.updatedAt ?? now;
  }

  /** Convert to dictionary for database storage. */
  toDict(): Record<string, unknown> {
    const data: Record<string, unknown> = {
      id: this.id,
      content: this.content,
      layer: this.layer,
      dimension: this.dimension,
      entity_id: this.entityId,
      valid_from: this.validFrom,
      valid_until: this.validUntil,
      supersedes: this.supersedes,
      superseded_by: this.supersededBy,
      user_id: this.userId,
      project_id: this.projectId,
      session_id: this.sessionId,
      embedding: this.embedding,
      embedding_blob: this.embeddingBlob,
      embedding_model: this.embeddingModel,
      embedding_dim: this.embeddingDim,
      content_hash: this.contentHash,
      last_accessed_at: this.lastAccessedAt,
      importance: this.importance,
      confidence: this.confidence,
      source: this.source,
      tags: this.tags,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };

    const rawEmbedding = data["embedding"] as number[];
    if (!data["embedding_blob"] && rawEmbedding && rawEmbedding.length > 0) {
      data["embedding_blob"] = packEmbedding(rawEmbedding);
    }
    data["tags"] = JSON.stringify(data["tags"]);
    data["embedding"] = JSON.stringify(rawEmbedding);
    return data;
  }

  /** Create from dictionary. */
  static fromDict(data: Record<string, unknown>): UnifiedMemory {
    // Parse tags
    if (typeof data["tags"] === "string") {
      try {
        data["tags"] = JSON.parse(data["tags"] as string);
      } catch {
        data["tags"] = [];
      }
    }
    // Parse embedding
    if (typeof data["embedding"] === "string") {
      try {
        data["embedding"] = JSON.parse(data["embedding"] as string);
      } catch {
        data["embedding"] = [];
      }
    }
    // Unpack embedding blob if no embedding array
    if (
      (!data["embedding"] || (data["embedding"] as unknown[]).length === 0) &&
      data["embedding_blob"]
    ) {
      data["embedding"] = unpackEmbedding(
        data["embedding_blob"] as Buffer
      );
    }
    return new UnifiedMemory({
      id: data["id"] as string,
      content: data["content"] as string,
      layer: data["layer"] as string,
      dimension: (data["dimension"] as string | null) ?? null,
      entityId: (data["entity_id"] as string | null) ?? null,
      validFrom: (data["valid_from"] as string | null) ?? null,
      validUntil: (data["valid_until"] as string | null) ?? null,
      supersedes: (data["supersedes"] as string | null) ?? null,
      supersededBy: (data["superseded_by"] as string | null) ?? null,
      userId: (data["user_id"] as string | null) ?? null,
      projectId: (data["project_id"] as string | null) ?? null,
      sessionId: (data["session_id"] as string | null) ?? null,
      embedding: data["embedding"] as number[],
      embeddingBlob: (data["embedding_blob"] as Buffer | null) ?? null,
      embeddingModel: (data["embedding_model"] as string | null) ?? null,
      embeddingDim: (data["embedding_dim"] as number | null) ?? null,
      contentHash: (data["content_hash"] as string | null) ?? null,
      lastAccessedAt: (data["last_accessed_at"] as string | null) ?? null,
      importance: (data["importance"] as number) ?? 0.5,
      confidence: (data["confidence"] as number) ?? 1.0,
      source: (data["source"] as string) ?? "user",
      tags: (data["tags"] as string[]) ?? [],
      createdAt: (data["created_at"] as string) ?? new Date().toISOString(),
      updatedAt: (data["updated_at"] as string) ?? new Date().toISOString(),
    });
  }
}

// ============================================================
// EngineConflictResolver (inline conflict resolver for the engine)
// ============================================================

/** Interface for the DB connection used by ConflictResolver */
export interface UnifiedDbConnection {
  execute(sql: string, params?: unknown[]): { fetchAll(): unknown[][] };
}

/**
 * Conflict detection and resolution (inline version for UnifiedMemoryEngine).
 */
export class EngineConflictResolver {
  private _db: UnifiedDbConnection;

  constructor(db: UnifiedDbConnection) {
    this._db = db;
  }

  /** Negation pairs for contradiction detection */
  private static readonly NEGATION_PAIRS: [string, string][] = [
    ["\u662f", "\u4e0d\u662f"],
    ["\u6709", "\u6ca1\u6709"],
    ["\u80fd", "\u4e0d\u80fd"],
    ["\u4f1a", "\u4e0d\u4f1a"],
    ["alive", "dead"],
    ["true", "false"],
  ];

  /** Detect potential conflicts. */
  async check(content: string, entityId?: string | null): Promise<Array<Record<string, unknown>>> {
    if (!entityId) {
      return [];
    }

    const cursor = this._db.execute(
      `
      SELECT id, content, valid_from, valid_until
      FROM memories
      WHERE entity_id = ?
      AND superseded_by IS NULL
      AND (valid_until IS NULL OR valid_until > datetime('now'))
    `,
      [entityId]
    );

    const conflicts: Array<Record<string, unknown>> = [];
    const rows = cursor.fetchAll();
    for (const row of rows) {
      if (this._isContradictory(content, row[1] as string)) {
        conflicts.push({
          id: row[0],
          content: row[1],
          valid_from: row[2],
          valid_until: row[3],
        });
      }
    }

    return conflicts;
  }

  /** Detect if two content strings are contradictory (simplified). */
  private _isContradictory(contentA: string, contentB: string): boolean {
    for (const [pos, neg] of EngineConflictResolver.NEGATION_PAIRS) {
      if (
        (contentA.includes(pos) && contentB.includes(neg)) ||
        (contentA.includes(neg) && contentB.includes(pos))
      ) {
        return true;
      }
    }
    return false;
  }

  /** Resolve conflicts. */
  async resolve(
    content: string,
    conflicts: Array<Record<string, unknown>>,
    strategy: string = "auto"
  ): Promise<Record<string, unknown>> {
    if (strategy === "auto") {
      return {
        action: "update",
        obsolete_ids: conflicts.map((c) => c["id"]),
        reason: "Newer information supersedes older",
      };
    } else if (strategy === "keep_old") {
      return {
        action: "reject",
        reason: "Keeping existing information",
      };
    } else if (strategy === "merge") {
      const merged = `${conflicts[0]["content"]}; \u66f4\u65b0: ${content}`;
      return {
        action: "merge",
        merged_content: merged,
        obsolete_ids: conflicts.map((c) => c["id"]),
      };
    } else {
      return { action: "update", obsolete_ids: [] };
    }
  }
}

// ============================================================
// EmbeddingEngine
// ============================================================

/**
 * Embedding vector engine (uses query cache for performance).
 */
export class EmbeddingEngine {
  private _model: unknown | null = null;
  private _modelName: string;
  private _cache: ReturnType<typeof getQueryCache>;

  constructor(modelName?: string | null) {
    this._modelName = modelName ?? DEFAULT_EMBEDDING_MODEL;
    this._cache = getQueryCache(1000, 3600);
  }

  /** Get or lazily initialize the model. */
  private get _modelValue(): unknown {
    if (this._model === null) {
      // In the TypeScript port, actual embedding models would be injected.
      // Fallback to dummy embeddings if no model is available.
      console.warn("EmbeddingEngine: no embedding model installed, using dummy embeddings");
      this._model = "dummy";
    }
    return this._model;
  }

  /**
   * Generate embedding vector.
   *
   * @param text - Text content
   * @param useCache - Whether to use cache (only for queries, not storage)
   */
  embed(text: string, useCache: boolean = false): number[] {
    if (useCache) {
      const cached = this._cache.get(text);
      if (cached !== null) {
        return cached;
      }
    }

    let embedding: number[];

    if (this._modelValue === "dummy") {
      // Return deterministic dummy vector based on content hash
      const hashVal = createHash("md5").update(text).digest("hex");
      embedding = [];
      for (let i = 0; i < 32 && i * 2 + 2 <= hashVal.length; i += 2) {
        embedding.push(parseInt(hashVal.slice(i, i + 2), 16) / 255.0);
      }
      // Pad to 384 dimensions
      while (embedding.length < 384) {
        embedding.push(0.0);
      }
    } else {
      // In production, call the actual embedding model
      // const embeddings = this._modelValue.embed([text]);
      // embedding = embeddings[0];
      throw new Error("EmbeddingEngine: real embedding model not yet integrated");
    }

    if (useCache) {
      this._cache.put(text, embedding);
    }

    return embedding;
  }

  /** Generate embedding vector (with cache, for queries). */
  embedCached(text: string): number[] {
    return this.embed(text, true);
  }

  /** Get cache statistics. */
  get cacheStats(): Record<string, unknown> {
    return this._cache.stats;
  }

  /** Compute cosine similarity between two vectors. */
  similarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
      return 0.0;
    }
    if (vecA.length !== vecB.length) {
      return 0.0;
    }

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
    }

    let normA = 0;
    for (const a of vecA) {
      normA += a * a;
    }
    normA = Math.sqrt(normA);

    let normB = 0;
    for (const b of vecB) {
      normB += b * b;
    }
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0.0;
    }

    return dotProduct / (normA * normB);
  }
}

// ============================================================
// Integration adapters (minimal placeholder)
// ============================================================

/** Integration flags for optional services */
export interface IntegrationFlags {
  postgresEnabled: boolean;
}

/** Storage shadow-write interface */
export interface StorageShadowWriter {
  shadowWriteMemory(payload: Record<string, unknown>): Promise<void>;
}

/** Integration adapters container */
export interface IntegrationAdapters {
  flags: IntegrationFlags;
  storageShadow: StorageShadowWriter;
}

/** Minimal no-op integration adapters */
function createNoOpAdapters(): IntegrationAdapters {
  return {
    flags: { postgresEnabled: false },
    storageShadow: {
      async shadowWriteMemory(_payload: Record<string, unknown>): Promise<void> {
        // no-op
      },
    },
  };
}

// ============================================================
// EnginePlugin protocol
// ============================================================

/** Engine plugin protocol */
export interface EnginePlugin {
  readonly name: string;
  load(engine: UnifiedMemoryEngine): Promise<void>;
  healthCheck(): Promise<Record<string, unknown>>;
  onMemoryAdded(memory: UnifiedMemory): Promise<void>;
}

// ============================================================
// UnifiedMemoryEngine
// ============================================================

/**
 * Unified Memory Engine (main system).
 *
 * Merges:
 * - Four-layer memory (vertical: lifecycle)
 * - Six-dimensional memory (horizontal: content type)
 * - Temporal tracking (Zep Graphiti model)
 * - Conflict detection and resolution
 * - Scope isolation
 */
export class UnifiedMemoryEngine {
  /** Contradiction hint words for conflict detection */
  static readonly CONTRADICTION_HINTS = [
    "\u4e0d\u662f", "\u6ca1\u6709", "\u4e0d\u80fd", "\u4e0d\u4f1a",
    "dead", "false",
  ];

  isPrimaryEngine = true;
  plugins: EnginePlugin[] = [];
  private _pluginHealth: Record<string, Record<string, unknown>> = {};

  dbPath: string;
  private _db: DatabaseType;
  embedder: EmbeddingEngine;
  conflictResolver: EngineConflictResolver;
  private _integrationAdapters: IntegrationAdapters;

  constructor(params: {
    dbPath?: string | null;
    plugins?: EnginePlugin[] | null;
    integrationAdapters?: IntegrationAdapters | null;
  } = {}) {
    let dbPath = params.dbPath ?? null;

    if (dbPath === null) {
      dbPath = getConfigValue("memory.db_path", null) as string | null;
    }
    if (dbPath === null) {
      const dataDir = getConfigValue("data_dir", null) as string | null;
      if (dataDir) {
        dbPath = dataDir + "/memory.db";
      }
    }
    if (dbPath === null) {
      dbPath = homedir() + "/.niko/memory.db";
    }

    this.dbPath = dbPath;
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this._db = new BetterSqlite3(this.dbPath);
    this.embedder = new EmbeddingEngine();
    this.conflictResolver = new EngineConflictResolver(
      this._createDbAdapter()
    );
    this._integrationAdapters =
      params.integrationAdapters ?? createNoOpAdapters();

    this._initSchema();
    console.log(`Memory engine initialized: ${this.dbPath}`);

    if (params.plugins) {
      this._registerPlugins(params.plugins);
    }
  }

  /** Create a DB adapter that wraps better-sqlite3 for ConflictResolver. */
  private _createDbAdapter(): UnifiedDbConnection {
    const db = this._db;
    return {
      execute(sql: string, params: unknown[] = []): { fetchAll(): unknown[][] } {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...params) as unknown[][];
        return {
          fetchAll(): unknown[][] {
            return rows;
          },
        };
      },
    };
  }

  private _registerPlugins(plugins: EnginePlugin[]): void {
    for (const plugin of plugins) {
      if (this.plugins.includes(plugin)) {
        continue;
      }
      this.plugins.push(plugin);
    }
  }

  /** Initialize all plugins (call after constructor). */
  async initialize(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.load(this);
      } catch (exc) {
        const name = (plugin as unknown as Record<string, unknown>).name ?? "unknown";
        console.error(`Memory plugin load failed: ${name}: ${exc}`);
        this._pluginHealth[name as string] = {
          status: "error",
          error: String(exc),
        };
      }
    }
  }

  /** Run health check on engine and all plugins. */
  async healthCheck(): Promise<Record<string, unknown>> {
    const pluginStatus: Record<string, unknown> = {};
    for (const plugin of this.plugins) {
      const name = (plugin as unknown as Record<string, unknown>).name ?? "unknown";
      try {
        pluginStatus[name as string] = await plugin.healthCheck();
      } catch (exc) {
        pluginStatus[name as string] = {
          status: "error",
          error: String(exc),
        };
      }
    }
    this._pluginHealth = pluginStatus as Record<string, Record<string, unknown>>;

    let dbOk = true;
    let error: string | null = null;
    try {
      this._db.prepare("SELECT 1").get();
    } catch (exc) {
      dbOk = false;
      error = String(exc);
    }

    return {
      engine: "primary",
      db_path: this.dbPath,
      db_ok: dbOk,
      error,
      plugins: pluginStatus,
    };
  }

  // ----------------------------------------------------------
  // Schema management
  // ----------------------------------------------------------

  private _initSchema(): void {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        layer TEXT DEFAULT 'session',
        dimension TEXT,
        entity_id TEXT,
        valid_from TEXT,
        valid_until TEXT,
        supersedes TEXT,
        superseded_by TEXT,
        user_id TEXT,
        project_id TEXT,
        session_id TEXT,
        embedding TEXT,
        importance REAL DEFAULT 0.5,
        confidence REAL DEFAULT 1.0,
        source TEXT DEFAULT 'user',
        tags TEXT DEFAULT '[]',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_layer ON memories(layer);
      CREATE INDEX IF NOT EXISTS idx_memories_dimension ON memories(dimension);
      CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
      CREATE INDEX IF NOT EXISTS idx_memories_valid ON memories(valid_from, valid_until);

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

    this._ensureColumn("memories", "embedding_blob", "BLOB");
    this._ensureColumn("memories", "embedding_model", "TEXT");
    this._ensureColumn("memories", "embedding_dim", "INTEGER");
    this._ensureColumn("memories", "content_hash", "TEXT");
    this._ensureColumn("memories", "last_accessed_at", "TEXT");
  }

  private _ensureColumn(
    tableName: string,
    columnName: string,
    columnType: string
  ): void {
    const rows = this._db.pragma(`table_info(${tableName})`) as Array<{
      name: string;
    }>;
    const columns = new Set(rows.map((r) => r.name));
    if (columns.has(columnName)) {
      return;
    }
    this._db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`
    );
  }

  // ----------------------------------------------------------
  // Add memory
  // ----------------------------------------------------------

  /**
   * Add a memory - unified entry point.
   */
  async add(params: {
    content: string;
    layer?: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    importance?: number;
    tags?: string[];
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    source?: string;
    confidence?: number;
  }): Promise<Record<string, unknown>> {
    const {
      content,
      layer = "session",
      dimension = null,
      entityId = null,
      validFrom = null,
      validUntil = null,
      importance = 0.5,
      tags = [],
      userId = null,
      projectId = null,
      sessionId = null,
      source = "user",
      confidence = 1.0,
    } = params;

    // 1. Conflict detection
    const conflicts = await this.conflictResolver.check(content, entityId);
    if (conflicts.length > 0) {
      const resolution = await this.conflictResolver.resolve(
        content,
        conflicts
      );
      if (resolution["action"] === "reject") {
        return { status: "rejected", reason: resolution["reason"] };
      }

      // Mark old memories as superseded
      const obsoleteIds = (resolution["obsolete_ids"] as string[]) ?? [];
      for (const oldId of obsoleteIds) {
        await this._markSuperseded(oldId);
      }
    }

    // 2. Generate embedding
    const embedding = this.embedder.embed(content);

    // 3. Create memory
    const now = new Date().toISOString();
    const memory = new UnifiedMemory({
      id: randomUUID(),
      content,
      layer,
      dimension,
      entityId,
      validFrom: validFrom ?? now,
      validUntil,
      userId,
      projectId,
      sessionId,
      embedding,
      embeddingBlob: packEmbedding(embedding),
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      embeddingDim: embedding.length,
      contentHash: createHash("sha256").update(content).digest("hex"),
      lastAccessedAt: now,
      importance,
      tags,
      source,
      confidence,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Store
    this._store(memory);

    // 4.1 Optional PostgreSQL shadow-write hook (non-blocking)
    await this._runPostgresShadowWrite(memory);

    // 5. Plugin notification
    for (const plugin of this.plugins) {
      try {
        await plugin.onMemoryAdded(memory);
      } catch (exc) {
        const name = (plugin as unknown as Record<string, unknown>).name ?? "unknown";
        console.error(`Memory plugin callback failed: ${name}: ${exc}`);
      }
    }

    console.log(`Memory added: ${memory.id.slice(0, 8)}... [${layer}]`);
    return { id: memory.id, status: "created" };
  }

  /** Optional PostgreSQL shadow-write (non-blocking). */
  private async _runPostgresShadowWrite(
    memory: UnifiedMemory
  ): Promise<void> {
    if (!this._integrationAdapters.flags.postgresEnabled) {
      return;
    }

    const payload: Record<string, unknown> = {
      id: memory.id,
      content: memory.content,
      layer: memory.layer,
      dimension: memory.dimension,
      entity_id: memory.entityId,
      importance: memory.importance,
      tags: memory.tags,
      created_at: memory.createdAt,
    };
    try {
      await this._integrationAdapters.storageShadow.shadowWriteMemory(payload);
    } catch (exc) {
      console.warn(
        `Postgres shadow write failed, local-first path preserved: ${exc}`
      );
    }
  }

  /** Store memory to database. */
  private _store(memory: UnifiedMemory): void {
    const data = memory.toDict();
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");

    this._db
      .prepare(
        `INSERT OR REPLACE INTO memories (${columns}) VALUES (${placeholders})`
      )
      .run(...Object.values(data));
  }

  /** Mark memory as superseded. */
  private async _markSuperseded(
    memoryId: string,
    supersededBy: string | null = null
  ): Promise<void> {
    this._db
      .prepare(
        `
      UPDATE memories
      SET superseded_by = ?, updated_at = ?
      WHERE id = ?
    `
      )
      .run(supersededBy ?? "new", new Date().toISOString(), memoryId);
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  /**
   * Search memories - supports multi-dimensional + temporal filtering.
   */
  async search(params: {
    query: string;
    layer?: string | null;
    dimensions?: string[] | null;
    entityId?: string | null;
    atTime?: string | null;
    limit?: number;
    minScore?: number | null;
  }): Promise<Array<Record<string, unknown>>> {
    const {
      query,
      layer = null,
      dimensions = null,
      entityId = null,
      atTime = null,
      limit = 10,
      minScore = null,
    } = params;

    const queryEmbedding = this.embedder.embedCached(query);

    let sql = "SELECT * FROM memories WHERE superseded_by IS NULL";
    const sqlParams: unknown[] = [];

    if (layer) {
      sql += " AND layer = ?";
      sqlParams.push(layer);
    }

    if (dimensions && dimensions.length > 0) {
      const placeholders = dimensions.map(() => "?").join(",");
      sql += ` AND dimension IN (${placeholders})`;
      sqlParams.push(...dimensions);
    }

    if (entityId) {
      sql += " AND entity_id = ?";
      sqlParams.push(entityId);
    }

    if (atTime) {
      sql += `
        AND (valid_from IS NULL OR valid_from <= ?)
        AND (valid_until IS NULL OR valid_until > ?)
      `;
      sqlParams.push(atTime, atTime);
    }

    const stmt = this._db.prepare(sql);
    const rows = stmt.all(...sqlParams) as Array<Record<string, unknown>>[];

    const threshold = minScore ?? DEFAULT_MIN_SCORE;

    const results: Array<Record<string, unknown>> = [];
    const columns = stmt.columns().map((c: { name: string }) => c.name);

    for (const rowValues of rows) {
      const data: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        data[columns[i]] = rowValues[i];
      }
      const memory = UnifiedMemory.fromDict(data);

      if (
        (!memory.embedding || memory.embedding.length === 0) &&
        data["embedding_blob"]
      ) {
        memory.embedding = unpackEmbedding(data["embedding_blob"] as Buffer);
      }

      const score = this.embedder.similarity(queryEmbedding, memory.embedding);

      if (score > threshold) {
        const now = new Date().toISOString();
        this._db
          .prepare(
            "UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?"
          )
          .run(now, now, memory.id);

        results.push({
          id: memory.id,
          content: memory.content,
          layer: memory.layer,
          dimension: memory.dimension,
          entity_id: memory.entityId,
          score: Math.round(score * 10000) / 10000,
          importance: memory.importance,
          created_at: memory.createdAt,
          last_accessed_at: now,
        });
      }
    }

    results.sort(
      (a, b) =>
        ((b["score"] as number) ?? 0) - ((a["score"] as number) ?? 0)
    );
    return results.slice(0, limit);
  }

  // ----------------------------------------------------------
  // Temporal facts
  // ----------------------------------------------------------

  /**
   * Get facts for an entity at a specific point in time.
   */
  async getTemporalFacts(params: {
    entityId: string;
    atTime?: string | null;
  }): Promise<Array<Record<string, unknown>>> {
    const { entityId, atTime = null } = params;
    const time = atTime ?? new Date().toISOString();

    const rows = this._db
      .prepare(
        `
      SELECT id, content, dimension, valid_from, valid_until, importance
      FROM memories
      WHERE entity_id = ?
      AND superseded_by IS NULL
      AND (valid_from IS NULL OR valid_from <= ?)
      AND (valid_until IS NULL OR valid_until > ?)
      ORDER BY importance DESC, valid_from DESC
    `
      )
      .all(entityId, time, time) as unknown[][];

    return rows.map((row) => ({
      id: row[0],
      content: row[1],
      dimension: row[2],
      valid_from: row[3],
      valid_until: row[4],
      importance: row[5],
    }));
  }

  // ----------------------------------------------------------
  // Conflict detection
  // ----------------------------------------------------------

  /**
   * Detect all conflicts for an entity.
   */
  async detectConflicts(entityId: string): Promise<Array<Record<string, unknown>>> {
    const rows = this._db
      .prepare(
        `
      SELECT id, content, valid_from, valid_until
      FROM memories
      WHERE entity_id = ?
      AND superseded_by IS NULL
      ORDER BY valid_from DESC
    `
      )
      .all(entityId) as unknown[][];

    const memories = rows;

    function isCandidate(content: string): boolean {
      const lowered = content.toLowerCase();
      return UnifiedMemoryEngine.CONTRADICTION_HINTS.some(
        (hint) => content.includes(hint) || lowered.includes(hint)
      );
    }

    const candidateIndices: number[] = [];
    for (let index = 0; index < memories.length; index++) {
      if (isCandidate((memories[index][1] as string) ?? "")) {
        candidateIndices.push(index);
      }
    }

    const conflicts: Array<Record<string, unknown>> = [];
    const comparedPairs = new Set<string>();

    for (const idx of candidateIndices) {
      const memA = memories[idx];
      for (let jdx = 0; jdx < memories.length; jdx++) {
        if (jdx === idx) {
          continue;
        }

        const pairKey = [idx, jdx].sort().join(",");
        if (comparedPairs.has(pairKey)) {
          continue;
        }
        comparedPairs.add(pairKey);

        if (
          this.conflictResolver["_isContradictory"](
            memA[1] as string,
            memories[jdx][1] as string
          )
        ) {
          conflicts.push({
            memory_a: { id: memA[0], content: memA[1] },
            memory_b: { id: memories[jdx][0], content: memories[jdx][1] },
            conflict_type: "contradiction",
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a memory conflict.
   */
  async resolveConflict(params: {
    memoryIdA: string;
    memoryIdB: string;
    resolution?: string;
  }): Promise<Record<string, unknown>> {
    const { memoryIdA, memoryIdB, resolution = "auto" } = params;

    if (resolution === "keep_a") {
      await this._markSuperseded(memoryIdB, memoryIdA);
      return {
        status: "resolved",
        kept: memoryIdA,
        removed: memoryIdB,
      };
    } else if (resolution === "keep_b") {
      await this._markSuperseded(memoryIdA, memoryIdB);
      return {
        status: "resolved",
        kept: memoryIdB,
        removed: memoryIdA,
      };
    } else {
      // auto - keep newer
      const row = this._db
        .prepare(
          `
        SELECT id FROM memories
        WHERE id IN (?, ?)
        ORDER BY created_at DESC LIMIT 1
      `
        )
        .get(memoryIdA, memoryIdB) as Record<string, unknown> | undefined;

      const newerId = row!["id"] as string;
      const olderId =
        newerId === memoryIdA ? memoryIdB : memoryIdA;

      await this._markSuperseded(olderId, newerId);
      return {
        status: "resolved",
        kept: newerId,
        removed: olderId,
      };
    }
  }

  // ----------------------------------------------------------
  // Retrieval profiles
  // ----------------------------------------------------------

  /** Get a retrieval profile by name. */
  getRetrievalProfile(
    profileName: string
  ): Record<string, unknown> | null {
    const row = this._db
      .prepare(
        `
      SELECT profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at
      FROM retrieval_profiles
      WHERE profile_name = ?
    `
      )
      .get(profileName) as unknown[] | undefined;

    if (!row) {
      return null;
    }

    return {
      profile_name: row[0],
      source_weights_json:
        row[1] ? JSON.parse(row[1] as string) : {},
      thresholds_json:
        row[2] ? JSON.parse(row[2] as string) : {},
      budget_json:
        row[3] ? JSON.parse(row[3] as string) : {},
      enabled: Boolean(row[4]),
      updated_at: row[5],
    };
  }

  /** Upsert a retrieval profile. */
  upsertRetrievalProfile(params: {
    profileName: string;
    sourceWeights: Record<string, unknown>;
    thresholds: Record<string, unknown>;
    budget: Record<string, unknown>;
    enabled?: boolean;
  }): void {
    const {
      profileName,
      sourceWeights,
      thresholds,
      budget,
      enabled = true,
    } = params;
    const now = new Date().toISOString();

    this._db
      .prepare(
        `
      INSERT INTO retrieval_profiles(profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_name) DO UPDATE SET
        source_weights_json=excluded.source_weights_json,
        thresholds_json=excluded.thresholds_json,
        budget_json=excluded.budget_json,
        enabled=excluded.enabled,
        updated_at=excluded.updated_at
    `
      )
      .run(
        profileName,
        JSON.stringify(sourceWeights ?? {}),
        JSON.stringify(thresholds ?? {}),
        JSON.stringify(budget ?? {}),
        enabled ? 1 : 0,
        now
      );
  }

  // ----------------------------------------------------------
  // Retrieval cache
  // ----------------------------------------------------------

  /** Pack a cache entry. */
  cachePack(params: {
    cacheKey: string;
    payload: Record<string, unknown>;
    ttlSeconds?: number;
    status?: string;
  }): void {
    const {
      cacheKey,
      payload,
      ttlSeconds = 300,
      status = "ready",
    } = params;
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + Math.max(ttlSeconds, 1) * 1000
    ).toISOString();

    this._db
      .prepare(
        `
      INSERT INTO retrieval_cache(cache_key, payload_json, status, created_at, expires_at, hit_count)
      VALUES(?, ?, ?, ?, ?, 0)
      ON CONFLICT(cache_key) DO UPDATE SET
        payload_json=excluded.payload_json,
        status=excluded.status,
        created_at=excluded.created_at,
        expires_at=excluded.expires_at
    `
      )
      .run(cacheKey, JSON.stringify(payload), status, now.toISOString(), expiresAt);
  }

  /** Read a cache entry. */
  cacheRead(cacheKey: string): Record<string, unknown> | null {
    const row = this._db
      .prepare(
        `
      SELECT payload_json, status, expires_at, hit_count
      FROM retrieval_cache
      WHERE cache_key = ?
    `
      )
      .get(cacheKey) as unknown[] | undefined;

    if (!row) {
      return null;
    }

    const expiresAt = row[2] as string | null;
    if (expiresAt && expiresAt <= new Date().toISOString()) {
      this.cacheRelease(cacheKey);
      return null;
    }

    this._db
      .prepare(
        "UPDATE retrieval_cache SET hit_count = hit_count + 1 WHERE cache_key = ?"
      )
      .run(cacheKey);

    return {
      payload: row[0] ? JSON.parse(row[0] as string) : {},
      status: row[1],
      expires_at: row[2],
      hit_count: (row[3] as number) + 1,
    };
  }

  /** Check cache status. */
  cacheStatus(cacheKey: string): string | null {
    const row = this._db
      .prepare("SELECT status FROM retrieval_cache WHERE cache_key = ?")
      .get(cacheKey) as unknown[] | undefined;
    return row ? (row[0] as string) : null;
  }

  /** Release (delete) a cache entry. */
  cacheRelease(cacheKey: string): void {
    this._db
      .prepare("DELETE FROM retrieval_cache WHERE cache_key = ?")
      .run(cacheKey);
  }

  /** Clean up expired cache entries. */
  cacheCleanup(): number {
    const result = this._db
      .prepare("DELETE FROM retrieval_cache WHERE expires_at <= ?")
      .run(new Date().toISOString());
    return result.changes;
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  /** Close database connection. */
  close(): void {
    this._db.close();
  }

  /** Create engine from configuration. */
  static fromConfig(
    plugins?: EnginePlugin[] | null
  ): UnifiedMemoryEngine {
    let dbPath = getConfigValue("memory.db_path", null) as string | null;
    if (dbPath === null) {
      const dataDir = getConfigValue("data_dir", null) as string | null;
      if (dataDir) {
        dbPath = dataDir + "/memory.db";
      }
    }
    if (dbPath === null) {
      dbPath = getConfigValue("memory.vector_db_path", null) as string | null;
    }
    return new UnifiedMemoryEngine({ dbPath, plugins });
  }
}

// ============================================================
// Singleton and factory
// ============================================================

let _unifiedEngine: UnifiedMemoryEngine | null = null;

/** Get or create UnifiedMemoryEngine singleton. */
export function getUnifiedMemoryEngine(params?: {
  dbPath?: string | null;
  plugins?: EnginePlugin[] | null;
  integrationAdapters?: IntegrationAdapters | null;
}): UnifiedMemoryEngine {
  if (_unifiedEngine === null) {
    _unifiedEngine = new UnifiedMemoryEngine(params ?? {});
  }
  return _unifiedEngine;
}

/** Reset UnifiedMemoryEngine singleton (for testing). */
export function resetUnifiedMemoryEngine(): void {
  if (_unifiedEngine !== null) {
    _unifiedEngine.close();
    _unifiedEngine = null;
  }
}

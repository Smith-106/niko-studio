/**
 * Core Memory Store
 *
 * TypeScript implementation migrated from src/memory/core_memory_store.py.
 *
 * Features:
 * - CRUD operations for core memories
 * - Semantic search via vector embeddings
 * - AI-powered summary generation
 * - Soft delete (archive) and hard delete
 * - Importance scoring and access tracking
 */

import BetterSqlite3 from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { SearchInterface } from "../protocols/search";
import { createLogger } from "../logger/index.js";

const _log = createLogger("memory-core");

type DatabaseType = InstanceType<typeof BetterSqlite3>;

// ============================================================
// CoreMemory data structure
// ============================================================

/**
 * Core Memory Structure.
 *
 * Attributes:
 * - id: Unique memory identifier
 * - content: Full memory content
 * - summary: AI-generated summary (optional)
 * - archived: Whether memory is archived (soft delete)
 * - createdAt: Creation timestamp (epoch seconds)
 * - updatedAt: Last update timestamp (epoch seconds)
 * - metadata: Additional metadata (tags, source, etc.)
 * - importance: Memory importance score (0.0-1.0)
 * - accessCount: Number of times accessed
 */
export class CoreMemory {
  id: string;
  content: string;
  summary: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
  importance: number;
  accessCount: number;

  constructor(params: {
    id: string;
    content: string;
    summary?: string | null;
    archived?: boolean;
    createdAt?: number;
    updatedAt?: number;
    metadata?: Record<string, unknown>;
    importance?: number;
    accessCount?: number;
  }) {
    const now = Date.now() / 1000;
    this.id = params.id;
    this.content = params.content;
    this.summary = params.summary ?? null;
    this.archived = params.archived ?? false;
    this.createdAt = params.createdAt ?? now;
    this.updatedAt = params.updatedAt ?? now;
    this.metadata = params.metadata ?? {};
    this.importance = params.importance ?? 0.5;
    this.accessCount = params.accessCount ?? 0;
  }

  /** Convert to plain object. */
  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      content: this.content,
      summary: this.summary,
      archived: this.archived,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      metadata: this.metadata,
      importance: this.importance,
      access_count: this.accessCount,
    };
  }

  /** Create from plain object. */
  static fromDict(data: Record<string, unknown>): CoreMemory {
    // Handle legacy data without new fields
    if (data["importance"] === undefined) {
      data["importance"] = 0.5;
    }
    if (data["access_count"] === undefined) {
      data["access_count"] = 0;
    }
    return new CoreMemory({
      id: data["id"] as string,
      content: data["content"] as string,
      summary: (data["summary"] as string | null) ?? null,
      archived: (data["archived"] as boolean) ?? false,
      createdAt: data["created_at"] as number,
      updatedAt: data["updated_at"] as number,
      metadata: (data["metadata"] as Record<string, unknown>) ?? {},
      importance: data["importance"] as number,
      accessCount: data["access_count"] as number,
    });
  }
}

// ============================================================
// Extended SearchInterface for CoreMemoryStore
// ============================================================

/**
 * Extended search interface providing vector operations needed by CoreMemoryStore.
 * Extends the base SearchInterface with memory-specific vector methods.
 */
export interface CoreSearchInterface extends SearchInterface {
  /** Database file path */
  readonly dbPath: string;

  /** Get raw database connection */
  _getConnection(): DatabaseType;

  /** Upsert a vector with metadata */
  upsertVector(params: {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
    type: string;
  }): void;

  /** Search memory vectors by query */
  searchMemoryVectors(query: string, topK: number): Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>;

  /** Delete a vector by ID */
  deleteVector(id: string): boolean;
}

// ============================================================
// CoreMemoryStore
// ============================================================

/**
 * Core Memory Store.
 * Persists memories using VectorSearch (SQLite + Embeddings).
 *
 * Features:
 * - CRUD operations for core memories
 * - Semantic search via vector embeddings
 * - AI-powered summary generation
 * - Soft delete (archive) and hard delete
 * - Importance scoring and access tracking
 */
export class CoreMemoryStore {
  private _vectorSearch: CoreSearchInterface | null;
  private _summaryGenerator: ((content: string) => string) | null;
  private _dbPath: string;
  private _ownsVectorSearch: boolean;

  constructor(params: {
    vectorSearch?: CoreSearchInterface | null;
    summaryGenerator?: ((content: string) => string) | null;
    dbPath?: string | null;
    ownsVectorSearch?: boolean;
  }) {
    this._vectorSearch = params.vectorSearch ?? null;
    this._summaryGenerator = params.summaryGenerator ?? null;
    this._ownsVectorSearch = params.ownsVectorSearch ?? false;

    let dbPath = params.dbPath ?? null;
    if (dbPath === null) {
      if (this._vectorSearch !== null) {
        dbPath = this._vectorSearch.dbPath;
      } else {
        dbPath = ".writing/core_memory.db";
      }
    }

    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this._dbPath = dbPath;
    this._initSchema();
  }

  /** Get the associated vector search instance (may be null). */
  get vectorSearch(): CoreSearchInterface | null {
    return this._vectorSearch;
  }

  // ----------------------------------------------------------
  // Schema management
  // ----------------------------------------------------------

  private _getCoreConnection(): DatabaseType {
    return new BetterSqlite3(this._dbPath);
  }

  /**
   * Close a database connection only if this store owns the vector search.
   * Borrowed/shared connections (from an external VectorSearch) must not be closed,
   * as they are managed by their owner and reused across calls.
   */
  private _closeOwnedConnection(conn: unknown): void {
    if (this._ownsVectorSearch && conn && typeof (conn as any).close === 'function') {
      (conn as any).close();
    }
  }

  private _initSchema(): void {
    const conn = this._getCoreConnection();
    try {
      conn.exec(`
        CREATE TABLE IF NOT EXISTS core_memories (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          summary TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at REAL,
          updated_at REAL,
          metadata TEXT NOT NULL DEFAULT '{}',
          importance REAL DEFAULT 0.5,
          access_count INTEGER DEFAULT 0,
          pending_vector_sync INTEGER NOT NULL DEFAULT 0
        );
      `);
      this._ensureCoreColumns(conn);
      conn.exec("COMMIT");
    } finally {
      conn.close();
    }
  }

  private _ensureCoreColumns(conn: DatabaseType): void {
    const rows = conn.pragma("table_info(core_memories)") as Array<{
      name: string;
    }>;
    const existing = new Set(rows.map((r) => r.name));

    const required: Record<string, string> = {
      created_at: "REAL DEFAULT 0",
      updated_at: "REAL DEFAULT 0",
      metadata: "TEXT NOT NULL DEFAULT '{}'",
      importance: "REAL DEFAULT 0.5",
      access_count: "INTEGER DEFAULT 0",
      pending_vector_sync: "INTEGER NOT NULL DEFAULT 0",
    };

    for (const [name, ddl] of Object.entries(required)) {
      if (!existing.has(name)) {
        conn.exec(`ALTER TABLE core_memories ADD COLUMN ${name} ${ddl}`);
      }
    }

    const defaults: Record<string, unknown> = {
      created_at: 0,
      updated_at: 0,
      metadata: "{}",
      importance: 0.5,
      access_count: 0,
      pending_vector_sync: 0,
    };

    for (const [name, value] of Object.entries(defaults)) {
      conn.prepare(`UPDATE core_memories SET ${name} = ? WHERE ${name} IS NULL`).run(value);
    }
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  private _parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) {
      return {};
    }
    try {
      const data = JSON.parse(raw);
      return typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  private _setPendingVectorSync(memoryId: string, pending: boolean): void {
    const conn = this._getCoreConnection();
    try {
      conn.prepare("UPDATE core_memories SET pending_vector_sync = ? WHERE id = ?").run(
        pending ? 1 : 0,
        memoryId
      );
    } finally {
      conn.close();
    }
  }

  private _updateSqliteAccessCount(memoryId: string, count: number): void {
    const now = Date.now() / 1000;
    const conn = this._getCoreConnection();
    try {
      conn.prepare(
        "UPDATE core_memories SET access_count = ?, updated_at = ? WHERE id = ?"
      ).run(count, now, memoryId);
    } finally {
      conn.close();
    }
  }

  // ----------------------------------------------------------
  // Upsert (primary API - via vector search)
  // ----------------------------------------------------------

  /**
   * Create or update a memory (unified upsert API).
   *
   * @param content - Memory content
   * @param memoryId - Optional ID (auto-generated if not provided)
   * @param metadata - Additional metadata
   * @param importance - Importance score (0.0-1.0)
   * @param summary - Optional pre-computed summary
   * @returns CoreMemory object
   */
  upsert(params: {
    content: string;
    memoryId?: string | null;
    metadata?: Record<string, unknown> | null;
    importance?: number;
    summary?: string | null;
  }): CoreMemory {
    const memoryId = params.memoryId ?? randomUUID();
    const now = Date.now() / 1000;
    const metadata = params.metadata ?? {};

    // Check if updating existing memory
    const existing = this.get(memoryId);
    const createdAt = existing ? existing.createdAt : now;
    const accessCount = existing ? existing.accessCount : 0;

    const memory = new CoreMemory({
      id: memoryId,
      content: params.content,
      summary: params.summary ?? null,
      archived: false,
      createdAt,
      updatedAt: now,
      metadata,
      importance: params.importance ?? 0.5,
      accessCount,
    });

    // Store in VectorSearch with full metadata
    const storeMetadata: Record<string, unknown> = {
      summary: memory.summary,
      archived: memory.archived,
      created_at: memory.createdAt,
      updated_at: memory.updatedAt,
      importance: memory.importance,
      access_count: memory.accessCount,
      extra: metadata,
    };

    if (this._vectorSearch !== null) {
      this._vectorSearch.upsertVector({
        id: memoryId,
        content: params.content,
        metadata: storeMetadata,
        type: "memory",
      });
    }

    return memory;
  }

  // ----------------------------------------------------------
  // Upsert memory (SQLite-backed, legacy API)
  // ----------------------------------------------------------

  /**
   * Create or update a memory in the core_memories table.
   *
   * Supported call styles:
   * - upsertMemory({ content, memoryId, metadata, summary, archived })
   * - upsertMemory({ memoryId, content, summary, archived })
   */
  upsertMemory(params: {
    content: string;
    memoryId?: string | null;
    summary?: string | null;
    archived?: boolean;
    metadata?: Record<string, unknown> | null;
    importance?: number | null;
    accessCount?: number | null;
    createdAt?: number | null;
    updatedAt?: number | null;
  }): CoreMemory {
    const content = params.content;
    let memoryId = params.memoryId ?? null;
    const summary = params.summary ?? null;
    const archived = params.archived ?? false;
    let metadata = params.metadata ?? null;
    let importance = params.importance ?? null;
    let accessCount = params.accessCount ?? null;
    let createdAt = params.createdAt ?? null;
    let updatedAt = params.updatedAt ?? null;

    if (content === null || content === undefined) {
      throw new Error("content is required");
    }

    if (memoryId === null) {
      memoryId = randomUUID();
    }

    const now = Date.now() / 1000;
    const archivedValue = archived ? 1 : 0;
    const conn = this._getCoreConnection();

    try {
      const row = conn
        .prepare(
          "SELECT created_at, metadata, importance, access_count FROM core_memories WHERE id = ?"
        )
        .get(memoryId) as Record<string, unknown> | undefined;

      const exists = row !== undefined;

      if (exists) {
        const existingMetadata = this._parseMetadata(row!.metadata as string | null);
        if (metadata === null) {
          metadata = existingMetadata;
        }
        if (createdAt === null) {
          createdAt =
            row!.created_at !== null && row!.created_at !== undefined
              ? (row!.created_at as number)
              : now;
        }
        if (importance === null) {
          importance =
            row!.importance !== null && row!.importance !== undefined
              ? (row!.importance as number)
              : 0.5;
        }
        if (accessCount === null) {
          accessCount =
            row!.access_count !== null && row!.access_count !== undefined
              ? (row!.access_count as number)
              : 0;
        }
      } else {
        if (metadata === null) {
          metadata = {};
        }
        if (createdAt === null) {
          createdAt = now;
        }
        if (importance === null) {
          importance = 0.5;
        }
        if (accessCount === null) {
          accessCount = 0;
        }
      }

      if (updatedAt === null) {
        updatedAt = now;
      }

      if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
        metadata = { value: metadata };
      }

      const pendingVectorSync = this._vectorSearch === null ? 1 : 0;

      if (exists) {
        conn.prepare(
          `
          UPDATE core_memories
          SET content = ?, summary = ?, archived = ?, updated_at = ?, metadata = ?,
              importance = ?, access_count = ?, pending_vector_sync = ?
          WHERE id = ?
        `
        ).run(
          content,
          summary,
          archivedValue,
          updatedAt,
          JSON.stringify(metadata),
          importance,
          accessCount,
          pendingVectorSync,
          memoryId
        );
      } else {
        conn.prepare(
          `
          INSERT INTO core_memories (
            id, content, summary, archived, created_at, updated_at,
            metadata, importance, access_count, pending_vector_sync
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          memoryId,
          content,
          summary,
          archivedValue,
          createdAt,
          updatedAt,
          JSON.stringify(metadata),
          importance,
          accessCount,
          pendingVectorSync
        );
      }
    } finally {
      conn.close();
    }

    // Sync with vector search
    if (this._vectorSearch !== null) {
      try {
        this.upsert({
          content,
          memoryId,
          metadata,
          importance,
          summary,
        });
        if (archived) {
          if (!this.archive(memoryId)) {
            throw new Error("Vector archive failed");
          }
        }
        this._setPendingVectorSync(memoryId, false);
      } catch (e) {
        _log.warn(
          `Vector upsert failed for memory ${memoryId.slice(0, 8)}...: ${e}`
        );
        this._setPendingVectorSync(memoryId, true);
      }
    }

    return new CoreMemory({
      id: memoryId,
      content,
      summary,
      archived,
      metadata,
      createdAt,
      updatedAt,
      importance,
      accessCount,
    });
  }

  // ----------------------------------------------------------
  // Get (primary API)
  // ----------------------------------------------------------

  /**
   * Retrieve a memory by ID (primary API).
   *
   * @param memoryId - Memory identifier
   * @param trackAccess - Whether to increment access count
   * @returns CoreMemory object or null if not found
   */
  get(memoryId: string, trackAccess: boolean = false): CoreMemory | null {
    if (this._vectorSearch === null) {
      const memory = this._getMemorySqlite(memoryId);
      if (memory && trackAccess) {
        memory.accessCount += 1;
        this._updateSqliteAccessCount(memoryId, memory.accessCount);
      }
      return memory;
    }

    const vConn = this._vectorSearch._getConnection();
    const row = vConn
      .prepare(
        "SELECT id, content, metadata FROM items WHERE id = ? AND type = 'memory'"
      )
      .get(memoryId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(row.metadata as string) as Record<string, unknown>; } catch { /* corrupted metadata */ }
    const memory = new CoreMemory({
      id: row.id as string,
      content: row.content as string,
      summary: (meta["summary"] as string | null) ?? null,
      archived: (meta["archived"] as boolean) ?? false,
      createdAt: (meta["created_at"] as number) ?? 0,
      updatedAt: (meta["updated_at"] as number) ?? 0,
      metadata: (meta["extra"] as Record<string, unknown>) ?? {},
      importance: (meta["importance"] as number) ?? 0.5,
      accessCount: (meta["access_count"] as number) ?? 0,
    });

    // Track access if requested
    if (trackAccess) {
      memory.accessCount += 1;
      this._updateAccessCount(memoryId, memory.accessCount);
      this._updateSqliteAccessCount(memoryId, memory.accessCount);
    }

    return memory;
  }

  private _getMemorySqlite(memoryId: string): CoreMemory | null {
    const conn = this._getCoreConnection();
    let row: Record<string, unknown> | undefined;
    try {
      row = conn
        .prepare(
          `
          SELECT id, content, summary, archived, created_at, updated_at,
                 metadata, importance, access_count
          FROM core_memories WHERE id = ?
        `
        )
        .get(memoryId) as Record<string, unknown> | undefined;
    } finally {
      conn.close();
    }

    if (!row) {
      return null;
    }

    const metadata = this._parseMetadata(row.metadata as string | null);
    return new CoreMemory({
      id: row.id as string,
      content: row.content as string,
      summary: (row.summary as string | null) ?? null,
      archived: Boolean(row.archived),
      createdAt:
        row.created_at !== null && row.created_at !== undefined
          ? (row.created_at as number)
          : 0,
      updatedAt:
        row.updated_at !== null && row.updated_at !== undefined
          ? (row.updated_at as number)
          : 0,
      metadata,
      importance:
        row.importance !== null && row.importance !== undefined
          ? (row.importance as number)
          : 0.5,
      accessCount:
        row.access_count !== null && row.access_count !== undefined
          ? (row.access_count as number)
          : 0,
    });
  }

  /**
   * Retrieve a memory by ID (legacy API).
   */
  getMemory(memoryId: string): CoreMemory | null {
    const memory = this._getMemorySqlite(memoryId);
    if (memory) {
      return memory;
    }

    if (this._vectorSearch !== null) {
      return this.get(memoryId);
    }
    return null;
  }

  /**
   * Retrieve all memories, optionally including archived entries.
   */
  getMemories(params: {
    includeArchived?: boolean;
    limit?: number | null;
  } = {}): CoreMemory[] {
    const { includeArchived = false, limit = null } = params;

    const conn = this._getCoreConnection();
    let rows: Array<Record<string, unknown>>;
    try {
      let query =
        "SELECT id, content, summary, archived, created_at, updated_at, " +
        "metadata, importance, access_count FROM core_memories";
      const sqlParams: unknown[] = [];
      if (!includeArchived) {
        query += " WHERE archived = 0";
      }
      if (limit !== null) {
        query += " LIMIT ?";
        sqlParams.push(limit);
      }
      rows = conn.prepare(query).all(...sqlParams) as Array<Record<string, unknown>>;
    } finally {
      conn.close();
    }

    const memories: CoreMemory[] = [];
    for (const row of rows) {
      const metadata = this._parseMetadata(row.metadata as string | null);
      memories.push(
        new CoreMemory({
          id: row.id as string,
          content: row.content as string,
          summary: (row.summary as string | null) ?? null,
          archived: Boolean(row.archived),
          createdAt:
            row.created_at !== null && row.created_at !== undefined
              ? (row.created_at as number)
              : 0,
          updatedAt:
            row.updated_at !== null && row.updated_at !== undefined
              ? (row.updated_at as number)
              : 0,
          metadata,
          importance:
            row.importance !== null && row.importance !== undefined
              ? (row.importance as number)
              : 0.5,
          accessCount:
            row.access_count !== null && row.access_count !== undefined
              ? (row.access_count as number)
              : 0,
        })
      );
    }

    return memories;
  }

  // ----------------------------------------------------------
  // Access count helpers
  // ----------------------------------------------------------

  private _updateAccessCount(memoryId: string, count: number): void {
    if (this._vectorSearch === null) {
      return;
    }
    const conn = this._vectorSearch._getConnection();
    try {
      const row = conn
        .prepare("SELECT metadata FROM items WHERE id = ?")
        .get(memoryId) as Record<string, unknown> | undefined;
      if (row) {
        const meta = JSON.parse(row.metadata as string) as Record<string, unknown>;
        meta["access_count"] = count;
        conn.prepare("UPDATE items SET metadata = ? WHERE id = ?").run(
          JSON.stringify(meta),
          memoryId
        );
      }
    } finally {
      this._closeOwnedConnection(conn);
    }
  }

  private _updateVectorSummary(memoryId: string, summary: string): void {
    if (this._vectorSearch === null) {
      return;
    }
    const conn = this._vectorSearch._getConnection();
    try {
      const row = conn
        .prepare("SELECT metadata FROM items WHERE id = ?")
        .get(memoryId) as Record<string, unknown> | undefined;
      if (row) {
        const meta = JSON.parse(row.metadata as string) as Record<string, unknown>;
        meta["summary"] = summary;
        meta["updated_at"] = Date.now() / 1000;
        conn.prepare("UPDATE items SET metadata = ? WHERE id = ?").run(
          JSON.stringify(meta),
          memoryId
        );
      }
    } finally {
      this._closeOwnedConnection(conn);
    }
  }

  // ----------------------------------------------------------
  // Search (SQLite fallback)
  // ----------------------------------------------------------

  /**
   * Fallback memory search using SQLite content matching.
   */
  private _searchMemoriesSqlite(params: {
    query: string;
    topK?: number;
    includeArchived?: boolean;
  }): CoreMemory[] {
    const { query, topK = 5, includeArchived = false } = params;
    const trimmedQuery = (query ?? "").trim();
    if (!trimmedQuery) {
      return [];
    }

    const normalizedQuery = trimmedQuery.toLowerCase();
    const altTerms: string[] = [];
    if (normalizedQuery.includes("science fiction")) {
      altTerms.push("sci-fi");
    }

    const tokens = trimmedQuery.split(/\s+/).filter((t) => t.length > 0);
    const searchTerms = [
      ...new Set([
        normalizedQuery,
        ...altTerms,
        ...tokens.map((t) => t.toLowerCase()),
      ]),
    ];

    const conn = this._getCoreConnection();
    let rows: Array<Record<string, unknown>>;
    try {
      const likeClause = searchTerms
        .map(() => "LOWER(content) LIKE ?")
        .join(" OR ");
      let sql =
        "SELECT id, content, summary, archived, created_at, updated_at, " +
        "metadata, importance, access_count " +
        "FROM core_memories WHERE (" +
        likeClause +
        ")";
      const sqlParams: unknown[] = searchTerms.map((t) => `%${t}%`);
      if (!includeArchived) {
        sql += " AND archived = 0";
      }
      sql += " ORDER BY updated_at DESC LIMIT ?";
      sqlParams.push(Math.max(topK * 3, topK));

      rows = conn.prepare(sql).all(...sqlParams) as Array<Record<string, unknown>>;
    } finally {
      conn.close();
    }

    const scored: Array<[number, CoreMemory]> = [];
    for (const row of rows) {
      const contentLower = ((row.content as string) ?? "").toLowerCase();
      const score = searchTerms.filter((t) => contentLower.includes(t)).length;
      if (score === 0) {
        continue;
      }
      const metadata = this._parseMetadata(row.metadata as string | null);
      scored.push([
        score,
        new CoreMemory({
          id: row.id as string,
          content: row.content as string,
          summary: (row.summary as string | null) ?? null,
          archived: Boolean(row.archived),
          createdAt:
            row.created_at !== null && row.created_at !== undefined
              ? (row.created_at as number)
              : 0,
          updatedAt:
            row.updated_at !== null && row.updated_at !== undefined
              ? (row.updated_at as number)
              : 0,
          metadata,
          importance:
            row.importance !== null && row.importance !== undefined
              ? (row.importance as number)
              : 0.5,
          accessCount:
            row.access_count !== null && row.access_count !== undefined
              ? (row.access_count as number)
              : 0,
        }),
      ]);
    }

    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, topK).map(([, m]) => m);
  }

  /**
   * Semantic search for memories.
   *
   * @param query - Search query
   * @param topK - Maximum results to return
   * @param includeArchived - Whether to include archived memories
   * @returns List of matching CoreMemory objects
   */
  searchMemories(params: {
    query: string;
    topK?: number;
    includeArchived?: boolean;
  }): CoreMemory[] {
    const { query, topK = 5, includeArchived = false } = params;

    if (this._vectorSearch === null) {
      return this._searchMemoriesSqlite({ query, topK, includeArchived });
    }

    let results: Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
    }>;

    try {
      results = this._vectorSearch.searchMemoryVectors(query, topK * 2);
      if (!results || results.length === 0) {
        return this._searchMemoriesSqlite({ query, topK, includeArchived });
      }
    } catch (e) {
      _log.warn(
        `Vector search failed, fallback to sqlite search: ${e}`
      );
      return this._searchMemoriesSqlite({ query, topK, includeArchived });
    }

    const memories: CoreMemory[] = [];

    for (const res of results) {
      const meta = res.metadata;
      const archived = (meta["archived"] as boolean) ?? false;

      // Filter archived unless explicitly included
      if (archived && !includeArchived) {
        continue;
      }

      memories.push(
        new CoreMemory({
          id: res.id,
          content: res.content,
          summary: (meta["summary"] as string | null) ?? null,
          archived,
          createdAt: (meta["created_at"] as number) ?? 0,
          updatedAt: (meta["updated_at"] as number) ?? 0,
          metadata: (meta["extra"] as Record<string, unknown>) ?? {},
          importance: (meta["importance"] as number) ?? 0.5,
          accessCount: (meta["access_count"] as number) ?? 0,
        })
      );

      if (memories.length >= topK) {
        break;
      }
    }

    return memories;
  }

  // ----------------------------------------------------------
  // Archive (soft delete)
  // ----------------------------------------------------------

  /**
   * Archive a memory (soft delete) via vector search.
   *
   * @param memoryId - Memory identifier
   * @returns True if archived, False if not found
   */
  archive(memoryId: string): boolean {
    const memory = this.get(memoryId);
    if (!memory) {
      return false;
    }

    memory.archived = true;
    memory.updatedAt = Date.now() / 1000;

    if (this._vectorSearch === null) {
      return false;
    }

    // Update metadata in storage
    const conn = this._vectorSearch._getConnection();
    try {
      const row = conn
        .prepare("SELECT metadata FROM items WHERE id = ?")
        .get(memoryId) as Record<string, unknown> | undefined;
      if (row) {
        const meta = JSON.parse(row.metadata as string) as Record<string, unknown>;
        meta["archived"] = true;
        meta["updated_at"] = memory.updatedAt;
        conn.prepare("UPDATE items SET metadata = ? WHERE id = ?").run(
          JSON.stringify(meta),
          memoryId
        );
        return true;
      }
      return false;
    } finally {
      conn.close();
    }
  }

  /**
   * Archive a memory (soft delete) - legacy API.
   */
  archiveMemory(memoryId: string): boolean {
    const now = Date.now() / 1000;
    const pendingVectorSync = this._vectorSearch === null ? 1 : 0;
    const conn = this._getCoreConnection();
    try {
      conn.prepare(
        `
        UPDATE core_memories
        SET archived = 1, updated_at = ?, pending_vector_sync = ?
        WHERE id = ?
      `
      ).run(now, pendingVectorSync, memoryId);
    } finally {
      conn.close();
    }

    if (this._vectorSearch !== null) {
      try {
        if (!this.archive(memoryId)) {
          throw new Error("Vector archive failed");
        }
        this._setPendingVectorSync(memoryId, false);
      } catch (e) {
        _log.error(
          `Vector archive failed for memory ${memoryId.slice(0, 8)}...: ${e}`
        );
        this._setPendingVectorSync(memoryId, true);
        return false;
      }
    }

    return true;
  }

  // ----------------------------------------------------------
  // Delete (hard delete)
  // ----------------------------------------------------------

  /**
   * Hard delete a memory via vector search.
   *
   * @param memoryId - Memory identifier
   * @returns True if deleted
   */
  delete(memoryId: string): boolean {
    if (this._vectorSearch !== null) {
      this._vectorSearch.deleteVector(memoryId);
    }
    return true;
  }

  /**
   * Hard delete a memory - legacy API.
   */
  deleteMemory(memoryId: string): boolean {
    if (this._vectorSearch !== null) {
      try {
        this.delete(memoryId);
      } catch (e) {
        _log.error(
          `Vector delete failed for memory ${memoryId.slice(0, 8)}...: ${e}`
        );
        return false;
      }
    }

    const conn = this._getCoreConnection();
    try {
      conn.prepare("DELETE FROM core_memories WHERE id = ?").run(memoryId);
    } finally {
      conn.close();
    }

    return true;
  }

  // ----------------------------------------------------------
  // Summary generation
  // ----------------------------------------------------------

  /**
   * Generate AI summary for a memory.
   *
   * @param memoryId - Memory identifier
   * @param tool - Optional summary tool (object with summarize method, or callable)
   * @param force - Whether to force regeneration
   * @returns Generated summary string
   */
  generateSummary(params: {
    memoryId: string;
    tool?: unknown;
    force?: boolean;
  }): string {
    let { memoryId, tool, force = false } = params;

    // Handle legacy positional arg: generateSummary(memoryId, bool)
    if (typeof tool === "boolean") {
      force = tool;
      tool = undefined;
    }

    let memory = this.getMemory(memoryId);
    if (memory === null && this._vectorSearch !== null) {
      memory = this.get(memoryId);
    }

    if (!memory) {
      _log.warn(`Memory not found: ${memoryId}`);
      return "";
    }

    if (memory.summary && !force) {
      return memory.summary;
    }

    let summary: string | null = null;

    // Try tool-based summary
    if (tool !== null && tool !== undefined) {
      try {
        if (
          typeof tool === "object" &&
          tool !== null &&
          "summarize" in tool &&
          typeof (tool as Record<string, unknown>).summarize === "function"
        ) {
          summary = ((tool as Record<string, unknown>).summarize as (s: string) => string)(
            memory.content
          );
        } else if (typeof tool === "function") {
          summary = (tool as (s: string) => string)(memory.content);
        }
      } catch (e) {
        _log.error(`Summary generation failed: ${e}`);
        summary = null;
      }
    }

    // Try configured summary generator
    if (summary === null && this._summaryGenerator) {
      try {
        summary = this._summaryGenerator(memory.content);
      } catch (e) {
        _log.error(`Summary generation failed: ${e}`);
        summary = null;
      }
    }

    // Fallback: truncate content
    if (summary === null) {
      summary = memory.content.slice(0, 120);
    }

    // Persist summary to SQLite
    const updatedAt = Date.now() / 1000;
    const conn = this._getCoreConnection();
    try {
      const row = conn
        .prepare("SELECT metadata FROM core_memories WHERE id = ?")
        .get(memoryId) as Record<string, unknown> | undefined;
      const metadata = this._parseMetadata(
        row ? (row.metadata as string | null) : null
      );
      metadata["summary"] = summary;
      conn.prepare(
        "UPDATE core_memories SET summary = ?, metadata = ?, updated_at = ? WHERE id = ?"
      ).run(summary, JSON.stringify(metadata), updatedAt, memoryId);
    } finally {
      conn.close();
    }

    // Sync to vector search
    if (this._vectorSearch !== null) {
      try {
        this._updateVectorSummary(memoryId, summary);
        this._setPendingVectorSync(memoryId, false);
      } catch (e) {
        _log.error(
          `Vector summary update failed for memory ${memoryId.slice(0, 8)}...: ${e}`
        );
        this._setPendingVectorSync(memoryId, true);
      }
    }

    return summary;
  }

  /**
   * Generate a simple extractive summary.
   *
   * @param content - Content to summarize
   * @param maxLength - Maximum summary length
   * @returns Extractive summary
   */
  private _defaultSummary(content: string, maxLength: number = 200): string {
    // Simple extractive summary: first sentence or truncated content
    const sentences = content.replace(/\n/g, " ").split(".");
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      if (firstSentence.length > 0 && firstSentence.length <= maxLength) {
        return firstSentence + ".";
      }
    }

    // Truncate if too long
    if (content.length > maxLength) {
      return content.slice(0, maxLength - 3).trim() + "...";
    }
    return content;
  }

  // ----------------------------------------------------------
  // List all
  // ----------------------------------------------------------

  /**
   * List all memories.
   *
   * @param includeArchived - Whether to include archived memories
   * @param limit - Maximum number of memories to return
   * @returns List of CoreMemory objects
   */
  listAll(params: { includeArchived?: boolean; limit?: number } = {}): CoreMemory[] {
    const { includeArchived = false, limit = 100 } = params;

    if (this._vectorSearch === null) {
      return this.getMemories({ includeArchived, limit });
    }

    const conn = this._vectorSearch._getConnection();
    try {
      const rows = conn
        .prepare(
          "SELECT id, content, metadata FROM items WHERE type = 'memory' LIMIT ?"
        )
        .all(limit) as Array<Record<string, unknown>>;

      const memories: CoreMemory[] = [];
      for (const row of rows) {
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(row.metadata as string) as Record<string, unknown>; } catch { /* skip corrupted row */ continue; }
        const archived = (meta["archived"] as boolean) ?? false;

        if (archived && !includeArchived) {
          continue;
        }

        memories.push(
          new CoreMemory({
            id: row.id as string,
            content: row.content as string,
            summary: (meta["summary"] as string | null) ?? null,
            archived,
            createdAt: (meta["created_at"] as number) ?? 0,
            updatedAt: (meta["updated_at"] as number) ?? 0,
            metadata: (meta["extra"] as Record<string, unknown>) ?? {},
            importance: (meta["importance"] as number) ?? 0.5,
            accessCount: (meta["access_count"] as number) ?? 0,
          })
        );
      }

      return memories;
    } finally {
      this._closeOwnedConnection(conn);
    }
  }
}

// ============================================================
// Singleton and factory
// ============================================================

let _coreMemoryStore: CoreMemoryStore | null = null;

/** Get or create CoreMemoryStore singleton. */
export function getCoreMemoryStore(params?: {
  vectorSearch?: CoreSearchInterface | null;
  summaryGenerator?: ((content: string) => string) | null;
  dbPath?: string | null;
}): CoreMemoryStore {
  if (_coreMemoryStore === null) {
    _coreMemoryStore = new CoreMemoryStore(params ?? {});
  }
  return _coreMemoryStore;
}

/** Reset CoreMemoryStore singleton (for testing). */
export function resetCoreMemoryStore(): void {
  _coreMemoryStore = null;
}

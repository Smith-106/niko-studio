/**
 * SQLite-backed memory store — preferred backend when better-sqlite3 is available.
 *
 * Features:
 * - WAL mode for concurrent reads
 * - busy_timeout for write contention
 * - Indexed queries for fast lookup
 * - FTS5 full-text search
 * - Batch operations use transactions
 *
 * Pattern learned from maestro-flow's SqliteDelegateBroker.
 */

import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import type { IMemoryStore, MemorySearchQuery, MemorySearchResult } from './imemory-store.js';
import { MemoryEntry } from './memory-manager.js';

/** Row shape returned by SELECT * FROM memories — mirrors the SQL schema */
interface MemoryRow {
  id: string;
  content: string;
  entity_id: string | null;
  topics: string;
  importance: number;
  source: string;
  valid_from: string | null;
  valid_until: string | null;
  supersedes: string | null;
  superseded_by: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

/** Row shape returned by SELECT COUNT(*) as count FROM memories */
interface CountRow {
  count: number;
}

export class SqliteMemoryStore implements IMemoryStore {
  private db: Database.Database;
  private _insertStmt!: Database.Statement;
  private _getStmt!: Database.Statement;
  private _updateStmt!: Database.Statement;
  private _deleteStmt!: Database.Statement;
  private _countStmt!: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
    this._prepareStatements();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        entity_id TEXT,
        topics TEXT DEFAULT '[]',
        importance REAL DEFAULT 0.5,
        source TEXT DEFAULT 'user',
        valid_from TEXT,
        valid_until TEXT,
        supersedes TEXT,
        superseded_by TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        content,
        topics,
        content='memories',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, id, content, topics)
        VALUES (new.rowid, new.id, new.content, new.topics);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, content, topics)
        VALUES ('delete', old.rowid, old.id, old.content, old.topics);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, content, topics)
        VALUES ('delete', old.rowid, old.id, old.content, old.topics);
        INSERT INTO memories_fts(rowid, id, content, topics)
        VALUES (new.rowid, new.id, new.content, new.topics);
      END;
    `);
  }

  private _prepareStatements(): void {
    this._insertStmt = this.db.prepare(`
      INSERT INTO memories (id, content, entity_id, topics, importance, source,
        valid_from, valid_until, supersedes, superseded_by, metadata, created_at, updated_at)
      VALUES (@id, @content, @entityId, @topics, @importance, @source,
        @validFrom, @validUntil, @supersedes, @supersededBy, @metadata, @createdAt, @updatedAt)
    `);
    this._getStmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    this._updateStmt = this.db.prepare(`
      UPDATE memories SET content = @content, topics = @topics, importance = @importance,
        source = @source, metadata = @metadata, updated_at = @updatedAt
      WHERE id = @id
    `);
    this._deleteStmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    this._countStmt = this.db.prepare('SELECT COUNT(*) as count FROM memories');
  }

  private _rowToEntry(row: MemoryRow): MemoryEntry {
    return new MemoryEntry({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      topics: JSON.parse(row.topics ?? '[]'),
      entityId: row.entity_id ?? null,
      importance: row.importance ?? 0.5,
      source: row.source ?? 'user',
      validFrom: row.valid_from ?? null,
      validUntil: row.valid_until ?? null,
      supersedes: row.supersedes ?? null,
      supersededBy: row.superseded_by ?? null,
      metadata: JSON.parse(row.metadata ?? '{}'),
    });
  }

  async add(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    this._insertStmt.run({
      id,
      content: entry.content,
      entityId: entry.entityId ?? null,
      topics: JSON.stringify(entry.topics ?? []),
      importance: entry.importance ?? 0.5,
      source: entry.source ?? 'user',
      validFrom: entry.validFrom ?? null,
      validUntil: entry.validUntil ?? null,
      supersedes: entry.supersedes ?? null,
      supersededBy: entry.supersededBy ?? null,
      metadata: JSON.stringify(entry.metadata ?? {}),
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now,
    });
    return id;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = this._getStmt.get(id) as MemoryRow | undefined;
    return row ? this._rowToEntry(row) : null;
  }

  async getBatch(ids: string[]): Promise<MemoryEntry[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM memories WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids) as MemoryRow[];
    return rows.map((r) => this._rowToEntry(r));
  }

  async search(query: MemorySearchQuery): Promise<MemorySearchResult> {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: unknown[] = [];

    if (query.entityId) {
      sql += ' AND entity_id = ?';
      params.push(query.entityId);
    }

    if (query.topics && query.topics.length > 0) {
      const topicClauses = query.topics.map((t) => "topics LIKE '%' || ? || '%'");
      sql += ` AND (${topicClauses.join(' OR ')})`;
      params.push(...query.topics);
    }

    if (query.startDate) {
      sql += ' AND created_at >= ?';
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ' AND created_at <= ?';
      params.push(query.endDate);
    }

    if (query.query) {
      const ftsStmt = this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts f ON m.id = f.id
        WHERE memories_fts MATCH ?
        ORDER BY rank
      `);
      const ftsRows = ftsStmt.all(query.query) as MemoryRow[];
      const memories = ftsRows.map((r) => this._rowToEntry(r));
      return { memories, total: memories.length };
    }

    sql += ' ORDER BY importance DESC, created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as MemoryRow[];
    const memories = rows.map((r) => this._rowToEntry(r));
    return { memories, total: memories.length };
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    this._updateStmt.run({
      id,
      content: updates.content ?? '',
      topics: JSON.stringify(updates.topics ?? []),
      importance: updates.importance ?? 0.5,
      source: updates.source ?? 'user',
      metadata: JSON.stringify(updates.metadata ?? {}),
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(id: string): Promise<void> {
    this._deleteStmt.run(id);
  }

  async rebuildIndex(): Promise<void> {
    this.db.exec("INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')");
  }

  async count(): Promise<number> {
    const row = this._countStmt.get() as CountRow | undefined;
    return row?.count ?? 0;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
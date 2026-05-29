import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { EventEmitter } from 'events'
import Database from 'better-sqlite3'

export interface SyncStateEntry {
  vault_path: string
  note_path: string
  entity_id: string | null
  vault_mtime: number
  vault_hash: string
  knowledge_mtime: number | null
  knowledge_hash: string | null
  last_sync_at: number
  sync_direction: 'vault-to-knowledge' | 'knowledge-to-vault' | null
}

export interface SyncConflict {
  id: string
  vault_path: string
  note_path: string
  entity_id: string | null
  vault_content: string
  knowledge_content: string
  detected_at: number
  resolved_at: number | null
  resolution: 'vault-wins' | 'knowledge-wins' | 'manual-merge' | null
}

export type ConflictStrategy = 'vault-wins' | 'knowledge-wins' | 'manual'

export class SyncStateStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        vault_path TEXT NOT NULL,
        note_path TEXT NOT NULL,
        entity_id TEXT,
        vault_mtime REAL NOT NULL,
        vault_hash TEXT NOT NULL,
        knowledge_mtime REAL,
        knowledge_hash TEXT,
        last_sync_at REAL NOT NULL,
        sync_direction TEXT,
        PRIMARY KEY (vault_path, note_path)
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        vault_path TEXT NOT NULL,
        note_path TEXT NOT NULL,
        entity_id TEXT,
        vault_content TEXT NOT NULL,
        knowledge_content TEXT NOT NULL,
        detected_at REAL NOT NULL,
        resolved_at REAL,
        resolution TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved
        ON sync_conflicts(vault_path, resolved_at);
    `)
  }

  getSyncState(vaultPath: string, notePath: string): SyncStateEntry | undefined {
    return this.db
      .prepare('SELECT * FROM sync_state WHERE vault_path = ? AND note_path = ?')
      .get(vaultPath, notePath) as SyncStateEntry | undefined
  }

  upsertSyncState(entry: SyncStateEntry) {
    this.db
      .prepare(
        `INSERT INTO sync_state (vault_path, note_path, entity_id, vault_mtime, vault_hash, knowledge_mtime, knowledge_hash, last_sync_at, sync_direction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(vault_path, note_path) DO UPDATE SET
           entity_id = excluded.entity_id,
           vault_mtime = excluded.vault_mtime,
           vault_hash = excluded.vault_hash,
           knowledge_mtime = excluded.knowledge_mtime,
           knowledge_hash = excluded.knowledge_hash,
           last_sync_at = excluded.last_sync_at,
           sync_direction = excluded.sync_direction`,
      )
      .run(
        entry.vault_path,
        entry.note_path,
        entry.entity_id,
        entry.vault_mtime,
        entry.vault_hash,
        entry.knowledge_mtime,
        entry.knowledge_hash,
        entry.last_sync_at,
        entry.sync_direction,
      )
  }

  detectChanges(vaultPath: string, notes: Array<{ path: string; mtime: number; content: string }>): Array<{ path: string; type: 'created' | 'modified' | 'deleted' }> {
    const changes: Array<{ path: string; type: 'created' | 'modified' | 'deleted' }> = []
    const existingPaths = new Set(
      (this.db
        .prepare('SELECT note_path FROM sync_state WHERE vault_path = ?')
        .all(vaultPath) as Array<{ note_path: string }>).map((r) => r.note_path),
    )

    for (const note of notes) {
      const relPath = note.path
      const existing = this.getSyncState(vaultPath, relPath)
      const hash = this.computeHash(note.content)

      if (!existing) {
        changes.push({ path: relPath, type: 'created' })
      } else if (existing.vault_mtime < note.mtime && existing.vault_hash !== hash) {
        changes.push({ path: relPath, type: 'modified' })
      }

      existingPaths.delete(relPath)
    }

    for (const deletedPath of existingPaths) {
      changes.push({ path: deletedPath, type: 'deleted' })
    }

    return changes
  }

  addConflict(conflict: Omit<SyncConflict, 'id'>): string {
    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO sync_conflicts (id, vault_path, note_path, entity_id, vault_content, knowledge_content, detected_at, resolved_at, resolution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        conflict.vault_path,
        conflict.note_path,
        conflict.entity_id,
        conflict.vault_content,
        conflict.knowledge_content,
        conflict.detected_at,
        conflict.resolved_at,
        conflict.resolution,
      )
    return id
  }

  getUnresolvedConflicts(vaultPath: string): SyncConflict[] {
    return this.db
      .prepare('SELECT * FROM sync_conflicts WHERE vault_path = ? AND resolved_at IS NULL')
      .all(vaultPath) as SyncConflict[]
  }

  resolveConflict(id: string, resolution: SyncConflict['resolution']) {
    this.db
      .prepare('UPDATE sync_conflicts SET resolved_at = ?, resolution = ? WHERE id = ?')
      .run(Date.now(), resolution, id)
  }

  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  close() {
    this.db.close()
  }
}

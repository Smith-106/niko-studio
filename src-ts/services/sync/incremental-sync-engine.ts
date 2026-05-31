import { createHash } from 'crypto'
import Database from 'better-sqlite3'
import path from 'path'

export interface SyncState {
  localId: string
  remoteId: string
  entityHash: string
  lastSyncAt: number
  direction: 'push' | 'pull' | 'bidirectional'
}

export class IncrementalSyncEngine {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        local_id TEXT PRIMARY KEY,
        remote_id TEXT NOT NULL,
        entity_hash TEXT NOT NULL,
        last_sync_at INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'bidirectional',
        UNIQUE(remote_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sync_remote ON sync_state(remote_id);
      CREATE INDEX IF NOT EXISTS idx_sync_hash ON sync_state(entity_hash);
    `)
  }

  /** 计算实体内容哈希 */
  hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
  }

  /** 检查本地实体是否已变更 */
  hasChanged(localId: string, currentContent: string): boolean {
    const row = this.db.prepare('SELECT entity_hash FROM sync_state WHERE local_id = ?').get(localId) as { entity_hash: string } | undefined
    if (!row) return true // 新实体
    return row.entity_hash !== this.hashContent(currentContent)
  }

  /** 记录同步状态 */
  recordSync(localId: string, remoteId: string, content: string, direction: 'push' | 'pull' | 'bidirectional' = 'bidirectional') {
    this.db.prepare(`
      INSERT OR REPLACE INTO sync_state (local_id, remote_id, entity_hash, last_sync_at, direction)
      VALUES (?, ?, ?, ?, ?)
    `).run(localId, remoteId, this.hashContent(content), Date.now(), direction)
  }

  /** 获取映射：local_id → remote_id */
  getRemoteId(localId: string): string | null {
    const row = this.db.prepare('SELECT remote_id FROM sync_state WHERE local_id = ?').get(localId) as { remote_id: string } | undefined
    return row?.remoteId ?? null
  }

  /** 获取映射：remote_id → local_id */
  getLocalId(remoteId: string): string | null {
    const row = this.db.prepare('SELECT local_id FROM sync_state WHERE remote_id = ?').get(remoteId) as { local_id: string } | undefined
    return row?.local_id ?? null
  }

  /** 获取自 lastSyncAfter 以来变更的实体 */
  getStaleEntities(sinceTimestamp: number): SyncState[] {
    return this.db.prepare('SELECT * FROM sync_state WHERE last_sync_at < ?').all(sinceTimestamp) as SyncState[]
  }

  /** 删除映射 */
  removeMapping(localId: string) {
    this.db.prepare('DELETE FROM sync_state WHERE local_id = ?').run(localId)
  }

  /** 关闭数据库 */
  close() {
    this.db.close()
  }
}

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

/**
 * 数据库迁移：memory.db + graph.db → narrative.db
 * 合并所有表到单一数据库，新增 foreshadows 和 sync_state 表
 */
export function migrateToNarrativeDB(dataDir: string): { success: boolean; tables: string[]; errors: string[] } {
  const result = { success: false, tables: [] as string[], errors: [] as string[] }
  const narrativePath = path.join(dataDir, 'narrative.db')
  const memoryPath = path.join(dataDir, 'memory.db')
  const graphPath = path.join(dataDir, 'graph.db')

  try {
    const narrative = new Database(narrativePath)
    narrative.pragma('journal_mode = WAL')

    // 创建新表结构
    narrative.exec(`
      -- 记忆表（合并自 memory.db）
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        dimension TEXT NOT NULL,
        content TEXT NOT NULL,
        entity_id TEXT,
        importance REAL DEFAULT 0.5,
        source TEXT,
        topics TEXT,
        valid_from INTEGER,
        valid_until INTEGER,
        supersedes TEXT,
        superseded_by TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      -- 实体表（合并自 graph.db）
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        aliases TEXT,
        properties TEXT,
        tags TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      -- 关系表（合并自 graph.db）
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (source_id) REFERENCES entities(id),
        FOREIGN KEY (target_id) REFERENCES entities(id)
      );

      -- 伏笔追踪表（新增）
      CREATE TABLE IF NOT EXISTS foreshadows (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        hint TEXT NOT NULL,
        planted_chapter INTEGER NOT NULL,
        max_distance INTEGER DEFAULT 50,
        reminder_threshold INTEGER DEFAULT 10,
        state TEXT DEFAULT 'planted' CHECK(state IN ('planted','approaching','due','resolved','expired')),
        resolved_chapter INTEGER,
        resolution TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      );

      -- 同步状态表（新增）
      CREATE TABLE IF NOT EXISTS sync_state (
        local_id TEXT PRIMARY KEY,
        remote_id TEXT NOT NULL,
        entity_hash TEXT NOT NULL,
        last_sync_at INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'bidirectional',
        UNIQUE(remote_id)
      );

      -- 索引
      CREATE INDEX IF NOT EXISTS idx_memories_dimension ON memories(dimension);
      CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
      CREATE INDEX IF NOT EXISTS idx_foreshadows_state ON foreshadows(state);
      CREATE INDEX IF NOT EXISTS idx_foreshadows_entity ON foreshadows(entity_id);
      CREATE INDEX IF NOT EXISTS idx_sync_remote ON sync_state(remote_id);
    `)

    // 从旧 memory.db 迁移数据
    if (fs.existsSync(memoryPath)) {
      try {
        const memDb = new Database(memoryPath, { readonly: true })
        const tables = memDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
        for (const t of tables) {
          if (t.name.startsWith('memories')) {
            const rows = memDb.prepare('SELECT * FROM memories').all() as any[]
            const insert = narrative.prepare(
              'INSERT OR IGNORE INTO memories (id, dimension, content, entity_id, importance, source, topics, valid_from, valid_until, supersedes, superseded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            for (const row of rows) {
              insert.run(row.id, row.dimension ?? 'context', row.content, row.entity_id, row.importance ?? 0.5, row.source, row.topics, row.valid_from, row.valid_until, row.supersedes, row.superseded_by, row.created_at, row.updated_at)
            }
            result.tables.push(`memories (${rows.length} rows)`)
          }
        }
        memDb.close()
      } catch (err) {
        result.errors.push(`memory.db migration: ${err}`)
      }
    }

    // 从旧 graph.db 迁移数据
    if (fs.existsSync(graphPath)) {
      try {
        const graphDb = new Database(graphPath, { readonly: true })
        // 迁移实体
        const entityRows = graphDb.prepare('SELECT * FROM entities').all() as any[]
        const insertEntity = narrative.prepare(
          'INSERT OR IGNORE INTO entities (id, type, name, description, aliases, properties, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        for (const row of entityRows) {
          insertEntity.run(row.id, row.type, row.name, row.description, row.aliases, row.properties, row.tags, row.created_at, row.updated_at)
        }
        result.tables.push(`entities (${entityRows.length} rows)`)

        // 迁移关系
        const relationRows = graphDb.prepare('SELECT * FROM relations').all() as any[]
        const insertRelation = narrative.prepare(
          'INSERT OR IGNORE INTO relations (id, source_id, target_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        for (const row of relationRows) {
          insertRelation.run(row.id, row.source_id, row.target_id, row.type, row.properties, row.created_at)
        }
        result.tables.push(`relations (${relationRows.length} rows)`)

        graphDb.close()
      } catch (err) {
        result.errors.push(`graph.db migration: ${err}`)
      }
    }

    narrative.close()
    result.success = result.errors.length === 0
  } catch (err) {
    result.errors.push(`narrative.db creation: ${err}`)
  }

  return result
}

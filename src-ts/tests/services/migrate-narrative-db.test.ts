import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'

import { migrateToNarrativeDB } from '../../services/migrate-narrative-db'

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-narrative-migrate-'))
}

function listTableNames(db: Database.Database): string[] {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name)
}

describe('services/migrate-narrative-db', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true })
    }
  })

  it('migrates legacy memory and graph databases into narrative.db with fallback defaults', () => {
    const dataDir = createTempDir()
    tempDirs.push(dataDir)

    const memoryDb = new Database(join(dataDir, 'memory.db'))
    memoryDb.exec(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        dimension TEXT,
        content TEXT NOT NULL,
        entity_id TEXT,
        importance REAL,
        source TEXT,
        topics TEXT,
        valid_from INTEGER,
        valid_until INTEGER,
        supersedes TEXT,
        superseded_by TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `)
    memoryDb
      .prepare(`
        INSERT INTO memories (
          id, dimension, content, entity_id, importance, source, topics,
          valid_from, valid_until, supersedes, superseded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        'mem-1',
        null,
        'Legacy memory content',
        'entity-1',
        null,
        'draft',
        '["hero"]',
        10,
        20,
        null,
        null,
        111,
        222,
      )
    memoryDb.close()

    const graphDb = new Database(join(dataDir, 'graph.db'))
    graphDb.exec(`
      CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        aliases TEXT,
        properties TEXT,
        tags TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
      CREATE TABLE relations (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT,
        created_at INTEGER
      );
    `)
    graphDb
      .prepare(`
        INSERT INTO entities (
          id, type, name, description, aliases, properties, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        'entity-1',
        'Character',
        'Lin',
        'Lead investigator',
        '["林岚"]',
        '{"role":"lead"}',
        '["main"]',
        333,
        444,
      )
    graphDb
      .prepare(`
        INSERT INTO relations (
          id, source_id, target_id, type, properties, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run('rel-1', 'entity-1', 'entity-1', 'KNOWS', '{"strength":1}', 555)
    graphDb.close()

    const result = migrateToNarrativeDB(dataDir)

    expect(result).toEqual({
      success: true,
      tables: ['memories (1 rows)', 'entities (1 rows)', 'relations (1 rows)'],
      errors: [],
    })

    const narrativeDb = new Database(join(dataDir, 'narrative.db'), { readonly: true })
    try {
      const memoryRow = narrativeDb
        .prepare('SELECT * FROM memories WHERE id = ?')
        .get('mem-1') as {
          id: string
          dimension: string
          content: string
          entity_id: string
          importance: number
          source: string
        }
      expect(memoryRow).toMatchObject({
        id: 'mem-1',
        dimension: 'context',
        content: 'Legacy memory content',
        entity_id: 'entity-1',
        importance: 0.5,
        source: 'draft',
      })

      const entityRow = narrativeDb
        .prepare('SELECT * FROM entities WHERE id = ?')
        .get('entity-1') as { name: string; type: string }
      expect(entityRow).toMatchObject({
        name: 'Lin',
        type: 'Character',
      })

      const relationRow = narrativeDb
        .prepare('SELECT * FROM relations WHERE id = ?')
        .get('rel-1') as { source_id: string; target_id: string; type: string }
      expect(relationRow).toMatchObject({
        source_id: 'entity-1',
        target_id: 'entity-1',
        type: 'KNOWS',
      })

      const tables = listTableNames(narrativeDb)
      expect(tables).toEqual(
        expect.arrayContaining(['memories', 'entities', 'relations', 'foreshadows', 'sync_state']),
      )
    } finally {
      narrativeDb.close()
    }
  })

  it('creates the consolidated narrative schema even when no legacy databases exist', () => {
    const dataDir = createTempDir()
    tempDirs.push(dataDir)

    const result = migrateToNarrativeDB(dataDir)

    expect(result).toEqual({
      success: true,
      tables: [],
      errors: [],
    })

    const narrativeDb = new Database(join(dataDir, 'narrative.db'), { readonly: true })
    try {
      const tables = listTableNames(narrativeDb)
      expect(tables).toEqual(
        expect.arrayContaining(['memories', 'entities', 'relations', 'foreshadows', 'sync_state']),
      )
      expect(
        (narrativeDb.prepare('SELECT COUNT(*) AS count FROM memories').get() as { count: number }).count,
      ).toBe(0)
    } finally {
      narrativeDb.close()
    }
  })

  it('reports per-database migration errors when legacy files are invalid', () => {
    const dataDir = createTempDir()
    tempDirs.push(dataDir)

    writeFileSync(join(dataDir, 'memory.db'), 'not a sqlite database')
    writeFileSync(join(dataDir, 'graph.db'), 'still not a sqlite database')

    const result = migrateToNarrativeDB(dataDir)

    expect(result.success).toBe(false)
    expect(result.tables).toEqual([])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('memory.db migration:')
    expect(result.errors[1]).toContain('graph.db migration:')
  })

  it('reports narrative creation failures when the target directory cannot be opened', () => {
    const dataDir = join(createTempDir(), 'missing-parent', 'nested')

    const result = migrateToNarrativeDB(dataDir)

    expect(result.success).toBe(false)
    expect(result.tables).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('narrative.db creation:')
  })
})

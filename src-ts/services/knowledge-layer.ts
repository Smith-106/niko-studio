/**
 * KnowledgeLayer - Unified Knowledge Layer (OpenKL-inspired)
 *
 * Migrated from src/services/knowledge_layer.py.
 *
 * Combines Vector Search (via IndexingService) with Graph capabilities
 * (SQLite-based Entity/Relation store). Acts as the "Hippocampus" for the Agent System.
 */

import Database from 'better-sqlite3';
import { join, dirname, basename, resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { IndexingService } from './indexing-service';
import type { FileChangeEvent } from './file-sync';

/**
 * Hybrid search result combining vector chunks and graph entities
 */
export interface HybridSearchResult {
  chunks: Array<{
    id: string;
    content: string;
    source_type: string;
    score: number;
  }>;
  entities: EntityRecord[];
}

/**
 * Entity record from the knowledge graph
 */
export interface EntityRecord {
  id: string;
  name: string;
  type: string;
  description: string;
  properties: string; // JSON
  created_at: number;
}

/**
 * Neighbor record from graph traversal
 */
export interface NeighborRecord {
  rel_type: string;
  target_name: string;
  target_type: string;
  description: string;
}

/**
 * File sync result
 */
export interface SyncFileResult {
  success: boolean;
  action: string;
  message: string;
  path?: string;
  content_hash?: string;
  doc_id?: string;
}

/**
 * AgentKnowledgeLayer - Unified Knowledge Layer inspired by OpenKL.
 *
 * Combines Vector Search with Graph capabilities.
 */
export class AgentKnowledgeLayer {
  private readonly dbPath: string;
  private readonly vectorStore: IndexingService;
  private _db: Database.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.vectorStore = new IndexingService(dbPath);
    this._initGraphSchema();
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
   * Initialize Graph tables in the same SQLite DB as Vector store.
   */
  private _initGraphSchema(): void {
    const db = this._getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        description TEXT,
        properties TEXT,
        created_at REAL
      )
    `);

    // FTS5 table for fast entity lookup
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts
        USING fts5(name, entity_id UNINDEXED, tokenize='unicode61')
      `);
    } catch {
      console.warn('FTS5 table may already exist or FTS5 is not available');
    }

    // Triggers to keep FTS in sync
    try {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
          INSERT INTO entities_fts(name, entity_id) VALUES (new.name, new.id);
        END;
      `);
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
          DELETE FROM entities_fts WHERE entity_id = old.id;
        END;
      `);
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
          UPDATE entities_fts SET name = new.name WHERE entity_id = old.id;
        END;
      `);
    } catch {
      console.warn('FTS triggers may already exist');
    }

    // Relation table
    db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        target_id TEXT,
        type TEXT,
        properties TEXT,
        created_at REAL,
        FOREIGN KEY(source_id) REFERENCES entities(id),
        FOREIGN KEY(target_id) REFERENCES entities(id)
      )
    `);

    // Provenance: link entities back to source documents
    db.exec(`
      CREATE TABLE IF NOT EXISTS provenance (
        entity_id TEXT,
        chunk_id TEXT,
        FOREIGN KEY(entity_id) REFERENCES entities(id),
        FOREIGN KEY(chunk_id) REFERENCES document_chunks(id)
      )
    `);

    // Backfill FTS if needed
    try {
      const entCount = (db.prepare('SELECT count(*) as cnt FROM entities').get() as { cnt: number }).cnt;
      const ftsCount = (db.prepare('SELECT count(*) as cnt FROM entities_fts').get() as { cnt: number }).cnt;

      if (entCount > 0 && ftsCount === 0) {
        console.log('Backfilling entities_fts index...');
        db.exec("INSERT INTO entities_fts(name, entity_id) SELECT name, id FROM entities");
      }
    } catch (e) {
      console.warn('Failed to populate FTS (schema might be initializing):', e);
    }
  }

  /**
   * Ingest a document into the unified store.
   *
   * @param docId - Unique identifier for the chunk
   * @param content - The text content to embed and store
   * @param sourceType - Category of the document
   */
  addDocument(docId: string, content: string, sourceType: string = 'general'): void {
    this.vectorStore.addDocument(docId, content, sourceType);
    console.log(`Ingested document ${docId} into unified store.`);
  }

  /**
   * Add node to Knowledge Graph
   */
  addEntity(
    entityId: string,
    name: string,
    type: string,
    desc: string = '',
    props: Record<string, unknown> = {}
  ): void {
    const propsJson = JSON.stringify(props);
    const db = this._getDb();

    db.prepare(
      'INSERT OR REPLACE INTO entities (id, name, type, description, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(entityId, name, type, desc, propsJson, Date.now() / 1000);
  }

  /**
   * Add edge to Knowledge Graph
   */
  addRelation(src: string, tgt: string, relType: string, props: Record<string, unknown> = {}): void {
    const relId = `${src}-${relType}-${tgt}`;
    const propsJson = JSON.stringify(props);
    const db = this._getDb();

    db.prepare(
      'INSERT OR REPLACE INTO relations (id, source_id, target_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(relId, src, tgt, relType, propsJson, Date.now() / 1000);
  }

  /**
   * Hybrid Search: Semantic search for chunks + Graph search for entities.
   *
   * @param queryText - The search query
   * @param entityFilter - Additional entity IDs to include
   * @param topK - Number of vector search results
   */
  queryHybrid(
    queryText: string,
    entityFilter: string[] | null = null,
    topK: number = 5
  ): HybridSearchResult {
    const results: HybridSearchResult = {
      chunks: [],
      entities: [],
    };

    // 1. Vector Search
    results.chunks = this.vectorStore.search(queryText, topK);

    // 2. Graph Search with FTS optimization
    const db = this._getDb();

    const cleanQuery = queryText.replace(/[^\w\s]/g, ' ');
    const tokens = cleanQuery.split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 0);

    if (tokens.length > 0) {
      try {
        const ftsTerms = tokens.map((t) => `"${t.replace(/"/g, '""')}"`);
        const ftsQuery = ftsTerms.join(' OR ');

        const querySql = `
          SELECT DISTINCT e.*
          FROM entities e
          JOIN entities_fts f ON e.id = f.entity_id
          WHERE f.name MATCH ?
          AND instr(lower(?), lower(e.name)) > 0
          LIMIT 500
        `;
        const rows = db.prepare(querySql).all(ftsQuery, queryText) as EntityRecord[];
        results.entities = rows;
      } catch {
        // Fallback if FTS table doesn't exist or query is malformed
        console.warn('FTS search failed. Falling back to full scan.');
        const rows = db.prepare(
          "SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0"
        ).all(queryText) as EntityRecord[];
        results.entities = rows;
      }
    } else {
      const rows = db.prepare(
        "SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0"
      ).all(queryText) as EntityRecord[];
      results.entities = rows;
    }

    // Apply entity filters if provided
    if (entityFilter && entityFilter.length > 0) {
      const existingIds = new Set(results.entities.map((e) => e.id));
      const missingIds = entityFilter.filter((eid) => !existingIds.has(eid));

      if (missingIds.length > 0) {
        const placeholders = missingIds.map(() => '?').join(',');
        const extraRows = db.prepare(
          `SELECT * FROM entities WHERE id IN (${placeholders})`
        ).all(...missingIds) as EntityRecord[];
        results.entities.push(...extraRows);
      }
    }

    return results;
  }

  /**
   * Get 1-hop neighbors from graph.
   */
  getNeighbors(entityId: string): NeighborRecord[] {
    const db = this._getDb();

    return db.prepare(`
      SELECT r.type as rel_type, e.name as target_name, e.type as target_type, e.description
      FROM relations r
      JOIN entities e ON r.target_id = e.id
      WHERE r.source_id = ?
    `).all(entityId) as NeighborRecord[];
  }

  /**
   * Sync a file to the knowledge layer.
   *
   * Detects file changes, updates index, and syncs to memories/citations.
   */
  syncFile(filePath: string, force: boolean = false): SyncFileResult {
    if (!existsSync(filePath)) {
      console.warn(`File does not exist: ${filePath}`);
      return { success: false, action: 'error', message: 'File not found' };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const contentHash = createHash('sha256').update(content, 'utf-8').digest('hex');
      const resolvedPath = resolve(filePath);
      const docId = createHash('md5').update(resolvedPath).digest('hex').slice(0, 16);

      // Determine source type based on path
      const pathStr = filePath.toLowerCase();
      let sourceType = 'document';
      if (pathStr.includes('citations')) {
        sourceType = 'citation';
      } else if (pathStr.includes('memories')) {
        sourceType = 'memory';
      }

      this.addDocument(docId, content, sourceType);

      console.log(`Synced file to knowledge layer: ${filePath} (type=${sourceType})`);

      return {
        success: true,
        action: 'synced',
        message: `Synced as ${sourceType}`,
        content_hash: contentHash,
        doc_id: docId,
      };
    } catch (e) {
      console.error(`Failed to sync file ${filePath}: ${e}`);
      return { success: false, action: 'error', message: String(e) };
    }
  }

  /**
   * Sync all matching files in a directory.
   */
  syncDirectory(
    directory: string,
    patterns: string[] = ['*.md', '*.txt', '*.json']
  ): Array<SyncFileResult & { path?: string }> {
    const results: Array<SyncFileResult & { path?: string }> = [];

    if (!existsSync(directory)) {
      console.warn(`Directory does not exist: ${directory}`);
      return results;
    }

    const dirPath = directory;
    for (const pattern of patterns) {
      const ext = pattern.startsWith('*.') ? pattern.slice(1) : pattern;
      this._walkDir(dirPath, ext, (filePath) => {
        const result = this.syncFile(filePath);
        result.path = filePath;
        results.push(result);
      });
    }

    console.log(`Directory sync complete: ${results.length} files`);
    return results;
  }

  /**
   * Walk a directory recursively matching files by extension
   */
  private _walkDir(dir: string, ext: string, callback: (filePath: string) => void): void {
    if (!existsSync(dir)) {
      return;
    }
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        this._walkDir(fullPath, ext, callback);
      } else if (entry.name.toLowerCase().endsWith(ext)) {
        callback(fullPath);
      }
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.vectorStore.close();
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }
}

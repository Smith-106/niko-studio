/**
 * memory-mcp.ts - Knowledge graph MCP server backed by SQLite storage.
 *
 * Migrated from JSON file storage to SQLite for performance and search quality.
 *
 * Provides:
 * - Entity CRUD (create_entities, open_nodes, delete_entities, add_observations)
 * - Relation CRUD (create_relations, delete_relations)
 * - Search (search_nodes) with SQL LIKE + pagination
 * - Graph traversal (get_entity_graph) with BFS
 * - Stats (read_graph, getGraphStats)
 * - Search history / heat tracking (for RRF fusion in Phase 2)
 * - Auto-migration from legacy JSON files
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { homedir } from "node:os";

// ============================================================
// Types
// ============================================================

export interface Entity {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  properties: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  id: string;
  from: string;
  to: string;
  relationType: string;
  properties: Record<string, unknown>;
  weight: number;
  createdAt: string;
}

export interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  entitiesByType: Record<string, number>;
  relationsByType: Record<string, number>;
  avgRelationsPerEntity: number;
}

interface GraphData {
  entities: Record<string, Entity>;
  relations: Record<string, Relation>;
}

/** Search result with heat score for RRF fusion */
export interface SearchEntityResult extends Entity {
  heatScore: number;
}

// ============================================================
// KnowledgeGraphStore - SQLite backed storage
// ============================================================

export class KnowledgeGraphStore {
  private dbPath: string;
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Resolve database path
    const resolvedPath = dbPath ?? path.join(
      homedir(),
      ".niko",
      "memory_graph.db",
    );

    this.dbPath = resolvedPath;

    // Ensure parent directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize SQLite with WAL mode (same pattern as GraphEngine)
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");

    this._initSchema();

    // Auto-migrate from legacy JSON if it exists
    this._migrateFromJson();

    console.info(`KnowledgeGraphStore initialized: ${this.dbPath}`);
  }

  // ---------- Schema ----------

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL DEFAULT 'concept',
        observations TEXT NOT NULL DEFAULT '[]',
        properties TEXT NOT NULL DEFAULT '{}',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_name TEXT NOT NULL,
        to_name TEXT NOT NULL,
        relation_type TEXT NOT NULL DEFAULT 'RELATED_TO',
        properties TEXT NOT NULL DEFAULT '{}',
        weight REAL NOT NULL DEFAULT 1.0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_name);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_name);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);

      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_name TEXT NOT NULL,
        query TEXT NOT NULL,
        hit_count INTEGER DEFAULT 1,
        last_accessed TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_search_entity ON search_history(entity_name);
    `);
  }

  // ---------- JSON Migration ----------

  private _migrateFromJson(): void {
    const jsonPath = this.dbPath.replace(/\.db$/, ".json");
    const bakPath = this.dbPath.replace(/\.db$/, ".json.bak");

    if (!fs.existsSync(jsonPath)) return;

    // Skip if SQLite already has data
    const count = (this.db.prepare("SELECT COUNT(*) as c FROM entities").get() as { c: number }).c;
    if (count > 0) return;

    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const data: GraphData = JSON.parse(raw) as GraphData;

      const insertEntity = this.db.prepare(`
        INSERT OR IGNORE INTO entities (id, name, entity_type, observations, properties, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '[]', ?, ?)
      `);

      const insertRelation = this.db.prepare(`
        INSERT OR IGNORE INTO relations (id, from_name, to_name, relation_type, properties, weight, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction(() => {
        if (data.entities) {
          for (const e of Object.values(data.entities)) {
            insertEntity.run(
              e.id,
              e.name,
              e.entityType ?? "concept",
              JSON.stringify(e.observations ?? []),
              JSON.stringify(e.properties ?? {}),
              e.createdAt ?? new Date().toISOString(),
              e.updatedAt ?? new Date().toISOString(),
            );
          }
        }
        if (data.relations) {
          for (const r of Object.values(data.relations)) {
            insertRelation.run(
              r.id,
              r.from,
              r.to,
              r.relationType ?? "RELATED_TO",
              JSON.stringify(r.properties ?? {}),
              r.weight ?? 1.0,
              r.createdAt ?? new Date().toISOString(),
            );
          }
        }
      });

      transaction();

      // Rename JSON to .bak (rollback point)
      fs.renameSync(jsonPath, bakPath);
      console.info(`Migrated ${jsonPath} → ${this.dbPath} (backup: ${bakPath})`);
    } catch (err) {
      console.error("JSON migration failed:", err);
    }
  }

  // ---------- Entity CRUD ----------

  createEntity(params: {
    name: string;
    entityType?: string;
    observations?: string[];
    properties?: Record<string, unknown>;
    tags?: string[];
  }): { id: string; name: string; status: string } | { error: string; name: string } {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    try {
      this.db.prepare(`
        INSERT INTO entities (id, name, entity_type, observations, properties, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.name,
        params.entityType ?? "concept",
        JSON.stringify(params.observations ?? []),
        JSON.stringify(params.properties ?? {}),
        JSON.stringify(params.tags ?? []),
        now,
        now,
      );
      return { id, name: params.name, status: "created" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE constraint")) {
        return { error: `Entity '${params.name}' already exists`, name: params.name };
      }
      throw err;
    }
  }

  createEntities(
    items: Array<{
      name: string;
      entityType?: string;
      observations?: string[];
      properties?: Record<string, unknown>;
      tags?: string[];
    }>,
  ): Array<{ id: string; name: string; status: string } | { error: string; name: string }> {
    return items.map((item) => this.createEntity(item));
  }

  getEntity(name: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE name = ?").get(name) as DBEntityRow | undefined;
    return row ? this._rowToEntity(row) : null;
  }

  getEntities(names: string[]): Array<Entity & { relations: Relation[] }> {
    const results: Array<Entity & { relations: Relation[] }> = [];
    for (const name of names) {
      const entity = this.getEntity(name);
      if (entity) {
        const rels = this.getEntityRelations(name);
        results.push({ ...entity, relations: rels });
      }
    }
    return results;
  }

  updateEntity(
    name: string,
    updates: {
      observations?: string[];
      properties?: Record<string, unknown>;
      entityType?: string;
      tags?: string[];
    },
  ): { name: string; status: string } | { error: string } {
    const row = this.db.prepare("SELECT * FROM entities WHERE name = ?").get(name) as DBEntityRow | undefined;
    if (!row) {
      return { error: `Entity '${name}' not found` };
    }

    const entity = this._rowToEntity(row);
    const now = new Date().toISOString();

    // Append observations
    if (updates.observations) {
      entity.observations = [...entity.observations, ...updates.observations];
    }

    // Merge properties
    if (updates.properties) {
      entity.properties = { ...entity.properties, ...updates.properties };
    }

    // Update type
    if (updates.entityType) {
      entity.entityType = updates.entityType;
    }

    // Update tags
    if (updates.tags) {
      entity.tags = [...entity.tags, ...updates.tags];
    }

    this.db.prepare(`
      UPDATE entities SET entity_type = ?, observations = ?, properties = ?, tags = ?, updated_at = ?
      WHERE name = ?
    `).run(
      entity.entityType,
      JSON.stringify(entity.observations),
      JSON.stringify(entity.properties),
      JSON.stringify(entity.tags),
      now,
      name,
    );

    return { name, status: "updated" };
  }

  deleteEntity(name: string): { name: string; status: string } | { error: string } {
    const row = this.db.prepare("SELECT id FROM entities WHERE name = ?").get(name) as { id: string } | undefined;
    if (!row) {
      return { error: `Entity '${name}' not found` };
    }

    // Delete relations involving this entity + search history + entity itself
    const transaction = this.db.transaction(() => {
      this.db.prepare("DELETE FROM relations WHERE from_name = ? OR to_name = ?").run(name, name);
      this.db.prepare("DELETE FROM search_history WHERE entity_name = ?").run(name);
      this.db.prepare("DELETE FROM entities WHERE name = ?").run(name);
    });
    transaction();

    return { name, status: "deleted" };
  }

  deleteEntities(names: string[]): Array<{ name: string; status: string } | { error: string }> {
    return names.map((name) => this.deleteEntity(name));
  }

  // ---------- Relation CRUD ----------

  createRelation(params: {
    from: string;
    to: string;
    relationType?: string;
    properties?: Record<string, unknown>;
    weight?: number;
  }): { id: string; from: string; to: string; type: string; status: string } | { error: string } {
    const fromRow = this.db.prepare("SELECT id FROM entities WHERE name = ?").get(params.from) as { id: string } | undefined;
    const toRow = this.db.prepare("SELECT id FROM entities WHERE name = ?").get(params.to) as { id: string } | undefined;

    if (!fromRow) return { error: `Entity '${params.from}' not found` };
    if (!toRow) return { error: `Entity '${params.to}' not found` };

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO relations (id, from_name, to_name, relation_type, properties, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.from,
      params.to,
      params.relationType ?? "RELATED_TO",
      JSON.stringify(params.properties ?? {}),
      params.weight ?? 1.0,
      now,
    );

    return { id, from: params.from, to: params.to, type: params.relationType ?? "RELATED_TO", status: "created" };
  }

  createRelations(
    items: Array<{
      from: string;
      to: string;
      relationType?: string;
      properties?: Record<string, unknown>;
      weight?: number;
    }>,
  ): Array<{ id: string; from: string; to: string; type: string; status: string } | { error: string }> {
    return items.map((item) => this.createRelation(item));
  }

  getEntityRelations(entityName: string, direction: "in" | "out" | "both" = "both"): Relation[] {
    let sql: string;
    if (direction === "out") {
      sql = "SELECT * FROM relations WHERE from_name = ?";
    } else if (direction === "in") {
      sql = "SELECT * FROM relations WHERE to_name = ?";
    } else {
      sql = "SELECT * FROM relations WHERE from_name = ? OR to_name = ?";
    }

    const params = direction === "both" ? [entityName, entityName] : [entityName];
    const rows = this.db.prepare(sql).all(...params) as DBRelationRow[];
    return rows.map((r) => this._rowToRelation(r));
  }

  deleteRelation(relationId: string): { id: string; status: string } | { error: string } {
    const row = this.db.prepare("SELECT id FROM relations WHERE id = ?").get(relationId) as { id: string } | undefined;
    if (!row) {
      return { error: `Relation '${relationId}' not found` };
    }
    this.db.prepare("DELETE FROM relations WHERE id = ?").run(relationId);
    return { id: relationId, status: "deleted" };
  }

  // ---------- Search ----------

  searchNodes(params: { query: string; entityType?: string; limit?: number }): Entity[] {
    const { query, entityType, limit = 20 } = params;
    const q = `%${query.toLowerCase()}%`;

    let sql: string;
    let sqlParams: unknown[];

    if (entityType) {
      sql = `SELECT * FROM entities WHERE entity_type = ? AND (
        LOWER(name) LIKE ? OR LOWER(observations) LIKE ?
      ) LIMIT ?`;
      sqlParams = [entityType, q, q, limit];
    } else {
      sql = `SELECT * FROM entities WHERE (
        LOWER(name) LIKE ? OR LOWER(observations) LIKE ?
      ) LIMIT ?`;
      sqlParams = [q, q, limit];
    }

    const rows = this.db.prepare(sql).all(...sqlParams) as DBEntityRow[];
    return rows.map((r) => this._rowToEntity(r));
  }

  /**
   * FTS-style search with heat score for RRF fusion.
   * Records search hits in search_history for future heat decay scoring.
   */
  searchEntities(params: {
    query: string;
    entityType?: string;
    limit?: number;
    trackHeat?: boolean;
  }): SearchEntityResult[] {
    const { query, entityType, limit = 20, trackHeat = true } = params;
    const q = `%${query.toLowerCase()}%`;

    let sql: string;
    let sqlParams: unknown[];

    if (entityType) {
      sql = `SELECT e.* FROM entities e
        WHERE e.entity_type = ? AND (
          LOWER(e.name) LIKE ? OR LOWER(e.observations) LIKE ?
        )
        ORDER BY e.updated_at DESC
        LIMIT ?`;
      sqlParams = [entityType, q, q, limit];
    } else {
      sql = `SELECT e.* FROM entities e
        WHERE LOWER(e.name) LIKE ? OR LOWER(e.observations) LIKE ?
        ORDER BY e.updated_at DESC
        LIMIT ?`;
      sqlParams = [q, q, limit];
    }

    const rows = this.db.prepare(sql).all(...sqlParams) as DBEntityRow[];

    // Get max access count for heat normalization
    const maxAccess = trackHeat
      ? ((this.db.prepare("SELECT MAX(hit_count) as m FROM search_history").get() as { m: number | null }).m ?? 1)
      : 0;

    const results = rows.map((row) => {
      const entity = this._rowToEntity(row);
      let heatScore = 0;

      if (trackHeat) {
        const heatRow = this.db.prepare(
          "SELECT hit_count, last_accessed FROM search_history WHERE entity_name = ? ORDER BY last_accessed DESC LIMIT 1"
        ).get(row.name) as { hit_count: number; last_accessed: string } | undefined;

        if (heatRow && heatRow.hit_count > 0) {
          const daysSinceAccess = (Date.now() - new Date(heatRow.last_accessed).getTime()) / (1000 * 60 * 60 * 24);
          heatScore = Math.min(1.0, heatRow.hit_count / Math.max(maxAccess, 1))
            * Math.exp(-daysSinceAccess / 30);
        }
      }

      return { ...entity, heatScore };
    });

    // Record heat tracking
    if (trackHeat) {
      const now = new Date().toISOString();
      for (const r of results) {
        this.db.prepare(`
          INSERT INTO search_history (entity_name, query, hit_count, last_accessed)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(entity_name, query) DO UPDATE SET
            hit_count = hit_count + 1,
            last_accessed = excluded.last_accessed
        `).run(r.name, query, now);
      }
    }

    return results;
  }

  getAllEntities(params?: { entityType?: string; limit?: number }): Entity[] {
    const entityType = params?.entityType;
    const limit = params?.limit ?? 100;

    let sql: string;
    let sqlParams: unknown[];

    if (entityType) {
      sql = "SELECT * FROM entities WHERE entity_type = ? LIMIT ?";
      sqlParams = [entityType, limit];
    } else {
      sql = "SELECT * FROM entities LIMIT ?";
      sqlParams = [limit];
    }

    const rows = this.db.prepare(sql).all(...sqlParams) as DBEntityRow[];
    return rows.map((r) => this._rowToEntity(r));
  }

  // ---------- Graph ----------

  getGraphStats(): GraphStats {
    const entityCount = (this.db.prepare("SELECT COUNT(*) as c FROM entities").get() as { c: number }).c;
    const relationCount = (this.db.prepare("SELECT COUNT(*) as c FROM relations").get() as { c: number }).c;

    const entitiesByType: Record<string, number> = {};
    const typeRows = this.db.prepare("SELECT entity_type, COUNT(*) as c FROM entities GROUP BY entity_type").all() as Array<{ entity_type: string; c: number }>;
    for (const row of typeRows) {
      entitiesByType[row.entity_type] = row.c;
    }

    const relationsByType: Record<string, number> = {};
    const relTypeRows = this.db.prepare("SELECT relation_type, COUNT(*) as c FROM relations GROUP BY relation_type").all() as Array<{ relation_type: string; c: number }>;
    for (const row of relTypeRows) {
      relationsByType[row.relation_type] = row.c;
    }

    return {
      totalEntities: entityCount,
      totalRelations: relationCount,
      entitiesByType,
      relationsByType,
      avgRelationsPerEntity: entityCount > 0 ? relationCount / entityCount : 0,
    };
  }

  getEntityGraph(params: { name: string; depth?: number }): {
    center: Entity;
    nodes: Entity[];
    edges: Relation[];
  } | { error: string } {
    const { name, depth = 1 } = params;

    const centerRow = this.db.prepare("SELECT * FROM entities WHERE name = ?").get(name) as DBEntityRow | undefined;
    if (!centerRow) {
      return { error: `Entity '${name}' not found` };
    }

    const center = this._rowToEntity(centerRow);
    const visitedNames = new Set<string>([name]);
    const collectedEntities: Entity[] = [];
    const collectedRelations: Relation[] = [];
    const collectedIds = new Set<string>();

    // BFS expansion using adjacency list built from relations
    let frontier = [name];
    for (let d = 0; d < depth; d++) {
      const nextFrontier: string[] = [];
      for (const entityName of frontier) {
        const relations = this.getEntityRelations(entityName);
        for (const r of relations) {
          const peer = r.from === entityName ? r.to : r.from;
          if (!visitedNames.has(peer)) {
            visitedNames.add(peer);
            const peerRow = this.db.prepare("SELECT * FROM entities WHERE name = ?").get(peer) as DBEntityRow | undefined;
            if (peerRow) {
              collectedEntities.push(this._rowToEntity(peerRow));
              nextFrontier.push(peer);
            }
          }
          if (!collectedIds.has(r.id)) {
            collectedRelations.push(r);
            collectedIds.add(r.id);
          }
        }
      }
      frontier = nextFrontier;
    }

    return { center, nodes: collectedEntities, edges: collectedRelations };
  }

  // ---------- JSON Import/Export (compat) ----------

  /**
   * Export all data as JSON (for backup or migration).
   */
  exportToJson(): GraphData {
    const entityRows = this.db.prepare("SELECT * FROM entities").all() as DBEntityRow[];
    const relationRows = this.db.prepare("SELECT * FROM relations").all() as DBRelationRow[];

    const entities: Record<string, Entity> = {};
    for (const row of entityRows) {
      const e = this._rowToEntity(row);
      entities[e.name] = e;
    }

    const relations: Record<string, Relation> = {};
    for (const row of relationRows) {
      const r = this._rowToRelation(row);
      relations[r.id] = r;
    }

    return { entities, relations };
  }

  // ---------- Lifecycle ----------

  close(): void {
    this.db.close();
  }

  // ---------- Row conversion ----------

  private _rowToEntity(row: DBEntityRow): Entity {
    return {
      id: row.id,
      name: row.name,
      entityType: row.entity_type,
      observations: safeJsonParse<string[]>(row.observations, []),
      properties: safeJsonParse<Record<string, unknown>>(row.properties, {}),
      tags: safeJsonParse<string[]>(row.tags, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private _rowToRelation(row: DBRelationRow): Relation {
    return {
      id: row.id,
      from: row.from_name,
      to: row.to_name,
      relationType: row.relation_type,
      properties: safeJsonParse<Record<string, unknown>>(row.properties, {}),
      weight: row.weight,
      createdAt: row.created_at,
    };
  }
}

// ============================================================
// Internal types for SQLite rows
// ============================================================

interface DBEntityRow {
  id: string;
  name: string;
  entity_type: string;
  observations: string;
  properties: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

interface DBRelationRow {
  id: string;
  from_name: string;
  to_name: string;
  relation_type: string;
  properties: string;
  weight: number;
  created_at: string;
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// MCP Tool Definitions (standalone functions)
// ============================================================

/**
 * Lazy-initialised store singleton.
 */
let _store: KnowledgeGraphStore | null = null;

function getStore(): KnowledgeGraphStore {
  if (!_store) {
    _store = new KnowledgeGraphStore();
  }
  return _store;
}

// -- Entity tools --

export function createEntities(
  entities: Array<{
    name: string;
    entityType?: string;
    observations?: string[];
    properties?: Record<string, unknown>;
  }>,
): Array<{ id: string; name: string; status: string } | { error: string; name: string }> {
  return getStore().createEntities(entities);
}

export function openNodes(names: string[]): Array<Entity & { relations: Relation[] }> {
  return getStore().getEntities(names);
}

export function addObservations(
  name: string,
  observations: string[],
): { name: string; status: string } | { error: string } {
  return getStore().updateEntity(name, { observations });
}

export function deleteEntities(
  names: string[],
): Array<{ name: string; status: string } | { error: string }> {
  return getStore().deleteEntities(names);
}

// -- Relation tools --

export function createRelations(
  relations: Array<{
    from: string;
    to: string;
    relationType?: string;
    properties?: Record<string, unknown>;
    weight?: number;
  }>,
): Array<{ id: string; from: string; to: string; type: string; status: string } | { error: string }> {
  return getStore().createRelations(relations);
}

export function deleteRelations(
  relationIds: string[],
): Array<{ id: string; status: string } | { error: string }> {
  const results: Array<{ id: string; status: string } | { error: string }> = [];
  for (const rid of relationIds) {
    results.push(getStore().deleteRelation(rid));
  }
  return results;
}

// -- Search tools --

export function searchNodes(params: {
  query: string;
  entityType?: string;
  limit?: number;
}): Entity[] {
  return getStore().searchNodes(params);
}

export function readGraph(params?: {
  entityType?: string;
  limit?: number;
}): { entities: Entity[]; stats: GraphStats } {
  const store = getStore();
  return {
    entities: store.getAllEntities(params),
    stats: store.getGraphStats(),
  };
}

export function getEntityGraph(params: {
  name: string;
  depth?: number;
}): { center: Entity; nodes: Entity[]; edges: Relation[] } | { error: string } {
  return getStore().getEntityGraph(params);
}

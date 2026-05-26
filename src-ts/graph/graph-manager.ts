/**
 * GraphManager - Knowledge Graph Manager
 *
 * Implements IGraphService interface, providing:
 * 1. Cypher query execution
 * 2. Entity/relationship CRUD operations
 * 3. Graph algorithms (shortest path, subgraph extraction)
 * 4. Entity search and statistics
 *
 * SQLite backend with Cypher syntax subset support.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createLogger } from '../logger/index.js';

const log = createLogger('graph-manager');

// ---------------------------------------------------------------------------
// Vector search integration (semantic search DI hook from PLN-005 Phase 1)
// ---------------------------------------------------------------------------

/**
 * Minimal vector-search surface required by GraphManager for entity embedding.
 * Decoupled from the concrete VectorSearch class so the graph layer does not
 * depend on the search layer at compile time (avoids cycles). Mirrors the
 * concrete `VectorSearch.add` signature so metadata is routed correctly at
 * runtime (the container's `IVectorSearch.index` shape uses positional
 * metadata which is incompatible with the concrete impl's `options.metadata`).
 */
export interface IEntityVectorSearch {
  add(
    id: string,
    content: string,
    metadata?: Record<string, unknown>,
    type?: string,
  ): Promise<void>;
  delete(id: string): Promise<boolean>;
}

let defaultEntityVectorSearch: IEntityVectorSearch | null = null;

// ---------------------------------------------------------------------------
// Types (mirrored from graph_contracts)
// ---------------------------------------------------------------------------

/** Entity types */
export enum EntityType {
  CHARACTER = 'character',
  LOCATION = 'location',
  EVENT = 'event',
  OBJECT = 'object',
  ITEM = 'object', // compatibility alias
  CONCEPT = 'concept',
  RELATIONSHIP = 'relationship',
  TIMELINE = 'timeline',
}

/** Relationship types */
export enum RelationType {
  KNOWS = 'KNOWS',
  LOCATED_IN = 'LOCATED_IN',
  PARTICIPATES = 'PARTICIPATES',
  OWNS = 'OWNS',
  CAUSES = 'CAUSES',
  PRECEDES = 'PRECEDES',
  FOLLOWS = 'FOLLOWS',
  RELATED_TO = 'RELATED_TO',
}

/** Entity data structure */
export class Entity {
  id: string;
  name: string;
  type: EntityType;
  properties: Record<string, unknown>;
  created_at: Date | null;
  updated_at: Date | null;

  constructor(params: {
    id: string;
    name: string;
    type: EntityType;
    properties?: Record<string, unknown>;
    created_at?: Date | null;
    updated_at?: Date | null;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.type = params.type;
    this.properties = params.properties ?? {};
    this.created_at = params.created_at ?? null;
    this.updated_at = params.updated_at ?? null;
  }
}

/** Relationship data structure */
export class Relationship {
  id: string;
  source_id: string;
  target_id: string;
  type: RelationType;
  properties: Record<string, unknown>;
  weight: number;

  constructor(params: {
    id: string;
    source_id: string;
    target_id: string;
    type: RelationType;
    properties?: Record<string, unknown>;
    weight?: number;
  }) {
    this.id = params.id;
    this.source_id = params.source_id;
    this.target_id = params.target_id;
    this.type = params.type;
    this.properties = params.properties ?? {};
    this.weight = params.weight ?? 1.0;
  }
}

/** Entity statistics */
export class EntityStats {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
  avg_connections_per_entity: number;

  constructor(params: {
    total_entities: number;
    total_relationships: number;
    entities_by_type: Record<string, number>;
    relationships_by_type: Record<string, number>;
    avg_connections_per_entity: number;
  }) {
    this.total_entities = params.total_entities;
    this.total_relationships = params.total_relationships;
    this.entities_by_type = params.entities_by_type;
    this.relationships_by_type = params.relationships_by_type;
    this.avg_connections_per_entity = params.avg_connections_per_entity;
  }
}

/** Graph path */
export class GraphPath {
  nodes: Entity[];
  edges: Relationship[];
  total_weight: number;

  constructor(params: { nodes: Entity[]; edges: Relationship[]; total_weight: number }) {
    this.nodes = params.nodes;
    this.edges = params.edges;
    this.total_weight = params.total_weight;
  }
}

/** Sub-graph structure */
export class SubGraph {
  entities: Entity[];
  relationships: Relationship[];
  center_entity_id: string | null;

  constructor(params: {
    entities: Entity[];
    relationships: Relationship[];
    center_entity_id?: string | null;
  }) {
    this.entities = params.entities;
    this.relationships = params.relationships;
    this.center_entity_id = params.center_entity_id ?? null;
  }
}

// ---------------------------------------------------------------------------
// CypherParser
// ---------------------------------------------------------------------------

/**
 * Cypher query parser (supports common syntax subset)
 */
export class CypherParser {
  // Node pattern: (alias:Label {prop: value})
  static readonly NODE_PATTERN = /\((\w+)?(?::(\w+))?(?:\s*\{([^}]*)\})?\)/;

  // Relationship pattern: -[alias:TYPE]-> or <-[alias:TYPE]-
  static readonly REL_PATTERN = /(<)?-\[(\w+)?(?::(\w+))?\]->(>)?/;

  // WHERE clause
  static readonly WHERE_PATTERN =
    /WHERE\s+(.+?)(?=\s+RETURN|\s+ORDER|\s+LIMIT|$)/is;

  // RETURN clause
  static readonly RETURN_PATTERN =
    /RETURN\s+(.+?)(?=\s+ORDER|\s+LIMIT|$)/is;

  // LIMIT clause
  static readonly LIMIT_PATTERN = /LIMIT\s+(\d+)/i;

  // ORDER BY clause
  static readonly ORDER_PATTERN =
    /ORDER\s+BY\s+(.+?)(?=\s+LIMIT|$)/is;

  /** Parse a Cypher query into structured components */
  static parse(cypher: string): Record<string, unknown> {
    cypher = cypher.trim();
    const result: Record<string, unknown> = {
      type: null,
      nodes: [] as Record<string, unknown>[],
      relationships: [] as Record<string, unknown>[],
      where: null,
      return: null,
      limit: null,
      order_by: null,
    };

    // Determine query type
    const upper = cypher.toUpperCase();
    if (upper.startsWith('MATCH')) {
      result.type = 'MATCH';
    } else if (upper.startsWith('CREATE')) {
      result.type = 'CREATE';
    } else if (upper.startsWith('DELETE')) {
      result.type = 'DELETE';
    } else if (upper.startsWith('SET')) {
      result.type = 'SET';
    } else {
      result.type = 'UNKNOWN';
    }

    // Parse nodes - use global flag to find all matches
    const nodeRegex = new RegExp(CypherParser.NODE_PATTERN.source, 'g');
    let nodeMatch: RegExpExecArray | null;
    while ((nodeMatch = nodeRegex.exec(cypher)) !== null) {
      const [, alias, label, propsStr] = nodeMatch;
      const props = propsStr ? CypherParser._parseProps(propsStr) : {};
      (result.nodes as Record<string, unknown>[]).push({ alias, label, properties: props });
    }

    // Parse relationships
    const relRegex = new RegExp(CypherParser.REL_PATTERN.source, 'g');
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relRegex.exec(cypher)) !== null) {
      const [, leftArrow, alias, relType, rightArrow] = relMatch;
      const direction = leftArrow ? 'left' : 'right';
      (result.relationships as Record<string, unknown>[]).push({
        alias,
        type: relType,
        direction,
      });
    }

    // Parse WHERE
    const whereMatch = CypherParser.WHERE_PATTERN.exec(cypher);
    if (whereMatch) {
      result.where = whereMatch[1].trim();
    }

    // Parse RETURN
    const returnMatch = CypherParser.RETURN_PATTERN.exec(cypher);
    if (returnMatch) {
      result.return = returnMatch[1].trim();
    }

    // Parse LIMIT
    const limitMatch = CypherParser.LIMIT_PATTERN.exec(cypher);
    if (limitMatch) {
      result.limit = parseInt(limitMatch[1], 10);
    }

    // Parse ORDER BY
    const orderMatch = CypherParser.ORDER_PATTERN.exec(cypher);
    if (orderMatch) {
      result.order_by = orderMatch[1].trim();
    }

    return result;
  }

  /** Parse property string {key: value, ...} */
  static _parseProps(propsStr: string): Record<string, unknown> {
    const props: Record<string, unknown> = {};
    if (!propsStr) return props;

    const pairs = propsStr.split(',');
    for (const pair of pairs) {
      if (pair.includes(':')) {
        let [key, value] = pair.split(':', 2);
        key = key.trim().replace(/^['"]|['"]$/g, '');
        value = value.trim().replace(/^['"]|['"]$/g, '');

        // Try type conversion
        if (/^\d+$/.test(value)) {
          (props as Record<string, unknown>)[key] = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          (props as Record<string, unknown>)[key] = parseFloat(value);
        } else if (value.toLowerCase() === 'true') {
          (props as Record<string, unknown>)[key] = true;
        } else if (value.toLowerCase() === 'false') {
          (props as Record<string, unknown>)[key] = false;
        } else {
          (props as Record<string, unknown>)[key] = value;
        }
      }
    }
    return props;
  }
}

// ---------------------------------------------------------------------------
// Hot-path safe JSON parse — 避免 try-catch 导致 V8 JIT 退优化
// ---------------------------------------------------------------------------

/**
 * 无 try-catch 的安全 JSON 解析。热路径中 try-catch 会触发 V8 JIT 退优化，
 * 因此先用快速校验过滤非 JSON 字符串，再直接调用 JSON.parse。
 * 校验逻辑：null/undefined/空字符串直接返回默认值；首字符非 { 或 [ 也返回默认值。
 */
function safeParseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || raw.length === 0) return {};
  // 快速校验：合法 JSON 对象或数组必须以 { 或 [ 开头
  const first = raw[0];
  if (first !== '{' && first !== '[') return {};
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// GraphManager
// ---------------------------------------------------------------------------

/**
 * Knowledge Graph Manager
 *
 * Implements IGraphService interface with full graph operation capabilities.
 * Uses SQLite as the backend storage.
 */
export class GraphManager {
  db_path: string;

  private _conn: Database.Database | null = null;
  private _lock = { locked: false };
  private _vectorSearch: IEntityVectorSearch | null = null;

  // 属性解析缓存：同一 node/edge ID 在多次查询中重复出现时避免重复解析
  // 写操作时清除对应缓存条目以保持一致性
  private _propsCache = new Map<string, Record<string, unknown>>();
  private static readonly PROPS_CACHE_MAX = 2000;

  private _setPropsCache(key: string, value: Record<string, unknown>): void {
    if (this._propsCache.size >= GraphManager.PROPS_CACHE_MAX) {
      const firstKey = this._propsCache.keys().next().value;
      if (firstKey !== undefined) this._propsCache.delete(firstKey);
    }
    this._propsCache.set(key, value);
  }

  constructor(dbPath?: string | null) {
    const resolved = dbPath ?? join(homedir(), '.niko', 'graph_manager.db');
    this.db_path = resolved;
    mkdirSync(dirname(this.db_path), { recursive: true });

    this._initDb();

    // Pick up the bootstrap-registered default vector search if present.
    // Per-instance override via setVectorSearch() takes precedence at call time.
    this._vectorSearch = defaultEntityVectorSearch;

    log.info(`GraphManager initialized`, { dbPath: this.db_path });
  }

  // -----------------------------------------------------------------------
  // Vector search wiring (semantic search hook)
  // -----------------------------------------------------------------------

  /**
   * Inject the VectorSearch adapter used to embed entities on create/update
   * and remove embeddings on delete. Pass `null` to detach.
   *
   * Closes the deferred Phase 1 DI step from PLN-005 verification.json.
   */
  setVectorSearch(vectorSearch: IEntityVectorSearch | null): void {
    this._vectorSearch = vectorSearch;
  }

  /**
   * Register a process-wide default vector search adapter. Any GraphManager
   * instantiated after this call (with no per-instance override) will pick it
   * up. Called by the gateway control plane at sidecar startup.
   */
  static setDefaultVectorSearch(vectorSearch: IEntityVectorSearch | null): void {
    defaultEntityVectorSearch = vectorSearch;
  }

  /**
   * Fire-and-forget entity embedding. Callers MUST NOT await; embedding errors
   * are logged and never propagate (per Phase 1 review F-003: keeps entity CRUD
   * synchronous even when the embedding model is slow or unavailable).
   */
  private _embedEntity(entity: Entity): void {
    const vs = this._vectorSearch;
    if (!vs) return;

    const content = this._buildEmbeddingContent(entity);
    vs.add(entity.id, content, this._buildEmbeddingMetadata(entity), 'entity').catch((err) => {
      log.warn(`Entity embedding failed for ${entity.id}`, { error: err instanceof Error ? err.message : String(err) });
    });
  }

  /** Fire-and-forget removal of an entity's embedding. */
  private _removeEntityEmbedding(entityId: string): void {
    const vs = this._vectorSearch;
    if (!vs) return;

    vs.delete(entityId).catch((err) => {
      log.warn(`Entity embedding delete failed for ${entityId}`, { error: err instanceof Error ? err.message : String(err) });
    });
  }

  /** Build the text content used to embed an entity. */
  private _buildEmbeddingContent(entity: Entity): string {
    const parts: string[] = [`${entity.type}: ${entity.name}`];
    const description = entity.properties?.description;
    if (typeof description === 'string' && description.trim()) {
      parts.push(description.trim());
    }
    return parts.join(' — ');
  }

  /** Build the metadata stored alongside the embedding. */
  private _buildEmbeddingMetadata(entity: Entity): Record<string, unknown> {
    return {
      entity_id: entity.id,
      entity_type: entity.type,
      entity_name: entity.name,
    };
  }

  // -----------------------------------------------------------------------
  // Database init
  // -----------------------------------------------------------------------

  private _initDb(): void {
    /** Initialize database connection and schema */
    this._conn = new Database(this.db_path);
    this._conn.pragma('journal_mode = WAL');

    this._conn.exec(`
      -- Entities table
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        created_at TEXT,
        updated_at TEXT
      );

      -- Relationships table
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        weight REAL DEFAULT 1.0,
        created_at TEXT,
        FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

      -- Full-text search (if SQLite supports FTS5)
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        id, name, properties,
        content='entities',
        content_rowid='rowid'
      );

      -- Triggers: sync FTS index
      CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
        INSERT INTO entities_fts(rowid, id, name, properties)
        VALUES (new.rowid, new.id, new.name, new.properties);
      END;

      CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, id, name, properties)
        VALUES('delete', old.rowid, old.id, old.name, old.properties);
      END;

      CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, id, name, properties)
        VALUES('delete', old.rowid, old.id, old.name, old.properties);
        INSERT INTO entities_fts(rowid, id, name, properties)
        VALUES (new.rowid, new.id, new.name, new.properties);
      END;
    `);
  }

  // -----------------------------------------------------------------------
  // Row mappers
  // -----------------------------------------------------------------------

  /** Convert a database row to an Entity object */
  private _rowToEntity(row: Record<string, unknown>): Entity {
    // 使用缓存避免重复解析同一实体的 properties
    const entityId = row.id as string;
    let props = this._propsCache.get(entityId);
    if (props === undefined) {
      props = typeof row.properties === 'string' ? safeParseJson(row.properties) : {};
      this._propsCache.set(entityId, props);
    }

    let createdAt: Date | null = null;
    let updatedAt: Date | null = null;

    if (row.created_at) {
      try {
        createdAt = new Date(row.created_at as string);
      } catch {
        // keep null
      }
    }

    if (row.updated_at) {
      try {
        updatedAt = new Date(row.updated_at as string);
      } catch {
        // keep null
      }
    }

    return new Entity({
      id: entityId,
      name: row.name as string,
      type: (EntityType[(row.type as string).toUpperCase() as keyof typeof EntityType] ?? EntityType.CONCEPT) as EntityType,
      properties: props,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  /** Convert a database row to a Relationship object */
  private _rowToRelationship(row: Record<string, unknown>): Relationship {
    // 使用缓存避免重复解析同一关系的 properties
    const relId = row.id as string;
    let props = this._propsCache.get(relId);
    if (props === undefined) {
      props = typeof row.properties === 'string' ? safeParseJson(row.properties) : {};
      this._propsCache.set(relId, props);
    }

    return new Relationship({
      id: relId,
      source_id: row.source_id as string,
      target_id: row.target_id as string,
      type: RelationType[row.type as keyof typeof RelationType] ?? RelationType.RELATED_TO,
      properties: props,
      weight: (row.weight as number) ?? 1.0,
    });
  }

  /** Batch get multiple entities (avoids N+1 queries) */
  getEntitiesBatch(entityIds: string[]): Record<string, Entity> {
    if (!entityIds.length) return {};

    const placeholders = entityIds.map(() => '?').join(',');
    const rows = this._conn!
      .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
      .all(...entityIds) as Record<string, unknown>[];

    const result: Record<string, Entity> = {};
    for (const row of rows) {
      const entity = this._rowToEntity(row);
      result[entity.id] = entity;
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Cypher query
  // -----------------------------------------------------------------------

  /**
   * Execute a Cypher query
   *
   * Supported syntax subset:
   * - MATCH (n:Type) RETURN n
   * - MATCH (n:Type) WHERE n.name = 'xxx' RETURN n
   * - MATCH (a)-[r:REL]->(b) RETURN a, r, b
   */
  runCypher(query: string): Record<string, unknown>[] {
    const parsed = CypherParser.parse(query);

    if (parsed.type === 'MATCH') {
      return this._executeMatch(
        parsed as Record<string, unknown>,
        query
      );
    } else if (parsed.type === 'CREATE') {
      return this._executeCreate(parsed as Record<string, unknown>, query);
    } else {
      // Try direct SQL execution (fallback)
      try {
        const stmt = this._conn!.prepare(query);
        if (stmt.reader) {
          return stmt.all() as Record<string, unknown>[];
        }
        const info = stmt.run();
        return [{ affected_rows: info.changes }];
      } catch (e) {
        log.error(`Cypher execution error`, { error: String(e) });
        return [{ error: String(e) }];
      }
    }
  }

  /** Execute MATCH query */
  private _executeMatch(
    parsed: Record<string, unknown>,
    _original: string
  ): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    const nodes = parsed.nodes as Record<string, unknown>[];
    const relationships = parsed.relationships as Record<string, unknown>[];
    const where = parsed.where as string | null;
    const limit = parsed.limit as number | null;

    // Simple node query
    if (nodes.length === 1 && relationships.length === 0) {
      const node = nodes[0];
      let sql = 'SELECT * FROM entities WHERE 1=1';
      let params: unknown[] = [];

      if (node.label) {
        sql += ' AND type = ?';
        params.push((node.label as string).toLowerCase());
      }

      // Parse WHERE conditions
      if (where) {
        [sql, params] = this._parseWhere(sql, params, where, node.alias as string | null);
      }

      if (limit) {
        sql += ` LIMIT ${limit}`;
      }

      const rows = this._conn!.prepare(sql).all(...params) as Record<string, unknown>[];
      for (const row of rows) {
        const entity = this._rowToEntity(row);
        results.push({
          [(node.alias as string) || 'n']: this._entityToDict(entity),
        });
      }
    } else if (relationships.length > 0) {
      // Relationship query
      return this._executeRelationshipMatch(nodes, relationships, where, limit);
    }

    return results;
  }

  /** Execute relationship pattern match */
  private _executeRelationshipMatch(
    nodes: Record<string, unknown>[],
    relationships: Record<string, unknown>[],
    _where: string | null,
    limit: number | null
  ): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];

    let sql = `
      SELECT
        e1.id as source_id, e1.name as source_name, e1.type as source_type,
        e1.properties as source_props,
        r.id as rel_id, r.type as rel_type, r.properties as rel_props,
        r.weight as rel_weight,
        e2.id as target_id, e2.name as target_name, e2.type as target_type,
        e2.properties as target_props
      FROM relationships r
      JOIN entities e1 ON r.source_id = e1.id
      JOIN entities e2 ON r.target_id = e2.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Node type filter
    if (nodes.length >= 1 && nodes[0].label) {
      sql += ' AND e1.type = ?';
      params.push((nodes[0].label as string).toLowerCase());
    }
    if (nodes.length >= 2 && nodes[1].label) {
      sql += ' AND e2.type = ?';
      params.push((nodes[1].label as string).toLowerCase());
    }

    // Relationship type filter
    if (relationships.length > 0 && relationships[0].type) {
      sql += ' AND r.type = ?';
      params.push(relationships[0].type);
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    const rows = this._conn!.prepare(sql).all(...params) as Record<string, unknown>[];
    for (const row of rows) {
      // 使用缓存 + safeParseJson 替代三个 try-catch JSON.parse，
      // 避免 V8 JIT 退优化；同一 entity/relation ID 只解析一次
      const sourceId = row.source_id as string;
      let sourceProps = this._propsCache.get(sourceId);
      if (sourceProps === undefined) {
        sourceProps = typeof row.source_props === 'string' ? safeParseJson(row.source_props) : {};
        this._propsCache.set(sourceId, sourceProps);
      }

      const relId = row.rel_id as string;
      let relProps = this._propsCache.get(relId);
      if (relProps === undefined) {
        relProps = typeof row.rel_props === 'string' ? safeParseJson(row.rel_props) : {};
        this._propsCache.set(relId, relProps);
      }

      const targetId = row.target_id as string;
      let targetProps = this._propsCache.get(targetId);
      if (targetProps === undefined) {
        targetProps = typeof row.target_props === 'string' ? safeParseJson(row.target_props) : {};
        this._propsCache.set(targetId, targetProps);
      }

      results.push({
        source: {
          id: row.source_id,
          name: row.source_name,
          type: row.source_type,
          properties: sourceProps,
        },
        relationship: {
          id: row.rel_id,
          type: row.rel_type,
          properties: relProps,
          weight: row.rel_weight,
        },
        target: {
          id: row.target_id,
          name: row.target_name,
          type: row.target_type,
          properties: targetProps,
        },
      });
    }

    return results;
  }

  /** Parse WHERE clause */
  private _parseWhere(
    sql: string,
    params: unknown[],
    where: string,
    _alias: string | null
  ): [string, unknown[]] {
    const pattern =
      /(\w+)\.(\w+)\s*(=|<>|<|>|<=|>=|CONTAINS)\s*['"]?([^'"]+)['"]?/gi;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(where)) !== null) {
      const [, _var, field, op, value] = match;

      if (field === 'name') {
        sql += ` AND name ${op} ?`;
        params.push(value);
      } else if (field === 'id') {
        sql += ` AND id ${op} ?`;
        params.push(value);
      } else if (field === 'type') {
        sql += ` AND type ${op} ?`;
        params.push(value.toLowerCase());
      } else {
        // JSON property query
        if (op.toUpperCase() === 'CONTAINS') {
          sql += ` AND json_extract(properties, '$.${field}') LIKE ?`;
          params.push(`%${value}%`);
        } else {
          sql += ` AND json_extract(properties, '$.${field}') ${op} ?`;
          params.push(value);
        }
      }
    }

    return [sql, params];
  }

  /** Execute CREATE query */
  private _executeCreate(
    parsed: Record<string, unknown>,
    _original: string
  ): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];
    const nodes = parsed.nodes as Record<string, unknown>[];

    for (const node of nodes) {
      if (node.label) {
        let entityType: EntityType;
        try {
          entityType =
            EntityType[(node.label as string).toLowerCase().toUpperCase() as keyof typeof EntityType] ??
            EntityType.CONCEPT;
        } catch {
          entityType = EntityType.CONCEPT;
        }

        const nodeProps = (node.properties ?? {}) as Record<string, unknown>;
        const entity = new Entity({
          id: randomUUID(),
          name: (nodeProps.name as string) ?? `Entity_${randomUUID().slice(0, 8)}`,
          type: entityType,
          properties: nodeProps,
        });
        const entityId = this.createEntity(entity);
        results.push({ created: entityId });
      }
    }

    return results;
  }

  /** Entity to dictionary */
  private _entityToDict(entity: Entity): Record<string, unknown> {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      properties: entity.properties,
      created_at: entity.created_at?.toISOString() ?? null,
      updated_at: entity.updated_at?.toISOString() ?? null,
    };
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /** Get entity statistics */
  getEntityStats(): EntityStats {
    // Total entities
    const totalEntities = (
      this._conn!.prepare('SELECT COUNT(*) as count FROM entities').get() as Record<string, number>
    ).count;

    // Total relationships
    const totalRelationships = (
      this._conn!.prepare('SELECT COUNT(*) as count FROM relationships').get() as Record<string, number>
    ).count;

    // By type - entities
    const entityRows = this._conn!
      .prepare('SELECT type, COUNT(*) as count FROM entities GROUP BY type')
      .all() as Record<string, unknown>[];
    const entitiesByType: Record<string, number> = {};
    for (const row of entityRows) {
      entitiesByType[row.type as string] = row.count as number;
    }

    // By type - relationships
    const relRows = this._conn!
      .prepare('SELECT type, COUNT(*) as count FROM relationships GROUP BY type')
      .all() as Record<string, unknown>[];
    const relationshipsByType: Record<string, number> = {};
    for (const row of relRows) {
      relationshipsByType[row.type as string] = row.count as number;
    }

    // Average connections
    const avgConnections =
      totalEntities > 0 ? (totalRelationships * 2) / totalEntities : 0;

    return new EntityStats({
      total_entities: totalEntities,
      total_relationships: totalRelationships,
      entities_by_type: entitiesByType,
      relationships_by_type: relationshipsByType,
      avg_connections_per_entity: Math.round(avgConnections * 100) / 100,
    });
  }

  // -----------------------------------------------------------------------
  // Graph traversal
  // -----------------------------------------------------------------------

  /**
   * Find related entities (BFS traversal)
   *
   * @param entityId - Starting entity ID
   * @param maxDepth - Maximum traversal depth
   * @param limit - Maximum number of results
   */
  findRelatedEntities(
    entityId: string,
    maxDepth: number = 2,
    limit: number = 50
  ): Entity[] {
    if (maxDepth <= 0 || limit <= 0) return [];

    const visited = new Set<string>([entityId]);
    let frontier: string[] = [entityId];
    const candidateIds: string[] = [];

    for (let depth = 1; depth <= maxDepth; depth++) {
      if (!frontier.length || candidateIds.length >= limit) break;

      const placeholders = frontier.map(() => '?').join(',');
      const sql = `
        SELECT target_id AS neighbor_id FROM relationships
        WHERE source_id IN (${placeholders})
        UNION
        SELECT source_id AS neighbor_id FROM relationships
        WHERE target_id IN (${placeholders})
      `;
      const params = [...frontier, ...frontier];
      const rows = this._conn!.prepare(sql).all(...params) as Record<string, string>[];

      const nextFrontier: string[] = [];
      for (const row of rows) {
        const neighborId = row.neighbor_id;
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        nextFrontier.push(neighborId);
        candidateIds.push(neighborId);
        if (candidateIds.length >= limit) break;
      }

      frontier = nextFrontier;
    }

    if (!candidateIds.length) return [];

    const idsForQuery = candidateIds.slice(0, limit);
    const placeholders = idsForQuery.map(() => '?').join(',');
    const rows = this._conn!
      .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
      .all(...idsForQuery) as Record<string, unknown>[];

    const entityMap = new Map<string, Entity>();
    for (const row of rows) {
      const entity = this._rowToEntity(row);
      entityMap.set(entity.id, entity);
    }
    return idsForQuery
      .filter((id) => entityMap.has(id))
      .map((id) => entityMap.get(id)!);
  }

  // -----------------------------------------------------------------------
  // Entity CRUD
  // -----------------------------------------------------------------------

  /** Create an entity */
  createEntity(entity: Entity): string {
    const now = new Date().toISOString();

    if (!entity.id) {
      entity.id = randomUUID();
    }

    const insert = this._conn!.prepare(
      `INSERT INTO entities (id, name, type, properties, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insert.run(
      entity.id,
      entity.name,
      entity.type,
      JSON.stringify(entity.properties),
      now,
      now
    );

    // 写操作后清除该实体的属性缓存，确保后续读取拿到最新数据
    this._propsCache.delete(entity.id);

    log.info(`Created entity`, { type: entity.type, name: entity.name, id: entity.id });

    // Fire-and-forget semantic embedding (no await — keeps CRUD synchronous).
    this._embedEntity(entity);

    return entity.id;
  }

  /** Get an entity */
  getEntity(entityId: string): Entity | null {
    const row = this._conn!
      .prepare('SELECT * FROM entities WHERE id = ?')
      .get(entityId) as Record<string, unknown> | undefined;

    return row ? this._rowToEntity(row) : null;
  }

  /** Update an entity */
  updateEntity(entity: Entity): boolean {
    const now = new Date().toISOString();

    const info = this._conn!
      .prepare(
        `UPDATE entities
         SET name = ?, type = ?, properties = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(entity.name, entity.type, JSON.stringify(entity.properties), now, entity.id);

    const success = info.changes > 0;
    if (success) {
      // 写操作后清除该实体的属性缓存，确保后续读取拿到最新数据
      this._propsCache.delete(entity.id);

      log.info(`Updated entity`, { id: entity.id });
      // Re-embed on update so semantic search reflects the new content.
      this._embedEntity(entity);
    }
    return success;
  }

  /** Delete an entity (and its associated relationships) */
  deleteEntity(entityId: string): boolean {
    // Delete associated relationships
    this._conn!
      .prepare('DELETE FROM relationships WHERE source_id = ? OR target_id = ?')
      .run(entityId, entityId);

    // Delete entity
    const info = this._conn!
      .prepare('DELETE FROM entities WHERE id = ?')
      .run(entityId);

    const success = info.changes > 0;
    if (success) {
      // 删除操作后清除该实体及其关联关系的属性缓存
      this._propsCache.delete(entityId);

      log.info(`Deleted entity: ${entityId}`);
      // Drop the corresponding embedding so stale vectors don't surface.
      this._removeEntityEmbedding(entityId);
    }
    return success;
  }

  // -----------------------------------------------------------------------
  // Relationship CRUD
  // -----------------------------------------------------------------------

  /** Create a relationship */
  createRelationship(relationship: Relationship): string {
    const now = new Date().toISOString();

    if (!relationship.id) {
      relationship.id = randomUUID();
    }

    this._conn!
      .prepare(
        `INSERT INTO relationships
         (id, source_id, target_id, type, properties, weight, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        relationship.id,
        relationship.source_id,
        relationship.target_id,
        relationship.type,
        JSON.stringify(relationship.properties),
        relationship.weight,
        now
      );

    // 写操作后清除该关系的属性缓存
    this._propsCache.delete(relationship.id);

    log.info(
      `Created relationship: ${relationship.source_id} -[${relationship.type}]-> ${relationship.target_id}`
    );
    return relationship.id;
  }

  /** Get relationships for an entity */
  getRelationships(
    entityId: string,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Relationship[] {
    let sql: string;
    let params: unknown[];

    if (direction === 'out') {
      sql = 'SELECT * FROM relationships WHERE source_id = ?';
      params = [entityId];
    } else if (direction === 'in') {
      sql = 'SELECT * FROM relationships WHERE target_id = ?';
      params = [entityId];
    } else {
      sql = 'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?';
      params = [entityId, entityId];
    }

    const rows = this._conn!.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => this._rowToRelationship(row));
  }

  /** Delete a relationship */
  deleteRelationship(relationshipId: string): boolean {
    const info = this._conn!
      .prepare('DELETE FROM relationships WHERE id = ?')
      .run(relationshipId);

    const success = info.changes > 0;
    if (success) {
      // 删除操作后清除该关系的属性缓存
      this._propsCache.delete(relationshipId);

      log.info(`Deleted relationship: ${relationshipId}`);
    }
    return success;
  }

  // -----------------------------------------------------------------------
  // Graph algorithms
  // -----------------------------------------------------------------------

  /** Find shortest path (BFS) */
  findShortestPath(sourceId: string, targetId: string): GraphPath | null {
    if (sourceId === targetId) {
      const entity = this.getEntity(sourceId);
      if (entity) {
        return new GraphPath({ nodes: [entity], edges: [], total_weight: 0 });
      }
      return null;
    }

    // BFS - collect entity IDs along the path, then batch-fetch
    const visited = new Set<string>([sourceId]);
    const queue: Array<[string, string[], Relationship[]]> = [
      [sourceId, [], []],
    ];

    while (queue.length > 0) {
      const [currentId, pathNodeIds, pathEdges] = queue.shift()!;

      // Get neighbors
      const rows = this._conn!
        .prepare(
          `
          SELECT r.*, e.id as neighbor_id
          FROM relationships r
          JOIN entities e ON (
            CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END
          ) = e.id
          WHERE r.source_id = ? OR r.target_id = ?
          `
        )
        .all(currentId, currentId, currentId) as Record<string, unknown>[];

      for (const row of rows) {
        const neighborId = row.neighbor_id as string;

        if (visited.has(neighborId)) continue;

        const rel = this._rowToRelationship(row);
        const newPathEdges = [...pathEdges, rel];
        const newPathNodeIds = [...pathNodeIds, neighborId];

        if (neighborId === targetId) {
          // Found path - batch-fetch all entities
          const allEntityIds = [sourceId, ...newPathNodeIds];
          const entityMap = this.getEntitiesBatch(allEntityIds);
          const allNodes = allEntityIds
            .filter((id) => id in entityMap)
            .map((id) => entityMap[id]);
          const totalWeight = newPathEdges.reduce((sum, e) => sum + e.weight, 0);

          return new GraphPath({
            nodes: allNodes,
            edges: newPathEdges,
            total_weight: totalWeight,
          });
        }

        visited.add(neighborId);
        queue.push([neighborId, newPathNodeIds, newPathEdges]);
      }
    }

    return null;
  }

  /** Get sub-graph centered on an entity */
  getSubGraph(centerId: string, radius: number = 2): SubGraph {
    const entityIds = new Set<string>();
    const relationshipIds = new Set<string>();

    // BFS traversal
    const queue: Array<[string, number]> = [[centerId, 0]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [currentId, depth] = queue.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);
      entityIds.add(currentId);

      if (depth < radius) {
        const rows = this._conn!
          .prepare(
            'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?'
          )
          .all(currentId, currentId) as Record<string, unknown>[];

        for (const row of rows) {
          relationshipIds.add(row.id as string);
          const neighborId =
            row.source_id === currentId
              ? (row.target_id as string)
              : (row.source_id as string);
          if (!visited.has(neighborId)) {
            queue.push([neighborId, depth + 1]);
          }
        }
      }
    }

    // Batch-fetch entities
    const entityMap = this.getEntitiesBatch(Array.from(entityIds));
    const entities = Object.values(entityMap);

    // Batch-fetch relationships
    let relationships: Relationship[] = [];
    if (relationshipIds.size > 0) {
      const placeholders = Array.from(relationshipIds)
        .map(() => '?')
        .join(',');
      const rows = this._conn!
        .prepare(`SELECT * FROM relationships WHERE id IN (${placeholders})`)
        .all(...Array.from(relationshipIds)) as Record<string, unknown>[];
      relationships = rows.map((row) => this._rowToRelationship(row));
    }

    return new SubGraph({
      entities,
      relationships,
      center_entity_id: centerId,
    });
  }

  /** Compatibility alias for adjacent callers expecting lower-case "g". */
  getSubgraph(centerId: string, radius: number = 2): SubGraph {
    return this.getSubGraph(centerId, radius);
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /** Search entities */
  searchEntities(
    query: string,
    entityType?: EntityType | null,
    limit: number = 20
  ): Entity[] {
    // Try FTS search
    try {
      let sql = `
        SELECT e.* FROM entities e
        JOIN entities_fts fts ON e.id = fts.id
        WHERE entities_fts MATCH ?
      `;
      const params: unknown[] = [query];

      if (entityType) {
        sql += ' AND e.type = ?';
        params.push(entityType);
      }

      sql += ` LIMIT ${limit}`;

      const rows = this._conn!.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map((row) => this._rowToEntity(row));
    } catch {
      // FTS unavailable, fallback to LIKE search
      let sql =
        'SELECT * FROM entities WHERE (name LIKE ? OR properties LIKE ?)';
      const params: unknown[] = [`%${query}%`, `%${query}%`];

      if (entityType) {
        sql += ' AND type = ?';
        params.push(entityType);
      }

      sql += ` LIMIT ${limit}`;

      const rows = this._conn!.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map((row) => this._rowToEntity(row));
    }
  }

  // -----------------------------------------------------------------------
  // Convenience aliases (legacy API compatibility)
  // -----------------------------------------------------------------------

  /** Create entity (alias) */
  addEntity(entity: Entity): string {
    return this.createEntity(entity);
  }

  /** Create relationship (alias) */
  addRelation(relation: Relationship): string {
    return this.createRelationship(relation);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Close the database connection */
  close(): void {
    if (this._conn) {
      this._conn.close();
      this._conn = null;
      this._propsCache.clear();
      log.info('GraphManager closed');
    }
  }

  /** Context manager: enter */
  [Symbol.dispose](): void {
    this.close();
  }
}

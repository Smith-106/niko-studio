/**
 * GraphEngine - Knowledge graph engine with SQLite backend
 *
 * Core features:
 * 1. Entity management (Character/Location/Event/Item/Foreshadow)
 * 2. Relation network
 * 3. Foreshadow tracking
 * 4. Timeline queries
 * 5. Cypher query support
 * 6. Plugin system with health checks
 * 7. Optional Neo4j projection
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { getConfigValue as getAppConfigValue } from '../config';
import { createIntegrationAdapters, type IntegrationAdapterBundle } from '../integrations';

// ---------------------------------------------------------------------------
// Data classes
// ---------------------------------------------------------------------------

/**
 * Entity - base entity data structure
 */
export class Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;

  constructor(params: {
    id: string;
    type: string;
    name: string;
    properties?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  }) {
    this.id = params.id;
    this.type = params.type;
    this.name = params.name;
    this.properties = params.properties ?? {};
    this.createdAt = params.createdAt ?? new Date().toISOString();
    this.updatedAt = params.updatedAt ?? new Date().toISOString();
  }
}

/**
 * Relation - relationship between entities
 */
export class Relation {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  properties: Record<string, unknown>;
  createdAt: string;

  constructor(params: {
    id: string;
    fromId: string;
    toId: string;
    type: string;
    properties?: Record<string, unknown>;
    createdAt?: string;
  }) {
    this.id = params.id;
    this.fromId = params.fromId;
    this.toId = params.toId;
    this.type = params.type;
    this.properties = params.properties ?? {};
    this.createdAt = params.createdAt ?? new Date().toISOString();
  }
}

// ---------------------------------------------------------------------------
// EnginePlugin interface
// ---------------------------------------------------------------------------

/**
 * Engine plugin protocol
 */
export interface EnginePlugin {
  readonly name: string;
  load(engine: GraphEngine): Promise<void>;
  healthCheck(): Promise<Record<string, unknown>>;
}

type IntegrationAdapters = Pick<IntegrationAdapterBundle, 'flags' | 'graphProjection'>;

function resolveGraphConfigValue(key: 'dataDir' | 'graph.dbPath', defaultValue: string | null = null): string | null {
  const envKeys = key === 'graph.dbPath'
    ? ['GRAPH_DB_PATH', 'NIKO_GRAPH_DB_PATH']
    : ['DATA_DIR', 'NIKO_DATA_DIR'];

  for (const envKey of envKeys) {
    const envVal = process.env[envKey];
    if (typeof envVal === 'string' && envVal.trim()) {
      return envVal;
    }
  }

  const configValue = getAppConfigValue(key, defaultValue);
  if (typeof configValue === 'string' && configValue.trim()) {
    return configValue;
  }

  return defaultValue;
}

// ---------------------------------------------------------------------------
// GraphEngine
// ---------------------------------------------------------------------------

/**
 * Knowledge graph engine (primary system)
 */
export class GraphEngine {
  static readonly ENTITY_TYPES: readonly string[] = [
    'Character',
    'Location',
    'Event',
    'Item',
    'Foreshadow',
    'Chapter',
    'Scene',
  ];

  static readonly MAX_CYPHER_LENGTH = 4096;
  static readonly MAX_NAME_PATTERN_LENGTH = 256;

  isPrimaryEngine = true;
  plugins: EnginePlugin[] = [];
  dbPath: string;
  db: Database.Database;

  private _pluginHealth: Record<string, Record<string, unknown>> = {};
  private _integrationAdapters: IntegrationAdapters;

  constructor(dbPath?: string | null, plugins?: Iterable<EnginePlugin> | null) {
    // Resolve DB path
    let resolved = dbPath ?? null;
    if (resolved === null) {
      const dataDir = resolveGraphConfigValue('dataDir');
      if (dataDir) {
        resolved = join(dataDir, 'graph.db');
      }
    }
    if (resolved === null) {
      resolved = join(homedir(), '.niko', 'graph.db');
    }

    this.dbPath = resolved;
    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this._integrationAdapters = createIntegrationAdapters();
    this._initSchema();

    console.info(`Graph engine initialized: ${this.dbPath}`);

    if (plugins) {
      this._registerPlugins(plugins);
    }
  }

  // -----------------------------------------------------------------------
  // Plugin management
  // -----------------------------------------------------------------------

  private _registerPlugins(plugins: Iterable<EnginePlugin>): void {
    for (const plugin of plugins) {
      if (this.plugins.includes(plugin)) {
        continue;
      }
      this.plugins.push(plugin);
    }
  }

  /** Load all registered plugins */
  async initialize(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.load(this);
      } catch (exc) {
        const name = (plugin as EnginePlugin).name ?? 'unknown';
        console.error(`Graph plugin load failed: ${name}: ${exc}`);
        this._pluginHealth[name] = { status: 'error', error: String(exc) };
      }
    }
  }

  /** Run health checks on the engine and all plugins */
  async healthCheck(): Promise<Record<string, unknown>> {
    const pluginStatus: Record<string, Record<string, unknown>> = {};
    for (const plugin of this.plugins) {
      const name = (plugin as EnginePlugin).name ?? 'unknown';
      try {
        pluginStatus[name] = await plugin.healthCheck();
      } catch (exc) {
        pluginStatus[name] = { status: 'error', error: String(exc) };
      }
    }
    this._pluginHealth = pluginStatus;

    let dbOk = true;
    let error: string | null = null;
    try {
      this.db.prepare('SELECT 1').get();
    } catch (exc) {
      dbOk = false;
      error = String(exc);
    }

    return {
      engine: 'primary',
      db_path: this.dbPath,
      db_ok: dbOk,
      error,
      plugins: pluginStatus,
    };
  }

  /** Create a GraphEngine from configuration values */
  static fromConfig(plugins?: Iterable<EnginePlugin> | null): GraphEngine {
    let dbPath: string | null | undefined = resolveGraphConfigValue('graph.dbPath');
    if (dbPath === null) {
      const dataDir = resolveGraphConfigValue('dataDir');
      if (dataDir) {
        dbPath = join(dataDir, 'graph.db');
      }
    }
    return new GraphEngine(dbPath, plugins);
  }

  // -----------------------------------------------------------------------
  // Schema
  // -----------------------------------------------------------------------

  private _initSchema(): void {
    /** Initialize database schema */
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        created_at TEXT,
        FOREIGN KEY (from_id) REFERENCES entities(id),
        FOREIGN KEY (to_id) REFERENCES entities(id)
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
    `);
  }

  // -----------------------------------------------------------------------
  // Cypher execution
  // -----------------------------------------------------------------------

  /**
   * Execute a Cypher query (simplified SQL translation)
   *
   * Supported basic patterns:
   * - MATCH (n:Type) WHERE n.name = 'xxx' RETURN n
   * - MATCH (a)-[r:REL]->(b) RETURN a, r, b
   */
  async executeCypher(cypher: string): Promise<Record<string, unknown>[]> {
    if (typeof cypher !== 'string') {
      console.warn('Blocked non-string graph query input');
      return [{ error: 'Invalid query input' }];
    }

    cypher = cypher.trim();
    if (!cypher) {
      return [{ error: 'Query cannot be empty' }];
    }

    if (cypher.length > GraphEngine.MAX_CYPHER_LENGTH) {
      console.warn('Blocked oversized graph query');
      return [{ error: 'Query too long' }];
    }

    // Only MATCH queries allowed
    if (!cypher.toUpperCase().startsWith('MATCH')) {
      console.warn('Blocked non-MATCH graph query');
      return [{ error: 'Only MATCH queries are allowed' }];
    }

    return this._executeMatch(cypher);
  }

  /** Parse and execute a MATCH query */
  private async _executeMatch(cypher: string): Promise<Record<string, unknown>[]> {
    const traversalMatch = cypher.match(
      /^MATCH\s*\((\w+)\)\s*-\[(\w+)\*1\.\.(\d+)\]-\((\w+)\)\s*WHERE\s*\1\.name\s+CONTAINS\s+['"](.+?)['"]\s*RETURN\s*\4\s*,\s*\2(?:\s+LIMIT\s+(\d+))?\s*$/i
    );
    if (traversalMatch) {
      return this._executeTraversalMatch(
        traversalMatch[3],
        traversalMatch[5],
        traversalMatch[6]
      );
    }

    const relationshipMatch = cypher.match(
      /^MATCH\s*\((\w+)(?::(\w+))?\)\s*-\[(\w+)(?::(\w+))?\]->\s*\((\w+)(?::(\w+))?\)\s*RETURN\s+.+?(?:\s+LIMIT\s+(\d+))?\s*$/i
    );
    if (relationshipMatch) {
      return this._executeRelationshipMatch(
        relationshipMatch[2] ?? null,
        relationshipMatch[4] ?? null,
        relationshipMatch[6] ?? null,
        relationshipMatch[7]
      );
    }

    // Parse (n:Type)
    const nodeMatch = cypher.match(/\((\w+):(\w+)\)/);
    if (nodeMatch) {
      const nodeAlias = nodeMatch[1];
      const entityType = nodeMatch[2];
      const resultKey = this._resolveNodeResultKey(cypher, nodeAlias);

      // Parse WHERE condition
      const whereMatch = cypher.match(
        /WHERE\s+\w+\.(\w+)\s*=\s*['"](.+?)['"]/i
      );

      if (whereMatch) {
        const field = whereMatch[1];
        const value = whereMatch[2];

        let rows: Record<string, unknown>[];
        if (field === 'name') {
          rows = this.db
            .prepare('SELECT * FROM entities WHERE type = ? AND name = ?')
            .all(entityType, value) as Record<string, unknown>[];
        } else {
          // Search in properties JSON
          rows = this.db
            .prepare(
              "SELECT * FROM entities WHERE type = ? AND json_extract(properties, ?) = ?"
            )
            .all(entityType, `$.${field}`, value) as Record<string, unknown>[];
        }

        return rows.map((row) => this._wrapEntityResult(resultKey, row));
      }

      const rows = this.db
        .prepare('SELECT * FROM entities WHERE type = ?')
        .all(entityType) as Record<string, unknown>[];
      return rows.map((row) => this._wrapEntityResult(resultKey, row));
    }

    return [];
  }

  private _executeRelationshipMatch(
    sourceType: string | null,
    relationType: string | null,
    targetType: string | null,
    limitValue?: string
  ): Record<string, unknown>[] {
    let sql = `
      SELECT
        r.id as relation_id,
        r.type as relation_type,
        r.properties as relation_properties,
        r.created_at as relation_created_at,
        e1.id as source_id,
        e1.type as source_type,
        e1.name as source_name,
        e1.properties as source_properties,
        e1.created_at as source_created_at,
        e1.updated_at as source_updated_at,
        e2.id as target_id,
        e2.type as target_type,
        e2.name as target_name,
        e2.properties as target_properties,
        e2.created_at as target_created_at,
        e2.updated_at as target_updated_at
      FROM relations r
      JOIN entities e1 ON r.from_id = e1.id
      JOIN entities e2 ON r.to_id = e2.id
      WHERE 1 = 1
    `;
    const params: unknown[] = [];

    if (sourceType) {
      sql += ' AND e1.type = ?';
      params.push(sourceType);
    }
    if (relationType) {
      sql += ' AND r.type = ?';
      params.push(relationType);
    }
    if (targetType) {
      sql += ' AND e2.type = ?';
      params.push(targetType);
    }

    sql += ' ORDER BY e1.name, e2.name';

    const limit = this._normalizeCypherLimit(limitValue);
    if (limit !== null) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((row) => ({
      source: {
        id: row.source_id,
        type: row.source_type,
        name: row.source_name,
        properties: this._parseProperties(row.source_properties),
        created_at: row.source_created_at,
        updated_at: row.source_updated_at,
      },
      relationship: {
        id: row.relation_id,
        type: row.relation_type,
        properties: this._parseProperties(row.relation_properties),
        created_at: row.relation_created_at,
      },
      target: {
        id: row.target_id,
        type: row.target_type,
        name: row.target_name,
        properties: this._parseProperties(row.target_properties),
        created_at: row.target_created_at,
        updated_at: row.target_updated_at,
      },
    }));
  }

  private _executeTraversalMatch(
    depthValue: string,
    startNameFragment: string,
    limitValue?: string
  ): Record<string, unknown>[] {
    const maxDepth = Math.max(1, Math.min(parseInt(depthValue, 10) || 1, 10));
    const limit = this._normalizeCypherLimit(limitValue);
    const startRows = this.db
      .prepare('SELECT * FROM entities WHERE name LIKE ? ORDER BY name')
      .all(`%${startNameFragment}%`) as Record<string, unknown>[];

    if (!startRows.length) {
      return [];
    }

    const queue: Array<{
      entityId: string;
      path: Record<string, unknown>[];
      visited: string[];
    }> = startRows.map((row) => ({
      entityId: row.id as string,
      path: [],
      visited: [row.id as string],
    }));
    const results = new Map<string, { m: Record<string, unknown>; r: Record<string, unknown>[] }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length >= maxDepth) {
        continue;
      }

      const adjacencyRows = this.db.prepare(`
        SELECT
          r.id as relation_id,
          r.type as relation_type,
          r.properties as relation_properties,
          r.created_at as relation_created_at,
          r.from_id,
          r.to_id,
          e1.id as from_entity_id,
          e1.type as from_entity_type,
          e1.name as from_entity_name,
          e1.properties as from_entity_properties,
          e1.created_at as from_entity_created_at,
          e1.updated_at as from_entity_updated_at,
          e2.id as to_entity_id,
          e2.type as to_entity_type,
          e2.name as to_entity_name,
          e2.properties as to_entity_properties,
          e2.created_at as to_entity_created_at,
          e2.updated_at as to_entity_updated_at
        FROM relations r
        JOIN entities e1 ON r.from_id = e1.id
        JOIN entities e2 ON r.to_id = e2.id
        WHERE r.from_id = ? OR r.to_id = ?
      `).all(current.entityId, current.entityId) as Record<string, unknown>[];

      for (const row of adjacencyRows) {
        const nextIsTarget = row.from_id === current.entityId;
        const nextId = String(nextIsTarget ? row.to_id : row.from_id);
        if (current.visited.includes(nextId)) {
          continue;
        }

        const relationStep = {
          id: row.relation_id,
          type: row.relation_type,
          properties: this._parseProperties(row.relation_properties),
          from: row.from_entity_name,
          to: row.to_entity_name,
          created_at: row.relation_created_at,
        };
        const nextPath = [...current.path, relationStep];
        const nextEntity = nextIsTarget
          ? {
              id: row.to_entity_id,
              type: row.to_entity_type,
              name: row.to_entity_name,
              properties: this._parseProperties(row.to_entity_properties),
              created_at: row.to_entity_created_at,
              updated_at: row.to_entity_updated_at,
            }
          : {
              id: row.from_entity_id,
              type: row.from_entity_type,
              name: row.from_entity_name,
              properties: this._parseProperties(row.from_entity_properties),
              created_at: row.from_entity_created_at,
              updated_at: row.from_entity_updated_at,
            };

        const existing = results.get(nextId);
        if (!existing || existing.r.length > nextPath.length) {
          results.set(nextId, { m: nextEntity, r: nextPath });
        }

        if (nextPath.length < maxDepth) {
          queue.push({
            entityId: nextId,
            path: nextPath,
            visited: [...current.visited, nextId],
          });
        }
      }
    }

    const ordered = Array.from(results.values()).sort((left, right) => {
      const depthDiff = left.r.length - right.r.length;
      if (depthDiff !== 0) {
        return depthDiff;
      }
      return String(left.m.name).localeCompare(String(right.m.name));
    });

    return limit === null ? ordered : ordered.slice(0, limit);
  }

  private _normalizeCypherLimit(limitValue?: string): number | null {
    if (!limitValue) {
      return null;
    }

    const parsed = parseInt(limitValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.min(parsed, 200);
  }

  private _resolveNodeResultKey(cypher: string, nodeAlias: string): string {
    const returnMatch = cypher.match(/\bRETURN\s+(\w+)\b/i);
    if (!returnMatch) {
      return nodeAlias;
    }

    return returnMatch[1] === nodeAlias ? returnMatch[1] : nodeAlias;
  }

  private _wrapEntityResult(resultKey: string, row: Record<string, unknown>): Record<string, unknown> {
    return {
      [resultKey]: this._mapEntityResult(row),
    };
  }

  private _mapEntityResult(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: this._parseProperties(row.properties),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private _parseProperties(raw: unknown): Record<string, unknown> {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    if (raw && typeof raw === 'object') {
      return raw as Record<string, unknown>;
    }

    return {};
  }

  // -----------------------------------------------------------------------
  // Entity search
  // -----------------------------------------------------------------------

  /**
   * Safe entity search (parameterized query to prevent injection)
   *
   * @param entityType - Entity type (Character, Location, etc.)
   * @param namePattern - Name pattern (supports % wildcards)
   * @param limit - Maximum number of results
   * @returns Matching entity list
   */
  async searchEntitiesByName(
    entityType: string,
    namePattern: string,
    limit: number = 50
  ): Promise<Record<string, unknown>[]> {
    if (typeof namePattern !== 'string' || !namePattern) {
      return [];
    }

    if (namePattern.length > GraphEngine.MAX_NAME_PATTERN_LENGTH) {
      console.warn('Blocked oversized entity name pattern');
      return [];
    }

    let normalizedLimit: number;
    try {
      normalizedLimit = Math.max(1, Math.min(Number(limit), 200));
    } catch {
      normalizedLimit = 50;
    }

    const rows = this.db
      .prepare(
        'SELECT * FROM entities WHERE type = ? AND name LIKE ? LIMIT ?'
      )
      .all(entityType, namePattern, normalizedLimit) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  // -----------------------------------------------------------------------
  // Character operations
  // -----------------------------------------------------------------------

  /** Get character information */
  async getCharacter(
    name: string,
    includeRelations = true,
    includeTimeline = false
  ): Promise<Record<string, unknown>> {
    const row = this.db
      .prepare("SELECT * FROM entities WHERE type = 'Character' AND name = ?")
      .get(name) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `Character '${name}' not found` };
    }

    const character: Record<string, unknown> = {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (includeRelations) {
      character['relations'] = await this.getRelationships(name);
    }

    if (includeTimeline) {
      character['timeline'] = await this._getCharacterTimeline(row.id as string);
    }

    return character;
  }

  /** Get character relationship network */
  async getRelationships(
    character: string,
    relationshipType?: string | null,
    _depth: number = 1
  ): Promise<Record<string, unknown>[]> {
    // Get character ID first
    const row = this.db
      .prepare('SELECT id FROM entities WHERE name = ?')
      .get(character) as Record<string, string> | undefined;

    if (!row) {
      return [];
    }

    const entityId = row.id;

    // Query relationships
    let sql = `
      SELECT r.id, r.type, r.properties,
             e1.name as from_name, e2.name as to_name
      FROM relations r
      JOIN entities e1 ON r.from_id = e1.id
      JOIN entities e2 ON r.to_id = e2.id
      WHERE (r.from_id = ? OR r.to_id = ?)
    `;
    const params: unknown[] = [entityId, entityId];

    if (relationshipType) {
      sql += ' AND r.type = ?';
      params.push(relationshipType);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      properties: typeof r.properties === 'string' ? JSON.parse(r.properties) : {},
      from: r.from_name,
      to: r.to_name,
    }));
  }

  /** Get character timeline */
  private async _getCharacterTimeline(characterId: string): Promise<Record<string, unknown>[]> {
    const rows = this.db
      .prepare(
        `
        SELECT e.name, e.properties, r.type as relation
        FROM relations r
        JOIN entities e ON r.to_id = e.id
        WHERE r.from_id = ? AND e.type = 'Event'
        ORDER BY json_extract(e.properties, '$.time')
        `
      )
      .all(characterId) as Record<string, unknown>[];

    return rows.map((row) => ({
      event: row.name,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : {},
      relation: row.relation,
    }));
  }

  // -----------------------------------------------------------------------
  // Foreshadow
  // -----------------------------------------------------------------------

  /** Get foreshadow status */
  async getForeshadows(
    status: string = 'pending',
    chapter?: number | null
  ): Promise<Record<string, unknown>[]> {
    let sql = "SELECT * FROM entities WHERE type = 'Foreshadow'";
    const params: unknown[] = [];

    if (status) {
      sql += " AND json_extract(properties, '$.status') = ?";
      params.push(status);
    }

    if (chapter !== undefined && chapter !== null) {
      sql += " AND json_extract(properties, '$.planted_chapter') <= ?";
      params.push(chapter);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : {},
      created_at: row.created_at,
    }));
  }

  // -----------------------------------------------------------------------
  // Entity CRUD
  // -----------------------------------------------------------------------

  /** Create an entity */
  async createEntity(
    entityType: string,
    name: string,
    properties?: Record<string, unknown> | null
  ): Promise<Record<string, unknown>> {
    if (!(GraphEngine.ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return { error: `Invalid entity type: ${entityType}` };
    }

    const entityId = randomUUID();
    const now = new Date().toISOString();
    const props = properties ?? {};

    this.db
      .prepare(
        `INSERT INTO entities (id, type, name, properties, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(entityId, entityType, name, JSON.stringify(props), now, now);

    await this._runNeo4jEntityProjection({
      id: entityId,
      type: entityType,
      name,
      properties: props,
      created_at: now,
    });

    console.info(`Created entity: ${entityType}/${name}`);
    return { id: entityId, status: 'created' };
  }

  /** Create a relation */
  async createRelation(
    fromName: string,
    toName: string,
    relationType: string,
    properties?: Record<string, unknown> | null
  ): Promise<Record<string, unknown>> {
    // Get entity IDs
    const fromRow = this.db
      .prepare('SELECT id FROM entities WHERE name = ?')
      .get(fromName) as Record<string, string> | undefined;
    const toRow = this.db
      .prepare('SELECT id FROM entities WHERE name = ?')
      .get(toName) as Record<string, string> | undefined;

    if (!fromRow) {
      return { error: `Entity '${fromName}' not found` };
    }
    if (!toRow) {
      return { error: `Entity '${toName}' not found` };
    }

    const relationId = randomUUID();
    const now = new Date().toISOString();
    const props = properties ?? {};

    this.db
      .prepare(
        `INSERT INTO relations (id, from_id, to_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(relationId, fromRow.id, toRow.id, relationType, JSON.stringify(props), now);

    await this._runNeo4jRelationProjection({
      id: relationId,
      from_id: fromRow.id,
      to_id: toRow.id,
      from_name: fromName,
      to_name: toName,
      type: relationType,
      properties: props,
      created_at: now,
    });

    console.info(`Created relation: ${fromName} -[${relationType}]-> ${toName}`);
    return { id: relationId, status: 'created' };
  }

  // -----------------------------------------------------------------------
  // Neo4j projection (optional)
  // -----------------------------------------------------------------------

  private async _runNeo4jEntityProjection(entity: Record<string, unknown>): Promise<void> {
    if (!this._integrationAdapters.flags.neo4jEnabled) {
      return;
    }
    try {
      await this._integrationAdapters.graphProjection.projectEntity(entity);
    } catch (exc) {
      console.warn(`Neo4j entity projection failed, local-first path preserved: ${exc}`);
    }
  }

  private async _runNeo4jRelationProjection(relation: Record<string, unknown>): Promise<void> {
    if (!this._integrationAdapters.flags.neo4jEnabled) {
      return;
    }
    try {
      await this._integrationAdapters.graphProjection.projectRelation(relation);
    } catch (exc) {
      console.warn(`Neo4j relation projection failed, local-first path preserved: ${exc}`);
    }
  }

  // -----------------------------------------------------------------------
  // Update / delete
  // -----------------------------------------------------------------------

  /** Update entity properties */
  async updateEntity(name: string, properties: Record<string, unknown>): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();

    const row = this.db
      .prepare('SELECT properties FROM entities WHERE name = ?')
      .get(name) as Record<string, string> | undefined;
    if (!row) {
      return { error: `Entity '${name}' not found` };
    }

    const existing: Record<string, unknown> = typeof row.properties === 'string' ? JSON.parse(row.properties) : {};
    Object.assign(existing, properties);

    this.db
      .prepare('UPDATE entities SET properties = ?, updated_at = ? WHERE name = ?')
      .run(JSON.stringify(existing), now, name);

    return { status: 'updated', properties: existing };
  }

  /** Delete entity and its relations */
  async deleteEntity(name: string): Promise<Record<string, unknown>> {
    const row = this.db
      .prepare('SELECT id FROM entities WHERE name = ?')
      .get(name) as Record<string, string> | undefined;

    if (!row) {
      return { error: `Entity '${name}' not found` };
    }

    const entityId = row.id;

    this.db.prepare('DELETE FROM relations WHERE from_id = ? OR to_id = ?')
      .run(entityId, entityId);
    this.db.prepare('DELETE FROM entities WHERE id = ?').run(entityId);

    console.info(`Deleted entity: ${name}`);
    return { status: 'deleted' };
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}

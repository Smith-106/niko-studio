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
import { createLogger } from '../logger/index.js';

const log = createLogger('graph-engine');

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

export interface GraphReadScope {
  workspaceId?: string | null;
  projectId?: string | null;
  allowLegacy?: boolean;
}

interface NormalizedGraphReadScope {
  workspaceId: string | null;
  projectId: string | null;
  allowLegacy: boolean;
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

  static readonly MAX_CYPHER_LENGTH = 65536;
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

    log.info(`Graph engine initialized`, { dbPath: this.dbPath });

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
        log.error(`Graph plugin load failed: ${name}`, { error: String(exc) });
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

  private _normalizeReadScope(scope?: GraphReadScope | null): NormalizedGraphReadScope | null {
    const workspaceId = readOptionalString(scope?.workspaceId);
    const projectId = readOptionalString(scope?.projectId);
    const allowLegacy = scope?.allowLegacy !== false;

    if (!workspaceId && !projectId) {
      return null;
    }

    return {
      workspaceId,
      projectId,
      allowLegacy,
    };
  }

  private _buildScopedEntityPredicate(
    alias: string,
    scope: NormalizedGraphReadScope
  ): { clause: string; params: unknown[] } {
    const workspaceExpr = `json_extract(${alias}.properties, '$.workspaceId')`;
    const projectExpr = `json_extract(${alias}.properties, '$.projectId')`;
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (scope.workspaceId) {
      clauses.push(`${workspaceExpr} = ?`);
      params.push(scope.workspaceId);

      if (scope.projectId) {
        clauses.push(`(${workspaceExpr} IS NULL AND ${projectExpr} = ?)`);
        params.push(scope.projectId);
      }
    } else if (scope.projectId) {
      clauses.push(`${projectExpr} = ?`);
      params.push(scope.projectId);
    }

    if (scope.allowLegacy) {
      clauses.push(`(${workspaceExpr} IS NULL AND ${projectExpr} IS NULL)`);
    }

    return {
      clause: `(${clauses.join(' OR ')})`,
      params,
    };
  }

  /**
   * Execute a Cypher query (simplified SQL translation)
   *
   * Supported basic patterns:
   * - MATCH (n:Type) WHERE n.name = 'xxx' RETURN n
   * - MATCH (a)-[r:REL]->(b) RETURN a, r, b
   */
  async executeCypher(
    cypher: string,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>[]> {
    if (typeof cypher !== 'string') {
      log.warn('Blocked non-string graph query input');
      return [{ error: 'Invalid query input' }];
    }

    cypher = cypher.trim();
    if (!cypher) {
      return [{ error: 'Query cannot be empty' }];
    }

    if (cypher.length > GraphEngine.MAX_CYPHER_LENGTH) {
      log.warn('Blocked oversized graph query');
      return [{ error: 'Query too long' }];
    }

    if (cypher.toUpperCase().startsWith('MATCH')) {
      return this._executeMatch(cypher, scope);
    }

    if (cypher.toUpperCase().startsWith('MERGE')) {
      return this._executeMergeMutation(cypher);
    }

    log.warn('Blocked graph query outside MATCH/MERGE subset');
    return [{ error: 'Only MATCH queries and scoped MERGE mutations are allowed' }];
  }

  private async _executeMergeMutation(cypher: string): Promise<Record<string, unknown>[]> {
    const merge = this._parseMergeMutation(cypher);
    if (!merge) {
      return [{ error: 'Invalid MERGE mutation syntax' }];
    }

    const { alias, entityType, matchProps, setProps } = merge;
    if (!(GraphEngine.ENTITY_TYPES as readonly string[]).includes(entityType)) {
      return [{ error: `Invalid entity type: ${entityType}` }];
    }

    const row = this._findEntityForMerge(entityType, matchProps);
    const createdAt = typeof row?.created_at === 'string' ? row.created_at : new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const nextName = this._resolveMergedEntityName(row, matchProps, setProps);

    if (!nextName) {
      return [{ error: 'MERGE mutation requires a name field' }];
    }

    const nextProperties = this._resolveMergedEntityProperties(row, matchProps, setProps);

    if (row) {
      this.db
        .prepare('UPDATE entities SET name = ?, properties = ?, updated_at = ? WHERE id = ?')
        .run(nextName, JSON.stringify(nextProperties), updatedAt, row.id);

      return [this._wrapEntityResult(alias, {
        ...row,
        name: nextName,
        properties: JSON.stringify(nextProperties),
        updated_at: updatedAt,
      })];
    }

    const entityId = typeof matchProps.id === 'string' && matchProps.id.trim()
      ? matchProps.id.trim()
      : randomUUID();

    this.db
      .prepare(
        `INSERT INTO entities (id, type, name, properties, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(entityId, entityType, nextName, JSON.stringify(nextProperties), createdAt, updatedAt);

    await this._runNeo4jEntityProjection({
      id: entityId,
      type: entityType,
      name: nextName,
      properties: nextProperties,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    return [this._wrapEntityResult(alias, {
      id: entityId,
      type: entityType,
      name: nextName,
      properties: JSON.stringify(nextProperties),
      created_at: createdAt,
      updated_at: updatedAt,
    })];
  }

  private _parseMergeMutation(cypher: string): {
    alias: string;
    entityType: string;
    matchProps: Record<string, unknown>;
    setProps: Record<string, unknown>;
  } | null {
    const header = /^MERGE\s*\((\w+):(\w+)\s*/i.exec(cypher);
    if (!header) return null;

    const alias = header[1];
    const entityType = header[2];
    let cursor = header[0].length;

    const matchObject = this._extractBalancedJsonObject(cypher, cursor);
    if (!matchObject) return null;
    cursor = matchObject.endIndex;

    while (cursor < cypher.length && /\s/.test(cypher[cursor]!)) {
      cursor += 1;
    }
    if (cypher[cursor] !== ')') return null;
    cursor += 1;

    const setPrefix = /\s*SET\s*/iy;
    setPrefix.lastIndex = cursor;
    const setMatch = setPrefix.exec(cypher);
    if (!setMatch) return null;
    cursor = setPrefix.lastIndex;

    const setObject = this._extractBalancedJsonObject(cypher, cursor);
    if (!setObject) return null;
    cursor = setObject.endIndex;

    const returnSuffix = new RegExp(`^\\s*RETURN\\s+${alias}\\s*$`, 'i');
    if (!returnSuffix.test(cypher.slice(cursor))) {
      return null;
    }

    try {
      const matchProps = JSON.parse(matchObject.json);
      const setProps = JSON.parse(setObject.json);
      if (!matchProps || typeof matchProps !== 'object' || Array.isArray(matchProps)) {
        return null;
      }
      if (!setProps || typeof setProps !== 'object' || Array.isArray(setProps)) {
        return null;
      }

      return {
        alias,
        entityType,
        matchProps: matchProps as Record<string, unknown>,
        setProps: setProps as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  }

  private _extractBalancedJsonObject(
    text: string,
    startIndex: number,
  ): { json: string; endIndex: number } | null {
    while (startIndex < text.length && /\s/.test(text[startIndex]!)) {
      startIndex += 1;
    }
    if (text[startIndex] !== '{') return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return {
            json: text.slice(startIndex, index + 1),
            endIndex: index + 1,
          };
        }
      }
    }

    return null;
  }

  private _findEntityForMerge(
    entityType: string,
    matchProps: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (typeof matchProps.id === 'string' && matchProps.id.trim()) {
      const row = this.db
        .prepare('SELECT * FROM entities WHERE id = ? AND type = ?')
        .get(matchProps.id.trim(), entityType) as Record<string, unknown> | undefined;
      return row ?? null;
    }

    const name = typeof matchProps.name === 'string' ? matchProps.name.trim() : '';
    let rows: Record<string, unknown>[];

    if (name) {
      rows = this.db
        .prepare('SELECT * FROM entities WHERE type = ? AND name = ?')
        .all(entityType, name) as Record<string, unknown>[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM entities WHERE type = ?')
        .all(entityType) as Record<string, unknown>[];
    }

    return rows.find((row) => {
      const properties = this._parseProperties(row.properties);
      return Object.entries(matchProps).every(([key, value]) => {
        if (key === 'id') return row.id === value;
        if (key === 'name') return row.name === value;
        return properties[key] === value;
      });
    }) ?? null;
  }

  private _resolveMergedEntityName(
    row: Record<string, unknown> | null,
    matchProps: Record<string, unknown>,
    setProps: Record<string, unknown>,
  ): string {
    return (
      (typeof setProps.name === 'string' && setProps.name.trim())
      || (typeof row?.name === 'string' && row.name.trim())
      || (typeof matchProps.name === 'string' && matchProps.name.trim())
      || ''
    );
  }

  private _resolveMergedEntityProperties(
    row: Record<string, unknown> | null,
    matchProps: Record<string, unknown>,
    setProps: Record<string, unknown>,
  ): Record<string, unknown> {
    const existing = row ? this._parseProperties(row.properties) : {};
    const merged = {
      ...existing,
      ...Object.fromEntries(Object.entries(matchProps).filter(([key]) => key !== 'id' && key !== 'name')),
      ...Object.fromEntries(Object.entries(setProps).filter(([key]) => key !== 'id' && key !== 'name')),
    };

    if (row && typeof row.created_at === 'string') {
      merged.created_at = row.created_at;
    }
    merged.updated_at = new Date().toISOString();

    return merged;
  }

  /** Parse and execute a MATCH query */
  private async _executeMatch(
    cypher: string,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>[]> {
    const normalizedScope = this._normalizeReadScope(scope);

    const traversalMatch = cypher.match(
      /^MATCH\s*\((\w+)\)\s*-\[(\w+)\*1\.\.(\d+)\]-\((\w+)\)\s*WHERE\s*\1\.name\s+CONTAINS\s+['"](.+?)['"]\s*RETURN\s*\4\s*,\s*\2(?:\s+LIMIT\s+(\d+))?\s*$/i
    );
    if (traversalMatch) {
      return this._executeTraversalMatch(
        traversalMatch[3],
        traversalMatch[5],
        traversalMatch[6],
        normalizedScope
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
        relationshipMatch[7],
        normalizedScope
      );
    }

    // Parse (n:Type)
    const nodeMatch = cypher.match(/\((\w+):(\w+)\)/);
    if (nodeMatch) {
      const nodeAlias = nodeMatch[1];
      const entityType = nodeMatch[2];
      const resultKey = this._resolveNodeResultKey(cypher, nodeAlias);
      const limit = this._normalizeCypherLimit(cypher.match(/\bLIMIT\s+(\d+)\s*$/i)?.[1]);

      // Parse WHERE condition
      const whereMatch = cypher.match(
        /WHERE\s+\w+\.(\w+)\s*=\s*['"](.+?)['"]/i
      );

      let sql = 'SELECT * FROM entities WHERE type = ?';
      const params: unknown[] = [entityType];

      if (normalizedScope) {
        const scoped = this._buildScopedEntityPredicate('entities', normalizedScope);
        sql += ` AND ${scoped.clause}`;
        params.push(...scoped.params);
      }

      if (whereMatch) {
        const field = whereMatch[1];
        const value = whereMatch[2];

        if (field === 'name') {
          sql += ' AND name = ?';
          params.push(value);
        } else {
          sql += ' AND json_extract(properties, ?) = ?';
          params.push(`$.${field}`, value);
        }

        if (limit !== null) {
          sql += ' LIMIT ?';
          params.push(limit);
        }

        const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
        return rows.map((row) => this._wrapEntityResult(resultKey, row));
      }

      if (limit !== null) {
        sql += ' LIMIT ?';
        params.push(limit);
      }

      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map((row) => this._wrapEntityResult(resultKey, row));
    }

    return [];
  }

  private _executeRelationshipMatch(
    sourceType: string | null,
    relationType: string | null,
    targetType: string | null,
    limitValue?: string,
    scope?: NormalizedGraphReadScope | null
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
    if (scope) {
      const sourceScope = this._buildScopedEntityPredicate('e1', scope);
      sql += ` AND ${sourceScope.clause}`;
      params.push(...sourceScope.params);

      const targetScope = this._buildScopedEntityPredicate('e2', scope);
      sql += ` AND ${targetScope.clause}`;
      params.push(...targetScope.params);
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
    limitValue?: string,
    scope?: NormalizedGraphReadScope | null
  ): Record<string, unknown>[] {
    const maxDepth = Math.max(1, Math.min(parseInt(depthValue, 10) || 1, 10));
    const limit = this._normalizeCypherLimit(limitValue);
    let startSql = 'SELECT * FROM entities WHERE name LIKE ?';
    const startParams: unknown[] = [`%${startNameFragment}%`];
    if (scope) {
      const scoped = this._buildScopedEntityPredicate('entities', scope);
      startSql += ` AND ${scoped.clause}`;
      startParams.push(...scoped.params);
    }
    startSql += ' ORDER BY name';
    const startRows = this.db.prepare(startSql).all(...startParams) as Record<string, unknown>[];

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

      let adjacencySql = `
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
      `;
      const adjacencyParams: unknown[] = [current.entityId, current.entityId];
      if (scope) {
        const sourceScope = this._buildScopedEntityPredicate('e1', scope);
        adjacencySql += ` AND ${sourceScope.clause}`;
        adjacencyParams.push(...sourceScope.params);

        const targetScope = this._buildScopedEntityPredicate('e2', scope);
        adjacencySql += ` AND ${targetScope.clause}`;
        adjacencyParams.push(...targetScope.params);
      }
      const adjacencyRows = this.db
        .prepare(adjacencySql)
        .all(...adjacencyParams) as Record<string, unknown>[];

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
      log.warn('Blocked oversized entity name pattern');
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
      properties: this._parseProperties(row.properties),
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
    includeTimeline = false,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>> {
    let sql = "SELECT * FROM entities WHERE type = 'Character' AND name = ?";
    const params: unknown[] = [name];
    const normalizedScope = this._normalizeReadScope(scope);
    if (normalizedScope) {
      const scoped = this._buildScopedEntityPredicate('entities', normalizedScope);
      sql += ` AND ${scoped.clause}`;
      params.push(...scoped.params);
    }

    const row = this.db
      .prepare(sql)
      .get(...params) as Record<string, unknown> | undefined;

    if (!row) {
      return { error: `Character '${name}' not found` };
    }

    const character: Record<string, unknown> = {
      id: row.id,
      type: row.type,
      name: row.name,
      properties: this._parseProperties(row.properties),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (includeRelations) {
      character['relations'] = await this.getRelationships(name, null, 1, scope);
    }

    if (includeTimeline) {
      character['timeline'] = await this._getCharacterTimeline(row.id as string, normalizedScope);
    }

    return character;
  }

  /** Get character relationship network */
  async getRelationships(
    character: string,
    relationshipType?: string | null,
    _depth: number = 1,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>[]> {
    // Get character ID first
    let entitySql = 'SELECT id FROM entities WHERE name = ?';
    const entityParams: unknown[] = [character];
    const normalizedScope = this._normalizeReadScope(scope);
    if (normalizedScope) {
      const scoped = this._buildScopedEntityPredicate('entities', normalizedScope);
      entitySql += ` AND ${scoped.clause}`;
      entityParams.push(...scoped.params);
    }

    const row = this.db
      .prepare(entitySql)
      .get(...entityParams) as Record<string, string> | undefined;

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
    if (normalizedScope) {
      const sourceScope = this._buildScopedEntityPredicate('e1', normalizedScope);
      sql += ` AND ${sourceScope.clause}`;
      params.push(...sourceScope.params);

      const targetScope = this._buildScopedEntityPredicate('e2', normalizedScope);
      sql += ` AND ${targetScope.clause}`;
      params.push(...targetScope.params);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      properties: this._parseProperties(r.properties),
      from: r.from_name,
      to: r.to_name,
    }));
  }

  /** Get character timeline */
  private async _getCharacterTimeline(
    characterId: string,
    scope?: NormalizedGraphReadScope | null
  ): Promise<Record<string, unknown>[]> {
    let sql = `
      SELECT e.name, e.properties, r.type as relation
      FROM relations r
      JOIN entities e ON r.to_id = e.id
      WHERE r.from_id = ? AND e.type = 'Event'
    `;
    const params: unknown[] = [characterId];
    if (scope) {
      const scoped = this._buildScopedEntityPredicate('e', scope);
      sql += ` AND ${scoped.clause}`;
      params.push(...scoped.params);
    }
    sql += " ORDER BY json_extract(e.properties, '$.time')";

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map((row) => ({
      event: row.name,
      properties: this._parseProperties(row.properties),
      relation: row.relation,
    }));
  }

  // -----------------------------------------------------------------------
  // Foreshadow
  // -----------------------------------------------------------------------

  /** Get foreshadow status */
  async getForeshadows(
    status: string = 'pending',
    chapter?: number | null,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>[]> {
    let sql = "SELECT * FROM entities WHERE type = 'Foreshadow'";
    const params: unknown[] = [];
    const normalizedScope = this._normalizeReadScope(scope);

    if (normalizedScope) {
      const scoped = this._buildScopedEntityPredicate('entities', normalizedScope);
      sql += ` AND ${scoped.clause}`;
      params.push(...scoped.params);
    }

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
      properties: this._parseProperties(row.properties),
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

    log.info(`Created entity`, { entityType, name });
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

    log.info(`Created relation`, { fromName, relationType, toName });
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
      log.warn(`Neo4j entity projection failed, local-first path preserved`, { error: String(exc) });
    }
  }

  private async _runNeo4jRelationProjection(relation: Record<string, unknown>): Promise<void> {
    if (!this._integrationAdapters.flags.neo4jEnabled) {
      return;
    }
    try {
      await this._integrationAdapters.graphProjection.projectRelation(relation);
    } catch (exc) {
      log.warn(`Neo4j relation projection failed, local-first path preserved`, { error: String(exc) });
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

    const existing: Record<string, unknown> = this._parseProperties(row.properties);
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

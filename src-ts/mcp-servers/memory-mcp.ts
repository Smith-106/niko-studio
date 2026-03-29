/**
 * memory-mcp.ts - Knowledge graph MCP server backed by JSON file storage.
 *
 * Migrated from src/mcp_servers/memory_mcp.py
 *
 * Provides:
 * - Entity CRUD (create_entities, open_nodes, delete_entities, add_observations)
 * - Relation CRUD (create_relations, delete_relations)
 * - Search (search_nodes) with simple string matching
 * - Graph traversal (get_entity_graph)
 * - Stats (read_graph, getGraphStats)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ============================================================
// Types
// ============================================================

export interface Entity {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  properties: Record<string, unknown>;
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

// ============================================================
// KnowledgeGraphStore - JSON file backed storage
// ============================================================

export class KnowledgeGraphStore {
  private filePath: string;
  private entities: Map<string, Entity>;
  private relations: Map<string, Relation>;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? ".",
      ".niko",
      "memory_graph.json",
    );

    this.filePath = resolvedPath;
    this.entities = new Map();
    this.relations = new Map();

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this._load();
  }

  // ---------- Persistence ----------

  private _load(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const data: GraphData = JSON.parse(raw) as GraphData;

      if (data.entities) {
        for (const e of Object.values(data.entities)) {
          this.entities.set(e.name, e);
        }
      }
      if (data.relations) {
        for (const r of Object.values(data.relations)) {
          this.relations.set(r.id, r);
        }
      }
    } catch {
      // Corrupt or empty file -- start fresh
    }
  }

  private _save(): void {
    const entities: Record<string, Entity> = {};
    for (const [name, e] of this.entities) {
      entities[name] = e;
    }

    const relations: Record<string, Relation> = {};
    for (const [id, r] of this.relations) {
      relations[id] = r;
    }

    const data: GraphData = { entities, relations };
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  // ---------- Entity CRUD ----------

  createEntity(params: {
    name: string;
    entityType?: string;
    observations?: string[];
    properties?: Record<string, unknown>;
  }): { id: string; name: string; status: string } | { error: string; name: string } {
    if (this.entities.has(params.name)) {
      return { error: `Entity '${params.name}' already exists`, name: params.name };
    }

    const now = new Date().toISOString();
    const entity: Entity = {
      id: crypto.randomUUID(),
      name: params.name,
      entityType: params.entityType ?? "concept",
      observations: params.observations ?? [],
      properties: params.properties ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.entities.set(entity.name, entity);
    this._save();
    return { id: entity.id, name: entity.name, status: "created" };
  }

  createEntities(
    items: Array<{
      name: string;
      entityType?: string;
      observations?: string[];
      properties?: Record<string, unknown>;
    }>,
  ): Array<{ id: string; name: string; status: string } | { error: string; name: string }> {
    const results: Array<{ id: string; name: string; status: string } | { error: string; name: string }> = [];
    for (const item of items) {
      results.push(this.createEntity(item));
    }
    return results;
  }

  getEntity(name: string): Entity | null {
    return this.entities.get(name) ?? null;
  }

  getEntities(names: string[]): Array<Entity & { relations: Relation[] }> {
    const results: Array<Entity & { relations: Relation[] }> = [];
    for (const name of names) {
      const entity = this.entities.get(name);
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
    },
  ): { name: string; status: string } | { error: string } {
    const entity = this.entities.get(name);
    if (!entity) {
      return { error: `Entity '${name}' not found` };
    }

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

    entity.updatedAt = new Date().toISOString();
    this._save();
    return { name, status: "updated" };
  }

  deleteEntity(name: string): { name: string; status: string } | { error: string } {
    const entity = this.entities.get(name);
    if (!entity) {
      return { error: `Entity '${name}' not found` };
    }

    // Remove all relations involving this entity
    for (const [id, r] of this.relations) {
      if (r.from === name || r.to === name) {
        this.relations.delete(id);
      }
    }

    this.entities.delete(name);
    this._save();
    return { name, status: "deleted" };
  }

  deleteEntities(names: string[]): Array<{ name: string; status: string } | { error: string }> {
    const results: Array<{ name: string; status: string } | { error: string }> = [];
    for (const name of names) {
      results.push(this.deleteEntity(name));
    }
    return results;
  }

  // ---------- Relation CRUD ----------

  createRelation(params: {
    from: string;
    to: string;
    relationType?: string;
    properties?: Record<string, unknown>;
    weight?: number;
  }): { id: string; from: string; to: string; type: string; status: string } | { error: string } {
    const fromEntity = this.entities.get(params.from);
    const toEntity = this.entities.get(params.to);

    if (!fromEntity) {
      return { error: `Entity '${params.from}' not found` };
    }
    if (!toEntity) {
      return { error: `Entity '${params.to}' not found` };
    }

    const relation: Relation = {
      id: crypto.randomUUID(),
      from: params.from,
      to: params.to,
      relationType: params.relationType ?? "RELATED_TO",
      properties: params.properties ?? {},
      weight: params.weight ?? 1.0,
      createdAt: new Date().toISOString(),
    };

    this.relations.set(relation.id, relation);
    this._save();
    return { id: relation.id, from: relation.from, to: relation.to, type: relation.relationType, status: "created" };
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
    const results: Array<{ id: string; from: string; to: string; type: string; status: string } | { error: string }> = [];
    for (const item of items) {
      results.push(this.createRelation(item));
    }
    return results;
  }

  getEntityRelations(entityName: string, direction: "in" | "out" | "both" = "both"): Relation[] {
    const results: Relation[] = [];
    for (const r of this.relations.values()) {
      if (direction === "out" && r.from === entityName) {
        results.push(r);
      } else if (direction === "in" && r.to === entityName) {
        results.push(r);
      } else if (direction === "both" && (r.from === entityName || r.to === entityName)) {
        results.push(r);
      }
    }
    return results;
  }

  deleteRelation(relationId: string): { id: string; status: string } | { error: string } {
    if (!this.relations.has(relationId)) {
      return { error: `Relation '${relationId}' not found` };
    }
    this.relations.delete(relationId);
    this._save();
    return { id: relationId, status: "deleted" };
  }

  // ---------- Search ----------

  searchNodes(params: { query: string; entityType?: string; limit?: number }): Entity[] {
    const { query, entityType, limit = 20 } = params;
    const q = query.toLowerCase();
    const results: Entity[] = [];

    for (const entity of this.entities.values()) {
      if (entityType && entity.entityType !== entityType) continue;

      const nameMatch = entity.name.toLowerCase().includes(q);
      const obsMatch = entity.observations.some((o) => o.toLowerCase().includes(q));

      if (nameMatch || obsMatch) {
        results.push(entity);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  getAllEntities(params?: { entityType?: string; limit?: number }): Entity[] {
    const entityType = params?.entityType;
    const limit = params?.limit ?? 100;
    const results: Entity[] = [];

    for (const entity of this.entities.values()) {
      if (entityType && entity.entityType !== entityType) continue;
      results.push(entity);
      if (results.length >= limit) break;
    }

    return results;
  }

  // ---------- Graph ----------

  getGraphStats(): GraphStats {
    const entitiesByType: Record<string, number> = {};
    const relationsByType: Record<string, number> = {};

    for (const e of this.entities.values()) {
      entitiesByType[e.entityType] = (entitiesByType[e.entityType] ?? 0) + 1;
    }
    for (const r of this.relations.values()) {
      relationsByType[r.relationType] = (relationsByType[r.relationType] ?? 0) + 1;
    }

    return {
      totalEntities: this.entities.size,
      totalRelations: this.relations.size,
      entitiesByType,
      relationsByType,
      avgRelationsPerEntity: this.entities.size > 0
        ? this.relations.size / this.entities.size
        : 0,
    };
  }

  getEntityGraph(params: { name: string; depth?: number }): {
    center: Entity;
    nodes: Entity[];
    edges: Relation[];
  } | { error: string } {
    const { name, depth = 1 } = params;

    const center = this.entities.get(name);
    if (!center) {
      return { error: `Entity '${name}' not found` };
    }

    const visitedNames = new Set<string>([name]);
    const collectedEntities: Entity[] = [];
    const collectedRelations: Relation[] = [];

    // BFS expansion
    let frontier = [name];
    for (let d = 0; d < depth; d++) {
      const nextFrontier: string[] = [];
      for (const entityName of frontier) {
        const relations = this.getEntityRelations(entityName);
        for (const r of relations) {
          const peer = r.from === entityName ? r.to : r.from;
          if (!visitedNames.has(peer)) {
            visitedNames.add(peer);
            const peerEntity = this.entities.get(peer);
            if (peerEntity) {
              collectedEntities.push(peerEntity);
              nextFrontier.push(peer);
            }
          }
          // Avoid duplicate edges
          if (!collectedRelations.some((existing) => existing.id === r.id)) {
            collectedRelations.push(r);
          }
        }
      }
      frontier = nextFrontier;
    }

    return { center, nodes: collectedEntities, edges: collectedRelations };
  }

  // ---------- Lifecycle ----------

  close(): void {
    this._save();
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

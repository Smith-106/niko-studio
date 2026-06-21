/**
 * MCP Graph Service
 *
 * Graph service module with 6 tools for knowledge graph operations.
 * Ported from src/mcp/services/graph.py
 */

import { getGraphEngine } from '../engine';
import { validateEntityType } from '../../utils/cypher-safety.js';

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

export interface GraphReadScope {
  workspaceId?: string | null;
  projectId?: string | null;
  allowLegacy?: boolean;
}

interface GraphEngine {
  executeCypher(cypher: string, scope?: GraphReadScope | null): Promise<unknown[]>;
  getCharacter(
    name: string,
    includeRelations: boolean,
    includeTimeline: boolean,
    scope?: GraphReadScope | null
  ): Promise<Record<string, unknown>>;
  getRelationships(
    character: string,
    relationshipType?: string | null,
    depth?: number,
    scope?: GraphReadScope | null
  ): Promise<unknown[]>;
  getForeshadows(
    status?: string,
    chapter?: number | null,
    scope?: GraphReadScope | null
  ): Promise<unknown[]>;
  createEntity(
    entityType: string,
    name: string,
    properties: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  createRelation(
    fromName: string,
    toName: string,
    relationType: string,
    properties: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
}

function isGraphEngine(engine: unknown): engine is GraphEngine {
  return (
    typeof engine === 'object' &&
    engine !== null &&
    typeof (engine as GraphEngine).executeCypher === 'function' &&
    typeof (engine as GraphEngine).getCharacter === 'function' &&
    typeof (engine as GraphEngine).getRelationships === 'function' &&
    typeof (engine as GraphEngine).getForeshadows === 'function' &&
    typeof (engine as GraphEngine).createEntity === 'function' &&
    typeof (engine as GraphEngine).createRelation === 'function'
  );
}

function getEngine(): GraphEngine | null {
  const engine = getGraphEngine();
  return isGraphEngine(engine) ? engine : null;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function graphQuery(
  cypher: string,
  scope?: GraphReadScope | null
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return scope ? engine.executeCypher(cypher, scope) : engine.executeCypher(cypher);
}

export async function graphGetCharacter(
  name: string,
  includeRelations = true,
  includeTimeline = false,
  scope?: GraphReadScope | null
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return {};
  return scope
    ? engine.getCharacter(name, includeRelations, includeTimeline, scope)
    : engine.getCharacter(name, includeRelations, includeTimeline);
}

export async function graphGetRelationships(
  character: string,
  relationshipType?: string | null,
  depth = 1,
  scope?: GraphReadScope | null
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return scope
    ? engine.getRelationships(character, relationshipType, depth, scope)
    : engine.getRelationships(character, relationshipType, depth);
}

export async function graphGetForeshadows(
  state?: string | null,
  chapter?: number | null,
  scope?: GraphReadScope | null
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return scope ? engine.getForeshadows(state ?? undefined, chapter, scope) : engine.getForeshadows(state ?? undefined, chapter);
}

export async function graphAddEntity(
  entityType: string,
  name: string,
  properties?: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  validateEntityType(entityType);
  const engine = getEngine();
  if (!engine) return { error: 'Graph engine unavailable' };
  return engine.createEntity(entityType, name, properties ?? {});
}

export async function graphAddRelation(
  fromName: string,
  toName: string,
  relationType: string,
  properties?: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Graph engine unavailable' };
  return engine.createRelation(fromName, toName, relationType, properties ?? {});
}

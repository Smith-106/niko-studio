/**
 * MCP Graph Service
 *
 * Graph service module with 6 tools for knowledge graph operations.
 * Ported from src/mcp/services/graph.py
 */

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface GraphEngine {
  executeCypher(cypher: string): Promise<unknown[]>;
  getCharacter(
    name: string,
    includeRelations: boolean,
    includeTimeline: boolean
  ): Promise<Record<string, unknown>>;
  getRelationships(
    character: string,
    relationshipType?: string | null,
    depth?: number
  ): Promise<unknown[]>;
  getForeshadows(status: string, chapter?: number | null): Promise<unknown[]>;
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

function getEngine(): GraphEngine | null {
  // Lazy accessor -- will be wired through container / gateway
  return null;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function graphQuery(cypher: string): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.executeCypher(cypher);
}

export async function graphGetCharacter(
  name: string,
  includeRelations = true,
  includeTimeline = false
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return {};
  return engine.getCharacter(name, includeRelations, includeTimeline);
}

export async function graphGetRelationships(
  character: string,
  relationshipType?: string | null,
  depth = 1
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.getRelationships(character, relationshipType, depth);
}

export async function graphGetForeshadows(
  status = 'pending',
  chapter?: number | null
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.getForeshadows(status, chapter);
}

export async function graphAddEntity(
  entityType: string,
  name: string,
  properties?: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
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

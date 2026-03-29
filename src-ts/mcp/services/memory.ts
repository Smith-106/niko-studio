/**
 * MCP Memory Service
 *
 * Memory service module with 5 tools for memory operations.
 * Ported from src/mcp/services/memory.py
 */

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface MemoryEngine {
  add(params: {
    content: string;
    layer: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    importance: number;
    tags: string[];
  }): Promise<Record<string, unknown>>;
  search(params: {
    query: string;
    layer?: string | null;
    dimensions?: string[] | null;
    entityId?: string | null;
    atTime?: string | null;
    limit: number;
  }): Promise<unknown[]>;
  getTemporalFacts(entityId: string, atTime?: string | null): Promise<unknown[]>;
  detectConflicts(entityId: string): Promise<unknown[]>;
  resolveConflict(
    memoryIdA: string,
    memoryIdB: string,
    resolution: string
  ): Promise<Record<string, unknown>>;
}

function getEngine(): MemoryEngine | null {
  // Lazy accessor -- will be wired through container / gateway
  return null;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export interface MemoryAddParams {
  content: string;
  layer?: string;
  dimension?: string | null;
  entityId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  importance?: number;
  tags?: string[];
}

export async function memoryAdd(params: MemoryAddParams): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Memory engine unavailable' };
  return engine.add({
    content: params.content,
    layer: params.layer ?? 'session',
    dimension: params.dimension ?? null,
    entityId: params.entityId ?? null,
    validFrom: params.validFrom ?? null,
    validUntil: params.validUntil ?? null,
    importance: params.importance ?? 0.5,
    tags: params.tags ?? [],
  });
}

export interface MemorySearchParams {
  query: string;
  layer?: string | null;
  dimensions?: string[] | null;
  entityId?: string | null;
  atTime?: string | null;
  limit?: number;
}

export async function memorySearch(params: MemorySearchParams): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.search({
    query: params.query,
    layer: params.layer ?? null,
    dimensions: params.dimensions ?? null,
    entityId: params.entityId ?? null,
    atTime: params.atTime ?? null,
    limit: params.limit ?? 10,
  });
}

export async function memoryGetTemporal(
  entityId: string,
  atTime?: string | null
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.getTemporalFacts(entityId, atTime ?? null);
}

export async function memoryGetConflicts(entityId: string): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.detectConflicts(entityId);
}

export async function memoryResolveConflict(
  memoryIdA: string,
  memoryIdB: string,
  resolution = 'auto'
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Memory engine unavailable' };
  return engine.resolveConflict(memoryIdA, memoryIdB, resolution);
}

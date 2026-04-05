/**
 * MCP Memory Service
 *
 * Memory service module with 5 tools for memory operations.
 * Ported from src/mcp/services/memory.py
 */

import { getMemoryEngine } from '../engine';

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
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    importance: number;
    tags: string[];
    source?: string;
    confidence?: number;
  }): Promise<Record<string, unknown>>;
  search(params: {
    query: string;
    layer?: string | null;
    dimensions?: string[] | null;
    entityId?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    atTime?: string | null;
    limit: number;
  }): Promise<unknown[]>;
  getTemporalFacts(params: {
    entityId: string;
    atTime?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
  }): Promise<unknown[]>;
  detectConflicts(
    entityId: string,
    scope?: {
      userId?: string | null;
      projectId?: string | null;
      sessionId?: string | null;
    }
  ): Promise<unknown[]>;
  resolveConflict(params: {
    memoryIdA: string;
    memoryIdB: string;
    resolution?: string;
  }): Promise<Record<string, unknown>>;
}

function isMemoryEngine(engine: unknown): engine is MemoryEngine {
  return (
    typeof engine === 'object' &&
    engine !== null &&
    typeof (engine as MemoryEngine).add === 'function' &&
    typeof (engine as MemoryEngine).search === 'function' &&
    typeof (engine as MemoryEngine).getTemporalFacts === 'function' &&
    typeof (engine as MemoryEngine).detectConflicts === 'function' &&
    typeof (engine as MemoryEngine).resolveConflict === 'function'
  );
}

function getEngine(): MemoryEngine | null {
  const engine = getMemoryEngine();
  return isMemoryEngine(engine) ? engine : null;
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
  userId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
  importance?: number;
  tags?: string[];
  source?: string;
  confidence?: number;
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
    userId: params.userId ?? null,
    projectId: params.projectId ?? null,
    sessionId: params.sessionId ?? null,
    importance: params.importance ?? 0.5,
    tags: params.tags ?? [],
    source: params.source ?? 'user',
    confidence: params.confidence ?? 1.0,
  });
}

export interface MemorySearchParams {
  query: string;
  layer?: string | null;
  dimensions?: string[] | null;
  entityId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
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
    userId: params.userId ?? null,
    projectId: params.projectId ?? null,
    sessionId: params.sessionId ?? null,
    atTime: params.atTime ?? null,
    limit: params.limit ?? 10,
  });
}

export async function memoryGetTemporal(
  entityId: string,
  atTime?: string | null,
  scope?: {
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
  }
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.getTemporalFacts({
    entityId,
    atTime: atTime ?? null,
    userId: scope?.userId ?? null,
    projectId: scope?.projectId ?? null,
    sessionId: scope?.sessionId ?? null,
  });
}

export async function memoryGetConflicts(
  entityId: string,
  scope?: {
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
  }
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.detectConflicts(entityId, {
    userId: scope?.userId ?? null,
    projectId: scope?.projectId ?? null,
    sessionId: scope?.sessionId ?? null,
  });
}

export async function memoryResolveConflict(
  memoryIdA: string,
  memoryIdB: string,
  resolution = 'auto'
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Memory engine unavailable' };
  return engine.resolveConflict({
    memoryIdA,
    memoryIdB,
    resolution,
  });
}

/**
 * Story Bible MCP Endpoints
 *
 * MCP endpoints for Story Bible CRUD operations.
 * Provides REST API for managing narrative entities (characters, world rules, plot threads, timeline events).
 */

import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import { jsonResponse, parseBody } from '../../mcp/http-types';
import type {
  StoryBibleEntity,
  CharacterProfile,
  WorldRule,
  PlotThread,
  TimelineEvent,
  SbEntityType,
} from '../entities/story-bible-types';
import {
  SB_ENTITY_TYPES,
  createCharacterProfile,
  createWorldRule,
  createPlotThread,
  createTimelineEvent,
} from '../entities/story-bible-types';
import { createLogger } from '../../logger';

const _log = createLogger('story-bible-endpoint');

// ============================================================
// In-memory storage (will be replaced with persistent storage)
// ============================================================

const entityStore = new Map<string, StoryBibleEntity>();
const novelEntityIndex = new Map<string, Set<string>>(); // novelId -> entityIds

// ============================================================
// Extraction and completeness types
// ============================================================

export interface ExtractionResult {
  novelId: string;
  extracted: StoryBibleEntity[];
  conflicts: Array<{ type: string; message: string }>;
  confidence: number;
  warnings: string[];
  timestamp: string;
}

export interface CompletenessReport {
  novelId: string;
  overallScore: number;
  byType: Record<SbEntityType, { count: number; avgScore: number }>;
  missing: Array<{ type: SbEntityType; suggestion: string }>;
  timestamp: string;
}

// ============================================================
// Helper functions
// ============================================================

function generateEntityId(): string {
  return `sb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function indexEntityByNovel(novelId: string, entityId: string): void {
  if (!novelEntityIndex.has(novelId)) {
    novelEntityIndex.set(novelId, new Set());
  }
  novelEntityIndex.get(novelId)!.add(entityId);
}

function removeFromNovelIndex(novelId: string, entityId: string): void {
  const entitySet = novelEntityIndex.get(novelId);
  if (entitySet) {
    entitySet.delete(entityId);
    if (entitySet.size === 0) {
      novelEntityIndex.delete(novelId);
    }
  }
}

function filterEntitiesByType(entities: StoryBibleEntity[], type?: SbEntityType): StoryBibleEntity[] {
  if (!type) return entities;
  return entities.filter((e) => e.type === type);
}

function validateEntityType(type: string): type is SbEntityType {
  return SB_ENTITY_TYPES.includes(type as SbEntityType);
}

function createEntityFromPartial(partial: Partial<StoryBibleEntity> & { type: SbEntityType; novelId: string; name: string }): StoryBibleEntity {
  const base = {
    id: generateEntityId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completenessScore: 0,
    source: 'manual' as const,
    metadata: {},
  };

  const entityType: string = partial.type;
  switch (partial.type) {
    case 'character':
      return createCharacterProfile({ ...base, ...partial });
    case 'world-rule':
      return createWorldRule({ ...base, ...partial });
    case 'plot-thread':
      return createPlotThread({ ...base, ...partial });
    case 'timeline-event':
      return createTimelineEvent({ ...base, ...partial });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// ============================================================
// CRUD Endpoints
// ============================================================

/**
 * GET/POST /story-bible/entities - List entities for a novel
 * Query/body params: novelId (required), type (optional)
 */
export async function sbGetEntitiesEndpoint(request: HttpRequest): Promise<HttpResponse> {
  // Accept params from both query and body (supports GET with query params and POST with body)
  const body = parseBody(request) as Record<string, unknown>;
  const novelId = (request.query?.novelId ?? body.novelId) as string | undefined;
  const type = (request.query?.type ?? body.type) as string | undefined;

  if (!novelId) {
    return jsonResponse({ error: 'novelId is required' }, 400);
  }

  if (type && !validateEntityType(type)) {
    return jsonResponse({ error: `Invalid entity type: ${type}. Valid types: ${SB_ENTITY_TYPES.join(', ')}` }, 400);
  }

  const entityIds = novelEntityIndex.get(novelId);
  if (!entityIds || entityIds.size === 0) {
    return jsonResponse({ entities: [], count: 0 });
  }

  const entities: StoryBibleEntity[] = [];
  for (const id of entityIds) {
    const entity = entityStore.get(id);
    if (entity) {
      entities.push(entity);
    }
  }

  const filtered = filterEntitiesByType(entities, type as SbEntityType | undefined);

  return jsonResponse({
    entities: filtered,
    count: filtered.length,
    novelId,
    type: type || 'all',
  });
}

/**
 * GET /story-bible/entity/:entityId - Get a single entity
 */
export async function sbGetEntityEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const entityId = request.params['entityId'];
  if (!entityId) {
    return jsonResponse({ error: 'entityId is required' }, 400);
  }

  const entity = entityStore.get(entityId);
  if (!entity) {
    return jsonResponse({ error: `Entity not found: ${entityId}` }, 404);
  }

  return jsonResponse({ entity });
}

/**
 * POST /story-bible/entities - Create a new entity
 */
export async function sbCreateEntityEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;

  const novelId = body.novelId as string | undefined;
  const name = body.name as string | undefined;
  const type = body.type as string | undefined;

  if (!novelId || !name || !type) {
    return jsonResponse({ error: 'novelId, name, and type are required' }, 400);
  }

  if (!validateEntityType(type)) {
    return jsonResponse({ error: `Invalid entity type: ${type}. Valid types: ${SB_ENTITY_TYPES.join(', ')}` }, 400);
  }

  try {
    const entity = createEntityFromPartial({
      ...body,
      type: type as SbEntityType,
      novelId,
      name,
    } as Partial<StoryBibleEntity> & { type: SbEntityType; novelId: string; name: string });

    entityStore.set(entity.id, entity);
    indexEntityByNovel(novelId, entity.id);

    _log.info('Created Story Bible entity', { entityId: entity.id, type, novelId });

    return jsonResponse({ entity }, 201);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    _log.error('Failed to create entity', { error: message, type, novelId });
    return jsonResponse({ error: message }, 400);
  }
}

/**
 * PUT /story-bible/entity/:entityId - Update an entity
 */
export async function sbUpdateEntityEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const entityId = request.params['entityId'];
  if (!entityId) {
    return jsonResponse({ error: 'entityId is required' }, 400);
  }

  const existing = entityStore.get(entityId);
  if (!existing) {
    return jsonResponse({ error: `Entity not found: ${entityId}` }, 404);
  }

  const body = parseBody(request) as Record<string, unknown>;

  // Prevent changing immutable fields
  delete body.id;
  delete body.novelId;
  delete body.type;
  delete body.createdAt;

  const updated: StoryBibleEntity = {
    ...existing,
    ...body,
    updatedAt: new Date().toISOString(),
  } as StoryBibleEntity;

  entityStore.set(entityId, updated);

  _log.info('Updated Story Bible entity', { entityId, type: existing.type });

  return jsonResponse({ entity: updated });
}

/**
 * DELETE /story-bible/entity/:entityId - Delete an entity
 */
export async function sbDeleteEntityEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const entityId = request.params['entityId'];
  if (!entityId) {
    return jsonResponse({ error: 'entityId is required' }, 400);
  }

  const existing = entityStore.get(entityId);
  if (!existing) {
    return jsonResponse({ error: `Entity not found: ${entityId}` }, 404);
  }

  entityStore.delete(entityId);
  removeFromNovelIndex(existing.novelId, entityId);

  _log.info('Deleted Story Bible entity', { entityId, type: existing.type, novelId: existing.novelId });

  return jsonResponse({ status: 'deleted', entityId });
}

/**
 * POST /story-bible/extract - Extract entities from manuscript
 */
export async function sbExtractFromManuscriptEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const novelId = body.novelId as string | undefined;

  if (!novelId) {
    return jsonResponse({ error: 'novelId is required' }, 400);
  }

  // TODO: Implement actual extraction using LLM
  // For now, return a placeholder result
  const result: ExtractionResult = {
    novelId,
    extracted: [],
    conflicts: [],
    confidence: 0,
    warnings: ['Extraction not yet implemented - placeholder result'],
    timestamp: new Date().toISOString(),
  };

  _log.info('Story Bible extraction requested', { novelId });

  return jsonResponse(result);
}

/**
 * GET/POST /story-bible/completeness - Get completeness report for a novel
 * Accepts params from both query and body.
 */
export async function sbGetCompletenessEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const novelId = (request.query?.novelId ?? body.novelId) as string | undefined;

  if (!novelId) {
    return jsonResponse({ error: 'novelId is required' }, 400);
  }

  const entityIds = novelEntityIndex.get(novelId);
  const entities = entityIds
    ? Array.from(entityIds)
        .map((id) => entityStore.get(id))
        .filter((e): e is StoryBibleEntity => e !== undefined)
    : [];

  const byType: Record<SbEntityType, { count: number; avgScore: number }> = {
    'character': { count: 0, avgScore: 0 },
    'world-rule': { count: 0, avgScore: 0 },
    'plot-thread': { count: 0, avgScore: 0 },
    'timeline-event': { count: 0, avgScore: 0 },
  };

  let totalScore = 0;
  for (const entity of entities) {
    byType[entity.type].count += 1;
    byType[entity.type].avgScore += entity.completenessScore;
    totalScore += entity.completenessScore;
  }

  // Calculate averages
  for (const type of SB_ENTITY_TYPES) {
    if (byType[type].count > 0) {
      byType[type].avgScore = byType[type].avgScore / byType[type].count;
    }
  }

  const missing: Array<{ type: SbEntityType; suggestion: string }> = [];
  if (byType['character'].count === 0) {
    missing.push({ type: 'character', suggestion: 'Add at least one main character' });
  }
  if (byType['world-rule'].count === 0) {
    missing.push({ type: 'world-rule', suggestion: 'Define world rules and constraints' });
  }
  if (byType['plot-thread'].count === 0) {
    missing.push({ type: 'plot-thread', suggestion: 'Create main plot thread' });
  }

  const report: CompletenessReport = {
    novelId,
    overallScore: entities.length > 0 ? totalScore / entities.length : 0,
    byType,
    missing,
    timestamp: new Date().toISOString(),
  };

  return jsonResponse(report);
}

// ============================================================
// Export for testing
// ============================================================

export function clearEntityStore(): void {
  entityStore.clear();
  novelEntityIndex.clear();
}

export function getEntityStore(): Map<string, StoryBibleEntity> {
  return entityStore;
}

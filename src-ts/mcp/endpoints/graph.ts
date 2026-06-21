/**
 * Graph REST Endpoints
 *
 * Graph-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/graph.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  graphQuery,
  graphGetCharacter,
  graphGetForeshadows,
  graphGetRelationships,
  graphAddEntity,
} from '../services/graph';
import type { GraphReadScope } from '../services/graph';
import { getConfigValue } from '../config';
import { normalizeProjectWorkspaceContext } from '../../project/workspace-model.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveWorkspaceRoot(): string {
  return String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim() || process.cwd();
}

function resolveGraphScope(body: Record<string, unknown>): GraphReadScope | null {
  const workspace = asRecord(body.workspace);
  const identity = asRecord(workspace?.identity);
  const context = asRecord(body.context);
  const workspaceId =
    readString(identity?.workspaceId)
    ?? readString(body.workspace_id)
    ?? readString(body.workspaceId);
  const projectId =
    readString(identity?.projectId)
    ?? readString(body.project_id)
    ?? readString(body.projectId)
    ?? readString(context?.projectId);

  if (!workspaceId && !projectId) {
    return null;
  }

  const normalizedWorkspace = normalizeProjectWorkspaceContext(body, {
    workspaceRoot: resolveWorkspaceRoot(),
  });

  return {
    workspaceId: workspaceId ? normalizedWorkspace.identity.workspaceId : null,
    projectId: projectId ? normalizedWorkspace.identity.projectId : null,
    allowLegacy: Boolean(getConfigValue('graph.allowLegacy', true)),
  };
}

/**
 * Patterns that indicate destructive or schema-modifying Cypher operations.
 * These are blocked at the /graph/query endpoint for safety.
 */
const BLOCKED_CYPHER_PATTERNS = [
  /\bDETACH\s+DELETE\b/i,
  /\bDROP\b/i,
  /\bCREATE\s+(?:CONSTRAINT|INDEX)/i,
  /\bREMOVE\s+[a-zA-Z_]+:/i,  // REMOVE n:Label (removes label, not property)
] as const;

function isCypherSafe(cypher: string): boolean {
  return !BLOCKED_CYPHER_PATTERNS.some(p => p.test(cypher));
}

export async function graphQueryEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const cypher = (body.cypher as string) ?? '';
  if (cypher.trim() && !isCypherSafe(cypher)) {
    return jsonResponse(
      { error: 'Cypher query contains blocked patterns (DETACH DELETE, DROP, CREATE CONSTRAINT/INDEX, REMOVE label). Only read-only queries are allowed.' },
      403,
    );
  }
  const scope = resolveGraphScope(body);
  const result = await graphQuery(cypher, scope);
  return jsonResponse(result);
}

export async function graphCharacterEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveGraphScope(body);
  const result = await graphGetCharacter(
    (body.name as string) ?? '',
    (body.include_relations as boolean) ?? true,
    (body.include_timeline as boolean) ?? false,
    scope
  );
  return jsonResponse(result);
}

export async function graphForeshadowsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveGraphScope(body);
  const state = body.state as string | undefined;
  const result = await graphGetForeshadows(
    state ?? undefined,
    body.chapter as number | undefined,
    scope
  );
  return jsonResponse(result);
}

// ============================================================
// Foreshadow CRUD endpoints
// ============================================================

export async function foreshadowPlantEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const description = String(body.description ?? '');
  if (!description.trim()) {
    return jsonResponse({ error: 'description is required' }, 400);
  }
  const scope = resolveGraphScope(body);
  const properties: Record<string, unknown> = {
    description,
    state: 'planted',
    planted_at: body.scene_id ?? '',
    planted_time: new Date().toISOString(),
    importance: body.importance ?? 1,
    ...(body.scene_id ? { scene_id: body.scene_id } : {}),
    ...(Array.isArray(body.tags) ? { tags: body.tags } : {}),
    ...(body.metadata && typeof body.metadata === 'object' ? { metadata: body.metadata } : {}),
    ...(scope?.workspaceId ? { workspaceId: scope.workspaceId } : {}),
    ...(scope?.projectId ? { projectId: scope.projectId } : {}),
  };
  const result = await graphAddEntity('Foreshadow', `foreshadow-${Date.now()}`, properties);
  const entityId = (result && typeof result === 'object' && 'id' in result) ? String(result.id) : `foreshadow-${Date.now()}`;
  return jsonResponse({
    id: entityId,
    description,
    state: 'planted',
    planted_at: String(properties.planted_at),
    planted_time: String(properties.planted_time),
    scene_id: body.scene_id ? String(body.scene_id) : null,
    hints: [],
    harvested_at: null,
    harvested_time: null,
    importance: Number(properties.importance ?? 1),
    tags: Array.isArray(properties.tags) ? properties.tags : [],
    metadata: (properties.metadata && typeof properties.metadata === 'object') ? properties.metadata as Record<string, unknown> : {},
  });
}

export async function foreshadowStatsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = (parseBody(request) ?? {}) as Record<string, unknown>;
  const scope = resolveGraphScope(body);
  const [planted, hinted, harvested] = await Promise.all([
    graphGetForeshadows('planted', undefined, scope),
    graphGetForeshadows('hinted', undefined, scope),
    graphGetForeshadows('harvested', undefined, scope),
  ]);
  const plantedArr = Array.isArray(planted) ? planted : [];
  const hintedArr = Array.isArray(hinted) ? hinted : [];
  const harvestedArr = Array.isArray(harvested) ? harvested : [];
  const total = plantedArr.length + hintedArr.length + harvestedArr.length;
  const totalHints = hintedArr.length;
  return jsonResponse({
    total,
    by_state: { planted: plantedArr.length, hinted: hintedArr.length, harvested: harvestedArr.length },
    total_hints: totalHints,
    avg_hints_per_foreshadow: total > 0 ? totalHints / total : 0,
    harvest_rate: total > 0 ? harvestedArr.length / total : 0,
  });
}

// ============================================================
// Character analysis endpoints
// ============================================================

export async function characterProfileEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  if (!name) {
    return jsonResponse({ error: 'name is required' }, 400);
  }
  const scope = resolveGraphScope(body);
  const characterData = await graphGetCharacter(name, true, false, scope);
  const data = characterData && typeof characterData === 'object' ? characterData as Record<string, unknown> : {};
  const props = (data.properties && typeof data.properties === 'object') ? data.properties as Record<string, unknown> : {};
  return jsonResponse({
    id: String(data.id ?? `char-${name}`),
    name,
    role: String(props.role ?? data.role ?? 'unknown'),
    personality: props.personality ?? data.personality ?? {},
    background: props.background ?? data.background ?? {},
    motivation: props.motivation ?? data.motivation ?? {},
    relationships: props.relationships ?? data.relationships ?? {},
    growth: props.growth ?? data.growth ?? {},
    five_dimension_score: props.five_dimension_score ?? data.five_dimension_score ?? {},
    created_at: String(data.created_at ?? new Date().toISOString()),
    updated_at: String(data.updated_at ?? new Date().toISOString()),
  });
}

export async function characterDepthEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const id = String(body.id ?? '').trim();
  if (!id) {
    return jsonResponse({ error: 'id is required' }, 400);
  }
  const name = id.startsWith('char-') ? id.slice(5) : id;
  const scope = resolveGraphScope(body);
  const characterData = await graphGetCharacter(name, true, false, scope);
  const data = characterData && typeof characterData === 'object' ? characterData as Record<string, unknown> : {};
  const props = (data.properties && typeof data.properties === 'object') ? data.properties as Record<string, unknown> : {};
  const dimensionScores = props.five_dimension_score ?? {};
  const scores = dimensionScores && typeof dimensionScores === 'object'
    ? dimensionScores as Record<string, number>
    : {};
  return jsonResponse({
    character: name,
    scores: {
      dynamicScore: scores.dynamicScore ?? 50,
      competenceScore: scores.competenceScore ?? 50,
      eccentricityScore: scores.eccentricityScore ?? 50,
      contrastScore: scores.contrastScore ?? 50,
      dualityScore: scores.dualityScore ?? 50,
    },
    depth_level: 'moderate',
    suggestions: [],
  });
}

export async function characterRelationshipsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveGraphScope(body);
  const name = String(body.name ?? '').trim();
  const allRelationships = await graphGetRelationships(name || '', null, 2, scope);
  const relationshipsArr = Array.isArray(allRelationships) ? allRelationships : [];
  const nodeSet = new Map<string, { id: string; name: string; role: string }>();
  const edges: Array<{ source: string; target: string; type: string; trust: number }> = [];
  for (const rel of relationshipsArr) {
    const r = rel as Record<string, unknown>;
    const source = String(r.from ?? r.source ?? '');
    const target = String(r.to ?? r.target ?? '');
    const type = String(r.type ?? r.relation_type ?? 'related');
    if (source && !nodeSet.has(source)) nodeSet.set(source, { id: source, name: source, role: 'character' });
    if (target && !nodeSet.has(target)) nodeSet.set(target, { id: target, name: target, role: 'character' });
    edges.push({ source, target, type, trust: Number(r.trust ?? r.weight ?? 0.5) });
  }
  if (name && !nodeSet.has(name)) {
    nodeSet.set(name, { id: name, name, role: 'protagonist' });
  }
  return jsonResponse({ nodes: [...nodeSet.values()], edges });
}

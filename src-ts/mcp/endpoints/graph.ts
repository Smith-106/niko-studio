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
} from '../services/graph';
import type { GraphReadScope } from '../services/graph';
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
    allowLegacy: true,
  };
}

export async function graphQueryEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const scope = resolveGraphScope(body);
  const result = await graphQuery((body.cypher as string) ?? '', scope);
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
  const result = await graphGetForeshadows(
    (body.status as string) ?? 'pending',
    body.chapter as number | undefined,
    scope
  );
  return jsonResponse(result);
}

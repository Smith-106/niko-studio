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

export async function graphQueryEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await graphQuery((body.cypher as string) ?? '');
  return jsonResponse(result);
}

export async function graphCharacterEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await graphGetCharacter(
    (body.name as string) ?? '',
    (body.include_relations as boolean) ?? true,
    (body.include_timeline as boolean) ?? false
  );
  return jsonResponse(result);
}

export async function graphForeshadowsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await graphGetForeshadows(
    (body.status as string) ?? 'pending',
    body.chapter as number | undefined
  );
  return jsonResponse(result);
}

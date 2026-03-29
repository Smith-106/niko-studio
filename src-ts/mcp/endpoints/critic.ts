/**
 * Critic REST Endpoints
 *
 * Critic-related HTTP endpoints for content evaluation.
 * Ported from src/mcp/endpoints/critic.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { evaluateContent, getImprovementSuggestions } from '../services/critic';

export async function criticEvaluateEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const qualityGoals = (body.quality_goals ?? body.qualityGoals) as
    | Record<string, unknown>
    | undefined;

  const result = await evaluateContent(
    (body.content as string) ?? '',
    body.scene_card as Record<string, unknown> | undefined,
    body.dimensions as string[] | undefined,
    qualityGoals
  );

  return jsonResponse(result);
}

export async function criticSuggestionsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await getImprovementSuggestions(
    (body.content as string) ?? '',
    body.issues as string[] | undefined,
    (body.max_suggestions as number) ?? 5
  );

  return jsonResponse(result);
}

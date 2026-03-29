/**
 * Skills REST Endpoints
 *
 * Skills-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/skills.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  skillsList,
  skillsLoad,
  skillsMatch,
  skillsGetChain,
} from '../services/skills';

export async function skillsListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const category = request.query['category'] ?? undefined;
  const result = await skillsList(category);
  return jsonResponse(result);
}

export async function skillsLoadEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsLoad((body.skill_id as string) ?? '');
  return jsonResponse(result);
}

export async function skillsMatchEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsMatch({
    taskType: body.task_type as string | undefined,
    keywords: body.keywords as string[] | undefined,
    issue: body.issue as string | undefined,
  });
  return jsonResponse(result);
}

export async function skillsChainEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await skillsGetChain((body.task_type as string) ?? '');
  return jsonResponse(result);
}

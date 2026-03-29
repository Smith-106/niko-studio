/**
 * Agent REST Endpoints
 *
 * Agent-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/agent.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  agentRoute,
  agentWrite,
  agentRevise,
  agentGetContext,
} from '../services/agent';

export async function agentRouteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as { task?: string };
  const result = await agentRoute(body.task ?? '');
  return jsonResponse(result);
}

export async function agentWriteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const qualityGoals = (body.quality_goals ?? body.qualityGoals) as
    | Record<string, unknown>
    | undefined;

  const result = await agentWrite({
    scene_card: (body.scene_card as Record<string, unknown>) ?? {},
    skills: body.skills as string[] | undefined,
    word_target: (body.word_target as number) ?? 2000,
    allow_llm_fallback: (body.allow_llm_fallback as boolean) ?? true,
    quality_goals: qualityGoals,
  });

  return jsonResponse(result);
}

export async function agentReviseEndpoint(request: HttpRequest): Promise<HttpResponse> {
  let body: Record<string, unknown>;
  try {
    body = parseBody(request) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body !== 'object' || body === null) {
    return jsonResponse({ error: 'Request body must be an object' }, 400);
  }

  let feedbackValue = body.feedback;
  if (feedbackValue == null) {
    feedbackValue = {};
  } else if (typeof feedbackValue !== 'object') {
    return jsonResponse({ error: 'feedback must be an object' }, 400);
  }

  const allowLlmFallback = Boolean(
    body.allow_llm_fallback ?? body.allowLlmFallback ?? true
  );

  const qualityGoals = (body.quality_goals ?? body.qualityGoals) as
    | Record<string, unknown>
    | undefined;

  const reviseParams = {
    draft: (body.draft as string) ?? '',
    feedback: feedbackValue as Record<string, unknown>,
    allow_llm_fallback: allowLlmFallback,
    quality_goals: qualityGoals,
  };

  try {
    const result = await agentRevise(reviseParams);
    return jsonResponse(result);
  } catch (exc) {
    const message = exc instanceof Error ? exc.message : String(exc);
    if (message.includes('ValueError')) {
      return jsonResponse({ error: message }, 400);
    }
    const statusCode = message.includes('LLM') ? 503 : 500;
    return jsonResponse({ error: message }, statusCode);
  }
}

export async function agentContextEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await agentGetContext(
    (body.scene_info as Record<string, unknown>) ?? {},
    body.context_types as string[] | undefined
  );
  return jsonResponse(result);
}

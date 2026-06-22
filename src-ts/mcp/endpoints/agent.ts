/**
 * Agent REST Endpoints
 *
 * Agent-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/agent.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { normalizeProjectWorkspaceContext } from '../../project/workspace-model.js';
import { safeResolveWorkspaceRoot } from '../input-validation.js';
import {
  agentRoute,
  agentWrite,
  agentRevise,
  agentGetContext,
} from '../services/agent';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveWorkspaceRoot(): string {
  return safeResolveWorkspaceRoot();
}

function resolveAgentWriteWorkspace(body: Record<string, unknown>) {
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

  if (!workspace && !workspaceId && !projectId) {
    return undefined;
  }

  return normalizeProjectWorkspaceContext({
    workspace: workspace ?? undefined,
    workspace_id: workspaceId ?? undefined,
    workspaceId: workspaceId ?? undefined,
    project_id: projectId ?? undefined,
    projectId: projectId ?? undefined,
    context: context ?? undefined,
  }, {
    workspaceRoot: resolveWorkspaceRoot(),
  });
}

export async function agentRouteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as { task?: string };
  const result = await agentRoute(body.task ?? '');
  return jsonResponse(result);
}

export async function agentWriteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveAgentWriteWorkspace(body);
  const qualityGoals = (body.quality_goals ?? body.qualityGoals) as
    | Record<string, unknown>
    | undefined;

  const result = await agentWrite({
    scene_card: (body.scene_card as Record<string, unknown>) ?? {},
    skills: body.skills as string[] | undefined,
    word_target: (body.word_target as number) ?? 2000,
    allow_llm_fallback: (body.allow_llm_fallback as boolean) ?? true,
    quality_goals: qualityGoals,
    workspace,
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

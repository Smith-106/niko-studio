/**
 * Workflow REST Endpoints
 *
 * Workflow-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/workflow.py
 */

import type { HttpRequest, HttpResponse, HttpRequestTraceContext } from '../http-types';
import type { WorkflowRecommendationInput } from '../../workflow/engine/engine-contracts.js';

import { jsonResponse, parseBody } from '../http-types';
import { normalizeProjectWorkspaceContext, type ProjectWorkspaceContext } from '../../project/workspace-model.js';
import { safeResolveWorkspaceRoot, tryResolveWorkspaceRoot } from '../input-validation.js';
import {
  workflowRoute,
  workflowPlan,
  workflowExecute,
  workflowQuickRollback,
  workflowLifecycle,
  checkpointCreate,
  checkpointRestore,
  checkpointList,
  workflowSchedulerRegister,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
  workflowSchedulerImportLitePlan,
} from '../services/workflow';
import {
  workflowRevisionAnalyzeWeakPoints,
  workflowRevisionCompare,
  workflowRevisionGenerateSuggestions,
  workflowRevisionHistory,
  workflowRevisionMarkRevised,
  workflowRevisionStartSession,
} from '../services/workflow-revision';

// ---------------------------------------------------------------
// Workflow endpoints
// ---------------------------------------------------------------

function resolveWorkspaceRoot(): string | HttpResponse {
  const result = tryResolveWorkspaceRoot();
  return result.ok ? result.value : result.error;
}

function resolveWorkspace(body: Record<string, unknown>): ProjectWorkspaceContext | HttpResponse {
  const workspaceRoot = resolveWorkspaceRoot();
  if (typeof workspaceRoot !== 'string') return workspaceRoot;
  const workspace = normalizeProjectWorkspaceContext(body, {
    workspaceRoot,
  });
  return {
    ...workspace,
    identity: {
      ...workspace.identity,
      workspaceRoot,
    },
  };
}

/** If resolveWorkspace returned an error HttpResponse, return it; otherwise get the workspace context. */
function guardWorkspace(ws: ProjectWorkspaceContext | HttpResponse): ProjectWorkspaceContext | HttpResponse {
  return ws;
}

function resolveTraceContext(request: HttpRequest): HttpRequestTraceContext | null {
  const traceContext = request.traceContext;
  if (!traceContext) {
    return null;
  }
  return {
    requestId: traceContext.requestId,
    route: traceContext.route,
    method: traceContext.method,
    startAtMs: traceContext.startAtMs,
  };
}

export async function workflowRouteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRoute((body.task as string) ?? '', workspace);
  return jsonResponse({ ...result, workspace });
}

export async function workflowPlanEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowPlan({
    task: (body.task as string) ?? '',
    level: body.level as string | undefined,
    recommendations: body.recommendations as WorkflowRecommendationInput | undefined,
    traceContext: resolveTraceContext(request),
    genre: body.genre as string | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowExecuteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowExecute({
    planId: (body.plan_id as string) ?? '',
    stepId: body.step_id as string | undefined,
    recommendations: body.recommendations as WorkflowRecommendationInput | undefined,
    confirmToken: body.confirm_token as string | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowLifecycleEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowLifecycle(
    (body.plan_id as string) ?? '',
    (body.action as string) ?? 'status',
    workspace,
  );
  return jsonResponse({ ...result, workspace });
}

export async function workflowQuickRollbackEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowQuickRollback({
    planId: (body.plan_id as string) ?? '',
    checkpointId: (body.checkpoint_id as string) ?? '',
    reason: (body.reason as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionStartSessionEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRevisionStartSession({
    chapterId: (body.chapter_id as string) ?? '',
    content: (body.content as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionAnalyzeEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRevisionAnalyzeWeakPoints({
    sessionId: (body.session_id as string) ?? '',
    content: body.content as string | null | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionSuggestEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const weakPointIds = Array.isArray(body.weak_point_ids)
    ? body.weak_point_ids.filter((item): item is string => typeof item === 'string')
    : null;
  const result = await workflowRevisionGenerateSuggestions({
    sessionId: (body.session_id as string) ?? '',
    weakPointIds,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionMarkRevisedEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRevisionMarkRevised({
    sessionId: (body.session_id as string) ?? '',
    revisedText: (body.revised_text as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionCompareEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRevisionCompare({
    sessionId: (body.session_id as string) ?? '',
    revisedText: body.revised_text as string | null | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowRevisionHistoryEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowRevisionHistory({
    chapterId: (body.chapter_id as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

// ---------------------------------------------------------------
// Scheduler endpoints
// ---------------------------------------------------------------

export async function workflowSchedulerRegisterEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerRegister({
    definition: body.task,
    enabled: body.enabled as boolean | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowSchedulerListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerList({
    limit: body.limit as number | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowSchedulerPauseEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerPause({
    taskId: (body.task_id as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowSchedulerResumeEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerResume({
    taskId: (body.task_id as string) ?? '',
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowSchedulerRunNowEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerRunNow({
    taskId: (body.task_id as string) ?? '',
    confirmToken: body.confirm_token as string | undefined,
    recommendations: body.recommendations as WorkflowRecommendationInput | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

export async function workflowSchedulerImportLitePlanEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await workflowSchedulerImportLitePlan({
    sessionId: (body.session_id as string | null | undefined) ?? null,
    forceLevel: (body.force_level as string | null | undefined) ?? null,
    enabled: body.enabled as boolean | null | undefined,
    workspace,
  });
  return jsonResponse({ ...result, workspace });
}

// ---------------------------------------------------------------
// UI Bridge wrappers
// ---------------------------------------------------------------

let uiBridgeEnabled = false;

export function setUiBridgeEnabled(enabled: boolean): void {
  uiBridgeEnabled = enabled;
}

function uiBridgeDisabledResponse(): HttpResponse {
  return jsonResponse({ error: 'UI Bridge is disabled', status: 'disabled' }, 403);
}

export async function uiBridgeWorkflowRouteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowRouteEndpoint(request);
}

export async function uiBridgeWorkflowPlanEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowPlanEndpoint(request);
}

export async function uiBridgeWorkflowExecuteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowExecuteEndpoint(request);
}

export async function uiBridgeWorkflowLifecycleEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowLifecycleEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerRegisterEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerRegisterEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerListEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerPauseEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerPauseEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerResumeEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerResumeEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerRunNowEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerRunNowEndpoint(request);
}

export async function uiBridgeWorkflowSchedulerImportLitePlanEndpoint(request: HttpRequest): Promise<HttpResponse> {
  if (!uiBridgeEnabled) return uiBridgeDisabledResponse();
  return workflowSchedulerImportLitePlanEndpoint(request);
}

// ---------------------------------------------------------------
// Checkpoint endpoints
// ---------------------------------------------------------------

export async function checkpointCreateEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await checkpointCreate(
    (body.description as string) ?? '',
    (body.auto_commit as boolean) ?? true,
    workspace,
  );
  return jsonResponse(result);
}

export async function checkpointRestoreEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await checkpointRestore(
    (body.checkpoint_id as string) ?? '',
    body.confirm_token as string | undefined,
    workspace,
  );
  return jsonResponse(result);
}

export async function checkpointListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const workspace = resolveWorkspace(body);
  if ('statusCode' in workspace) return workspace;
  const result = await checkpointList((body.limit as number) ?? 10, workspace);
  return jsonResponse(result);
}

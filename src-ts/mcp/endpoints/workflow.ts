/**
 * Workflow REST Endpoints
 *
 * Workflow-related HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/workflow.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import {
  workflowRoute,
  workflowPlan,
  workflowExecute,
  workflowQuickRollback,
  workflowLifecycle,
  checkpointCreate,
  checkpointRestore,
  checkpointList,
} from '../services/workflow';

// ---------------------------------------------------------------
// Workflow endpoints
// ---------------------------------------------------------------

export async function workflowRouteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await workflowRoute((body.task as string) ?? '');
  return jsonResponse(result);
}

export async function workflowPlanEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await workflowPlan({
    task: (body.task as string) ?? '',
    level: body.level as string | undefined,
    recommendations: body.recommendations as unknown[] | undefined,
    genre: body.genre as string | undefined,
  });
  return jsonResponse(result);
}

export async function workflowExecuteEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await workflowExecute({
    planId: (body.plan_id as string) ?? '',
    stepId: body.step_id as string | undefined,
    recommendations: body.recommendations as unknown[] | undefined,
    confirmToken: body.confirm_token as string | undefined,
  });
  return jsonResponse(result);
}

export async function workflowLifecycleEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await workflowLifecycle(
    (body.plan_id as string) ?? '',
    (body.action as string) ?? 'status'
  );
  return jsonResponse(result);
}

export async function workflowQuickRollbackEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await workflowQuickRollback({
    planId: (body.plan_id as string) ?? '',
    checkpointId: (body.checkpoint_id as string) ?? '',
    reason: (body.reason as string) ?? '',
  });
  return jsonResponse(result);
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

// ---------------------------------------------------------------
// Checkpoint endpoints
// ---------------------------------------------------------------

export async function checkpointCreateEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await checkpointCreate(
    (body.description as string) ?? '',
    (body.auto_commit as boolean) ?? true
  );
  return jsonResponse(result);
}

export async function checkpointRestoreEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await checkpointRestore(
    (body.checkpoint_id as string) ?? '',
    body.confirm_token as string | undefined
  );
  return jsonResponse(result);
}

export async function checkpointListEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await checkpointList((body.limit as number) ?? 10);
  return jsonResponse(result);
}

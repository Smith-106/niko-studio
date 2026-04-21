import type { ProjectWorkspaceContext } from '@/types/workspace'

import { type ApiResponse, callApi } from '../core'
import { appendWorkspacePayload } from '../workspace'
import type {
  AutomationTaskDefinition,
  RecommendationInput,
  WorkflowExecuteFailureResponse,
  WorkflowExecuteResponse,
  WorkflowLifecycleResponse,
  WorkflowPlanStatusResponse,
  WorkflowSchedulerErrorResponse,
  WorkflowSchedulerImportLitePlanResponse,
  WorkflowSchedulerListResponse,
  WorkflowSchedulerRegisterResponse,
  WorkflowSchedulerRunNowResponse,
  WorkflowSchedulerStatusResponse,
} from './contracts'
import { normalizeRecommendations } from './contracts'
import {
  type WorkflowBackendMode,
  resolveWorkflowEndpoint,
  resolveWorkflowSchedulerEndpoint,
} from './endpoints'

export async function routeWorkflow(
  task: string,
  level?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<unknown>> {
  return callApi(resolveWorkflowEndpoint('/route'), 'POST', appendWorkspacePayload({ task, level }, workspace))
}

export async function uiRouteWorkflow(
  task: string,
  level?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<unknown>> {
  return callApi(resolveWorkflowEndpoint('/route', 'uiBridge'), 'POST', appendWorkspacePayload({ task, level }, workspace))
}

export async function createPlan(
  task: string,
  level?: string,
  recommendations?: RecommendationInput[],
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowPlanStatusResponse | WorkflowExecuteFailureResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowEndpoint('/plan', mode),
    'POST',
    appendWorkspacePayload({
      task,
      level,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function uiCreatePlan(
  task: string,
  level?: string,
  recommendations?: RecommendationInput[],
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowPlanStatusResponse | WorkflowExecuteFailureResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowEndpoint('/plan', 'uiBridge'),
    'POST',
    appendWorkspacePayload({
      task,
      level,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function executePlan(
  planId: string,
  stepId?: string,
  recommendations?: RecommendationInput[],
  mode?: WorkflowBackendMode,
  confirm_token?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowExecuteResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowEndpoint('/execute', mode),
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      step_id: stepId,
      confirm_token: confirm_token && confirm_token.trim().length > 0 ? confirm_token : undefined,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function uiExecutePlan(
  planId: string,
  stepId?: string,
  recommendations?: RecommendationInput[],
  confirm_token?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowExecuteResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowEndpoint('/execute', 'uiBridge'),
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      step_id: stepId,
      confirm_token: confirm_token && confirm_token.trim().length > 0 ? confirm_token : undefined,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function workflowLifecycle(
  planId: string,
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status',
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/lifecycle', mode),
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      action,
    }, workspace),
  )
}

export async function uiWorkflowLifecycle(
  planId: string,
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status',
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/lifecycle', 'uiBridge'),
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      action,
    }, workspace),
  )
}

export async function getPlanStatus(
  planId: string,
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return workflowLifecycle(planId, 'status')
}

export async function workflowSchedulerRegister(
  task: AutomationTaskDefinition,
  enabled?: boolean,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerRegisterResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/register', mode),
    'POST',
    appendWorkspacePayload({ task, enabled }, workspace),
  )
}

export async function uiWorkflowSchedulerRegister(
  task: AutomationTaskDefinition,
  enabled?: boolean,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerRegisterResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/register', 'uiBridge'),
    'POST',
    appendWorkspacePayload({ task, enabled }, workspace),
  )
}

export async function workflowSchedulerList(
  limit?: number,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerListResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/list', mode),
    'POST',
    appendWorkspacePayload({ limit }, workspace),
  )
}

export async function uiWorkflowSchedulerList(
  limit?: number,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerListResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/list', 'uiBridge'),
    'POST',
    appendWorkspacePayload({ limit }, workspace),
  )
}

export async function workflowSchedulerPause(
  taskId: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerStatusResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/pause', mode),
    'POST',
    appendWorkspacePayload({ task_id: taskId }, workspace),
  )
}

export async function uiWorkflowSchedulerPause(
  taskId: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerStatusResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/pause', 'uiBridge'),
    'POST',
    appendWorkspacePayload({ task_id: taskId }, workspace),
  )
}

export async function workflowSchedulerResume(
  taskId: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerStatusResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/resume', mode),
    'POST',
    appendWorkspacePayload({ task_id: taskId }, workspace),
  )
}

export async function uiWorkflowSchedulerResume(
  taskId: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerStatusResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/resume', 'uiBridge'),
    'POST',
    appendWorkspacePayload({ task_id: taskId }, workspace),
  )
}

export async function workflowSchedulerRunNow(
  taskId: string,
  recommendations?: RecommendationInput[],
  mode?: WorkflowBackendMode,
  confirmToken?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerRunNowResponse | WorkflowSchedulerErrorResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/run-now', mode),
    'POST',
    appendWorkspacePayload({
      task_id: taskId,
      confirm_token: confirmToken && confirmToken.trim().length > 0 ? confirmToken : undefined,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function uiWorkflowSchedulerRunNow(
  taskId: string,
  recommendations?: RecommendationInput[],
  confirmToken?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerRunNowResponse | WorkflowSchedulerErrorResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/run-now', 'uiBridge'),
    'POST',
    appendWorkspacePayload({
      task_id: taskId,
      confirm_token: confirmToken && confirmToken.trim().length > 0 ? confirmToken : undefined,
      recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
    }, workspace),
  )
}

export async function workflowSchedulerImportLitePlan(
  sessionId?: string,
  forceLevel?: string,
  enabled?: boolean,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerImportLitePlanResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/import-lite-plan', mode),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId && sessionId.trim().length > 0 ? sessionId : undefined,
      force_level: forceLevel && forceLevel.trim().length > 0 ? forceLevel : undefined,
      enabled,
    }, workspace),
  )
}

export async function uiWorkflowSchedulerImportLitePlan(
  sessionId?: string,
  forceLevel?: string,
  enabled?: boolean,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowSchedulerImportLitePlanResponse | WorkflowSchedulerErrorResponse>> {
  return callApi(
    resolveWorkflowSchedulerEndpoint('/scheduler/import-lite-plan', 'uiBridge'),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId && sessionId.trim().length > 0 ? sessionId : undefined,
      force_level: forceLevel && forceLevel.trim().length > 0 ? forceLevel : undefined,
      enabled,
    }, workspace),
  )
}

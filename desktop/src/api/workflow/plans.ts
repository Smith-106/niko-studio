import type { ProjectWorkspaceContext } from '@/types/workspace'

import { type ApiResponse, callApi } from '../core'
import { appendWorkspacePayload } from '../workspace'
import type {
  RecommendationInput,
  WorkflowExecuteFailureResponse,
  WorkflowExecuteResponse,
  WorkflowLifecycleResponse,
  WorkflowPlanStatusResponse,
} from './contracts'
import { normalizeRecommendations } from './contracts'
import { resolveWorkflowEndpoint } from './endpoints'

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
  mode?: 'standard' | 'uiBridge',
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
  mode?: 'standard' | 'uiBridge',
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
  mode?: 'standard' | 'uiBridge',
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

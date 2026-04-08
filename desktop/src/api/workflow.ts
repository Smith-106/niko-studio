import { useSettingsStore } from '@/stores/settingsStore'
import type { ProjectWorkspaceContext } from '@/types/workspace'
import { type ApiResponse, callApi } from './core'
import { appendWorkspacePayload } from './workspace'

export interface RecommendationPayload {
  id: string
  title: string
  reason: string
  action: string
}

export type RecommendationInput = string | Partial<RecommendationPayload> | Record<string, unknown>

export interface RecommendationExecutionResult {
  recommendation_id: string
  status: 'applied' | 'undone' | 'failed'
  plan_id?: string
  step_id?: string
  message?: string
  error?: string
}

export interface RecommendationBatchResult {
  total: number
  applied: number
  undone: number
  failed: number
  results: RecommendationExecutionResult[]
}

export type WorkflowExecutionMode = 'Autopilot' | 'Team' | 'Pipeline/Ralph' | 'EcoMode'

export type WorkflowPhase =
  | 'planned'
  | 'executing'
  | 'review'
  | 'test'
  | 'done'
  | 'recovery'
  | 'wave_gate'

export interface WorkflowObservabilityMetrics {
  [key: string]: unknown
}

export interface WorkflowBudgetGuardrail {
  threshold_triggered: boolean
  degraded: boolean
  degrade_mode: string
  reason?: string
  [key: string]: unknown
}

export interface WorkflowHandoffPackage {
  trigger?: 'pause' | 'stop' | string
  next_command?: string
  [key: string]: unknown
}

export interface WorkflowStateResumeMetadata {
  current_phase: WorkflowPhase | string
  state_trace_id: string
  can_resume_from_checkpoint: boolean
  [key: string]: unknown
}

export interface WorkflowModuleOwnershipItem {
  module: string
  owner: string
  previous_owner?: string | null
  [key: string]: unknown
}

export interface WorkflowConcurrencyInfo {
  serialized: boolean
  conflict_modules: string[]
  ownership: WorkflowModuleOwnershipItem[]
  [key: string]: unknown
}

export interface WorkflowGateInfo {
  decision?: string
  confirm_required?: boolean
  confirmed?: boolean
  destructive?: boolean
  risk?: string
  reason?: string
  [key: string]: unknown
}

export interface WorkflowGateChain {
  required: boolean
  passed: boolean
  failed_gate?: string | null
  trace: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface WorkflowExecuteResponseBase extends WorkflowStateResumeMetadata {
  step_id?: string
  step_name?: string
  status: 'completed' | 'waiting_confirmation' | 'gate_blocked'
  plan_status?: string
  runner_state?: string
  remaining_steps?: number
  gate?: WorkflowGateInfo
  execution_mode: WorkflowExecutionMode | string
  observability_metrics: WorkflowObservabilityMetrics
  budget_guardrail: WorkflowBudgetGuardrail
  concurrency?: WorkflowConcurrencyInfo
  gate_chain?: WorkflowGateChain
  wave_completion_checkpoint_id?: string
  rollback_checkpoint_id?: string
  workspace?: ProjectWorkspaceContext
}

export interface WorkflowExecuteCompletedResponse extends WorkflowExecuteResponseBase {
  status: 'completed'
  result?: unknown
  message?: string
}

export interface WorkflowExecuteWaitingConfirmationResponse extends WorkflowExecuteResponseBase {
  status: 'waiting_confirmation'
  gate: WorkflowGateInfo
}

export interface WorkflowExecuteGateBlockedResponse extends WorkflowExecuteResponseBase {
  status: 'gate_blocked'
  blocked: true
  recovery: Record<string, unknown>
  result?: unknown
}

export interface WorkflowExecuteFailureResponse {
  error: string
  step_id?: string
  failure?: {
    phase?: string
    reason?: string
    checkpoint_id?: string | null
    [key: string]: unknown
  }
  rollback?: Record<string, unknown> | null
  recovery?: Record<string, unknown>
  concurrency?: WorkflowConcurrencyInfo
  execution_mode?: WorkflowExecutionMode | string
  observability_metrics?: WorkflowObservabilityMetrics
  budget_guardrail?: WorkflowBudgetGuardrail
  current_phase?: WorkflowPhase | string
  state_trace_id?: string
  can_resume_from_checkpoint?: boolean
  workspace?: ProjectWorkspaceContext
  [key: string]: unknown
}

export type WorkflowExecuteResponse =
  | WorkflowExecuteCompletedResponse
  | WorkflowExecuteWaitingConfirmationResponse
  | WorkflowExecuteGateBlockedResponse
  | WorkflowExecuteFailureResponse

export interface WorkflowLifecycleResponse {
  plan_id: string
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status' | string
  runner_state: string
  plan_status: string
  session_status?: string
  checkpoint_id?: string | null
  lane?: string
  quality_metrics?: Record<string, unknown>
  state_mapping?: Record<string, string>
  execution_mode: WorkflowExecutionMode | string
  observability_metrics: WorkflowObservabilityMetrics
  budget_guardrail: WorkflowBudgetGuardrail
  handoff_package: WorkflowHandoffPackage
  workspace?: ProjectWorkspaceContext
}

export interface WorkflowPlanStepStatusItem {
  id: string
  name: string
  status: string
  output?: unknown
}

export interface WorkflowPlanStatusResponse {
  plan_id: string
  task: string
  level: string
  status: string
  runner_state: string
  session_status?: string
  state_mapping?: Record<string, string>
  template_meta?: Record<string, unknown>
  gate_decision?: string
  recommendations?: Array<Record<string, unknown>>
  recommendations_frozen?: boolean
  plan_hash?: string
  steps: WorkflowPlanStepStatusItem[]
  progress: string
  execution_mode: WorkflowExecutionMode | string
  observability_metrics: WorkflowObservabilityMetrics
  budget_guardrail: WorkflowBudgetGuardrail
  handoff_package: WorkflowHandoffPackage
  workspace?: ProjectWorkspaceContext
}

function toRecommendationPayload(input: RecommendationInput, index: number, action = 'apply'): RecommendationPayload {
  if (typeof input === 'string') {
    const title = input.trim()
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title,
      reason: title,
      action,
    }
  }

  const record = input as Record<string, unknown>
  const title = String(record.title ?? record.name ?? record.recommendation ?? '').trim()
  const safeTitle = title || `recommendation-${index + 1}`
  const reasonRaw = record.reason
  const reason = typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : safeTitle
  const idRaw = record.id
  const normalizedActionRaw = record.action
  const normalizedAction = typeof normalizedActionRaw === 'string' && normalizedActionRaw.trim()
    ? normalizedActionRaw.trim()
    : action

  return {
    id: typeof idRaw === 'string' && idRaw.trim() ? idRaw.trim() : `rec-${String(index + 1).padStart(2, '0')}`,
    title: safeTitle,
    reason,
    action: normalizedAction,
  }
}

function normalizeRecommendations(recommendations?: RecommendationInput[], action = 'apply'): RecommendationPayload[] {
  if (!recommendations || recommendations.length === 0) {
    return []
  }

  return recommendations
    .map((item, index) => toRecommendationPayload(item, index, action))
    .filter((item) => item.title.length > 0)
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

function readPlanId(payload: unknown): string | undefined {
  const record = readRecord(payload)
  const planId = record.plan_id
  return typeof planId === 'string' && planId.trim() ? planId : undefined
}

function readStepId(payload: unknown): string | undefined {
  const record = readRecord(payload)
  const stepId = record.step_id
  return typeof stepId === 'string' && stepId.trim() ? stepId : undefined
}

function readError(payload: unknown): string | undefined {
  const record = readRecord(payload)
  const error = record.error
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  const status = record.status
  if (status === 'failed') {
    return 'workflow execute failed'
  }
  return undefined
}

export function mergeRecommendationBatchResults(results: RecommendationExecutionResult[]): RecommendationBatchResult {
  return {
    total: results.length,
    applied: results.filter((item) => item.status === 'applied').length,
    undone: results.filter((item) => item.status === 'undone').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  }
}

function resolveWorkflowEndpoint(path: '/route' | '/plan' | '/execute' | '/lifecycle', mode?: 'standard' | 'uiBridge'): string {
  const backendMode = mode ?? useSettingsStore.getState().settings.workflowBackendMode
  const prefix = backendMode === 'uiBridge' ? '/ui/workflow' : '/workflow'
  return `${prefix}${path}`
}

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
  planId: string
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return workflowLifecycle(planId, 'status')
}

export async function applyRecommendation(
  task: string,
  recommendation: RecommendationInput,
  level?: string
): Promise<ApiResponse<RecommendationExecutionResult>> {
  const normalized = normalizeRecommendations([recommendation], 'apply')
  if (normalized.length === 0) {
    return {
      success: false,
      error: 'invalid recommendation payload',
    }
  }

  const mode = useSettingsStore.getState().settings.workflowBackendMode
  const planResponse = await createPlan(task, level, normalized, mode)
  if (!planResponse.success) {
    return {
      success: false,
      error: planResponse.error || 'create plan failed',
    }
  }

  const planId = readPlanId(planResponse.data)
  if (!planId) {
    return {
      success: false,
      error: 'missing plan_id from workflow plan response',
    }
  }

  const executeResponse = await executePlan(planId, undefined, normalized, mode)
  if (!executeResponse.success) {
    return {
      success: false,
      error: executeResponse.error || 'execute plan failed',
    }
  }

  const executeError = readError(executeResponse.data)
  if (executeError) {
    return {
      success: true,
      data: {
        recommendation_id: normalized[0].id,
        status: 'failed',
        plan_id: planId,
        step_id: readStepId(executeResponse.data),
        error: executeError,
      },
    }
  }

  return {
    success: true,
    data: {
      recommendation_id: normalized[0].id,
      status: 'applied',
      plan_id: planId,
      step_id: readStepId(executeResponse.data),
      message: 'recommendation applied',
    },
  }
}

export async function undoRecommendation(
  task: string,
  recommendation: RecommendationInput,
  level?: string
): Promise<ApiResponse<RecommendationExecutionResult>> {
  const normalized = normalizeRecommendations([recommendation], 'undo')
  if (normalized.length === 0) {
    return {
      success: false,
      error: 'invalid recommendation payload',
    }
  }

  const mode = useSettingsStore.getState().settings.workflowBackendMode
  const planResponse = await createPlan(task, level, normalized, mode)
  if (!planResponse.success) {
    return {
      success: false,
      error: planResponse.error || 'create plan failed',
    }
  }

  const planId = readPlanId(planResponse.data)
  if (!planId) {
    return {
      success: false,
      error: 'missing plan_id from workflow plan response',
    }
  }

  const executeResponse = await executePlan(planId, undefined, normalized, mode)
  if (!executeResponse.success) {
    return {
      success: false,
      error: executeResponse.error || 'execute plan failed',
    }
  }

  const executeError = readError(executeResponse.data)
  if (executeError) {
    return {
      success: true,
      data: {
        recommendation_id: normalized[0].id,
        status: 'failed',
        plan_id: planId,
        step_id: readStepId(executeResponse.data),
        error: executeError,
      },
    }
  }

  return {
    success: true,
    data: {
      recommendation_id: normalized[0].id,
      status: 'undone',
      plan_id: planId,
      step_id: readStepId(executeResponse.data),
      message: 'recommendation undone',
    },
  }
}

export async function batchApplyRecommendations(
  task: string,
  recommendations: RecommendationInput[],
  level?: string
): Promise<ApiResponse<RecommendationBatchResult>> {
  if (recommendations.length === 0) {
    return {
      success: true,
      data: mergeRecommendationBatchResults([]),
    }
  }

  const normalized = normalizeRecommendations(recommendations, 'apply')
  const results: RecommendationExecutionResult[] = []

  for (const recommendation of normalized) {
    const response = await applyRecommendation(task, recommendation, level)
    if (response.success && response.data) {
      results.push(response.data)
      continue
    }

    results.push({
      recommendation_id: recommendation.id,
      status: 'failed',
      error: response.error || 'apply recommendation failed',
    })
  }

  return {
    success: true,
    data: mergeRecommendationBatchResults(results),
  }
}

export interface WorkflowQuickRollbackResult {
  status?: string
  plan_id?: string
  checkpoint_id?: string
  message?: string
  [key: string]: unknown
}

export async function quickRollbackWorkflow(
  planId: string,
  checkpointId: string,
  reason?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowQuickRollbackResult>> {
  return callApi(
    '/workflow/quick-rollback',
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      checkpoint_id: checkpointId,
      reason,
    }, workspace),
  )
}

export async function createCheckpoint(
  description?: string,
  autoCommit?: boolean
): Promise<ApiResponse<{ checkpoint_id: string; commit_hash?: string }>> {
  return callApi('/workflow/checkpoint/create', 'POST', {
    description,
    auto_commit: autoCommit,
  })
}

export async function restoreCheckpoint(
  checkpointId: string
): Promise<ApiResponse<{ status: string }>> {
  return callApi('/workflow/checkpoint/restore', 'POST', { checkpoint_id: checkpointId })
}

export async function listCheckpoints(
  limit?: number
): Promise<ApiResponse<Array<{ id: string; description: string; created_at: string }>>> {
  return callApi('/workflow/checkpoint/list', 'POST', { limit })
}

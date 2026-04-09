import type { ProjectWorkspaceContext } from '@/types/workspace'

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
  output?: Record<string, unknown>
}

export interface WorkflowPlanStatusResponse {
  plan_id: string
  level: string
  steps: WorkflowPlanStepStatusItem[]
  total_steps?: number
  current_phase?: WorkflowPhase | string
  state_trace_id?: string
  can_resume_from_checkpoint?: boolean
  session_id?: string
  runner_state?: string
  plan_status?: string
  concurrency?: WorkflowConcurrencyInfo
  gate_chain?: WorkflowGateChain
  wave_completion_checkpoint_id?: string
  rollback_checkpoint_id?: string
  execution_mode?: WorkflowExecutionMode | string
  observability_metrics?: WorkflowObservabilityMetrics
  budget_guardrail?: WorkflowBudgetGuardrail
  workspace?: ProjectWorkspaceContext
  [key: string]: unknown
}

export interface WorkflowQuickRollbackResult {
  status?: string
  plan_id?: string
  checkpoint_id?: string
  message?: string
  [key: string]: unknown
}

function toRecommendationPayload(
  input: RecommendationInput,
  index: number,
  action = 'apply',
): RecommendationPayload {
  const fallbackId = `rec-${String(index + 1).padStart(2, '0')}`
  if (typeof input === 'string') {
    return {
      id: fallbackId,
      title: input,
      reason: input,
      action,
    }
  }

  const record = input as Record<string, unknown>
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : fallbackId,
    title: typeof record.title === 'string' && record.title.trim()
      ? record.title
      : typeof record.action === 'string' && record.action.trim()
        ? record.action
        : `Recommendation ${index + 1}`,
    reason: typeof record.reason === 'string' && record.reason.trim()
      ? record.reason
      : typeof record.feedback === 'string' && record.feedback.trim()
        ? record.feedback
        : typeof record.description === 'string' && record.description.trim()
          ? record.description
          : '',
    action: typeof record.action === 'string' && record.action.trim() ? record.action : action,
  }
}

export function normalizeRecommendations(
  recommendations?: RecommendationInput[],
  action = 'apply',
): RecommendationPayload[] {
  if (!Array.isArray(recommendations)) return []
  return recommendations
    .map((item, index) => toRecommendationPayload(item, index, action))
    .filter((item) => item.title.trim().length > 0)
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function readPlanId(payload: unknown): string | undefined {
  const record = readRecord(payload)
  const planId = record.plan_id
  return typeof planId === 'string' && planId.trim() ? planId : undefined
}

export function readStepId(payload: unknown): string | undefined {
  const record = readRecord(payload)
  const stepId = record.step_id
  return typeof stepId === 'string' && stepId.trim() ? stepId : undefined
}

export function readError(payload: unknown): string | undefined {
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

export function mergeRecommendationBatchResults(
  results: RecommendationExecutionResult[],
): RecommendationBatchResult {
  return {
    total: results.length,
    applied: results.filter((item) => item.status === 'applied').length,
    undone: results.filter((item) => item.status === 'undone').length,
    failed: results.filter((item) => item.status === 'failed').length,
    results,
  }
}

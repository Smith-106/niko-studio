/**
 * Niko-Studio API Client
 * Communicates with Gateway backend via Tauri invoke
 */

import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/stores/settingsStore'

const DEFAULT_API_BASE = 'http://127.0.0.1:8000'

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const resolveApiBase = (): string => {
  const storeBase = useSettingsStore.getState().settings.apiBaseUrl
  if (storeBase && storeBase.trim()) {
    return normalizeBaseUrl(storeBase.trim())
  }
  const envBase = import.meta.env.VITE_NIKO_GATEWAY_URL as string | undefined
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase.trim())
  }
  return DEFAULT_API_BASE
}

// Gateway 配置：
// - 默认本地 127.0.0.1:8000
// - 远程模式：settings apiBaseUrl 或 VITE_NIKO_GATEWAY_URL
const API_BASE = resolveApiBase()

export const getApiBase = (): string => API_BASE

export const getResolvedApiBase = (): string => resolveApiBase()

// 是否在 Tauri 环境中运行
const isTauri = '__TAURI__' in window

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface GatewayMetrics {
  requests_total: number
  requests_failed_total: number
  requests_success_total: number
  latency_ms_avg: number
  latency_ms_max: number
}

export type WritingHelperMode = 'polish' | 'summarize' | 'outline'

export interface WritingHelperRequest {
  content: string
  mode?: WritingHelperMode
  max_sentences?: number
  max_items?: number
  instruction?: string
  detection_evasion_guard_enabled?: boolean
}

export interface WritingHelperResponse {
  mode: WritingHelperMode
  processed_text?: string
  outline?: string[]
  stats?: Record<string, number>
}

export type GatewayTools = Record<string, string[]>

export type GatewayConnectionState = 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
export type GatewayReconnectState = 'idle' | 'probing' | 'backoff' | 'retrying' | 'recovered' | 'failed'

export interface GatewayRuntimeServerState {
  state: GatewayConnectionState
  loading: boolean
  last_error?: string | null
}

export interface GatewayRuntime {
  session_id?: string
  connection_state?: GatewayConnectionState
  reconnect_state?: GatewayReconnectState
  last_probe_at?: string
  reconnect_attempts?: number
  last_error?: string | null
  servers?: Record<string, GatewayRuntimeServerState>
  service_configs?: GatewayServiceConfig[]
}

export interface GatewayRuntimeView {
  connectionState: GatewayConnectionState
  reconnectState: GatewayReconnectState
  sessionId: string | null
  reconnectAttempts: number
  lastError: string | null
  lastProbeAt: string | null
  servers: Record<string, GatewayRuntimeServerState>
}

export interface GatewayServiceConfig {
  id: string
  name: string
  path: string
  enabled: boolean
  builtin: boolean
  transport: string
  health_url?: string | null
  status?: string
}

export interface GatewayServiceConfigInput {
  id?: string
  service_id?: string
  name?: string
  path?: string
  enabled?: boolean
  transport?: string
  health_url?: string | null
}

export interface GatewayServiceProbeResult {
  service: {
    id: string
    status: string
    enabled: boolean
    checked_at: string
  }
}

export interface GatewayHealth {
  status: string
  version: string
  services: Record<string, string>
  engine_health?: Record<string, { status: string; error?: string }>
  agents?: string[]
  skills_count?: number
  mcp_runtime?: GatewayRuntime
}

function fallbackConnectionState(backendHealthy: boolean, services?: Record<string, string>): GatewayConnectionState {
  if (!backendHealthy) {
    return 'disconnected'
  }

  const serviceValues = Object.values(services || {})
  if (serviceValues.length === 0) {
    return 'connected'
  }
  return serviceValues.every((value) => value === 'ok') ? 'connected' : 'degraded'
}

export function deriveGatewayRuntimeState(
  health: GatewayHealth | null | undefined,
  backendHealthy: boolean
): GatewayRuntimeView {
  const fallbackState = fallbackConnectionState(backendHealthy, health?.services)
  const runtime = health?.mcp_runtime

  return {
    connectionState: runtime?.connection_state ?? fallbackState,
    reconnectState: runtime?.reconnect_state ?? (fallbackState === 'connected' ? 'idle' : 'failed'),
    sessionId: runtime?.session_id ?? null,
    reconnectAttempts: runtime?.reconnect_attempts ?? 0,
    lastError: runtime?.last_error ?? null,
    lastProbeAt: runtime?.last_probe_at ?? null,
    servers: runtime?.servers ?? {},
  }
}

export interface ModelFetchResult {
  models: string[]
  source: 'gateway' | 'direct'
}

/**
 * 统一 API 调用方法
 * 在 Tauri 环境中使用 invoke，否则直接 fetch
 */
async function callApi<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    let data: T

    if (isTauri) {
      // 通过 Tauri Rust 后端代理请求
      const response = await invoke<string>('call_api', {
        endpoint,
        method,
        body: body ? JSON.stringify(body) : null,
      })
      data = JSON.parse(response)
    } else {
      // 直接 fetch (开发模式)
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      }
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
      }
      const response = await fetch(`${getResolvedApiBase()}${endpoint}`, options)
      data = await response.json()
    }

    return { success: true, data }
  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error)
    return { success: false, error: String(error) }
  }
}

function deduplicateModels(models: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const model of models) {
    const normalized = model.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function normalizeModelName(model: string): string {
  if (model.startsWith('models/')) {
    return model.slice('models/'.length)
  }
  return model
}

function extractModelsFromPayload(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    const parsed = payload
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''
        const record = item as Record<string, unknown>
        if (typeof record.id === 'string') return record.id
        if (typeof record.name === 'string') return normalizeModelName(record.name)
        if (typeof record.model === 'string') return record.model
        return ''
      })
      .filter(Boolean)

    return deduplicateModels(parsed)
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const candidateKeys = ['models', 'data', 'items', 'result']

    for (const key of candidateKeys) {
      if (record[key] !== undefined) {
        const models = extractModelsFromPayload(record[key])
        if (models.length > 0) {
          return models
        }
      }
    }
  }

  return []
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  return response.json()
}

export async function fetchProviderModels(
  providerId: string,
  baseUrl: string,
  apiKey: string
): Promise<ApiResponse<ModelFetchResult>> {
  let gatewayError: string | null = null

  try {
    const gatewayRes = await callApi<unknown>(`/models?provider=${encodeURIComponent(providerId)}`, 'GET')
    if (gatewayRes.success && gatewayRes.data) {
      const gatewayModels = extractModelsFromPayload(gatewayRes.data)
      if (gatewayModels.length > 0) {
        return { success: true, data: { models: gatewayModels, source: 'gateway' } }
      }
      gatewayError = 'gateway returned empty models'
    } else {
      gatewayError = gatewayRes.error ?? 'gateway unavailable'
    }
  } catch (error) {
    gatewayError = String(error)
  }

  const normalizedBase = normalizeBaseUrl(baseUrl.trim())
  let payload: unknown

  try {
    switch (providerId) {
      case 'local': {
        payload = await requestJson(`${normalizedBase}/api/tags`)
        break
      }
      case 'google': {
        if (!apiKey.trim()) {
          return { success: false, error: 'Google provider requires API key' }
        }
        payload = await requestJson(`${normalizedBase}/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`)
        break
      }
      case 'anthropic': {
        if (!apiKey.trim()) {
          return { success: false, error: 'Anthropic provider requires API key' }
        }
        payload = await requestJson(`${normalizedBase}/v1/models`, {
          headers: {
            'x-api-key': apiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
        })
        break
      }
      case 'openai':
      case 'openrouter':
      default: {
        if (!apiKey.trim()) {
          return { success: false, error: `${providerId} provider requires API key` }
        }
        payload = await requestJson(`${normalizedBase}/models`, {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
        })
        break
      }
    }

    const models = extractModelsFromPayload(payload)
    if (models.length === 0) {
      return {
        success: false,
        error: `No models found (gateway=${gatewayError ?? 'n/a'}, direct=empty)`
      }
    }

    return { success: true, data: { models, source: 'direct' } }
  } catch (error) {
    console.error('Fetch provider models failed:', error)
    return {
      success: false,
      error: `Fetch failed (gateway=${gatewayError ?? 'n/a'}, direct=${String(error)})`
    }
  }
}

// ============ Backend Control (Tauri Only) ============

export async function startBackend(): Promise<ApiResponse<string>> {
  if (!isTauri) {
    return { success: false, error: 'Not in Tauri environment' }
  }
  try {
    const result = await invoke<string>('start_backend')
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  if (isTauri) {
    try {
      return await invoke<boolean>('check_backend_health')
    } catch {
      return false
    }
  }
  // 非 Tauri 环境直接检查
  try {
    const response = await fetch(`${getResolvedApiBase()}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function getGatewayHealth(): Promise<ApiResponse<GatewayHealth>> {
  return callApi('/health', 'GET')
}

export async function getGatewayMetrics(): Promise<ApiResponse<{ status: string; metrics: GatewayMetrics }>> {
  return callApi('/metrics', 'GET')
}

export async function listGatewayTools(): Promise<ApiResponse<GatewayTools>> {
  return callApi('/tools', 'GET')
}

export async function processWritingHelper(
  payload: WritingHelperRequest
): Promise<ApiResponse<WritingHelperResponse>> {
  return callApi('/writing-helper/process', 'POST', payload as Record<string, unknown>)
}

export async function listGatewayServiceConfigs(): Promise<ApiResponse<{ services: GatewayServiceConfig[] }>> {
  return callApi('/mcp/services', 'GET')
}

export async function createGatewayServiceConfig(
  payload: GatewayServiceConfigInput
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi('/mcp/services', 'POST', payload as Record<string, unknown>)
}

export async function updateGatewayServiceConfig(
  serviceId: string,
  payload: GatewayServiceConfigInput
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}`, 'PUT', payload as Record<string, unknown>)
}

export async function setGatewayServiceEnabled(
  serviceId: string,
  enabled: boolean
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}/enabled`, 'POST', { enabled })
}

export async function probeGatewayServiceHealth(
  serviceId: string
): Promise<ApiResponse<GatewayServiceProbeResult>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}/health`, 'POST')
}

// ============ Chat API (Main Interface) ============

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type WorkflowLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export interface ChatModelComparisonRequest {
  enabled: boolean
  controlModel: string
  primaryModel?: string
}

export interface QualityGoalsPayload {
  naturalness?: number
  readability?: number
  coherence?: number
  style_consistency?: number
  humanization_preset?: 'human_writing' | 'ai_edit_guidance' | 'custom'
  custom_humanization_instruction?: string
  sentence_entropy_target?: number
  rhythm_variability_target?: number
}

export interface ChatRequest {
  messages: ChatMessage[]
  workflowLevel: WorkflowLevel
  skills: string[]
  allowLlmFallback: boolean
  qualityGoals?: QualityGoalsPayload
  context?: {
    projectId?: string
    chapterId?: string
  }
  comparison?: ChatModelComparisonRequest
}

export interface ChatModelComparisonResultItem {
  model: string
  content: string
}

export interface ChatModelComparisonResult {
  enabled: boolean
  primary: ChatModelComparisonResultItem
  control: ChatModelComparisonResultItem
}

export interface WriterMetadata {
  warnings?: string[]
  knowledge_retrieved?: {
    entities_count: number
    relations_count: number
    memories_count: number
  }
  [key: string]: unknown
}

export interface ChatResponse {
  content: string
  skills_used: string[]
  comparison?: ChatModelComparisonResult
  writer_metadata?: WriterMetadata
  workflow_info?: {
    level: string
    level_slug?: string
    steps_completed: number
    total_steps: number
  }
  evaluation?: {
    score: number
    feedback: string
  }
}

export async function chat(request: ChatRequest): Promise<ApiResponse<ChatResponse>> {
  return callApi<ChatResponse>('/chat', 'POST', request as unknown as Record<string, unknown>)
}

// ============ Workflow API ============

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

export async function routeWorkflow(task: string, level?: string): Promise<ApiResponse<unknown>> {
  return callApi('/workflow/route', 'POST', { task, level })
}

export async function createPlan(
  task: string,
  level?: string,
  recommendations?: RecommendationInput[]
): Promise<ApiResponse<WorkflowPlanStatusResponse | WorkflowExecuteFailureResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi('/workflow/plan', 'POST', {
    task,
    level,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function executePlan(
  planId: string,
  stepId?: string,
  recommendations?: RecommendationInput[]
): Promise<ApiResponse<WorkflowExecuteResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi('/workflow/execute', 'POST', {
    plan_id: planId,
    step_id: stepId,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function workflowLifecycle(
  planId: string,
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status'
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return callApi('/workflow/lifecycle', 'POST', {
    plan_id: planId,
    action,
  })
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

  const planResponse = await createPlan(task, level, normalized)
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

  const executeResponse = await executePlan(planId, undefined, normalized)
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

  const planResponse = await createPlan(task, level, normalized)
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

  const executeResponse = await executePlan(planId, undefined, normalized)
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

// ============ Agent API ============

export interface AgentRouteResult {
  workflow_level: string
  workflow_level_slug?: string
  scene_type: string
  dispatched_skills: string[]
  task_assignments: Array<{
    task_id: string
    agent_type: string
    instruction: string
    skills: string[]
  }>
}

export async function agentRoute(task: string): Promise<ApiResponse<AgentRouteResult>> {
  return callApi('/agent/route', 'POST', { task })
}

export async function agentWrite(
  sceneCard: Record<string, unknown>,
  skills?: string[],
  wordTarget?: number,
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<{ content: string; wordcount: number }>> {
  return callApi('/agent/write', 'POST', {
    scene_card: sceneCard,
    skills,
    word_target: wordTarget,
    quality_goals: qualityGoals,
  })
}

export async function agentRevise(
  draft: string,
  feedback: Record<string, unknown>,
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<{ content: string }>> {
  return callApi('/agent/revise', 'POST', { draft, feedback, quality_goals: qualityGoals })
}

export async function agentGetContext(
  sceneInfo: Record<string, unknown>,
  contextTypes?: string[]
): Promise<ApiResponse<Record<string, unknown>>> {
  return callApi('/agent/context', 'POST', {
    scene_info: sceneInfo,
    context_types: contextTypes,
  })
}

// ============ Skills API ============

export async function listSkills(category?: string): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
  const endpoint = category ? `/skills/list?category=${category}` : '/skills/list'
  return callApi(endpoint, 'GET')
}

export async function loadSkill(skillId: string): Promise<ApiResponse<{ id: string; content: string }>> {
  return callApi(`/skills/load`, 'POST', { skill_id: skillId })
}

export async function matchSkills(
  taskType?: string,
  keywords?: string[],
  issue?: string
): Promise<ApiResponse<Array<{ skill_id: string; relevance: number }>>> {
  return callApi('/skills/match', 'POST', { task_type: taskType, keywords, issue })
}

export async function getSkillChain(taskType: string): Promise<ApiResponse<Array<{ skill_id: string; step: number }>>> {
  return callApi('/skills/chain', 'POST', { task_type: taskType })
}

// ============ Memory API ============

export async function searchMemory(
  query: string,
  options?: {
    layer?: string
    dimensions?: string[]
    limit?: number
  }
): Promise<ApiResponse<Array<{ id: string; content: string; score: number }>>> {
  return callApi('/memory/search', 'POST', { query, ...options })
}

export async function addMemory(
  content: string,
  options?: {
    layer?: string
    dimension?: string
    entity_id?: string
    importance?: number
    tags?: string[]
  }
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi('/memory/add', 'POST', { content, ...options })
}

export interface MemoryUploadResponse {
  status: string
  file_name: string
  session_id: string
  chunks: number
  memory_ids: string[]
}

export async function uploadMemoryFile(
  payload: {
    file_name: string
    file_content_base64: string
    session_id: string
    chunk_size?: number
    chunk_overlap?: number
  }
): Promise<ApiResponse<MemoryUploadResponse>> {
  return callApi('/memory/upload', 'POST', payload)
}

export async function getTemporalFacts(
  entityId: string,
  atTime?: string
): Promise<ApiResponse<Array<{ id: string; content: string }>>> {
  return callApi('/memory/temporal', 'POST', { entity_id: entityId, at_time: atTime })
}

// ============ Graph API ============

export async function queryGraph(cypher: string): Promise<ApiResponse<unknown[]>> {
  return callApi('/graph/query', 'POST', { cypher })
}

export async function getCharacter(
  name: string,
  includeRelations?: boolean
): Promise<ApiResponse<{ name: string; role: string; relationships: Record<string, string> }>> {
  return callApi('/graph/character', 'POST', { name, include_relations: includeRelations })
}

export async function getForeshadows(
  status?: string,
  chapter?: number
): Promise<ApiResponse<Array<{ id: string; description: string; status: string }>>> {
  return callApi('/graph/foreshadows', 'POST', { status, chapter })
}

// ============ Critic API ============

export interface EvaluationResult {
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
  total_score: number
  lock_score: number
  style_score: number
  logic_score: number
  actionable_feedback: string
  suggestions: RecommendationInput[]
}

export async function evaluateContent(
  content: string,
  sceneCard?: Record<string, unknown>,
  dimensions?: string[],
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<EvaluationResult>> {
  return callApi('/critic/evaluate', 'POST', {
    content,
    scene_card: sceneCard,
    dimensions,
    quality_goals: qualityGoals,
  })
}

export async function getImprovementSuggestions(
  content: string,
  issues?: string[],
  maxSuggestions?: number
): Promise<ApiResponse<Array<{ issue: string; suggestion: string; priority: string }>>> {
  return callApi('/critic/suggestions', 'POST', {
    content,
    issues,
    max_suggestions: maxSuggestions,
  })
}

// ============ Checkpoint API ============

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

// ============ SSE Streaming Chat ============

export interface StreamEvent {
  type: 'start' | 'routing' | 'progress' | 'content' | 'evaluation' | 'done' | 'error'
  data: Record<string, unknown>
}

export type StreamTerminal = 'done' | 'error' | 'interrupted' | 'recovered'

interface StreamDiagnostics {
  fallback_reason?: string | null
  failure_reason?: string | null
  error_type?: string | null
}

interface StreamTerminalPayload {
  status?: string
  terminal?: StreamTerminal
  diagnostics?: StreamDiagnostics
}

export interface StreamDonePayload extends StreamTerminalPayload {
  skills_used?: string[]
  decision?: 'go' | 'soft_go' | 'no_go'
}

function normalizeTerminalValue(raw: unknown): StreamTerminal | undefined {
  if (raw === 'done' || raw === 'error' || raw === 'interrupted' || raw === 'recovered') {
    return raw
  }
  if (raw === 'aborted') {
    return 'interrupted'
  }
  return undefined
}

function parseLegacyTerminal(data: Record<string, unknown>): StreamTerminal | undefined {
  const legacy = data.legacy_contract_fields
  if (!legacy || typeof legacy !== 'object') {
    return undefined
  }

  const legacyRecord = legacy as Record<string, unknown>
  const keys = ['terminal', 'terminal_state', 'status']
  for (const key of keys) {
    const value = legacyRecord[key]
    const normalized = normalizeTerminalValue(value)
    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function parseLegacyDecision(data: Record<string, unknown>): 'go' | 'soft_go' | 'no_go' | undefined {
  const decision = data.decision
  if (decision === 'go' || decision === 'soft_go' || decision === 'no_go') {
    return decision
  }

  const legacy = data.legacy_contract_fields
  if (!legacy || typeof legacy !== 'object') {
    return undefined
  }

  const legacyDecision = (legacy as Record<string, unknown>).decision
  if (legacyDecision === 'go' || legacyDecision === 'soft_go' || legacyDecision === 'no_go') {
    return legacyDecision
  }

  return undefined
}


export interface StreamCallbacks {
  onStart?: () => void
  onRouting?: (data: { level: string; scene_type: string; skills: string[] }) => void
  onProgress?: (data: { step: number; total: number; message: string }) => void
  onContent?: (chunk: string, index: number) => void
  onEvaluation?: (data: { score: number; feedback: string }) => void
  onDone?: (data: StreamDonePayload) => void
  onError?: (error: string, payload?: StreamTerminalPayload) => void
}

export interface StreamOptions {
  signal?: AbortSignal
}

/**
 * SSE 流式聊天 - 优化版本
 *
 * 优化策略:
 * - 使用 ReadableStream + getReader 进行流式读取
 * - requestAnimationFrame 批量 DOM 更新，减少重绘
 * - 高效的 TextDecoder 流式解码
 */
export async function chatStream(
  request: ChatRequest,
  callbacks: StreamCallbacks,
  options?: StreamOptions
): Promise<void> {
  const url = `${getResolvedApiBase()}/chat/stream`

  // 内容缓冲区，用于批量更新
  let contentBuffer: Array<{ chunk: string; index: number }> = []
  let rafScheduled = false

  // 使用 requestAnimationFrame 批量处理内容更新
  const flushContentBuffer = () => {
    if (contentBuffer.length === 0) return

    // 批量触发回调
    for (const { chunk, index } of contentBuffer) {
      callbacks.onContent?.(chunk, index)
    }
    contentBuffer = []
    rafScheduled = false
  }

  const scheduleContentUpdate = (chunk: string, index: number) => {
    contentBuffer.push({ chunk, index })

    if (!rafScheduled) {
      rafScheduled = true
      requestAnimationFrame(flushContentBuffer)
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    // 使用流式 TextDecoder
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // 流结束，刷新剩余内容
        flushContentBuffer()
        break
      }

      // 流式解码，保留部分字符
      buffer += decoder.decode(value, { stream: true })

      // 解析 SSE 事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      let currentData = ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6).trim()
        } else if (line === '' && currentEvent && currentData) {
          // 完整事件，触发回调
          try {
            const data = JSON.parse(currentData)
            handleStreamEventOptimized(currentEvent, data, callbacks, scheduleContentUpdate)
          } catch (e) {
            console.error('Failed to parse SSE data:', e)
          }
          currentEvent = ''
          currentData = ''
        }
      }
    }
  } catch (error) {
    // 确保刷新任何待处理的内容
    flushContentBuffer()
    console.error('Stream error:', error)
    const message = String(error)
    const aborted = options?.signal?.aborted || message.toLowerCase().includes('abort')
    callbacks.onError?.(
      message,
      aborted ? { terminal: 'interrupted', status: 'aborted' } : { terminal: 'error', status: 'failed' }
    )
  }
}

function toStreamTerminalPayload(data: Record<string, unknown>): StreamTerminalPayload {
  const terminal = normalizeTerminalValue(data.terminal)
    ?? parseLegacyTerminal(data)
    ?? (() => {
      if (data.status === 'aborted') return 'interrupted'
      if (data.status === 'restored') return 'recovered'
      return undefined
    })()

  return {
    status: typeof data.status === 'string' ? data.status : undefined,
    terminal,
    diagnostics: typeof data.diagnostics === 'object' && data.diagnostics !== null
      ? (data.diagnostics as StreamDiagnostics)
      : undefined,
  }
}

function handleStreamEventOptimized(
  eventType: string,
  data: Record<string, unknown>,
  callbacks: StreamCallbacks,
  scheduleContentUpdate: (chunk: string, index: number) => void
): void {
  switch (eventType) {
    case 'start':
      callbacks.onStart?.()
      break
    case 'routing':
      callbacks.onRouting?.(data as { level: string; scene_type: string; skills: string[] })
      break
    case 'progress':
      callbacks.onProgress?.(data as { step: number; total: number; message: string })
      break
    case 'content':
      // 使用 requestAnimationFrame 批量更新
      scheduleContentUpdate(data.chunk as string, data.index as number)
      break
    case 'evaluation':
      callbacks.onEvaluation?.(data as { score: number; feedback: string })
      break
    case 'done': {
      const terminalPayload = toStreamTerminalPayload(data)
      callbacks.onDone?.({
        ...terminalPayload,
        terminal: terminalPayload.terminal === 'recovered' ? 'done' : terminalPayload.terminal,
        skills_used: Array.isArray(data.skills_used) ? (data.skills_used as string[]) : [],
        decision: parseLegacyDecision(data),
      })
      break
    }
    case 'error': {
      const terminalPayload = toStreamTerminalPayload(data)
      callbacks.onError?.(
        String(data.error ?? 'Stream error'),
        {
          ...terminalPayload,
          terminal: terminalPayload.terminal === 'recovered' ? 'error' : terminalPayload.terminal,
        }
      )
      break
    }
  }
}

// ============ Health Check ============

export async function checkHealth(): Promise<boolean> {
  return checkBackendHealth()
}

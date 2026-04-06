/**
 * Niko-Studio API Client
 * Communicates with Gateway backend via Tauri invoke
 */

import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '@/stores/settingsStore'

const DEFAULT_API_BASE = 'http://127.0.0.1:8000'
const GENERIC_API_ERROR_MESSAGE = 'Request failed. Please try again.'
const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const getErrorName = (error: unknown): string => (error instanceof Error ? error.name : 'UnknownError')

const resolveApiBase = (): string => {
  const env = import.meta.env as Record<string, string | undefined>
  const envBase = env.NIKO_GATEWAY_URL ?? env.VITE_NIKO_GATEWAY_URL
  if (envBase && envBase.trim()) {
    return normalizeBaseUrl(envBase.trim())
  }

  const storeBase = useSettingsStore.getState().settings.apiBaseUrl
  if (storeBase && storeBase.trim()) {
    return normalizeBaseUrl(storeBase.trim())
  }

  return DEFAULT_API_BASE
}

// Gateway configuration:
// - Default local 127.0.0.1:8000
// - Remote mode: env(NIKO_GATEWAY_URL / VITE_NIKO_GATEWAY_URL) or settings apiBaseUrl

export const getResolvedApiBase = (): string => resolveApiBase()

// 是否在 Tauri 环境中运行
const isTauri = '__TAURI__' in window

let cachedRuntimeGatewayBase: string | null = null
let cachedRuntimeGatewayBaseAt: number | null = null

const getRuntimeGatewayBase = async (): Promise<string> => {
  if (!isTauri) {
    return getResolvedApiBase()
  }

  const now = Date.now()
  if (cachedRuntimeGatewayBase && cachedRuntimeGatewayBaseAt && now - cachedRuntimeGatewayBaseAt < 5000) {
    return cachedRuntimeGatewayBase
  }

  const base = await invoke<string>('get_gateway_base')
  cachedRuntimeGatewayBase = normalizeBaseUrl(base)
  cachedRuntimeGatewayBaseAt = now
  return cachedRuntimeGatewayBase
}

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

export type WritingHelperMode = 'polish' | 'summarize' | 'outline' | 'rewrite' | 'expand'

export type LegacyPolishType = 'standard' | 'academic' | 'business' | 'creative'

export interface LegacyPolishRequest {
  originalText: string
  llmApiUrl?: string
  llmApiKey?: string
  model?: string
  polishType?: LegacyPolishType
  api_key?: string
  base_url?: string
  provider?: string
}

export interface LegacyPolishResponse {
  originalText: string
  polishedText: string
  diffMarkup: string
  error?: string
}

export interface WritingHelperRequest {
  content: string
  mode?: WritingHelperMode
  max_sentences?: number
  max_items?: number
  instruction?: string
  detection_evasion_guard_enabled?: boolean
  api_key?: string
  base_url?: string
  model?: string
  provider?: string
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
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }

      if (!response.ok) {
        const errorMessage =
          payload &&
          typeof payload === 'object' &&
          typeof (payload as { error?: unknown }).error === 'string' &&
          (payload as { error: string }).error.trim().length > 0
            ? (payload as { error: string }).error
            : `HTTP error: ${response.status}`
        return { success: false, error: errorMessage }
      }

      data = payload as T
    }

    return { success: true, data }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    console.error(`API call failed: ${endpoint} (${errorName})`)
    return { success: false, error: GENERIC_API_ERROR_MESSAGE }
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

function buildModelFetchError(gatewayReason: string, directReason: string): string {
  return `gateway=${gatewayReason}; direct=${directReason}`
}

export async function fetchProviderModels(
  providerId: string,
  baseUrl: string,
  apiKey: string
): Promise<ApiResponse<ModelFetchResult>> {
  let gatewayReason = 'request_failed'

  try {
    const gatewayRes = await callApi<unknown>(`/models?provider=${encodeURIComponent(providerId)}`, 'GET')
    if (gatewayRes.success && gatewayRes.data) {
      const gatewayModels = extractModelsFromPayload(gatewayRes.data)
      if (gatewayModels.length > 0) {
        return { success: true, data: { models: gatewayModels, source: 'gateway' } }
      }
      gatewayReason = 'empty_models'
    } else {
      gatewayReason = (gatewayRes.error ?? '').trim() || 'request_failed'
    }
  } catch (error) {
    gatewayReason = getErrorName(error)
    console.error(`Gateway models fallback failed (${gatewayReason})`)
  }

  const normalizedBase = normalizeBaseUrl(baseUrl.trim())
  const trimmedApiKey = apiKey.trim()
  let payload: unknown

  try {
    switch (providerId) {
      case 'local': {
        payload = await requestJson(`${normalizedBase}/api/tags`)
        break
      }
      case 'google': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1beta/models?key=${encodeURIComponent(trimmedApiKey)}`)
        break
      }
      case 'anthropic': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1/models`, {
          headers: {
            'x-api-key': trimmedApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        break
      }
      case 'openai':
      case 'openrouter':
      default: {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        // OpenAI-compatible APIs use /v1/models endpoint
        const openaiBaseUrl = normalizedBase.includes('/v1') ? normalizedBase : `${normalizedBase}/v1`
        payload = await requestJson(`${openaiBaseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${trimmedApiKey}`,
          },
        })
        break
      }
    }

    const models = extractModelsFromPayload(payload)
    if (models.length === 0) {
      return {
        success: false,
        error: buildModelFetchError(gatewayReason, 'empty_models'),
      }
    }

    return { success: true, data: { models, source: 'direct' } }
  } catch (error) {
    const directReason = error instanceof Error ? error.message : GENERIC_API_ERROR_MESSAGE
    console.error(`Fetch provider models failed (${getErrorName(error)})`)
    return {
      success: false,
      error: buildModelFetchError(gatewayReason, directReason),
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
  return callApi('/writing-helper/process', 'POST', payload as unknown as Record<string, unknown>)
}

export interface StreamWritingHelperRequest {
  content: string
  mode?: string
  instruction?: string
  model?: string
  provider?: string
  api_key?: string
  base_url?: string
}

export async function streamWritingHelper(
  payload: StreamWritingHelperRequest,
  callbacks: {
    onContent: (chunk: string, index: number) => void
    onDone: () => void
    onError: (error: string) => void
  },
  options?: { signal?: AbortSignal }
): Promise<void> {
  const base = isTauri ? await getRuntimeGatewayBase() : getResolvedApiBase()
  const url = `${base}/writing/stream`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data = await response.json() as {
      streaming?: boolean
      events?: Array<{ event: string; data: Record<string, unknown> }>
    }

    if (data.events) {
      for (const evt of data.events) {
        if (evt.event === 'content' && evt.data) {
          callbacks.onContent(
            evt.data.chunk as string,
            evt.data.index as number,
          )
        } else if (evt.event === 'done') {
          callbacks.onDone()
        } else if (evt.event === 'error') {
          callbacks.onError(evt.data.error as string)
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      callbacks.onError(err instanceof Error ? err.message : String(err))
    }
  }
}

function mapPolishTypeToInstruction(polishType?: LegacyPolishType): string {
  switch (polishType) {
    case 'academic':
      return '使用更正式、学术的书面表达'
    case 'business':
      return '使用更专业、商务化表达'
    case 'creative':
      return '在不改变原意下更生动有创意'
    default:
      return ''
  }
}

function generateDiffMarkup(original: string, polished: string): string {
  const diffLines: string[] = []
  const originalLines = original.split('\n')
  const polishedLines = polished.split('\n')

  let originalIndex = 0
  let polishedIndex = 0

  while (originalIndex < originalLines.length || polishedIndex < polishedLines.length) {
    const originalLine = originalIndex < originalLines.length ? originalLines[originalIndex] : ''
    const polishedLine = polishedIndex < polishedLines.length ? polishedLines[polishedIndex] : ''

    if (originalLine === polishedLine) {
      diffLines.push(originalLine)
      originalIndex++
      polishedIndex++
      continue
    }

    if (
      polishedIndex + 1 < polishedLines.length &&
      originalLine === polishedLines[polishedIndex + 1]
    ) {
      diffLines.push(`<ins class="diff-add">${polishedLine}</ins>`)
      polishedIndex++
      continue
    }

    if (
      originalIndex + 1 < originalLines.length &&
      polishedLine === originalLines[originalIndex + 1]
    ) {
      diffLines.push(`<del class="diff-del">${originalLine}</del>`)
      originalIndex++
      continue
    }

    diffLines.push(`<del class="diff-del">${originalLine}</del>`)
    diffLines.push(`<ins class="diff-add">${polishedLine}</ins>`)
    originalIndex++
    polishedIndex++
  }

  return diffLines.join('\n')
}

export async function polishContentCompat(request: LegacyPolishRequest): Promise<LegacyPolishResponse> {
  const originalText = typeof request.originalText === 'string' ? request.originalText : ''
  if (!originalText.trim()) {
    return {
      originalText,
      polishedText: '',
      diffMarkup: '',
      error: 'originalText is required',
    }
  }

  const response = await processWritingHelper({
    content: originalText,
    mode: 'polish',
    instruction: mapPolishTypeToInstruction(request.polishType),
    detection_evasion_guard_enabled: true,
    api_key: request.api_key,
    base_url: request.base_url,
    model: request.model,
    provider: request.provider,
  })

  if (!response.success || !response.data) {
    return {
      originalText,
      polishedText: '',
      diffMarkup: '',
      error: response.error || 'polish request failed',
    }
  }

  const polishedText = response.data.processed_text || ''
  return {
    originalText,
    polishedText,
    diffMarkup: generateDiffMarkup(originalText, polishedText),
  }
}

export const polishContent = polishContentCompat

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
  knowledge_retrieval?: boolean
  search_mode?: 'hybrid' | 'iterative' | 'context'
  profile?: string
  min_score?: number
  budget_tokens?: number
  rerank?: boolean
  max_iterations?: number
  confidence_threshold?: number
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

function resolveWorkflowEndpoint(path: '/route' | '/plan' | '/execute' | '/lifecycle', mode?: 'standard' | 'uiBridge'): string {
  const backendMode = mode ?? useSettingsStore.getState().settings.workflowBackendMode
  const prefix = backendMode === 'uiBridge' ? '/ui/workflow' : '/workflow'
  return `${prefix}${path}`
}

export async function routeWorkflow(task: string, level?: string): Promise<ApiResponse<unknown>> {
  return callApi(resolveWorkflowEndpoint('/route'), 'POST', { task, level })
}

export async function uiRouteWorkflow(task: string, level?: string): Promise<ApiResponse<unknown>> {
  return callApi(resolveWorkflowEndpoint('/route', 'uiBridge'), 'POST', { task, level })
}

export async function createPlan(
  task: string,
  level?: string,
  recommendations?: RecommendationInput[],
  mode?: 'standard' | 'uiBridge'
): Promise<ApiResponse<WorkflowPlanStatusResponse | WorkflowExecuteFailureResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(resolveWorkflowEndpoint('/plan', mode), 'POST', {
    task,
    level,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function uiCreatePlan(
  task: string,
  level?: string,
  recommendations?: RecommendationInput[]
): Promise<ApiResponse<WorkflowPlanStatusResponse | WorkflowExecuteFailureResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(resolveWorkflowEndpoint('/plan', 'uiBridge'), 'POST', {
    task,
    level,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function executePlan(
  planId: string,
  stepId?: string,
  recommendations?: RecommendationInput[],
  mode?: 'standard' | 'uiBridge',
  confirm_token?: string
): Promise<ApiResponse<WorkflowExecuteResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(resolveWorkflowEndpoint('/execute', mode), 'POST', {
    plan_id: planId,
    step_id: stepId,
    confirm_token: confirm_token && confirm_token.trim().length > 0 ? confirm_token : undefined,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function uiExecutePlan(
  planId: string,
  stepId?: string,
  recommendations?: RecommendationInput[],
  confirm_token?: string
): Promise<ApiResponse<WorkflowExecuteResponse>> {
  const normalizedRecommendations = normalizeRecommendations(recommendations)
  return callApi(resolveWorkflowEndpoint('/execute', 'uiBridge'), 'POST', {
    plan_id: planId,
    step_id: stepId,
    confirm_token: confirm_token && confirm_token.trim().length > 0 ? confirm_token : undefined,
    recommendations: normalizedRecommendations.length > 0 ? normalizedRecommendations : undefined,
  })
}

export async function workflowLifecycle(
  planId: string,
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status',
  mode?: 'standard' | 'uiBridge'
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return callApi(resolveWorkflowEndpoint('/lifecycle', mode), 'POST', {
    plan_id: planId,
    action,
  })
}

export async function uiWorkflowLifecycle(
  planId: string,
  action: 'start' | 'pause' | 'resume' | 'stop' | 'status'
): Promise<ApiResponse<WorkflowLifecycleResponse | WorkflowExecuteFailureResponse>> {
  return callApi(resolveWorkflowEndpoint('/lifecycle', 'uiBridge'), 'POST', {
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

export interface NovelQualityCheckResult {
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW' | string
  total_score: number
  lock_score?: number
  style_score?: number
  logic_score?: number
  actionable_feedback?: string
  suggestions?: RecommendationInput[]
  [key: string]: unknown
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

export async function novelQualityCheck(
  content: string,
  sceneCard?: Record<string, unknown>,
  dimensions?: string[],
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<NovelQualityCheckResult>> {
  return callApi('/api/novel/quality-check', 'POST', {
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
  reason?: string
): Promise<ApiResponse<WorkflowQuickRollbackResult>> {
  return callApi('/workflow/quick-rollback', 'POST', {
    plan_id: planId,
    checkpoint_id: checkpointId,
    reason,
  })
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
  writer_metadata?: WriterMetadata
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
  const base = isTauri ? await getRuntimeGatewayBase() : getResolvedApiBase()
  const url = `${base}/chat/stream`

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
        writer_metadata: typeof data.writer_metadata === 'object' && data.writer_metadata !== null
          ? (data.writer_metadata as WriterMetadata)
          : undefined,
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

// ============ Config API ============

// Modifiable fields whitelist (mirrors backend MODIFIABLE_FIELDS)
export const MODIFIABLE_FIELDS: string[] = [
  // Agent config
  'agent.default_model',
  'agent.max_cost_per_request',
  'agent.max_cost_per_session',
  'agent.max_tokens_per_request',
  'agent.budget_warn_threshold',
  'agent.log_level',
  // Memory config
  'memory.cache_enabled',
  'memory.cache_ttl',
  'memory.cache_max_size',
  'memory.chunk_size',
  'memory.chunk_overlap',
  // Workflow config
  'workflow.session_timeout',
  'workflow.max_concurrent_sessions',
  'workflow.checkpoint_enabled',
  'workflow.checkpoint_interval',
  'workflow.resume_strategy',
  'workflow.quality_mode',
  'workflow.quality_level',
  'workflow.degrade_on_timeout',
  'workflow.degrade_on_error',
  'workflow.critical_gate_always_on',
  'workflow.quality_phase_timeout_seconds',
  // Writing config
  'writing.character_depth_dimensions',
  'writing.max_character_traits',
  'writing.scene_coherence_threshold',
  'writing.contradiction_sensitivity',
  'writing.foreshadowing_max_distance',
  'writing.foreshadowing_reminder_threshold',
  'writing.style_vector_dimensions',
  'writing.style_sample_min_words',
  // Backup config
  'backup.backup_dir',
  'backup.compress',
  'backup.max_backups',
  'backup.webdav_enabled',
  'backup.webdav_url',
  'backup.webdav_username',
  'backup.webdav_remote_path',
  'backup.s3_enabled',
  'backup.s3_bucket',
  'backup.s3_prefix',
  'backup.s3_region',
  'backup.s3_endpoint_url',
  'backup.s3_access_key_id',
  'backup.s3_force_path_style',
  // Token config
  'token.default_budget',
  'token.budget_warn_threshold',
  // Obsidian config
  'obsidian.enabled',
  'obsidian.auto_discover',
  'obsidian.sync_on_startup',
  'obsidian.default_vault',
  'gateway.localhost_only',
  'gateway.localhost_only_exempt_paths',
  'gateway.detection_evasion_guard',
  // Gateway config (limited)
  'gateway.metrics_enabled',
  'gateway.ui_bridge_enabled',
  'integration.dbhub_governance_enabled',
  'integration.search_route_mode',
  'integration.search_elastic_timeout_ms',
  'integration.redis_rate_limit',
  'integration.redis_rate_limit_window_seconds',
  'integration.langflow_enabled',
  'integration.langflow_flow_name',
  'integration.redis_cache_ttl_seconds',
]

// Secret fields (mirrors backend SECRET_FIELDS)
export const SECRET_FIELDS: string[] = [
  'agent.google_api_key',
  'agent.openai_api_key',
  'backup.webdav_password',
  'backup.s3_secret_access_key',
]

// Config section interfaces matching backend dataclasses
export interface AgentConfig {
  max_cost_per_request: number
  max_cost_per_session: number
  max_tokens_per_request: number
  budget_warn_threshold: number
  default_model: string
  google_api_key: string
  openai_api_key: string
  log_level: string
}

export interface MemoryConfig {
  vector_db_path: string
  embedding_model: string
  embedding_dimension: number
  cache_enabled: boolean
  cache_ttl: number
  cache_max_size: number
  chunk_size: number
  chunk_overlap: number
}

export interface WorkflowConfig {
  session_timeout: number
  max_concurrent_sessions: number
  checkpoint_enabled: boolean
  checkpoint_interval: number
  resume_strategy: string
  quality_mode: string
  quality_level: string
  degrade_on_timeout: boolean
  degrade_on_error: boolean
  critical_gate_always_on: boolean
  quality_phase_timeout_seconds: number
}

export interface GraphConfig {
  db_path: string
  max_connections: number
  max_entities_per_query: number
  relation_depth: number
}

export interface WritingConfig {
  character_depth_dimensions: number
  max_character_traits: number
  scene_coherence_threshold: number
  contradiction_sensitivity: string
  foreshadowing_max_distance: number
  foreshadowing_reminder_threshold: number
  style_vector_dimensions: number
  style_sample_min_words: number
}

export interface GatewayConfig {
  host: string
  port: number
  reload: boolean
  localhost_only: boolean
  localhost_only_exempt_paths: string[]
  cors_dev_origins: string[]
  cors_prod_origins: string[]
  metrics_enabled: boolean
  ui_bridge_enabled: boolean
  detection_evasion_guard: boolean
}

export interface BackupConfig {
  backup_dir: string
  compress: boolean
  max_backups: number
  webdav_enabled: boolean
  webdav_url: string
  webdav_username: string
  webdav_password: string
  webdav_remote_path: string
  s3_enabled: boolean
  s3_bucket: string
  s3_prefix: string
  s3_region: string
  s3_endpoint_url: string
  s3_access_key_id: string
  s3_secret_access_key: string
  s3_force_path_style: boolean
}

export interface TokenConfig {
  db_path: string
  default_model: string
  default_budget: number
  budget_warn_threshold: number
}

export interface ObsidianConfig {
  enabled: boolean
  auto_discover: boolean
  sync_on_startup: boolean
  default_vault: string
  file_patterns: string[]
}

export interface IntegrationConfig {
  postgres_enabled: boolean
  redis_cache_enabled: boolean
  elasticsearch_enabled: boolean
  neo4j_enabled: boolean
  langflow_enabled: boolean
  dbhub_governance_enabled: boolean
  search_route_mode: string
  search_elastic_timeout_ms: number
  redis_rate_limit: number
  redis_rate_limit_window_seconds: number
  langflow_flow_name: string
  redis_cache_ttl_seconds: number
}

// Main config interface matching backend AppConfig
export interface BackendConfig {
  app_name: string
  version: string
  debug: boolean
  env: string
  data_dir: string
  log_dir: string
  agent: AgentConfig
  memory: MemoryConfig
  workflow: WorkflowConfig
  graph: GraphConfig
  writing: WritingConfig
  backup: BackupConfig
  token: TokenConfig
  obsidian: ObsidianConfig
  gateway: GatewayConfig
  integration: IntegrationConfig
}

// Response types for config endpoints
export interface ConfigResponse {
  status: string
  config: BackendConfig
  modifiable_fields: string[]
}

export interface ConfigUpdateResponse {
  status: string
  updated?: string[]
  errors?: Array<{ field: string; error: string }>
}

export interface SecretFieldStatus {
  configured: boolean
  value: string
}

export interface SecretsResponse {
  status: string
  secrets: Record<string, SecretFieldStatus>
}

export interface SecretsUpdateResponse {
  status: string
  updated?: string[]
  errors?: Array<{ field: string; error: string }>
}

export interface ConfigReloadResponse {
  status: string
  message: string
}

// Error type for config operations
export interface ConfigError {
  field: string
  error: string
}

/**
 * Get current configuration with secrets masked.
 * Returns all 10 config sections with modifiable_fields list.
 */
export async function getConfig(): Promise<ApiResponse<ConfigResponse>> {
  const response = await callApi<Omit<ConfigResponse, 'modifiable_fields'>>('/config', 'GET')
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        ...response.data,
        modifiable_fields: MODIFIABLE_FIELDS,
      },
    }
  }
  return response as ApiResponse<ConfigResponse>
}

/**
 * Update configuration fields.
 * Only modifiable fields can be updated (see MODIFIABLE_FIELDS).
 * Fields should use dot notation (e.g., "agent.default_model").
 */
export async function updateConfig(
  fields: Record<string, unknown>
): Promise<ApiResponse<ConfigUpdateResponse>> {
  return callApi<ConfigUpdateResponse>('/config', 'PUT', { fields })
}

/**
 * Get secret fields status (masked values only).
 * Shows which secrets are configured without exposing actual values.
 */
export async function getSecrets(): Promise<ApiResponse<SecretsResponse>> {
  return callApi<SecretsResponse>('/config/secrets', 'GET')
}

/**
 * Update secret configuration fields.
 * Only secret fields can be updated (see SECRET_FIELDS).
 * Fields should use dot notation (e.g., "agent.google_api_key").
 */
export async function updateSecrets(
  secrets: Record<string, string>
): Promise<ApiResponse<SecretsUpdateResponse>> {
  return callApi<SecretsUpdateResponse>('/config/secrets', 'PUT', { secrets })
}

/**
 * Reload configuration from file.
 * Triggers hot reload of all configuration values.
 */
export async function reloadConfig(): Promise<ApiResponse<ConfigReloadResponse>> {
  return callApi<ConfigReloadResponse>('/config/reload', 'POST')
}

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

export type GatewayTools = Record<string, string[]>

export interface GatewayHealth {
  status: string
  version: string
  services: Record<string, string>
  engine_health?: Record<string, { status: string; error?: string }>
  agents?: string[]
  skills_count?: number
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
  method: 'GET' | 'POST' = 'GET',
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
      if (body && method === 'POST') {
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

// ============ Chat API (Main Interface) ============

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export type WorkflowLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export interface ChatRequest {
  messages: ChatMessage[]
  workflowLevel: WorkflowLevel
  skills: string[]
  allowLlmFallback: boolean
  context?: {
    projectId?: string
    chapterId?: string
  }
}

export interface ChatResponse {
  content: string
  skills_used: string[]
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

export async function routeWorkflow(task: string, level?: string): Promise<ApiResponse<unknown>> {
  return callApi('/workflow/route', 'POST', { task, level })
}

export async function createPlan(task: string, level?: string): Promise<ApiResponse<unknown>> {
  return callApi('/workflow/plan', 'POST', { task, level })
}

export async function executePlan(planId: string, stepId?: string): Promise<ApiResponse<unknown>> {
  return callApi('/workflow/execute', 'POST', { plan_id: planId, step_id: stepId })
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
  wordTarget?: number
): Promise<ApiResponse<{ content: string; wordcount: number }>> {
  return callApi('/agent/write', 'POST', {
    scene_card: sceneCard,
    skills,
    word_target: wordTarget,
  })
}

export async function agentRevise(
  draft: string,
  feedback: Record<string, unknown>
): Promise<ApiResponse<{ content: string }>> {
  return callApi('/agent/revise', 'POST', { draft, feedback })
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
  suggestions: string[]
}

export async function evaluateContent(
  content: string,
  sceneCard?: Record<string, unknown>,
  dimensions?: string[]
): Promise<ApiResponse<EvaluationResult>> {
  return callApi('/critic/evaluate', 'POST', {
    content,
    scene_card: sceneCard,
    dimensions,
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

export interface StreamCallbacks {
  onStart?: () => void
  onRouting?: (data: { level: string; scene_type: string; skills: string[] }) => void
  onProgress?: (data: { step: number; total: number; message: string }) => void
  onContent?: (chunk: string, index: number) => void
  onEvaluation?: (data: { score: number; feedback: string }) => void
  onDone?: (data: { status: string; skills_used: string[] }) => void
  onError?: (error: string) => void
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
  callbacks: StreamCallbacks
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
    callbacks.onError?.(String(error))
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
    case 'done':
      callbacks.onDone?.(data as { status: string; skills_used: string[] })
      break
    case 'error':
      callbacks.onError?.(data.error as string)
      break
  }
}

// ============ Health Check ============

export async function checkHealth(): Promise<boolean> {
  return checkBackendHealth()
}

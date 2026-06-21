import { type ApiResponse, callApi, getResolvedApiBase, getRuntimeGatewayBase, isTauriRuntime } from './core'
import { appendLegacyChatWorkspacePayload, type ProjectWorkspaceContext } from './workspace'
import { logger } from '../utils/logger'

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
  workspace?: ProjectWorkspaceContext
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

export type WorkflowDecision = 'go' | 'soft_go' | 'no_go'
export type PublishRecommendation = 'pass' | 'revise' | 'block'

export interface NarrativeAuthorityMetadata {
  sessionId?: string
  workspaceId?: string
  projectId?: string
  recordSetId?: string
  sceneId?: string
  eventId?: string
  timelineId?: string
  consistencyRunId?: string
}

export interface ConsistencyGovernanceMetadata {
  decision?: WorkflowDecision
  publish_recommendation?: PublishRecommendation
  score?: number
  feedback?: string
}

export interface WriterMetadata {
  canon_context?: {
    available: boolean
    reason: string | null
    total_pages: number
    match_count: number
    injected: boolean
    matches: Array<{
      page_id: string
      slug: string
      title: string
      score: number
      excerpt: string
      authority: {
        workspaceId: string
        scopeAuthority: 'workspace'
        canonAuthority: 'canon-page'
        projectionAuthority: 'derived'
        promotion: 'manual'
        promotedFrom: 'story-bible' | 'chat' | 'research' | 'manual'
        status: 'curated' | 'draft'
      }
    }>
  }
  warnings?: string[]
  knowledge_retrieved?: {
    entities_count: number
    relations_count: number
    memories_count: number
  }
  workspace_context?: ProjectWorkspaceContext
  narrative_authority?: NarrativeAuthorityMetadata
  consistency_governance?: ConsistencyGovernanceMetadata
  [key: string]: unknown
}

export function toPublishRecommendation(
  decision?: WorkflowDecision,
): PublishRecommendation | undefined {
  if (decision === 'go') return 'pass'
  if (decision === 'soft_go') return 'revise'
  if (decision === 'no_go') return 'block'
  return undefined
}

export function buildConsistencyGovernanceMetadata(params: {
  decision?: WorkflowDecision
  evaluation?: {
    score?: number
    feedback?: string
  } | null
}): ConsistencyGovernanceMetadata | undefined {
  const score = typeof params.evaluation?.score === 'number' ? params.evaluation.score : undefined
  const feedback = typeof params.evaluation?.feedback === 'string'
    ? params.evaluation.feedback.trim()
    : ''
  const publishRecommendation = toPublishRecommendation(params.decision)
  const hasMeaningfulScore = typeof score === 'number' && Number.isFinite(score) && score > 0
  const hasFeedback = feedback.length > 0

  if (!params.decision && !publishRecommendation && !hasMeaningfulScore && !hasFeedback) {
    return undefined
  }

  return {
    decision: params.decision,
    publish_recommendation: publishRecommendation,
    score: hasMeaningfulScore ? score : undefined,
    feedback: hasFeedback ? feedback : undefined,
  }
}

export function mergeWriterMetadataGovernance(
  writerMetadata: WriterMetadata | undefined,
  governance: ConsistencyGovernanceMetadata | undefined,
): WriterMetadata | undefined {
  if (!governance) {
    return writerMetadata
  }

  return {
    ...(writerMetadata ?? {}),
    consistency_governance: {
      ...(writerMetadata?.consistency_governance ?? {}),
      ...governance,
    },
  }
}

export interface ChatResponse {
  content: string
  skills_used: string[]
  comparison?: ChatModelComparisonResult
  writer_metadata?: WriterMetadata
  workspace?: ProjectWorkspaceContext
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
  return callApi<ChatResponse>(
    '/chat',
    'POST',
    appendLegacyChatWorkspacePayload(request as unknown as Record<string, unknown>, request.workspace),
  )
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
  decision?: WorkflowDecision
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
  const base = isTauriRuntime()
    ? await getRuntimeGatewayBase(getResolvedApiBase)
    : getResolvedApiBase()
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
      body: JSON.stringify(
        appendLegacyChatWorkspacePayload(request as unknown as Record<string, unknown>, request.workspace),
      ),
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
    // ISS-20260613-009: currentEvent/currentData 必须在循环外声明，
    // 否则跨 chunk 的 SSE 事件会因每轮循环变量重置而丢失
    let currentEvent = ''
    let currentData = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // 流结束，buffer 可能残留最后一行（无尾随 \n），并入解析后再补发
        if (buffer) {
          for (const line of buffer.split('\n')) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6).trim()
            }
          }
          buffer = ''
        }
        // 补发尚未 dispatch 的尾部事件（无尾随空行的流会丢最后一个事件）
        if (currentEvent && currentData) {
          try {
            const data = JSON.parse(currentData)
            handleStreamEventOptimized(currentEvent, data, callbacks, scheduleContentUpdate)
          } catch (e) {
            logger.error('Failed to parse SSE data:', e)
          }
          currentEvent = ''
          currentData = ''
        }
        // 流结束，刷新剩余内容
        flushContentBuffer()
        break
      }

      // 流式解码，保留部分字符
      buffer += decoder.decode(value, { stream: true })

      // 解析 SSE 事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

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
            logger.error('Failed to parse SSE data:', e)
          }
          currentEvent = ''
          currentData = ''
        }
      }
    }
  } catch (error) {
    // 确保刷新任何待处理的内容
    flushContentBuffer()
    logger.error('Stream error:', error)
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

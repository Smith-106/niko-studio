import type {
  StreamWritingHelperRequest,
  WritingHelperRequest,
  WritingHelperResponse,
} from './contracts'

import {
  type ApiResponse,
  callApi,
  getResolvedApiBase,
  getRuntimeGatewayBase,
  isTauriRuntime,
} from './core'
import { appendWorkspacePayload } from './workspace'

export type {
  StreamWritingHelperRequest,
  WritingHelperMode,
  WritingHelperRequest,
  WritingHelperResponse,
} from './contracts'
export type LegacyPolishType = 'standard' | 'academic' | 'business' | 'creative'

interface WritingStreamEvent {
  event: WritingStreamEventType
  data: Record<string, unknown>
}

type WritingStreamEventType = 'start' | 'content' | 'done' | 'error'

const INVALID_WRITING_STREAM_PAYLOAD = 'Invalid writing stream payload'

function isWritingStreamEventType(value: unknown): value is WritingStreamEventType {
  return value === 'start' || value === 'content' || value === 'done' || value === 'error'
}

function isWritingStreamEventData(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

export async function processWritingHelper(
  payload: WritingHelperRequest
): Promise<ApiResponse<WritingHelperResponse>> {
  return callApi(
    '/writing/helper',
    'POST',
    appendWorkspacePayload(payload as unknown as Record<string, unknown>, payload.workspace),
  )
}

function dispatchWritingStreamEvent(
  eventType: WritingStreamEventType,
  data: Record<string, unknown>,
  callbacks: {
    onContent: (chunk: string, index: number) => void
    onDone: () => void
    onError: (error: string) => void
  },
): void {
  if (eventType === 'content') {
    if (typeof data.chunk !== 'string' || typeof data.index !== 'number' || Number.isNaN(data.index)) {
      callbacks.onError(INVALID_WRITING_STREAM_PAYLOAD)
      return
    }

    callbacks.onContent(data.chunk, data.index)
    return
  }

  if (eventType === 'done') {
    callbacks.onDone()
    return
  }

  if (eventType === 'error') {
    callbacks.onError(String(data.error ?? 'Stream error'))
  }
}

function parseJsonErrorPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const error = (payload as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

function parseWritingStreamEvent(rawEvent: unknown): WritingStreamEvent | null {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return null
  }

  const event = (rawEvent as { event?: unknown }).event
  if (!isWritingStreamEventType(event)) {
    return null
  }

  const data = (rawEvent as { data?: unknown }).data
  if (!isWritingStreamEventData(data)) {
    return null
  }

  if (
    event === 'content' &&
    (typeof data.chunk !== 'string' || typeof data.index !== 'number' || Number.isNaN(data.index))
  ) {
    return null
  }

  return { event, data }
}

async function consumeJsonWritingEvents(
  response: Response,
  callbacks: {
    onContent: (chunk: string, index: number) => void
    onDone: () => void
    onError: (error: string) => void
  },
): Promise<void> {
  const data = await response.json() as {
    streaming?: unknown
    events?: unknown
    error?: unknown
  }

  const error = parseJsonErrorPayload(data)
  if (error) {
    callbacks.onError(error)
    return
  }

  if (data.streaming !== true || !Array.isArray(data.events)) {
    callbacks.onError(INVALID_WRITING_STREAM_PAYLOAD)
    return
  }

  for (const rawEvent of data.events) {
    const event = parseWritingStreamEvent(rawEvent)
    if (!event) {
      callbacks.onError(INVALID_WRITING_STREAM_PAYLOAD)
      return
    }

    dispatchWritingStreamEvent(event.event, event.data, callbacks)
  }
}

async function consumeSseWritingEvents(
  response: Response,
  callbacks: {
    onContent: (chunk: string, index: number) => void
    onDone: () => void
    onError: (error: string) => void
  },
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''
  let currentData = ''

  const flushEvent = () => {
    if (!currentEvent || !currentData) {
      currentEvent = ''
      currentData = ''
      return
    }

    if (!isWritingStreamEventType(currentEvent)) {
      callbacks.onError(INVALID_WRITING_STREAM_PAYLOAD)
      currentEvent = ''
      currentData = ''
      return
    }

    try {
      const data = JSON.parse(currentData) as unknown
      if (!isWritingStreamEventData(data)) {
        callbacks.onError(INVALID_WRITING_STREAM_PAYLOAD)
      } else {
        dispatchWritingStreamEvent(currentEvent, data, callbacks)
      }
    } catch {
      callbacks.onError('Failed to parse writing stream event')
    }

    currentEvent = ''
    currentData = ''
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      buffer += decoder.decode()
      const lines = buffer.split('\n')
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '')
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7).trim()
        } else if (trimmed.startsWith('data: ')) {
          currentData = trimmed.slice(6).trim()
        } else if (trimmed === '') {
          flushEvent()
        }
      }
      flushEvent()
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '')
      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.slice(7).trim()
      } else if (trimmed.startsWith('data: ')) {
        currentData = trimmed.slice(6).trim()
      } else if (trimmed === '') {
        flushEvent()
      }
    }
  }
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
  const base = isTauriRuntime()
    ? await getRuntimeGatewayBase(getResolvedApiBase)
    : getResolvedApiBase()
  const url = `${base}/writing/stream`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(
        appendWorkspacePayload(payload as unknown as Record<string, unknown>, payload.workspace),
      ),
      signal: options?.signal,
    })

    if (!response.ok) {
      const error = parseJsonErrorPayload(await response.clone().json().catch(() => null))
      throw new Error(error ?? `HTTP error: ${response.status}`)
    }

    const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''
    if (contentType.includes('text/event-stream')) {
      await consumeSseWritingEvents(response, callbacks)
      return
    }

    await consumeJsonWritingEvents(response, callbacks)
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

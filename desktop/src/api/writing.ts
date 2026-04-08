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
    '/writing-helper/process',
    'POST',
    appendWorkspacePayload(payload as unknown as Record<string, unknown>, payload.workspace),
  )
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

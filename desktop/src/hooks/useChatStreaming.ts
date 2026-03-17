import { useCallback, useRef, useState } from 'react'
import { chatStream } from '../api/client'
import type { ChatRequest, StreamDonePayload } from '../api/client'

type StreamPhase = 'idle' | 'streaming' | 'done' | 'error' | 'interrupted' | 'recovered'

type StreamTerminal = 'done' | 'error' | 'interrupted' | 'recovered'

interface StreamRuntimeMeta {
  terminal: StreamTerminal
  decision?: 'go' | 'soft_go' | 'no_go'
  diagnostics?: {
    fallback_reason?: string | null
    failure_reason?: string | null
    error_type?: string | null
  }
}

interface RecoverStatus {
  type: 'error' | 'success' | 'info'
  message: string
}

interface StartStreamOptions {
  onRecoverStatus: (status: RecoverStatus | null) => void
  onCommitAssistantMessage: (args: { content: string; writerMetadata?: StreamDonePayload['writer_metadata'] }) => void
  onInterrupted: () => void
  onStreamPhase: (phase: StreamPhase) => void
  normalizeTerminal: (payload?: StreamDonePayload) => StreamTerminal
  maybeShowGateHint: (payload?: StreamDonePayload) => void
  t: {
    processingCompleted: string
    streamRecovered: string
  }
}

export function useChatStreaming() {
  const [streamingContent, setStreamingContent] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamRequestIdRef = useRef(0)

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const startStream = useCallback(async (request: ChatRequest, options: StartStreamOptions): Promise<{ phase: StreamPhase; meta: StreamRuntimeMeta | null }> => {
    let streamFailed = false
    let hasStreamContent = false
    let streamText = ''
    let streamWriterMetadata: StreamDonePayload['writer_metadata']
    let finalPhase: StreamPhase | null = null
    let finalized = false
    let streamDone = false
    let streamMeta: StreamRuntimeMeta | null = null

    const requestId = ++streamRequestIdRef.current
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    options.onStreamPhase('streaming')

    const finalize = (phase: StreamPhase, meta?: StreamRuntimeMeta) => {
      if (finalized || requestId !== streamRequestIdRef.current) return
      finalized = true
      finalPhase = phase
      streamMeta = meta ?? streamMeta
      options.onStreamPhase(phase)
    }

    await chatStream(
      request,
      {
        onContent: (chunk) => {
          hasStreamContent = true
          streamText += chunk
          setStreamingContent(streamText)
        },
        onDone: (payload) => {
          streamDone = true
          streamWriterMetadata = payload.writer_metadata
          options.maybeShowGateHint(payload)
          const terminal = options.normalizeTerminal(payload)
          finalize(terminal, { terminal, decision: payload.decision, diagnostics: payload.diagnostics })
        },
        onError: (error, payload) => {
          const terminal = payload?.terminal === 'interrupted' ? 'interrupted' : 'error'
          if (abortController.signal.aborted || terminal === 'interrupted' || error.toLowerCase().includes('abort')) {
            finalize('interrupted', { terminal: 'interrupted', diagnostics: payload?.diagnostics })
            return
          }
          streamFailed = true
          finalize('error', { terminal: 'error', diagnostics: payload?.diagnostics })
        },
      },
      { signal: abortController.signal }
    )

    if (abortControllerRef.current === abortController) {
      abortControllerRef.current = null
    }

    if (!finalized) {
      if (abortController.signal.aborted) {
        finalize('interrupted', { terminal: 'interrupted' })
      } else if (streamDone || hasStreamContent) {
        finalize('done', { terminal: 'done' })
      } else if (streamFailed) {
        finalize('error', { terminal: 'error' })
      } else {
        finalize('error', { terminal: 'error' })
      }
    }

    if ((finalPhase === 'done' || finalPhase === 'recovered') && hasStreamContent) {
      options.onCommitAssistantMessage({
        content: streamText || options.t.processingCompleted,
        writerMetadata: streamWriterMetadata,
      })
      if (finalPhase === 'recovered') {
        options.onRecoverStatus({ type: 'success', message: options.t.streamRecovered })
      }
      return { phase: finalPhase, meta: streamMeta }
    }

    if (finalPhase === 'interrupted') {
      options.onInterrupted()
      return { phase: 'interrupted', meta: streamMeta }
    }

    return { phase: 'error', meta: streamMeta }
  }, [])

  return {
    streamingContent,
    setStreamingContent,
    startStream,
    cancelStream,
  }
}

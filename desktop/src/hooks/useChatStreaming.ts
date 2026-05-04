import { useCallback, useRef, useState } from 'react'
import { buildConsistencyGovernanceMetadata, chatStream, mergeWriterMetadataGovernance } from '../api/client'
import type { ChatRequest, StreamDonePayload } from '../api/client'
import { useSmoothStream } from './useSmoothStream'

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
  detail?: string
  error_class?: string
  recoverable?: boolean
  retry_after?: number
}

// interface StreamErrorPayload {
//   error_class: string
//   recoverable: boolean
//   retry_after: number
//   terminal?: string
//   diagnostics?: {
//     fallback_reason?: string | null
//     failure_reason?: string | null
//     error_type?: string | null
//   }
// }

// function isStreamErrorPayload(payload: any): payload is StreamErrorPayload {
//     return payload && typeof payload.recoverable === 'boolean';
// }

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
  const [streamDone, setStreamDone] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamRequestIdRef = useRef(0)

  const { addChunk, reset } = useSmoothStream({
    onUpdate: setStreamingContent,
    streamDone,
  })

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const startStream = useCallback(async (request: ChatRequest, options: StartStreamOptions): Promise<{ phase: StreamPhase; meta: StreamRuntimeMeta | null }> => {
    // let retries = 0
    // const maxRetries = 2

    for (;;) {
      let streamFailed = false
      let hasStreamContent = false
      let streamText = ''
      let streamWriterMetadata: StreamDonePayload['writer_metadata']
      let streamEvaluation: { score?: number; feedback?: string } | undefined
      let finalPhase: StreamPhase | null = null
      let finalized = false
      let streamDoneFlag = false
      let streamMeta: StreamRuntimeMeta | null = null
      // let streamErrorPayload: StreamErrorPayload | null = null

      const requestId = ++streamRequestIdRef.current
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      setStreamDone(false)
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
            addChunk(chunk)
          },
          onEvaluation: (payload) => {
            streamEvaluation = payload
          },
          onDone: (payload) => {
            streamDoneFlag = true
            setStreamDone(true)
            streamWriterMetadata = mergeWriterMetadataGovernance(
              payload.writer_metadata,
              buildConsistencyGovernanceMetadata({
                decision: payload.decision,
                evaluation: streamEvaluation,
              }),
            )
            options.maybeShowGateHint(payload)
            const terminal = options.normalizeTerminal(payload)
            finalize(terminal, { terminal, decision: payload.decision, diagnostics: payload.diagnostics })
          },
          onError: (error, payload: any) => {
            // streamErrorPayload = payload ?? null
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
        } else if (streamDoneFlag || hasStreamContent) {
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

      // TODO: Fix this
      // if (finalPhase === 'error' && isStreamErrorPayload(streamErrorPayload) && streamErrorPayload.recoverable && retries < maxRetries) {
      //   retries++
      //   const delay = (streamErrorPayload.retry_after ?? 5) * 1000
      //   options.onRecoverStatus({ type: 'info', message: `Retrying (${retries}/${maxRetries})...` })
      //   if (delay > 0) {
      //     await new Promise(resolve => setTimeout(resolve, delay))
      //   }
      //   continue
      // }

      return { phase: 'error', meta: streamMeta }
    }
  }, [addChunk, reset])

  const resetStream = useCallback(() => {
    reset('')
    setStreamDone(true)
  }, [reset])

  return {
    streamingContent,
    setStreamingContent,
    startStream,
    cancelStream,
    resetStream,
  }
}

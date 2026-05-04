import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChatStreaming } from './useChatStreaming'

let capturedCallbacks: {
  onContent?: (chunk: string, index: number) => void
  onEvaluation?: (data: { score: number; feedback: string }) => void
  onDone?: (data: Record<string, unknown>) => void
  onError?: (error: string, payload?: Record<string, unknown>) => void
} = {}

let mockOnUpdate: ((text: string) => void) | null = null
let mockDisplayedText = ''

vi.mock('./useSmoothStream', () => ({
  useSmoothStream: vi.fn(({ onUpdate }) => {
    mockOnUpdate = onUpdate
    mockDisplayedText = ''
    return {
      addChunk: (chunk: string) => {
        mockDisplayedText += chunk
        mockOnUpdate?.(mockDisplayedText)
      },
      reset: (text = '') => {
        mockDisplayedText = text
        mockOnUpdate?.(text)
      },
    }
  }),
}))

vi.mock('../api/client', () => ({
  chatStream: vi.fn(),
  buildConsistencyGovernanceMetadata: vi.fn(() => undefined),
  mergeWriterMetadataGovernance: vi.fn((_m: unknown, g: unknown) => g ?? _m),
}))

import { chatStream } from '../api/client'

const mockChatStream = vi.mocked(chatStream)

function makeOptions(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    onRecoverStatus: vi.fn(),
    onCommitAssistantMessage: vi.fn(),
    onInterrupted: vi.fn(),
    onStreamPhase: vi.fn(),
    normalizeTerminal: vi.fn(() => 'done' as const),
    maybeShowGateHint: vi.fn(),
    t: {
      processingCompleted: 'Processing completed',
      streamRecovered: 'Stream recovered',
    },
    ...overrides,
  }
}

const baseRequest = {
  messages: [],
  workflowLevel: 'L2' as const,
  skills: [],
  allowLlmFallback: false,
}

describe('useChatStreaming integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks = {}
    mockOnUpdate = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('streams multi-chunk response and commits final message', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('The hero ', 0)
      capturedCallbacks.onContent?.('crossed the ', 1)
      capturedCallbacks.onContent?.('threshold.', 2)
      capturedCallbacks.onDone?.({
        terminal: 'done',
        skills_used: [],
        writer_metadata: { model: 'test' },
      })
    })

    const res = await act(() => result.current.startStream(baseRequest, options))

    expect(res.phase).toBe('done')
    expect(result.current.streamingContent).toBe('The hero crossed the threshold.')
    expect(options.onCommitAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'The hero crossed the threshold.' }),
    )
    expect(options.onStreamPhase).toHaveBeenCalledWith('streaming')
  })

  it('streams content with evaluation metadata', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('Chapter draft', 0)
      capturedCallbacks.onEvaluation?.({ score: 0.85, feedback: 'Good pacing' })
      capturedCallbacks.onDone?.({
        terminal: 'done',
        skills_used: [],
        writer_metadata: {},
      })
    })

    const res = await act(() => result.current.startStream(baseRequest, options))

    expect(res.phase).toBe('done')
    expect(options.onCommitAssistantMessage).toHaveBeenCalled()
  })

  it('handles error → retry → success lifecycle', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()
    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      callCount++

      if (callCount === 1) {
        capturedCallbacks.onError?.('Temporary failure', {
          recoverable: true,
          retry_after: 0,
          terminal: 'error',
        })
      } else {
        capturedCallbacks.onContent?.('Recovered content', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    const res = await act(() => result.current.startStream(baseRequest, options))

    expect(mockChatStream).toHaveBeenCalledTimes(2)
    expect(res.phase).toBe('done')
    expect(options.onCommitAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Recovered content' }),
    )
    expect(options.onRecoverStatus).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info' }),
    )
  })

  it('handles interruption during streaming and does not commit', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks, opts) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('Partial content...', 0)
      opts?.signal?.addEventListener('abort', () => {
        capturedCallbacks.onError?.('AbortError', { terminal: 'interrupted' })
      })
    })

    let phase: string | undefined
    await act(async () => {
      const streamPromise = result.current.startStream(baseRequest, options)
      result.current.cancelStream()
      const res = await streamPromise
      phase = res.phase
    })

    expect(phase).toBe('interrupted')
    expect(options.onInterrupted).toHaveBeenCalled()
    expect(options.onCommitAssistantMessage).not.toHaveBeenCalled()
  })

  it('uses processingCompleted fallback when streamed text is empty after content chunk', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('', 0)
      capturedCallbacks.onDone?.({
        terminal: 'done',
        skills_used: [],
        writer_metadata: {},
      })
    })

    await act(() => result.current.startStream(baseRequest, options))

    expect(options.onCommitAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Processing completed' }),
    )
  })
})

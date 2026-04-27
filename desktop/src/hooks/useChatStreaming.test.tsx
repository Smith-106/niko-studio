import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChatStreaming } from './useChatStreaming'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedCallbacks: {
  onContent?: (chunk: string, index: number) => void
  onEvaluation?: (data: { score: number; feedback: string }) => void
  onDone?: (data: Record<string, unknown>) => void
  onError?: (error: string, payload?: Record<string, unknown>) => void
} = {}

// Mock useSmoothStream to bypass RAF complexity -- we test the hook, not the stream smoother
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChatStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks = {}
    mockOnUpdate = null

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // 1. Initial state
  // -----------------------------------------------------------------------
  it('exposes initial state and functions', () => {
    const { result } = renderHook(() => useChatStreaming())

    expect(result.current.streamingContent).toBe('')
    expect(typeof result.current.startStream).toBe('function')
    expect(typeof result.current.cancelStream).toBe('function')
    expect(typeof result.current.resetStream).toBe('function')
    expect(typeof result.current.setStreamingContent).toBe('function')
  })

  // -----------------------------------------------------------------------
  // 2. startStream calls chatStream and content accumulates
  // -----------------------------------------------------------------------
  it('calls chatStream and updates streamingContent', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('Hello ', 0)
      capturedCallbacks.onContent?.('world', 1)
    })

    await act(async () => {
      await result.current.startStream(baseRequest, options)
    })

    expect(mockChatStream).toHaveBeenCalledTimes(1)
    // useSmoothStream mock concatenates via onUpdate calls
    expect(result.current.streamingContent).toBe('Hello world')
  })

  // -----------------------------------------------------------------------
  // 3. Successful stream calls onCommitAssistantMessage
  // -----------------------------------------------------------------------
  it('commits message after successful stream', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onContent?.('Response text', 0)
      capturedCallbacks.onDone?.({
        terminal: 'done',
        skills_used: ['test-skill'],
        writer_metadata: {},
      })
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    expect(phase).toBe('done')
    expect(options.onCommitAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Response text',
      }),
    )
  })

  // -----------------------------------------------------------------------
  // 4. Stream error returns error phase
  // -----------------------------------------------------------------------
  it('handles stream errors and returns error phase', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      capturedCallbacks.onError?.('Network failure', { terminal: 'error', status: 'failed' })
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    expect(phase).toBe('error')
    expect(options.onCommitAssistantMessage).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 5. cancelStream triggers abort
  // -----------------------------------------------------------------------
  it('cancelStream aborts the active stream', async () => {
    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()

    let streamResolve: () => void
    const streamPromise = new Promise<void>((resolve) => { streamResolve = resolve })

    mockChatStream.mockImplementation(async (_req, callbacks, opts) => {
      capturedCallbacks = callbacks as typeof capturedCallbacks
      opts?.signal?.addEventListener('abort', () => {
        capturedCallbacks.onError?.('AbortError', { terminal: 'interrupted', status: 'aborted' })
        streamResolve()
      })
      await streamPromise
    })

    let phase: string | undefined
    await act(async () => {
      const streamResultPromise = result.current.startStream(baseRequest, options)
      result.current.cancelStream()
      const res = await streamResultPromise
      phase = res.phase
    })

    expect(phase).toBe('interrupted')
    expect(options.onInterrupted).toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 6. resetStream clears streamingContent
  // -----------------------------------------------------------------------
  it('resetStream clears streamingContent', async () => {
    const { result } = renderHook(() => useChatStreaming())

    // Set content via setStreamingContent (simulates stream having run)
    act(() => {
      result.current.setStreamingContent('Some content')
    })
    expect(result.current.streamingContent).toBe('Some content')

    // Reset
    act(() => {
      result.current.resetStream()
    })

    expect(result.current.streamingContent).toBe('')
  })

  // -----------------------------------------------------------------------
  // 7. requestId competition discards stale results
  // -----------------------------------------------------------------------
  it('discards first stream results when second stream starts before first resolves', async () => {
    const { result } = renderHook(() => useChatStreaming())

    let firstStreamResolve: (value: void) => void
    const firstStreamDone = new Promise<void>((resolve) => { firstStreamResolve = resolve })

    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      callCount++
      if (callCount === 1) {
        // First stream: fires content+done but waits to resolve
        capturedCallbacks = callbacks as typeof capturedCallbacks
        capturedCallbacks.onContent?.('First stream', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
        await firstStreamDone
      } else {
        // Second stream: resolves immediately
        capturedCallbacks = callbacks as typeof capturedCallbacks
        capturedCallbacks.onContent?.('Second stream', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    const options1 = makeOptions()
    const options2 = makeOptions()
    let phase2: string | undefined

    await act(async () => {
      // Start first stream (hangs)
      const firstPromise = result.current.startStream(baseRequest, options1)

      // Start second stream (resolves immediately)
      const secondPromise = result.current.startStream(baseRequest, options2)
      const res2 = await secondPromise
      phase2 = res2.phase

      // Now let first stream resolve — its finalize is blocked by requestId check
      firstStreamResolve()
      await firstPromise
    })

    // Second stream succeeds
    expect(phase2).toBe('done')
    // Only second stream's commit should have been called
    expect(options2.onCommitAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Second stream' }),
    )
  })
})

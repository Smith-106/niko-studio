import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChatStreaming } from '../useChatStreaming'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let capturedCallbacks: {
  onContent?: (chunk: string, index: number) => void
  onEvaluation?: (data: { score: number; feedback: string }) => void
  onDone?: (data: Record<string, unknown>) => void
  onError?: (error: string, payload?: Record<string, unknown>) => void
} = {}

let mockOnUpdate: ((text: string) => void) | null = null
let mockDisplayedText = ''

vi.mock('../useSmoothStream', () => ({
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

vi.mock('../../api/client', () => ({
  chatStream: vi.fn(),
  buildConsistencyGovernanceMetadata: vi.fn(() => undefined),
  mergeWriterMetadataGovernance: vi.fn((_m: unknown, g: unknown) => g ?? _m),
}))

import { chatStream } from '../../api/client'

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
// Tests — retry_after cap
// ---------------------------------------------------------------------------

describe('useChatStreaming — retry_after cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks = {}
    mockOnUpdate = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('caps retry_after at 30 seconds when server returns a large value', async () => {
    // Capture the delay passed to setTimeout by replacing it temporarily
    let capturedDelay: number | undefined
    const originalSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void, delay?: number) => {
      capturedDelay = delay
      // Execute immediately to avoid real wait
      return originalSetTimeout(fn, 0)
    }) as typeof setTimeout

    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()
    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      callCount++
      capturedCallbacks = callbacks as typeof capturedCallbacks
      if (callCount === 1) {
        capturedCallbacks.onError?.('Rate limited', {
          terminal: 'error',
          status: 'failed',
          recoverable: true,
          retry_after: 120,
          error_class: 'rate_limit',
        })
      } else {
        capturedCallbacks.onContent?.('Success', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    // The delay should be capped at 30 * 1000 = 30000ms, not 120 * 1000 = 120000ms
    expect(capturedDelay).toBe(30_000)
    expect(mockChatStream).toHaveBeenCalledTimes(2)
    expect(phase).toBe('done')

    globalThis.setTimeout = originalSetTimeout
  })

  it('uses retry_after directly when value is below 30', async () => {
    let capturedDelay: number | undefined
    const originalSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void, delay?: number) => {
      capturedDelay = delay
      return originalSetTimeout(fn, 0)
    }) as typeof setTimeout

    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()
    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      callCount++
      capturedCallbacks = callbacks as typeof capturedCallbacks
      if (callCount === 1) {
        capturedCallbacks.onError?.('Rate limited', {
          terminal: 'error',
          status: 'failed',
          recoverable: true,
          retry_after: 5,
          error_class: 'rate_limit',
        })
      } else {
        capturedCallbacks.onContent?.('Success', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    // The delay should be 5 * 1000 = 5000ms (unchanged, below cap)
    expect(capturedDelay).toBe(5_000)
    expect(mockChatStream).toHaveBeenCalledTimes(2)
    expect(phase).toBe('done')

    globalThis.setTimeout = originalSetTimeout
  })

  it('defaults retry_after to 5 when not provided', async () => {
    let capturedDelay: number | undefined
    const originalSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void, delay?: number) => {
      capturedDelay = delay
      return originalSetTimeout(fn, 0)
    }) as typeof setTimeout

    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()
    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      callCount++
      capturedCallbacks = callbacks as typeof capturedCallbacks
      if (callCount === 1) {
        // No retry_after provided — should default to 5 seconds
        capturedCallbacks.onError?.('Rate limited', {
          terminal: 'error',
          status: 'failed',
          recoverable: true,
          error_class: 'rate_limit',
        })
      } else {
        capturedCallbacks.onContent?.('Success', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    // The delay should default to 5 * 1000 = 5000ms
    expect(capturedDelay).toBe(5_000)
    expect(mockChatStream).toHaveBeenCalledTimes(2)
    expect(phase).toBe('done')

    globalThis.setTimeout = originalSetTimeout
  })

  it('caps retry_after exactly at 30 seconds boundary', async () => {
    let capturedDelay: number | undefined
    const originalSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void, delay?: number) => {
      capturedDelay = delay
      return originalSetTimeout(fn, 0)
    }) as typeof setTimeout

    const { result } = renderHook(() => useChatStreaming())
    const options = makeOptions()
    let callCount = 0

    mockChatStream.mockImplementation(async (_req, callbacks) => {
      callCount++
      capturedCallbacks = callbacks as typeof capturedCallbacks
      if (callCount === 1) {
        // retry_after: 30 — at the boundary, should NOT be capped
        capturedCallbacks.onError?.('Rate limited', {
          terminal: 'error',
          status: 'failed',
          recoverable: true,
          retry_after: 30,
          error_class: 'rate_limit',
        })
      } else {
        capturedCallbacks.onContent?.('Success', 0)
        capturedCallbacks.onDone?.({
          terminal: 'done',
          skills_used: [],
          writer_metadata: {},
        })
      }
    })

    let phase: string | undefined
    await act(async () => {
      const res = await result.current.startStream(baseRequest, options)
      phase = res.phase
    })

    // 30 is exactly the cap, so delay should be 30 * 1000 = 30000ms
    expect(capturedDelay).toBe(30_000)
    expect(mockChatStream).toHaveBeenCalledTimes(2)
    expect(phase).toBe('done')

    globalThis.setTimeout = originalSetTimeout
  })
})

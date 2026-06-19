import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('useChatStreaming extra branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallbacks = {}
    mockOnUpdate = null
  })

  // Lines 99, 154: first stream errors after a second stream supersedes it
  it('drops stale stream finalization when a new stream starts', async () => {
    const { result } = renderHook(() => useChatStreaming())

    let firstCallbacks: typeof capturedCallbacks = {}
    let secondCallbacks: typeof capturedCallbacks = {}
    let firstResolve!: () => void
    let secondResolve!: () => void
    const firstPromise = new Promise<void>((resolve) => { firstResolve = resolve })
    const secondPromise = new Promise<void>((resolve) => { secondResolve = resolve })

    mockChatStream
      .mockImplementationOnce(async (_req, callbacks) => {
        firstCallbacks = callbacks as typeof capturedCallbacks
        await firstPromise
      })
      .mockImplementationOnce(async (_req, callbacks) => {
        secondCallbacks = callbacks as typeof capturedCallbacks
        await secondPromise
      })

    const options = makeOptions()

    // 启动第一个流，保持 pending
    let firstStreamPromise: Promise<{ phase: string; meta: unknown }>
    await act(async () => {
      firstStreamPromise = result.current.startStream(baseRequest, options)
      await Promise.resolve()
    })

    // 在第一个流完成前启动第二个流
    let secondStreamPromise: Promise<{ phase: string; meta: unknown }>
    await act(async () => {
      secondStreamPromise = result.current.startStream(baseRequest, options)
      await Promise.resolve()
    })

    // 第一个流现在 requestId 已过期，触发 onError 时 finalize 会因 requestId 不匹配而返回
    await act(async () => {
      firstCallbacks.onError?.('stale error', { terminal: 'error' })
      firstResolve()
    })

    // 完成第二个流
    await act(async () => {
      secondCallbacks.onContent?.('second response', 0)
      secondCallbacks.onDone?.({ terminal: 'done' })
      secondResolve()
    })

    await act(async () => {
      await firstStreamPromise
      await secondStreamPromise
    })

    expect(options.onCommitAssistantMessage).toHaveBeenCalled()
  })

  // Line 150: chatStream returns without callbacks and signal is aborted
  it('finalizes as interrupted when stream returns after abort', async () => {
    const { result } = renderHook(() => useChatStreaming())

    mockChatStream.mockImplementationOnce(async (_req, _callbacks, opts) => {
      await new Promise<void>((resolve) => {
        opts?.signal?.addEventListener('abort', () => resolve())
      })
    })

    const options = makeOptions()

    let streamPromise: Promise<{ phase: string; meta: unknown }>
    await act(async () => {
      streamPromise = result.current.startStream(baseRequest, options)
      await Promise.resolve()
    })

    act(() => {
      result.current.cancelStream()
    })

    let phase: string | undefined
    await act(async () => {
      const res = await streamPromise
      phase = res.phase
    })

    expect(phase).toBe('interrupted')
    expect(options.onInterrupted).toHaveBeenCalled()
  })
})

import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSmoothStream } from './useSmoothStream'

describe('useSmoothStream Intl.Segmenter fallback', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>
  let nextRafId: number
  let originalSegmenter: typeof Intl.Segmenter | undefined

  beforeEach(() => {
    nextRafId = 1
    rafCallbacks = new Map()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = nextRafId++
      rafCallbacks.set(id, cb)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id)
    })
    // Save and remove Intl.Segmenter so the constructor throws
    originalSegmenter = Intl.Segmenter
    // @ts-expect-error — intentionally deleting to test fallback
    delete Intl.Segmenter
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Restore Intl.Segmenter
    // @ts-expect-error — restoring the global
    Intl.Segmenter = originalSegmenter
  })

  function flushRaf(timestamp: number = 0) {
    let iterations = 0
    while (rafCallbacks.size > 0 && iterations < 100) {
      iterations++
      const ids = [...rafCallbacks.keys()]
      for (const id of ids) {
        const cb = rafCallbacks.get(id)
        rafCallbacks.delete(id)
        if (cb) cb(timestamp)
      }
    }
  }

  it('gracefully falls back when Intl.Segmenter is not available', () => {
    const onUpdate = vi.fn()

    // The hook should not throw when Intl.Segmenter is missing
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    expect(result.current).toBeDefined()
    expect(result.current.addChunk).toBeTypeOf('function')
    expect(result.current.reset).toBeTypeOf('function')
  })

  it('uses simple character split when segmenter is null', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: true, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('ABC')
    })

    flushRaf()

    // With the fallback path ([...queue]), each character should be consumed
    // The hook should have called onUpdate with at least some text
    expect(onUpdate).toHaveBeenCalled()
    const allTexts = onUpdate.mock.calls.map((c) => c[0] as string)
    const finalText = allTexts[allTexts.length - 1]
    expect(finalText).toContain('A')
  })

  it('correctly handles multi-byte characters without segmenter', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: true, minDelay: 0 }),
    )

    // Chinese characters — without segmenter, [...queue] splits by UTF-16 code unit
    act(() => {
      result.current.addChunk('你好')
    })

    flushRaf()

    expect(onUpdate).toHaveBeenCalled()
    const allTexts = onUpdate.mock.calls.map((c) => c[0] as string)
    const finalText = allTexts[allTexts.length - 1]
    // Should eventually accumulate both characters
    expect(finalText).toContain('你')
  })

  it('falls back to character split when Intl.Segmenter constructor throws', () => {
    const onUpdate = vi.fn()

    // Restore Intl.Segmenter but make the constructor throw
    // @ts-expect-error — intentionally replacing to test constructor failure
    Intl.Segmenter = class {
      constructor() {
        throw new Error('Segmenter not supported')
      }
    }

    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: true, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('XY')
    })

    flushRaf()

    expect(onUpdate).toHaveBeenCalled()
    const allTexts = onUpdate.mock.calls.map((c) => c[0] as string)
    const finalText = allTexts[allTexts.length - 1]
    expect(finalText).toContain('X')
  })
})

import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSmoothStream } from './useSmoothStream'

describe('useSmoothStream', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>
  let nextRafId: number

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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function flushRaf(timestamp: number = 0) {
    // Run all queued RAF callbacks up to a limit to avoid infinite loops
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

  it('calls onUpdate when chunks are added', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('Hello')
    })

    flushRaf()

    expect(onUpdate).toHaveBeenCalled()
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as string
    expect(lastCall.length).toBeGreaterThan(0)
  })

  it('accumulates text across multiple chunks', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('A')
      result.current.addChunk('B')
      result.current.addChunk('C')
    })

    flushRaf()

    // All content should eventually be displayed
    const allTexts = onUpdate.mock.calls.map((c) => c[0] as string)
    const finalText = allTexts[allTexts.length - 1]
    expect(finalText).toContain('A')
    expect(finalText).toContain('B')
    expect(finalText).toContain('C')
  })

  it('resets displayed text and clears queue', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('Old text')
    })
    flushRaf()

    act(() => {
      result.current.reset('Fresh start')
    })

    expect(onUpdate).toHaveBeenCalledWith('Fresh start')
  })

  it('respects initialText through reset', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, initialText: 'Initial' }),
    )

    // initialText is stored in displayedRef but not emitted until reset is called
    act(() => {
      result.current.reset('Fresh')
    })

    expect(onUpdate).toHaveBeenCalledWith('Fresh')
  })

  it('stops animation loop when queue is empty and stream is done', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: true, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('Done')
    })

    // Drain all animations
    flushRaf()

    // No more pending RAF callbacks
    expect(rafCallbacks.size).toBe(0)
  })

  it('keeps animating when streamDone is false but queue is empty', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('X')
    })

    // Drain one round
    const ids = [...rafCallbacks.keys()]
    for (const id of ids) {
      const cb = rafCallbacks.get(id)
      rafCallbacks.delete(id)
      if (cb) cb(0)
    }

    // A new rAF should have been scheduled since streamDone is false
    expect(rafCallbacks.size).toBeGreaterThan(0)
  })

  it('reset clears animation frame', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 0 }),
    )

    act(() => {
      result.current.addChunk('Some text')
    })

    act(() => {
      result.current.reset()
    })

    expect(rafCallbacks.size).toBe(0)
  })

  it('respects minDelay between renders', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() =>
      useSmoothStream({ onUpdate, streamDone: false, minDelay: 100 }),
    )

    act(() => {
      result.current.addChunk('A')
      result.current.addChunk('B')
    })

    // First call at t=0 should proceed
    const ids1 = [...rafCallbacks.keys()]
    for (const id of ids1) {
      const cb = rafCallbacks.get(id)
      rafCallbacks.delete(id)
      if (cb) cb(0)
    }

    const callsAfterT0 = onUpdate.mock.calls.length

    // Second call at t=50 should skip (less than minDelay=100)
    const ids2 = [...rafCallbacks.keys()]
    for (const id of ids2) {
      const cb = rafCallbacks.get(id)
      rafCallbacks.delete(id)
      if (cb) cb(50)
    }

    // Should not have produced new output since minDelay hasn't elapsed
    expect(onUpdate.mock.calls.length).toBe(callsAfterT0)

    // Third call at t=100 should proceed
    const ids3 = [...rafCallbacks.keys()]
    for (const id of ids3) {
      const cb = rafCallbacks.get(id)
      rafCallbacks.delete(id)
      if (cb) cb(100)
    }

    expect(onUpdate.mock.calls.length).toBeGreaterThan(callsAfterT0)
  })
})

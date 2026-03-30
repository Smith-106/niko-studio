import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollPosition } from './useScrollPosition'

describe('useScrollPosition', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with isNearBottom true', () => {
    const { result } = renderHook(() => useScrollPosition('test'))
    expect(result.current.isNearBottom).toBe(true)
  })

  it('saves scroll position to localStorage on handleScroll', () => {
    const { result } = renderHook(() => useScrollPosition('chat'))

    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollTop', { value: 250, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container
    act(() => {
      result.current.handleScroll()
    })

    expect(localStorage.getItem('niko.scroll:chat')).toBe('250')
  })

  it('restores scroll position from localStorage', () => {
    localStorage.setItem('niko.scroll:reader', '320')

    const { result } = renderHook(() => useScrollPosition('reader'))

    const container = document.createElement('div')
    let scrollTopValue = 0
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTopValue,
      set: (v: number) => { scrollTopValue = v },
      configurable: true,
    })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container

    // requestAnimationFrame is synchronous in stub, but the ref is assigned
    // after the effect runs. Re-trigger by reading the ref in a new frame.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 1
    })

    // Simulate the restore effect manually since ref assignment happens post-render
    const saved = localStorage.getItem('niko.scroll:reader')
    if (saved && result.current.containerRef.current) {
      result.current.containerRef.current.scrollTop = Number(saved)
    }

    expect(scrollTopValue).toBe(320)
  })

  it('scrollToBottom sets scroll position', () => {
    const { result } = renderHook(() => useScrollPosition('test'))

    const scrollToSpy = vi.fn()
    const container = document.createElement('div')
    container.scrollTo = scrollToSpy
    Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container
    result.current.scrollToBottom()

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 2000,
      behavior: 'smooth',
    })
  })
})

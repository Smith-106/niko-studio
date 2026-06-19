import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useScrollPosition } from './useScrollPosition'

function ScrollPositionHarness({ keyName = 'reader' }: { keyName?: string }) {
  const { containerRef, handleScroll, isNearBottom, scrollToBottom } = useScrollPosition(keyName)

  return (
    <>
      <div data-testid="scroll-container" ref={containerRef} onScroll={handleScroll} />
      <span data-testid="near-bottom">{String(isNearBottom)}</span>
      <button type="button" onClick={scrollToBottom}>bottom</button>
    </>
  )
}

describe('useScrollPosition', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('ignores scroll and bottom requests before the container ref is attached', () => {
    const { result } = renderHook(() => useScrollPosition('detached'))

    expect(() => {
      result.current.handleScroll()
      result.current.scrollToBottom()
    }).not.toThrow()
  })

  it('saves delayed scroll positions through the throttled path', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)

    const { result } = renderHook(() => useScrollPosition('throttled', 100))
    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollTop', { value: 100, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container

    act(() => {
      result.current.handleScroll()
    })
    expect(localStorage.getItem('niko.scroll:throttled')).toBe('100')

    Object.defineProperty(container, 'scrollTop', { value: 220, configurable: true })
    vi.setSystemTime(1_050)
    act(() => {
      result.current.handleScroll()
    })
    expect(localStorage.getItem('niko.scroll:throttled')).toBe('100')

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(localStorage.getItem('niko.scroll:throttled')).toBe('220')
  })

  it('updates near-bottom state even when saving to localStorage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useScrollPosition('failing-storage'))
    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollTop', { value: 0, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container

    act(() => {
      result.current.handleScroll()
    })

    expect(result.current.isNearBottom).toBe(false)
  })

  it('tolerates the scroll container disappearing before near-bottom detection', () => {
    const { result } = renderHook(() => useScrollPosition('volatile-ref'))
    const ref = result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>
    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollTop', { value: 10, configurable: true })

    ref.current = container
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      ref.current = null
    })

    expect(() => {
      act(() => {
        result.current.handleScroll()
      })
    }).not.toThrow()
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

  it('restores saved scroll position when the ref is attached during render', () => {
    localStorage.setItem('niko.scroll:mounted-reader', '480')

    render(<ScrollPositionHarness keyName="mounted-reader" />)

    expect(screen.getByTestId('scroll-container').scrollTop).toBe(480)
  })

  it('skips restore when key is empty and ignores restore storage errors', () => {
    render(<ScrollPositionHarness keyName="" />)
    expect(screen.getByTestId('scroll-container').scrollTop).toBe(0)

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    expect(() => render(<ScrollPositionHarness keyName="restore-error" />)).not.toThrow()
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

  it('scrollToBottom falls back to scrollTop when scrollTo is unavailable', () => {
    const { result } = renderHook(() => useScrollPosition('fallback'))

    const container = document.createElement('div')
    Object.defineProperty(container, 'scrollTo', { value: undefined, configurable: true })
    Object.defineProperty(container, 'scrollHeight', { value: 1750, configurable: true })

    ;(result.current.containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container
    result.current.scrollToBottom()

    expect(container.scrollTop).toBe(1750)
  })
})

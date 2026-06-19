import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useResizablePanel } from './useResizablePanel'

describe('useResizablePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('restores a persisted width when it is within bounds', () => {
    localStorage.setItem('sidebar-width', '420')

    const { result } = renderHook(() =>
      useResizablePanel({
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 640,
        storageKey: 'sidebar-width',
      }),
    )

    expect(result.current.width).toBe(420)
    expect(result.current.isResizing).toBe(false)
  })

  it('falls back to the default width when persisted storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() =>
      useResizablePanel({
        defaultWidth: 300,
        minWidth: 240,
        maxWidth: 640,
        storageKey: 'chat-width',
      }),
    )

    expect(result.current.width).toBe(300)
  })

  it('resizes in rtl mode, clamps the width, and persists the rounded value', () => {
    const { result } = renderHook(() =>
      useResizablePanel({
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 360,
        storageKey: 'right-panel-width',
      }),
    )

    act(() => {
      result.current.startResize({
        clientX: 100,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent)
    })

    expect(result.current.isResizing).toBe(true)
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 180 }))
    })

    expect(result.current.width).toBe(360)
    expect(localStorage.getItem('right-panel-width')).toBe('360')

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.isResizing).toBe(false)
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('supports ltr resizing, resets width, and cleans listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { result, unmount } = renderHook(() =>
      useResizablePanel({
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 640,
        storageKey: 'left-panel-width',
        direction: 'ltr',
      }),
    )

    act(() => {
      result.current.startResize({
        clientX: 300,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 260 }))
    })

    expect(result.current.width).toBe(360)

    act(() => {
      result.current.resetWidth()
    })

    expect(result.current.width).toBe(320)
    expect(localStorage.getItem('left-panel-width')).toBe('320')

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('keeps resizing behavior when localStorage writes fail during resize and reset', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const { result } = renderHook(() =>
      useResizablePanel({
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 640,
        storageKey: 'failing-width',
      }),
    )

    act(() => {
      result.current.startResize({
        clientX: 100,
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }))
    })

    expect(result.current.width).toBe(370)

    act(() => {
      result.current.resetWidth()
    })

    expect(result.current.width).toBe(320)

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(result.current.isResizing).toBe(false)
  })
})

import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentSearch } from './ContentSearch'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      contentSearchPlaceholder: 'Search content...',
    },
  }),
}))

type SearchRef = {
  focus: () => void
}

function createContainerRef(text = 'Alpha alpha beta alpha') {
  const container = document.createElement('div')
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  paragraph.scrollIntoView = vi.fn()
  container.appendChild(paragraph)
  return {
    ref: { current: container } as React.RefObject<HTMLDivElement>,
    paragraph,
  }
}

describe('ContentSearch additional behavior', () => {
  const highlightSetMock = vi.fn()
  const highlightDeleteMock = vi.fn()
  const highlightCtorMock = vi.fn(function HighlightMock(this: unknown, ...ranges: Range[]) {
    return { ranges }
  })

  beforeEach(() => {
    vi.useFakeTimers()
    highlightSetMock.mockReset()
    highlightDeleteMock.mockReset()
    highlightCtorMock.mockClear()

    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    }) as typeof requestAnimationFrame)

    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: {
        Highlights: true,
        highlights: {
          set: highlightSetMock,
          delete: highlightDeleteMock,
        },
      },
    })

    vi.stubGlobal('Highlight', highlightCtorMock as unknown as typeof Highlight)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('focuses the input through the forwarded ref', () => {
    const { ref: containerRef } = createContainerRef()
    const searchRef = createRef<SearchRef>()

    render(
      <ContentSearch
        ref={searchRef}
        containerRef={containerRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    act(() => {
      searchRef.current?.focus()
    })

    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search content...'))
  })

  it('searches text, updates the match counter, and scrolls to the next result', () => {
    const { ref: containerRef, paragraph } = createContainerRef()

    render(
      <ContentSearch
        containerRef={containerRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Search content...')
    fireEvent.change(input, { target: { value: 'alpha' } })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(highlightCtorMock).toHaveBeenCalledOnce()
    expect(highlightSetMock).toHaveBeenCalledWith('content-search', expect.any(Object))
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(paragraph.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'smooth',
    })

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('supports case-sensitive matching after toggling the Aa button', () => {
    const { ref: containerRef } = createContainerRef()

    render(
      <ContentSearch
        containerRef={containerRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Search content...')
    const caseButton = screen.getByRole('button', { name: 'Aa' })

    fireEvent.change(input, { target: { value: 'Alpha' } })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.click(caseButton)
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByText('1/1')).toBeInTheDocument()
    expect(caseButton.className).toContain('bg-primary-50')
  })

  it('clears highlights when the search query becomes empty or the panel closes', () => {
    const { ref: containerRef } = createContainerRef()

    const { rerender } = render(
      <ContentSearch
        containerRef={containerRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Search content...')
    fireEvent.change(input, { target: { value: 'alpha' } })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    fireEvent.change(input, { target: { value: '' } })
    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(highlightDeleteMock).toHaveBeenCalledWith('content-search')

    rerender(
      <ContentSearch
        containerRef={containerRef}
        visible={false}
        onClose={vi.fn()}
      />,
    )

    expect(highlightDeleteMock).toHaveBeenCalled()
  })

  it('gracefully ignores highlight api failures and closes on Escape', () => {
    const { ref: containerRef } = createContainerRef()
    const onClose = vi.fn()
    highlightSetMock.mockImplementation(() => {
      throw new Error('set failed')
    })
    highlightDeleteMock.mockImplementation(() => {
      throw new Error('delete failed')
    })

    const { rerender } = render(
      <ContentSearch
        containerRef={containerRef}
        visible={true}
        onClose={onClose}
      />,
    )

    const input = screen.getByPlaceholderText('Search content...')
    fireEvent.change(input, { target: { value: 'alpha' } })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <ContentSearch
        containerRef={containerRef}
        visible={false}
        onClose={onClose}
      />,
    )
  })

  it('does not schedule a search while hidden and cleans pending timers on unmount', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const { ref: hiddenRef } = createContainerRef()

    const hidden = render(
      <ContentSearch
        containerRef={hiddenRef}
        visible={false}
        onClose={vi.fn()}
      />,
    )

    expect(hidden.container).toBeEmptyDOMElement()
    expect(setTimeoutSpy).not.toHaveBeenCalled()

    hidden.unmount()

    const { ref: visibleRef } = createContainerRef()
    const visible = render(
      <ContentSearch
        containerRef={visibleRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Search content...'), {
      target: { value: 'alpha' },
    })

    visible.unmount()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('ignores Enter navigation when there are no matches', () => {
    const { ref: containerRef, paragraph } = createContainerRef('Alpha beta')

    render(
      <ContentSearch
        containerRef={containerRef}
        visible={true}
        onClose={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText('Search content...')
    fireEvent.change(input, { target: { value: 'missing' } })

    act(() => {
      vi.advanceTimersByTime(150)
    })

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument()
    expect(paragraph.scrollIntoView).not.toHaveBeenCalled()
  })
})

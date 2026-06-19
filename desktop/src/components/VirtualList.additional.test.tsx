import { createRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { useVirtualizerMock } = vi.hoisted(() => ({
  useVirtualizerMock: vi.fn(),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: useVirtualizerMock,
}))

import { VirtualList } from './VirtualList'

describe('VirtualList additional coverage', () => {
  beforeEach(() => {
    useVirtualizerMock.mockReset()
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders virtualized rows and uses the external container ref when virtualization is enabled', async () => {
    const scrollToIndex = vi.fn()
    const measureElement = vi.fn()
    let capturedOptions: {
      enabled: boolean
      overscan: number
      getScrollElement: () => HTMLDivElement | null
    } | null = null

    useVirtualizerMock.mockImplementation((options) => {
      capturedOptions = options
      return {
        getVirtualItems: () => [
          { key: 'row-1', start: 12, index: 1 },
        ],
        getTotalSize: () => 120,
        measureElement,
        scrollToIndex,
      }
    })

    const externalRef = createRef<HTMLDivElement>()

    const { container } = render(
      <VirtualList
        items={['alpha', 'beta', 'gamma']}
        estimateSize={() => 40}
        stickToBottom
        containerRef={externalRef}
        className="virtual-list"
        style={{ height: 120 }}
      >
        {(item, index) => <span>{`${index}:${item}`}</span>}
      </VirtualList>,
    )

    await waitFor(() => {
      expect(scrollToIndex).toHaveBeenCalledWith(2, { align: 'end', behavior: 'smooth' })
    })

    expect(capturedOptions?.enabled).toBe(true)
    expect(capturedOptions?.overscan).toBe(5)
    expect(capturedOptions?.getScrollElement()).toBe(externalRef.current)

    const outer = container.firstElementChild as HTMLElement
    const inner = outer.firstElementChild as HTMLElement
    const row = screen.getByText('1:beta').parentElement as HTMLElement

    expect(outer).toHaveClass('virtual-list')
    expect(outer).toHaveStyle({ height: '120px', overflow: 'auto' })
    expect(inner).toHaveStyle({ height: '120px', width: '100%', position: 'relative' })
    expect(row).toHaveAttribute('data-index', '1')
    expect(row.style.transform).toBe('translateY(12px)')
    expect(measureElement).toHaveBeenCalled()
  })

  it('falls back to direct rendering when the virtualizer returns no rows outside jsdom detection', async () => {
    useVirtualizerMock.mockImplementation(() => ({
      getVirtualItems: () => [],
      getTotalSize: () => 0,
      measureElement: vi.fn(),
      scrollToIndex: vi.fn(),
    }))

    render(
      <VirtualList items={['alpha', 'beta']} estimateSize={() => 24}>
        {(item) => <span>{item}</span>}
      </VirtualList>,
    )

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeInTheDocument()
      expect(screen.getByText('beta')).toBeInTheDocument()
    })
  })
})

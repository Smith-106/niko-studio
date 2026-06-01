import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VirtualList } from '../VirtualList'

describe('VirtualList', () => {
  const items = ['alpha', 'beta', 'gamma']
  const estimateSize = () => 40

  it('renders items via fallback in JSDOM', () => {
    render(
      <VirtualList items={items} estimateSize={estimateSize}>
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.getByText('gamma')).toBeInTheDocument()
  })

  it('passes className and style to container', () => {
    const { container } = render(
      <VirtualList
        items={items}
        estimateSize={estimateSize}
        className="custom-list"
        style={{ height: 500 }}
      >
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveClass('custom-list')
    expect(wrapper).toHaveStyle({ height: '500px', overflow: 'auto' })
  })

  it('calls onScroll handler', () => {
    const onScroll = vi.fn()
    const { container } = render(
      <VirtualList items={items} estimateSize={estimateSize} onScroll={onScroll}>
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    fireEvent.scroll(container.firstElementChild!)
    expect(onScroll).toHaveBeenCalled()
  })

  it('renders empty list without errors', () => {
    const { container } = render(
      <VirtualList items={[]} estimateSize={estimateSize}>
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toBeInTheDocument()
    // No item content rendered for empty list
    expect(wrapper.textContent).toBe('')
  })

  it('uses index as key in fallback mode (JSDOM environment)', () => {
    const { container } = render(
      <VirtualList items={items} estimateSize={estimateSize}>
        {(item) => <span data-testid={`item-${item}`}>{item}</span>}
      </VirtualList>
    )

    // In JSDOM, fallback mode is used, which renders items with index-based keys
    // The inner wrapper divs use key={index}
    const wrapper = container.firstElementChild!
    const itemWrappers = wrapper.querySelectorAll(':scope > div')
    expect(itemWrappers).toHaveLength(3)
  })

  it('fallback mode activates when virtualizer produces zero items', () => {
    // This test verifies the fallback mechanism triggers correctly
    // In JSDOM, the virtualizer returns 0 items due to 0 scroll dimensions
    const { container, rerender } = render(
      <VirtualList items={items} estimateSize={estimateSize}>
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    // All items should be rendered (fallback mode)
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('beta')).toBeInTheDocument()
    expect(screen.getByText('gamma')).toBeInTheDocument()

    // Rerender with more items - fallback should still work
    const moreItems = [...items, 'delta', 'epsilon']
    rerender(
      <VirtualList items={moreItems} estimateSize={estimateSize}>
        {(item) => <span>{item}</span>}
      </VirtualList>
    )

    expect(screen.getByText('delta')).toBeInTheDocument()
    expect(screen.getByText('epsilon')).toBeInTheDocument()
  })

  it('renders children function with correct item and index', () => {
    const renderFn = vi.fn((item, index) => <span>{item}</span>)
    render(
      <VirtualList items={items} estimateSize={estimateSize}>
        {renderFn}
      </VirtualList>
    )

    // In fallback mode, renderFn is called for each item with correct arguments
    expect(renderFn).toHaveBeenCalledTimes(3)
    expect(renderFn).toHaveBeenCalledWith('alpha', 0)
    expect(renderFn).toHaveBeenCalledWith('beta', 1)
    expect(renderFn).toHaveBeenCalledWith('gamma', 2)
  })
})

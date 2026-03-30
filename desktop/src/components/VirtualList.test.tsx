import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { VirtualList } from './VirtualList'

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
})

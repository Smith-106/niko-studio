import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccordionWrapper } from './AccordionWrapper'

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span data-testid="chevron">▼</span>,
}))

const items = [
  { id: 'a', header: <span>Item A</span>, content: <span>Content A</span> },
  { id: 'b', header: <span>Item B</span>, content: <span>Content B</span> },
]

describe('AccordionWrapper', () => {
  it('renders all headers', () => {
    render(<AccordionWrapper items={items} mode="single" />)
    expect(screen.getByText('Item A')).toBeTruthy()
    expect(screen.getByText('Item B')).toBeTruthy()
  })

  it('expands item on click in single mode', () => {
    render(<AccordionWrapper items={items} mode="single" />)
    fireEvent.click(screen.getByText('Item A'))
    expect(screen.getByText('Content A')).toBeTruthy()
  })

  it('collapses same item on second click in single mode', () => {
    render(<AccordionWrapper items={items} mode="single" />)
    const btn = screen.getByText('Item A').closest('button')!
    fireEvent.click(btn)
    fireEvent.click(btn)
    const contentEl = screen.getByText('Content A').closest('div')
    expect(['0', '0px']).toContain(contentEl?.parentElement?.style.maxHeight)
  })

  it('allows multiple expansions in multi mode', () => {
    render(<AccordionWrapper items={items} mode="multi" />)
    fireEvent.click(screen.getByText('Item A'))
    fireEvent.click(screen.getByText('Item B'))
    expect(screen.getByText('Content A')).toBeTruthy()
    expect(screen.getByText('Content B')).toBeTruthy()
  })

  it('removes an expanded item when clicking it again in multi mode', () => {
    render(<AccordionWrapper items={items} mode="multi" />)
    const button = screen.getByText('Item A').closest('button')!

    fireEvent.click(button)
    fireEvent.click(button)

    const region = document.getElementById('accordion-content-a')
    expect(['0', '0px']).toContain(region?.style.maxHeight)
  })

  it('renders empty list without errors', () => {
    const { container } = render(<AccordionWrapper items={[]} mode="single" />)
    expect(container.innerHTML).toContain('space-y-2')
  })
})

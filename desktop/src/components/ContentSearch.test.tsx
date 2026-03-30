import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContentSearch } from './ContentSearch'

function createContainerRef() {
  const el = document.createElement('div')
  return { current: el } as React.RefObject<HTMLDivElement>
}

describe('ContentSearch', () => {
  const defaultProps = {
    containerRef: createContainerRef(),
    visible: true,
    onClose: vi.fn(),
  }

  it('returns null when not visible', () => {
    const { container } = render(
      <ContentSearch {...defaultProps} visible={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when visible', () => {
    render(<ContentSearch {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索内容...')
    expect(input).toBeInTheDocument()
  })

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn()
    render(<ContentSearch {...defaultProps} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText('搜索内容...'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<ContentSearch {...defaultProps} onClose={onClose} />)
    // Close button is the second button (first is "Aa", second is X)
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find((btn) => btn.textContent !== 'Aa')!
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('toggles case sensitivity on Aa button click', () => {
    render(<ContentSearch {...defaultProps} />)
    const aaButton = screen.getByText('Aa')

    // Initially off: should not have the active class
    expect(aaButton.className).not.toContain('bg-primary-50')

    // Click once: activate
    fireEvent.click(aaButton)
    expect(aaButton.className).toContain('bg-primary-50')

    // Click again: deactivate
    fireEvent.click(aaButton)
    expect(aaButton.className).not.toContain('bg-primary-50')
  })
})

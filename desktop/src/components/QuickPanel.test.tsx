import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QuickPanel, type QuickPanelItem } from './QuickPanel'

const mockItems: QuickPanelItem[] = [
  { id: 'new-doc', label: 'New Document', keywords: ['file', 'create'], action: vi.fn() },
  { id: 'settings', label: 'Settings', action: vi.fn() },
  { id: 'search', label: 'Search Content', description: 'Find text in project', action: vi.fn() },
]

const defaultProps = {
  items: mockItems,
  visible: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
}

describe('QuickPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when not visible', () => {
    const { container } = render(<QuickPanel {...defaultProps} visible={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders search input when visible', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')
    expect(input).toBeInTheDocument()
  })

  it('renders all items when no search query', () => {
    render(<QuickPanel {...defaultProps} />)
    expect(screen.getByText('New Document')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Search Content')).toBeInTheDocument()
  })

  it('renders item description when present', () => {
    render(<QuickPanel {...defaultProps} />)
    expect(screen.getByText('Find text in project')).toBeInTheDocument()
  })

  it('calls onSelect when item is clicked', () => {
    render(<QuickPanel {...defaultProps} />)
    fireEvent.click(screen.getByText('Settings'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings' }),
    )
  })

  it('calls onSelect on Enter key', () => {
    render(<QuickPanel {...defaultProps} />)
    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-doc' }),
    )
  })

  it('calls onClose on Escape key', () => {
    render(<QuickPanel {...defaultProps} />)
    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('filters items by search text', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')
    fireEvent.change(input, { target: { value: 'settings' } })
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('New Document')).not.toBeInTheDocument()
    expect(screen.queryByText('Search Content')).not.toBeInTheDocument()
  })

  it('filters items by keyword match', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')
    fireEvent.change(input, { target: { value: 'file' } })
    expect(screen.getByText('New Document')).toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('shows no-match message when no items match', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')
    fireEvent.change(input, { target: { value: 'zzz-nonexistent' } })
    expect(screen.getByText('无匹配命令')).toBeInTheDocument()
  })

  it('navigates with ArrowDown and ArrowUp keys', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')

    // ArrowDown moves selection from index 0 to 1
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings' }),
    )

    vi.clearAllMocks()

    // ArrowUp from index 1 goes to index 0 (wraps around)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-doc' }),
    )
  })

  it('highlights item on mouse enter', () => {
    render(<QuickPanel {...defaultProps} />)
    const item = screen.getByText('Settings').closest('div[style]')
    expect(item).toBeTruthy()
    fireEvent.mouseEnter(item!)
    // ArrowDown now should move to next (index 2) since we're on Settings (index 1)
    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByPlaceholderText('搜索命令...'), { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'search' }),
    )
  })

  it('renders hint text in the footer', () => {
    render(<QuickPanel {...defaultProps} />)
    expect(screen.getByText('↑↓ 选择')).toBeInTheDocument()
    expect(screen.getByText('↵ 确认')).toBeInTheDocument()
    expect(screen.getByText('ESC 关闭')).toBeInTheDocument()
  })
})

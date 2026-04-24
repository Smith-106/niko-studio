import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('exposes dialog, combobox, and listbox semantics', () => {
    render(<QuickPanel {...defaultProps} />)

    expect(screen.getByRole('dialog', { name: '快捷命令面板' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('combobox', { name: '搜索命令...' })).toHaveAttribute('aria-controls')
    expect(screen.getByRole('listbox', { name: '命令结果' })).toBeInTheDocument()
  })

  it('marks the first result as selected by default and updates selection on hover', () => {
    render(<QuickPanel {...defaultProps} />)

    const input = screen.getByRole('combobox', { name: '搜索命令...' })
    const firstOption = screen.getByRole('option', { name: 'New Document' })
    const hoveredOption = screen.getByRole('option', { name: 'Search Content Find text in project' })

    expect(input).toHaveAttribute('aria-activedescendant', firstOption.id)
    expect(firstOption).toHaveAttribute('aria-selected', 'true')
    expect(hoveredOption).toHaveAttribute('aria-selected', 'false')

    fireEvent.mouseEnter(hoveredOption)

    expect(input).toHaveAttribute('aria-activedescendant', hoveredOption.id)
    expect(firstOption).toHaveAttribute('aria-selected', 'false')
    expect(hoveredOption).toHaveAttribute('aria-selected', 'true')
  })

  it('moves focus into the search input on open and restores it on close', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <div>
        <button type="button">Trigger</button>
        <QuickPanel {...defaultProps} visible={false} />
      </div>,
    )

    const trigger = screen.getByRole('button', { name: 'Trigger' })
    await user.click(trigger)
    expect(trigger).toHaveFocus()

    rerender(
      <div>
        <button type="button">Trigger</button>
        <QuickPanel {...defaultProps} visible />
      </div>,
    )

    const input = await screen.findByRole('combobox', { name: '搜索命令...' })
    await waitFor(() => expect(input).toHaveFocus())

    rerender(
      <div>
        <button type="button">Trigger</button>
        <QuickPanel {...defaultProps} visible={false} />
      </div>,
    )

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus()
  })

  it('keeps focus on the search input when Tab is pressed', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByRole('combobox', { name: '搜索命令...' })
    input.focus()

    fireEvent.keyDown(input, { key: 'Tab' })

    expect(input).toHaveFocus()
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

  it('updates aria-activedescendant and selected option during keyboard navigation', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByRole('combobox', { name: '搜索命令...' })

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    const selectedOption = screen.getByRole('option', { name: 'Settings' })
    expect(input).toHaveAttribute('aria-activedescendant', selectedOption.id)
    expect(selectedOption).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(input, { key: 'End' })

    const lastOption = screen.getByRole('option', { name: 'Search Content Find text in project' })
    expect(input).toHaveAttribute('aria-activedescendant', lastOption.id)
    expect(lastOption).toHaveAttribute('aria-selected', 'true')
  })

  it('navigates with ArrowDown and ArrowUp keys', () => {
    render(<QuickPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('搜索命令...')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'settings' }),
    )

    vi.clearAllMocks()

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(defaultProps.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-doc' }),
    )
  })

  it('highlights item on mouse enter', () => {
    render(<QuickPanel {...defaultProps} />)
    const item = screen.getByRole('option', { name: 'Settings' })
    fireEvent.mouseEnter(item)
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


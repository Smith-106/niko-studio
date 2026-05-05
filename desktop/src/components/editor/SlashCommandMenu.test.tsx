import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlashCommandMenu } from './SlashCommandMenu'

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: {
      editorCmdGenerate: 'AI 生成段落',
      editorCmdGenerateDesc: '根据上下文生成一段文本',
      editorCmdContinue: 'AI 续写',
      editorCmdContinueDesc: '从当前位置继续写作',
      editorCmdFullArticle: 'AI 生成文章',
      editorCmdFullArticleDesc: '生成一篇完整文章',
      editorCmdHeading1: '标题 1',
      editorCmdHeading1Desc: '大标题',
      editorCmdHeading2: '标题 2',
      editorCmdHeading2Desc: '中标题',
      editorCmdHeading3: '标题 3',
      editorCmdHeading3Desc: '小标题',
      editorCmdBulletList: '无序列表',
      editorCmdBulletListDesc: '创建无序列表',
      editorCmdOrderedList: '有序列表',
      editorCmdOrderedListDesc: '创建有序列表',
      editorCmdBlockquote: '引用',
      editorCmdBlockquoteDesc: '插入引用块',
      editorCmdCodeBlock: '代码块',
      editorCmdCodeBlockDesc: '插入代码块',
      editorCmdHorizontalRule: '分割线',
      editorCmdHorizontalRuleDesc: '插入水平分割线',
    },
    language: 'zh',
    translate: (key: string) => key,
  }),
}))

const defaultPosition = { x: 100, y: 200 }

describe('SlashCommandMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when position is null', () => {
    const { container } = render(
      <SlashCommandMenu
        query=""
        position={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders all menu items when no query is provided', () => {
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // Should show AI commands and format commands
    expect(screen.getByText('AI 生成段落')).toBeInTheDocument()
    expect(screen.getByText('AI 续写')).toBeInTheDocument()
    expect(screen.getByText('AI 生成文章')).toBeInTheDocument()
    expect(screen.getByText('标题 1')).toBeInTheDocument()
    expect(screen.getByText('标题 2')).toBeInTheDocument()
    expect(screen.getByText('标题 3')).toBeInTheDocument()
    expect(screen.getByText('无序列表')).toBeInTheDocument()
    expect(screen.getByText('有序列表')).toBeInTheDocument()
    expect(screen.getByText('引用')).toBeInTheDocument()
    expect(screen.getByText('代码块')).toBeInTheDocument()
    expect(screen.getByText('分割线')).toBeInTheDocument()
    expect(screen.getByText('表格')).toBeInTheDocument()
    expect(screen.getByText('行内公式')).toBeInTheDocument()
    expect(screen.getByText('块级公式')).toBeInTheDocument()
    expect(screen.getByText('提示块')).toBeInTheDocument()
  })

  it('filters items by query matching label, description, or id', () => {
    render(
      <SlashCommandMenu
        query="heading"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('标题 1')).toBeInTheDocument()
    expect(screen.getByText('标题 2')).toBeInTheDocument()
    expect(screen.getByText('标题 3')).toBeInTheDocument()
    expect(screen.queryByText('AI 生成段落')).not.toBeInTheDocument()
  })

  it('renders nothing when no items match the query', () => {
    const { container } = render(
      <SlashCommandMenu
        query="zzzzz-no-match"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('calls onSelect when a menu item is clicked', () => {
    const onSelect = vi.fn()
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('AI 生成段落'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ai-generate',
        label: 'AI 生成段落',
        type: 'ai',
      }),
    )
  })

  it('highlights the first item by default', () => {
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // The first item (AI generate) should have the selected background
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.className).toContain('bg-primary-50')
    // The second item should not
    expect(buttons[1]?.className).not.toContain('bg-primary-50')
  })

  it('navigates down with ArrowDown key', () => {
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button')
    // Initially first is selected
    expect(buttons[0]?.className).toContain('bg-primary-50')

    fireEvent.keyDown(document, { key: 'ArrowDown' })

    // Second should now be selected
    expect(buttons[1]?.className).toContain('bg-primary-50')
    expect(buttons[0]?.className).not.toContain('bg-primary-50')
  })

  it('wraps around when navigating past the last item', () => {
    render(
      <SlashCommandMenu
        query="heading"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // There are 3 heading items, press down 4 times to wrap
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })

    const buttons = screen.getAllByRole('button')
    // Should wrap back to first
    expect(buttons[0]?.className).toContain('bg-primary-50')
  })

  it('navigates up with ArrowUp key and wraps', () => {
    render(
      <SlashCommandMenu
        query="heading"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button')
    fireEvent.keyDown(document, { key: 'ArrowUp' })

    // Should wrap to last item
    expect(buttons[2]?.className).toContain('bg-primary-50')
  })

  it('selects item with Enter key', () => {
    const onSelect = vi.fn()
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ai-continue' }),
    )
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking outside the menu', () => {
    const onClose = vi.fn()
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <SlashCommandMenu
          query=""
          position={defaultPosition}
          onSelect={vi.fn()}
          onClose={onClose}
        />
      </div>,
    )

    fireEvent.mouseDown(screen.getByTestId('outside'))

    expect(onClose).toHaveBeenCalled()
  })

  it('shows AI badge for AI-type commands', () => {
    render(
      <SlashCommandMenu
        query="generate"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('does not show AI badge for format commands', () => {
    render(
      <SlashCommandMenu
        query="heading"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText('AI')).not.toBeInTheDocument()
  })

  it('resets selection index when filter results change', () => {
    const { rerender } = render(
      <SlashCommandMenu
        query="heading"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // Navigate to the second item
    fireEvent.keyDown(document, { key: 'ArrowDown' })

    // Change the filter so results change
    rerender(
      <SlashCommandMenu
        query="bullet"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // Only one result, should be the first (and only) one selected
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.className).toContain('bg-primary-50')
  })

  it('changes highlighted item on mouse hover', async () => {
    const user = userEvent.setup()
    render(
      <SlashCommandMenu
        query=""
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons[0]?.className).toContain('bg-primary-50')

    await user.hover(buttons[2]!)

    expect(buttons[2]?.className).toContain('bg-primary-50')
    expect(buttons[0]?.className).not.toContain('bg-primary-50')
  })

  it('filters new Phase 2 commands by Chinese labels', () => {
    render(
      <SlashCommandMenu
        query="公式"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('行内公式')).toBeInTheDocument()
    expect(screen.getByText('块级公式')).toBeInTheDocument()
    expect(screen.queryByText('表格')).not.toBeInTheDocument()
  })

  it('selects table command and returns correct item', () => {
    const onSelect = vi.fn()
    render(
      <SlashCommandMenu
        query="表格"
        position={defaultPosition}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('表格'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'table',
        label: '表格',
        type: 'format',
      }),
    )
  })

  it('selects callout command and returns correct item', () => {
    const onSelect = vi.fn()
    render(
      <SlashCommandMenu
        query="提示"
        position={defaultPosition}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('提示块'))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'callout',
        type: 'format',
      }),
    )
  })

  it('filters math commands by id "math"', () => {
    render(
      <SlashCommandMenu
        query="math"
        position={defaultPosition}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('行内公式')).toBeInTheDocument()
    expect(screen.getByText('块级公式')).toBeInTheDocument()
  })
})

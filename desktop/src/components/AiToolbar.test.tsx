import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiToolbar } from './AiToolbar'

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      aiToolWrite: 'Write',
      aiToolRewrite: 'Rewrite',
      aiToolDescribe: 'Describe',
      aiToolBrainstorm: 'Brainstorm',
      sidebarWritingHelper: 'Writing Helper',
      sidebarTextOptimizer: 'Text Optimizer',
    },
    translate: (key: string) => key,
    language: 'zh',
  }),
}))

const defaultProps = {
  onWrite: vi.fn(),
  onRewrite: vi.fn(),
  onDescribe: vi.fn(),
  onBrainstorm: vi.fn(),
  onOpenWritingHelper: vi.fn(),
  onOpenTextOptimizer: vi.fn(),
}

describe('AiToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all primary tool buttons', () => {
    render(<AiToolbar {...defaultProps} />)
    const buttons = screen.getAllByTitle(/Write|Rewrite|Describe|Brainstorm/)
    expect(buttons).toHaveLength(4)
  })

  it('renders all extended tool buttons', () => {
    render(<AiToolbar {...defaultProps} />)
    expect(screen.getByLabelText('Writing Helper')).toBeInTheDocument()
    expect(screen.getByLabelText('Text Optimizer')).toBeInTheDocument()
  })

  it('calls onWrite when Write button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Write'))
    expect(defaultProps.onWrite).toHaveBeenCalledOnce()
  })

  it('calls onRewrite when Rewrite button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Rewrite'))
    expect(defaultProps.onRewrite).toHaveBeenCalledOnce()
  })

  it('calls onDescribe when Describe button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Describe'))
    expect(defaultProps.onDescribe).toHaveBeenCalledOnce()
  })

  it('calls onBrainstorm when Brainstorm button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByTitle('Brainstorm'))
    expect(defaultProps.onBrainstorm).toHaveBeenCalledOnce()
  })

  it('calls onOpenWritingHelper when the helper button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Writing Helper'))
    expect(defaultProps.onOpenWritingHelper).toHaveBeenCalledOnce()
  })

  it('calls onOpenTextOptimizer when the optimizer button is clicked', () => {
    render(<AiToolbar {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Text Optimizer'))
    expect(defaultProps.onOpenTextOptimizer).toHaveBeenCalledOnce()
  })

  it('disables all buttons when disabled prop is true', () => {
    render(<AiToolbar {...defaultProps} disabled={true} />)
    const allButtons = screen.getAllByRole('button')
    allButtons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('enables all buttons when disabled prop is false or omitted', () => {
    render(<AiToolbar {...defaultProps} />)
    const allButtons = screen.getAllByRole('button')
    allButtons.forEach((btn) => {
      expect(btn).not.toBeDisabled()
    })
  })
})

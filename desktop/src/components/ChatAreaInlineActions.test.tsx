import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatAreaInlineActions } from './ChatAreaInlineActions'

const defaultProps = {
  selectedText: 'some selected text',
  inlineAction: null as 'continue' | 'revise' | 'generate' | null,
  selectedTextInfo: 'Selected 18 chars',
  continueLabel: 'Continue',
  reviseLabel: 'Revise',
  generateLabel: 'Generate',
  runLabel: 'Run',
  clearSelectionLabel: 'Clear',
  runDisabled: false,
  onSelectAction: vi.fn(),
  onRun: vi.fn(),
  onClear: vi.fn(),
}

describe('ChatAreaInlineActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders selected text info', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    expect(screen.getByText('Selected 18 chars')).toBeInTheDocument()
  })

  it('renders all action buttons', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('Revise')).toBeInTheDocument()
    expect(screen.getByText('Generate')).toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('calls onSelectAction with continue when Continue is clicked', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    fireEvent.click(screen.getByText('Continue'))
    expect(defaultProps.onSelectAction).toHaveBeenCalledWith('continue')
  })

  it('calls onSelectAction with revise when Revise is clicked', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    fireEvent.click(screen.getByText('Revise'))
    expect(defaultProps.onSelectAction).toHaveBeenCalledWith('revise')
  })

  it('calls onSelectAction with generate when Generate is clicked', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    fireEvent.click(screen.getByText('Generate'))
    expect(defaultProps.onSelectAction).toHaveBeenCalledWith('generate')
  })

  it('calls onRun when Run button is clicked', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    fireEvent.click(screen.getByText('Run'))
    expect(defaultProps.onRun).toHaveBeenCalledOnce()
  })

  it('calls onClear when Clear button is clicked', () => {
    render(<ChatAreaInlineActions {...defaultProps} />)
    fireEvent.click(screen.getByText('Clear'))
    expect(defaultProps.onClear).toHaveBeenCalledOnce()
  })

  it('disables Run button when runDisabled is true', () => {
    render(<ChatAreaInlineActions {...defaultProps} runDisabled={true} />)
    const runButton = screen.getByText('Run')
    expect(runButton).toBeDisabled()
  })

  it('enables Run button when runDisabled is false', () => {
    render(<ChatAreaInlineActions {...defaultProps} runDisabled={false} />)
    const runButton = screen.getByText('Run')
    expect(runButton).not.toBeDisabled()
  })

  it('disables Revise button when selectedText is empty', () => {
    render(<ChatAreaInlineActions {...defaultProps} selectedText="" />)
    const reviseButton = screen.getByText('Revise')
    expect(reviseButton).toBeDisabled()
  })

  it('enables Revise button when selectedText is present', () => {
    render(<ChatAreaInlineActions {...defaultProps} selectedText="text" />)
    const reviseButton = screen.getByText('Revise')
    expect(reviseButton).not.toBeDisabled()
  })

  it('highlights active action with blue styling', () => {
    render(<ChatAreaInlineActions {...defaultProps} inlineAction="continue" />)
    const continueButton = screen.getByText('Continue')
    expect(continueButton.className).toContain('bg-blue-600')
    expect(continueButton.className).toContain('text-white')
  })

  it('shows default styling for inactive actions', () => {
    render(<ChatAreaInlineActions {...defaultProps} inlineAction="continue" />)
    const reviseButton = screen.getByText('Revise')
    expect(reviseButton.className).toContain('bg-gray-200')
  })
})

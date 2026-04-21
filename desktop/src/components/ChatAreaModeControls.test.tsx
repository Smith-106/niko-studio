import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatAreaModeControls } from './ChatAreaModeControls'

const defaultPresets = [
  { id: 'focusWriting' as const, label: 'Focus Writing' },
  { id: 'agentDiagnose' as const, label: 'Agent Diagnose' },
  { id: 'compareReview' as const, label: 'Compare Review' },
]

const defaultProps = {
  modeLabel: 'Mode',
  workflowLabel: 'Workflow',
  modePresetsLabel: 'Presets',
  chatMode: 'chat' as const,
  agentAction: 'write' as const,
  enableModelComparison: false,
  comparisonModel: 'gpt-4',
  comparisonModels: ['gpt-4', 'claude-3', 'gemini-pro'],
  workflowLevel: 'L3' as const,
  chatModeNormalLabel: 'Normal',
  chatModeAgentLabel: 'Agent',
  chatModeComparisonLabel: 'Comparison',
  templateLibraryEntryLabel: 'Templates',
  comparisonModelLabel: 'Comparison Model',
  chatAgentActionWriteLabel: 'Write',
  chatAgentActionReviseLabel: 'Revise',
  chatAgentActionContextLabel: 'Context',
  workflowQuickLabel: 'Quick',
  workflowLiteLabel: 'Lite',
  workflowStandardLabel: 'Standard',
  workflowBrainstormLabel: 'Brainstorm',
  workflowCoordinatorLabel: 'Coordinator',
  showMoreLabel: 'More',
  showLessLabel: 'Less',
  modePresets: defaultPresets,
  onSetChatMode: vi.fn(),
  onToggleModelComparison: vi.fn(),
  onOpenTemplateLibrary: vi.fn(),
  onSetComparisonModel: vi.fn(),
  onSetAgentAction: vi.fn(),
  onSetWorkflowLevel: vi.fn(),
  onApplyPreset: vi.fn(),
}

describe('ChatAreaModeControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the mode label and current mode summary', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('Mode')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
  })

  it('renders mode presets', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('Focus Writing')).toBeInTheDocument()
    expect(screen.getByText('Agent Diagnose')).toBeInTheDocument()
    expect(screen.getByText('Compare Review')).toBeInTheDocument()
  })

  it('calls onApplyPreset when a preset is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('Agent Diagnose'))
    expect(defaultProps.onApplyPreset).toHaveBeenCalledWith('agentDiagnose')
  })

  it('calls onOpenTemplateLibrary when Templates button is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('Templates'))
    expect(defaultProps.onOpenTemplateLibrary).toHaveBeenCalledOnce()
  })

  it('shows More button by default in chat mode without comparison', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('More')).toBeInTheDocument()
    expect(screen.queryByText('Less')).not.toBeInTheDocument()
  })

  it('toggles to Less button when More is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    expect(screen.getByText('Less')).toBeInTheDocument()
    expect(screen.queryByText('More')).not.toBeInTheDocument()
  })

  it('shows advanced panel automatically in agent mode', () => {
    render(<ChatAreaModeControls {...defaultProps} chatMode="agent" />)
    expect(screen.getByText('Less')).toBeInTheDocument()
  })

  it('shows advanced panel automatically when model comparison is enabled', () => {
    render(<ChatAreaModeControls {...defaultProps} enableModelComparison={true} />)
    expect(screen.getByText('Less')).toBeInTheDocument()
  })

  it('renders comparison mode label when model comparison is enabled', () => {
    render(<ChatAreaModeControls {...defaultProps} enableModelComparison={true} />)
    // "Comparison" appears both as summary badge and toggle button
    expect(screen.getAllByText('Comparison').length).toBeGreaterThanOrEqual(2)
  })

  it('renders agent mode summary with action label', () => {
    render(<ChatAreaModeControls {...defaultProps} chatMode="agent" agentAction="revise" />)
    // Summary badge shows "Agent . Revise"
    expect(screen.getByText('Agent \u00b7 Revise')).toBeInTheDocument()
  })

  it('renders Normal and Agent mode buttons when advanced panel is open', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    // Open advanced panel
    fireEvent.click(screen.getByText('More'))
    // Use aria-label to target the mode buttons specifically
    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agent' })).toBeInTheDocument()
  })

  it('calls onSetChatMode when mode button is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    fireEvent.click(screen.getByRole('button', { name: 'Agent' }))
    expect(defaultProps.onSetChatMode).toHaveBeenCalledWith('agent')
  })

  it('renders Comparison toggle button in chat mode with advanced panel open', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    expect(screen.getByRole('button', { name: 'Comparison' })).toBeInTheDocument()
  })

  it('calls onToggleModelComparison when Comparison is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    fireEvent.click(screen.getByRole('button', { name: 'Comparison' }))
    expect(defaultProps.onToggleModelComparison).toHaveBeenCalledOnce()
  })

  it('renders comparison model selector when comparison is enabled', () => {
    render(
      <ChatAreaModeControls {...defaultProps} enableModelComparison={true} chatMode="chat" />,
    )
    const select = screen.getByLabelText('Comparison Model')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('gpt-4')
  })

  it('renders agent action selector in agent mode', () => {
    render(<ChatAreaModeControls {...defaultProps} chatMode="agent" />)
    // The select has aria-label "Agent" which may collide with the button.
    // Use getAllByLabelText and filter for select.
    const allAgent = screen.getAllByLabelText('Agent')
    const select = allAgent.find((el) => el.tagName === 'SELECT')
    expect(select).toBeTruthy()
    expect(select!).toHaveValue('write')
  })

  it('calls onSetAgentAction when agent action is changed', () => {
    render(<ChatAreaModeControls {...defaultProps} chatMode="agent" />)
    const allAgent = screen.getAllByLabelText('Agent')
    const select = allAgent.find((el) => el.tagName === 'SELECT')!
    fireEvent.change(select, { target: { value: 'revise' } })
    expect(defaultProps.onSetAgentAction).toHaveBeenCalledWith('revise')
  })

  it('renders all workflow level buttons in advanced panel', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    expect(screen.getByText('Quick')).toBeInTheDocument()
    expect(screen.getByText('Lite')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Brainstorm')).toBeInTheDocument()
    expect(screen.getByText('Coordinator')).toBeInTheDocument()
  })

  it('calls onSetWorkflowLevel when a workflow level is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByText('More'))
    fireEvent.click(screen.getByText('Quick'))
    expect(defaultProps.onSetWorkflowLevel).toHaveBeenCalledWith('L1')
  })

  it('highlights the current workflow level', () => {
    render(<ChatAreaModeControls {...defaultProps} workflowLevel="L3" />)
    fireEvent.click(screen.getByText('More'))
    const standardButton = screen.getByText('Standard')
    expect(standardButton.className).toContain('bg-primary-600')
  })

  it('renders selectedSkillsLabel when provided', () => {
    render(<ChatAreaModeControls {...defaultProps} selectedSkillsLabel="2 skills selected" />)
    expect(screen.getByText('2 skills selected')).toBeInTheDocument()
  })

  it('does not render selectedSkillsLabel when not provided', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.queryByText('2 skills selected')).not.toBeInTheDocument()
  })

  it('calls onSetComparisonModel when comparison model is changed', () => {
    render(
      <ChatAreaModeControls {...defaultProps} enableModelComparison={true} chatMode="chat" />,
    )
    fireEvent.change(screen.getByLabelText('Comparison Model'), { target: { value: 'claude-3' } })
    expect(defaultProps.onSetComparisonModel).toHaveBeenCalledWith('claude-3')
  })
})

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
  modePresetsLabel: 'Presets',
  availableSkillIds: ['character-forge', 'dialogue-system'],
  selectedSkillIds: [],
  skillPacksLabel: 'Skills',
  chatMode: 'chat' as const,
  agentAction: 'write' as const,
  enableModelComparison: false,
  chatModeNormalLabel: 'Normal',
  chatModeAgentLabel: 'Agent',
  chatModeComparisonLabel: 'Comparison',
  templateLibraryEntryLabel: 'Templates',
  chatAgentActionWriteLabel: 'Write',
  chatAgentActionReviseLabel: 'Revise',
  chatAgentActionContextLabel: 'Context',
  modePresets: defaultPresets,
  onOpenTemplateLibrary: vi.fn(),
  onSetComparisonModel: vi.fn(),
  onSetAgentAction: vi.fn(),
  onApplyPreset: vi.fn(),
  onToggleSkill: vi.fn(),
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

  it('renders comparison mode label when model comparison is enabled', () => {
    render(<ChatAreaModeControls {...defaultProps} enableModelComparison={true} />)
    expect(screen.getByText('Comparison')).toBeInTheDocument()
  })

  it('renders agent mode summary with action label', () => {
    render(<ChatAreaModeControls {...defaultProps} chatMode="agent" agentAction="revise" />)
    // Summary badge shows "Agent . Revise"
    expect(screen.getByText('Agent · Revise')).toBeInTheDocument()
  })

  it('renders primary skill-pack chips when provided', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'character-forge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'dialogue-system' })).toBeInTheDocument()
  })

  it('calls onToggleSkill when a skill-pack chip is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'character-forge' }))
    expect(defaultProps.onToggleSkill).toHaveBeenCalledWith('character-forge')
  })

  it('does not render selectedSkillsLabel when not provided', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.queryByText('2 skills selected')).not.toBeInTheDocument()
  })

  it('renders selected skill label when provided', () => {
    render(<ChatAreaModeControls {...defaultProps} selectedSkillsLabel="2 active" />)
    expect(screen.getByText('2 active')).toBeInTheDocument()
  })

  it('does not render show-more/show-less toggle button', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Less' })).not.toBeInTheDocument()
  })

  it('does not render mode buttons (Normal/Agent)', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    // Normal appears in the mode summary chip, but NOT as a clickable button in an advanced section
    // The only buttons are: template library, presets, skills
    const normalButtons = screen.queryAllByRole('button', { name: 'Normal' })
    expect(normalButtons).toHaveLength(0)
  })

  it('does not render workflow level buttons', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.queryByText('Quick')).not.toBeInTheDocument()
    expect(screen.queryByText('Lite')).not.toBeInTheDocument()
    expect(screen.queryByText('Standard')).not.toBeInTheDocument()
    expect(screen.queryByText('Brainstorm')).not.toBeInTheDocument()
    expect(screen.queryByText('Coordinator')).not.toBeInTheDocument()
  })
})

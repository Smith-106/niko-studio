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

  it('renders the mode summary badge and presets', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Focus Writing')).toBeInTheDocument()
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
    expect(screen.getByText('Agent · Revise')).toBeInTheDocument()
  })

  it('renders collapsible skill-pack section (collapsed by default)', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.getByText('Skills')).toBeInTheDocument()
    // Skill chips are hidden by default
    expect(screen.queryByRole('button', { name: 'character-forge' })).not.toBeInTheDocument()
  })

  it('shows skill-pack chips when skills section is expanded', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    // Click expand button
    const expandButton = screen.getByText('Skills').closest('button')
    if (expandButton) fireEvent.click(expandButton)
    expect(screen.getByRole('button', { name: 'character-forge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'dialogue-system' })).toBeInTheDocument()
  })

  it('calls onToggleSkill when a skill-pack chip is clicked', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    // Expand skills section first
    const expandButton = screen.getByText('Skills').closest('button')
    if (expandButton) fireEvent.click(expandButton)
    fireEvent.click(screen.getByRole('button', { name: 'character-forge' }))
    expect(defaultProps.onToggleSkill).toHaveBeenCalledWith('character-forge')
  })

  it('shows selected skill count badge when skills are selected', () => {
    render(<ChatAreaModeControls {...defaultProps} selectedSkillIds={['character-forge']} />)
    // Badge shows count
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('does not render show-more/show-less toggle button', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Less' })).not.toBeInTheDocument()
  })

  it('does not render mode buttons (Normal/Agent)', () => {
    render(<ChatAreaModeControls {...defaultProps} />)
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

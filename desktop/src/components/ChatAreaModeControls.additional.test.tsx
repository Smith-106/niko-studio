import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ChatAreaModeControls } from './ChatAreaModeControls'

const defaultProps = {
  modeLabel: 'Mode',
  modePresetsLabel: 'Presets',
  availableSkillIds: ['character-forge', 'dialogue-system'],
  selectedSkillIds: [] as string[] | undefined,
  skillPacksLabel: 'Skill Packs',
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
  modePresets: [
    { id: 'focusWriting' as const, label: 'Focus Writing' },
    { id: 'agentDiagnose' as const, label: 'Agent Diagnose' },
  ],
  onOpenTemplateLibrary: vi.fn(),
  onSetComparisonModel: vi.fn(),
  onSetAgentAction: vi.fn(),
  onApplyPreset: vi.fn(),
  onToggleSkill: vi.fn(),
}

describe('ChatAreaModeControls additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides the skill packs section when the supporting props are incomplete', () => {
    render(
      <ChatAreaModeControls
        {...defaultProps}
        selectedSkillsLabel="Selected"
        skillPacksLabel={undefined}
        onToggleSkill={undefined}
      />,
    )

    expect(screen.getByText('Selected')).toBeInTheDocument()
    expect(screen.queryByText('Skill Packs')).not.toBeInTheDocument()
  })

  it('treats missing selectedSkillIds as unselected chips', () => {
    render(
      <ChatAreaModeControls
        {...defaultProps}
        selectedSkillIds={undefined}
      />,
    )

    fireEvent.click(screen.getByText('Skill Packs').closest('button')!)

    expect(screen.getByRole('button', { name: 'character-forge' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'dialogue-system' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders selected skill chips with the selected state styling', () => {
    render(
      <ChatAreaModeControls
        {...defaultProps}
        selectedSkillIds={['character-forge']}
      />,
    )

    fireEvent.click(screen.getByText('Skill Packs').closest('button')!)

    const selectedChip = screen.getByRole('button', { name: 'character-forge' })
    const unselectedChip = screen.getByRole('button', { name: 'dialogue-system' })

    expect(selectedChip).toHaveAttribute('aria-pressed', 'true')
    expect(selectedChip.className).toContain('bg-primary-600')
    expect(unselectedChip).toHaveAttribute('aria-pressed', 'false')
    expect(unselectedChip.className).toContain('bg-gray-50')
  })
})

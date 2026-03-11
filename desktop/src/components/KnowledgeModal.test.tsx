import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeModal } from './KnowledgeModal'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  searchMemory: vi.fn(),
  queryGraph: vi.fn(),
  listSkills: vi.fn(),
  loadSkill: vi.fn(),
  matchSkills: vi.fn(),
  getSkillChain: vi.fn(),
}))

import { listSkills, queryGraph, searchMemory } from '../api/client'

const mockedListSkills = vi.mocked(listSkills)
const mockedQueryGraph = vi.mocked(queryGraph)
const mockedSearchMemory = vi.mocked(searchMemory)
const zh = translations.zh
const en = translations.en

describe('KnowledgeModal accessibility and labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    mockedQueryGraph.mockResolvedValue({ success: true, data: [] } as never)
    mockedSearchMemory.mockResolvedValue({ success: true, data: [] } as never)
    mockedListSkills.mockResolvedValue({
      success: true,
      data: [{ id: 'dialogue-system', name: 'dialogue-system' }],
    } as never)
  })

  it('renders as named dialog and supports escape close', async () => {
    const onClose = vi.fn()
    render(<KnowledgeModal isOpen onClose={onClose} />)

    expect(await screen.findByRole('dialog', { name: zh.knowledgeTitle })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders i18n tab labels and search control', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('button', { name: zh.knowledgeTabCharacters })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabLocations })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabPlots })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTabSkills })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: zh.knowledgeSearchPlaceholder })).toBeInTheDocument()
  })

  it('renders zh-only labels for temporal, character, foreshadow, and memory forms', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByText(zh.knowledgeTemporalTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeTemporalEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeTemporalAtTimePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeTemporalAction })).toBeInTheDocument()

    expect(screen.getByText(zh.knowledgeCharacterTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeCharacterNamePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeCharacterAction })).toBeInTheDocument()

    expect(screen.getByText(zh.knowledgeForeshadowTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeForeshadowStatusPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeForeshadowChapterPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeForeshadowAction })).toBeInTheDocument()

    expect(screen.getAllByText(zh.knowledgeMemoryTitle)).toHaveLength(2)
    expect(screen.getByLabelText(zh.knowledgeMemoryContentPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryLayerPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryDimensionPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(zh.knowledgeMemoryTagsPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.knowledgeMemoryAction })).toBeInTheDocument()
  })

  it('renders en-only labels for temporal, character, foreshadow, and memory forms', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('dialog', { name: en.knowledgeTitle })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeTemporalTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeTemporalEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeTemporalAtTimePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeTemporalAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeCharacterTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeCharacterNamePlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeCharacterAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeForeshadowTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeForeshadowStatusPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeForeshadowChapterPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeForeshadowAction })).toBeInTheDocument()

    expect(screen.getByText(en.knowledgeMemoryTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryContentPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryLayerPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryDimensionPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryEntityPlaceholder)).toBeInTheDocument()
    expect(screen.getByLabelText(en.knowledgeMemoryTagsPlaceholder)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.knowledgeMemoryAction })).toBeInTheDocument()
  })
})


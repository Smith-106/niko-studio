import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeModal } from './KnowledgeModal'
import { translations } from '../i18n'

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

describe('KnowledgeModal accessibility and labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

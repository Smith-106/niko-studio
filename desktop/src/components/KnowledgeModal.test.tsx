import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KnowledgeModal } from './KnowledgeModal'

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

    expect(await screen.findByRole('dialog', { name: '知识库' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders i18n tab labels and search control', async () => {
    render(<KnowledgeModal isOpen onClose={() => {}} />)

    expect(await screen.findByRole('button', { name: '角色' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '地点' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '剧情' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '技能' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '搜索...' })).toBeInTheDocument()
  })
})

import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillTab } from './SkillTab'
import type { KnowledgeItem } from './KnowledgeTypes'
import { useSettingsStore } from '../../stores/settingsStore'

const mockListSkills = vi.fn()
const mockLoadSkill = vi.fn()
const mockMatchSkills = vi.fn()
const mockGetSkillChain = vi.fn()
const mockCreateSkill = vi.fn()
const mockSaveSkill = vi.fn()
const mockDeleteSkill = vi.fn()

vi.mock('../../api/client', () => ({
  listSkills: (...args: unknown[]) => mockListSkills(...args),
  loadSkill: (...args: unknown[]) => mockLoadSkill(...args),
  matchSkills: (...args: unknown[]) => mockMatchSkills(...args),
  getSkillChain: (...args: unknown[]) => mockGetSkillChain(...args),
  createSkill: (...args: unknown[]) => mockCreateSkill(...args),
  saveSkill: (...args: unknown[]) => mockSaveSkill(...args),
  deleteSkill: (...args: unknown[]) => mockDeleteSkill(...args),
}))

const stableT = {
  knowledgeTaskMatch: '任务匹配',
  knowledgeSkillDetails: '技能详情',
  knowledgeSkillChain: '推荐链路',
  knowledgeCurrentSkill: '当前技能：{skillId}',
  knowledgeLoading: '加载中...',
  knowledgeEmpty: '暂无数据',
  knowledgeAddPrefix: '添加',
  knowledgeTabSkills: '技能',
  knowledgeNoDescription: '暂无描述',
  knowledgeSkillDetailsLoadFailed: '加载技能详情失败',
  skillDescCharacterForge: '角色塑造',
  skillDescSuspenseCraft: '悬念张力',
  skillDescDialogueSystem: '对话系统',
  skillDescTensionArc: '张力曲线',
  skillDescEmotionArc: '情感弧光',
  skillDescOpeningCraft: '开篇技巧',
  skillDescEndingCraft: '结尾技巧',
  skillDescConflictEscalation: '冲突升级',
}

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: stableT,
    language: 'zh',
    translate: (key: string, params?: Record<string, string | number>) => {
      let text = stableT[key as keyof typeof stableT] ?? String(key)
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v))
        })
      }
      return text
    },
  }),
}))

function SkillTabHarness(props: { searchQuery?: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSkillId, setSelectedSkillId] = useState('')

  return (
    <SkillTab
      items={items}
      onItemsChange={setItems}
      loading={loading}
      onLoadingChange={setLoading}
      selectedSkillId={selectedSkillId}
      onSelectedSkillIdChange={setSelectedSkillId}
      searchQuery={props.searchQuery ?? ''}
    />
  )
}

describe('SkillTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, language: 'zh' },
    }))

    mockListSkills.mockResolvedValue({
      success: true,
      data: [
        { id: 'skill-1', name: 'Character Forge' },
        { id: 'skill-2', name: 'Suspense Craft' },
        { id: 'skill-3', name: 'Dialogue System' },
      ],
    })
    mockLoadSkill.mockResolvedValue({
      success: true,
      data: { id: 'skill-1', content: 'Create compelling characters with depth.' },
    })
    mockMatchSkills.mockResolvedValue({
      success: true,
      data: [
        { skill_id: 'skill-1', relevance: 0.95 },
        { skill_id: 'skill-2', relevance: 0.72 },
      ],
    })
    mockGetSkillChain.mockResolvedValue({
      success: true,
      data: [
        { skill_id: 'skill-1', step: 1 },
        { skill_id: 'skill-2', step: 2 },
      ],
    })
  })

  it('loads and displays skills from the API on mount', async () => {
    render(<SkillTabHarness />)

    expect(mockListSkills).toHaveBeenCalled()
    expect(await screen.findByText('Character Forge')).toBeInTheDocument()
    expect(screen.getByText('Suspense Craft')).toBeInTheDocument()
    expect(screen.getByText('Dialogue System')).toBeInTheDocument()
  })

  it('falls back to default skills when API fails', async () => {
    mockListSkills.mockResolvedValue({ success: false, data: null })

    render(<SkillTabHarness />)

    expect(await screen.findByText('character-forge')).toBeInTheDocument()
    expect(screen.getByText('suspense-craft')).toBeInTheDocument()
    expect(screen.getByText('dialogue-system')).toBeInTheDocument()
  })

  it('selects a skill when a skill card is clicked', async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))

    await waitFor(() => {
      expect(screen.getByText(/当前技能：skill-1/)).toBeInTheDocument()
    })
  })

  it('disables skill details and chain buttons when no skill is selected', async () => {
    render(<SkillTabHarness />)

    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: 'edit skill' })
      const chainButton = screen.getByRole('button', { name: '推荐链路' })
      expect(editButton).toBeDisabled()
      expect(chainButton).toBeDisabled()
    })
  })

  it('loads and displays skill details when button is clicked', async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))
    await user.click(screen.getByRole('button', { name: 'edit skill' }))

    await waitFor(() => {
      expect(mockLoadSkill).toHaveBeenCalledWith('skill-1')
      expect(screen.getByText('Create compelling characters with depth.')).toBeInTheDocument()
    })
  })

  it('shows error message when skill details loading fails', async () => {
    mockLoadSkill.mockResolvedValue({
      success: false,
      data: null,
    })

    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))
    await user.click(screen.getByRole('button', { name: 'edit skill' }))

    await waitFor(() => {
      expect(mockLoadSkill).toHaveBeenCalledWith('skill-1')
    })
  })

  it('runs task match and displays results', async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByRole('button', { name: '任务匹配' }))

    await waitFor(() => {
      expect(mockMatchSkills).toHaveBeenCalled()
      expect(screen.getByText(/skill-1/)).toBeInTheDocument()
      expect(screen.getByText(/skill-2/)).toBeInTheDocument()
    })
  })

  it('loads skill chain and displays ordered steps', async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))
    await user.click(screen.getByRole('button', { name: '推荐链路' }))

    await waitFor(() => {
      expect(mockGetSkillChain).toHaveBeenCalledWith('skill-1')
      expect(screen.getByText(/Step 1: skill-1/)).toBeInTheDocument()
      expect(screen.getByText(/Step 2: skill-2/)).toBeInTheDocument()
    })
  })

  it('filters skills based on searchQuery', async () => {
    render(<SkillTabHarness searchQuery="Character" />)

    expect(await screen.findByText('Character Forge')).toBeInTheDocument()
    expect(screen.queryByText('Suspense Craft')).not.toBeInTheDocument()
    expect(screen.queryByText('Dialogue System')).not.toBeInTheDocument()
  })

  it('shows empty state with add button when no skills match filter', async () => {
    render(<SkillTabHarness searchQuery="NonexistentSkill" />)

    await waitFor(() => {
      expect(screen.getByText('暂无数据')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /添加技能/ })).toBeInTheDocument()
  })
})

describe('SkillTab CRUD operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, language: 'zh' },
    }))

    mockListSkills.mockResolvedValue({
      success: true,
      data: [
        { id: 'skill-1', name: 'Character Forge' },
        { id: 'skill-2', name: 'Suspense Craft' },
      ],
    })
    mockLoadSkill.mockResolvedValue({
      success: true,
      data: { id: 'skill-1', content: 'Original content.' },
    })
    mockCreateSkill.mockResolvedValue({ success: true, data: { id: 'new-skill' } })
    mockSaveSkill.mockResolvedValue({ success: true, data: { success: true } })
    mockDeleteSkill.mockResolvedValue({ success: true, data: { success: true } })
  })

  it('creates a new skill', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await screen.findByText('Character Forge')

    await user.click(screen.getByRole('button', { name: 'create skill' }))
    const nameInput = screen.getByPlaceholderText('Skill name...')
    await user.type(nameInput, 'New Skill')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockCreateSkill).toHaveBeenCalledWith('New Skill', expect.stringContaining('New Skill'))
    })
  })

  it('edits skill content and saves', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))
    await user.click(screen.getByRole('button', { name: 'edit skill' }))

    await waitFor(() => {
      expect(mockLoadSkill).toHaveBeenCalledWith('skill-1')
    })

    const textarea = screen.getByDisplayValue('Original content.')
    await user.clear(textarea)
    await user.type(textarea, 'Updated content.')

    await user.click(screen.getByRole('button', { name: 'save skill' }))

    await waitFor(() => {
      expect(mockSaveSkill).toHaveBeenCalledWith('skill-1', 'Updated content.')
    })
  })

  it('deletes skill with two-click confirmation', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    await user.click(await screen.findByText('Character Forge'))

    const deleteButton = screen.getByRole('button', { name: 'delete skill' })
    await user.click(deleteButton)

    expect(screen.getByRole('button', { name: 'confirm delete' })).toBeInTheDocument()
    expect(mockDeleteSkill).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'confirm delete' }))

    await waitFor(() => {
      expect(mockDeleteSkill).toHaveBeenCalledWith('skill-1')
    })
  })

  it('cancels delete by selecting different skill', { timeout: 15_000 }, async () => {
    const user = userEvent.setup()
    render(<SkillTabHarness />)

    const forge = await screen.findByText('Character Forge')
    await user.click(forge)
    await user.click(screen.getByRole('button', { name: 'delete skill' }))

    expect(screen.getByRole('button', { name: 'confirm delete' })).toBeInTheDocument()

    const craft = await screen.findByText('Suspense Craft')
    fireEvent.click(craft)

    expect(screen.queryByRole('button', { name: 'confirm delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'delete skill' })).toBeInTheDocument()
    expect(mockDeleteSkill).not.toHaveBeenCalled()
  })
})

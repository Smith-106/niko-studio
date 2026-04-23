import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryForm } from './MemoryForm'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'

const mockGetTemporalFacts = vi.fn()
const mockGetCharacter = vi.fn()
const mockGetForeshadows = vi.fn()
const mockAddMemory = vi.fn()

vi.mock('../../api/client', () => ({
  getTemporalFacts: (...args: unknown[]) => mockGetTemporalFacts(...args),
  getCharacter: (...args: unknown[]) => mockGetCharacter(...args),
  getForeshadows: (...args: unknown[]) => mockGetForeshadows(...args),
  addMemory: (...args: unknown[]) => mockAddMemory(...args),
}))

vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: {
      knowledgeTemporalTitle: '时间事实',
      knowledgeTemporalEntityPlaceholder: '实体ID',
      knowledgeTemporalAtTimePlaceholder: '时间点（可选，ISO 时间）',
      knowledgeTemporalAction: '查询时间事实',
      knowledgeTemporalEntityRequired: '请输入时间事实查询的实体ID。',
      knowledgeTemporalLoaded: '时间事实查询完成。',
      knowledgeCharacterTitle: '角色详情',
      knowledgeCharacterNamePlaceholder: '角色名',
      knowledgeCharacterAction: '查询角色详情',
      knowledgeCharacterNameRequired: '请输入角色名。',
      knowledgeCharacterLoaded: '角色详情加载完成。',
      knowledgeForeshadowTitle: '伏笔筛选',
      knowledgeForeshadowStatusPlaceholder: '状态',
      knowledgeForeshadowStatusPending: '待处理',
      knowledgeForeshadowStatusResolved: '已解决',
      knowledgeForeshadowStatusAll: '全部',
      knowledgeForeshadowChapterPlaceholder: '章节',
      knowledgeForeshadowAction: '查询伏笔',
      knowledgeForeshadowsLoaded: '伏笔查询完成。',
      knowledgeMemoryTitle: '添加记忆',
      knowledgeMemoryContentPlaceholder: '记忆内容',
      knowledgeMemoryLayerPlaceholder: '会话',
      knowledgeMemoryDimensionPlaceholder: '上下文',
      knowledgeMemoryEntityPlaceholder: '实体ID（可选）',
      knowledgeMemoryTagsPlaceholder: '标签（英文逗号分隔）',
      knowledgeMemoryAction: '添加记忆',
      knowledgeMemoryContentRequired: '请输入记忆内容。',
      knowledgeMemoryAdded: '记忆添加成功。',
      knowledgeRequestFailed: '请求失败，请稍后重试。',
      knowledgeNoDescription: '暂无描述',
    },
    language: 'zh',
    translate: (key: string) => key,
  }),
}))

function MemoryFormHarness() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [status, setStatus] = useState<OperationStatus | null>(null)

  return (
    <>
      {status && <div data-testid="status">{status.message}</div>}
      {items.length > 0 && (
        <div data-testid="items-count">{items.length}</div>
      )}
      <MemoryForm onStatusChange={setStatus} onItemsChange={setItems} />
    </>
  )
}

describe('MemoryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, language: 'zh' },
    }))
    useAppStore.setState({
      backendStatus: false,
      currentWorkspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'default-project',
          projectId: 'default-project',
          projectName: 'Test',
          workspaceRoot: '/tmp/test',
        },
        knowledge: { focusEntityId: '', graphEntityIds: [], memoryEntryIds: [] },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: null,
          chapterTitle: null,
          chapterNumber: null,
        },
        storyBible: {
          storyBibleId: null,
          draftId: null,
          version: null,
          storage: 'workspace',
        },
        workflow: {
          sessionId: null,
          planId: null,
          level: 'L3',
        },
        chat: {
          conversationId: null,
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    })
    mockGetTemporalFacts.mockResolvedValue({
      success: true,
      data: [{ id: 'fact-1', content: 'Fact content A' }],
    })
    mockGetCharacter.mockResolvedValue({
      success: true,
      data: {
        name: 'Alice',
        role: 'Protagonist',
        relationships: { Bob: 'Friend' },
      },
    })
    mockGetForeshadows.mockResolvedValue({
      success: true,
      data: [{ id: 'fs-1', description: 'Hidden clue', status: 'pending' }],
    })
    mockAddMemory.mockResolvedValue({
      success: true,
      data: { id: 'mem-1', status: 'created' },
    })
  })

  it('renders all four form sections', () => {
    render(<MemoryFormHarness />)

    expect(screen.getByText('时间事实')).toBeInTheDocument()
    expect(screen.getByText('角色详情')).toBeInTheDocument()
    expect(screen.getByText('伏笔筛选')).toBeInTheDocument()
    // '添加记忆' appears both as section title and as button
    expect(screen.getAllByText('添加记忆').length).toBeGreaterThanOrEqual(2)
  })

  it('queries temporal facts with valid entity ID', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.type(screen.getByLabelText('实体ID'), 'hero-1')
    await user.click(screen.getByRole('button', { name: '查询时间事实' }))

    await waitFor(() => {
      expect(mockGetTemporalFacts).toHaveBeenCalledWith('hero-1', undefined, expect.any(Object))
    })

    expect(await screen.findByText('时间事实查询完成。')).toBeInTheDocument()
    expect(screen.getByTestId('items-count').textContent).toBe('1')
  })

  it('shows error when temporal facts query has empty entity ID', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.click(screen.getByRole('button', { name: '查询时间事实' }))

    expect(await screen.findByText('请输入时间事实查询的实体ID。')).toBeInTheDocument()
    expect(mockGetTemporalFacts).not.toHaveBeenCalled()
  })

  it('queries temporal facts with an optional time value', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.type(screen.getByLabelText('实体ID'), 'hero-2')
    await user.type(screen.getByLabelText('时间点（可选，ISO 时间）'), '2025-01-01')
    await user.click(screen.getByRole('button', { name: '查询时间事实' }))

    await waitFor(() => {
      expect(mockGetTemporalFacts).toHaveBeenCalledWith('hero-2', '2025-01-01', expect.any(Object))
    })
  })

  it('loads character details and converts relationships to text', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.type(screen.getByLabelText('角色名'), 'Alice')
    await user.click(screen.getByRole('button', { name: '查询角色详情' }))

    await waitFor(() => {
      expect(mockGetCharacter).toHaveBeenCalledWith('Alice', true, expect.any(Object))
    })

    expect(await screen.findByText('角色详情加载完成。')).toBeInTheDocument()
    expect(screen.getByTestId('items-count').textContent).toBe('1')
  })

  it('shows error when character name is empty', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.click(screen.getByRole('button', { name: '查询角色详情' }))

    expect(await screen.findByText('请输入角色名。')).toBeInTheDocument()
    expect(mockGetCharacter).not.toHaveBeenCalled()
  })

  it('queries foreshadows with selected status and chapter', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.selectOptions(screen.getByLabelText('状态'), 'pending')
    await user.type(screen.getByLabelText('章节'), '3')
    await user.click(screen.getByRole('button', { name: '查询伏笔' }))

    await waitFor(() => {
      expect(mockGetForeshadows).toHaveBeenCalledWith('pending', 3, expect.any(Object))
    })

    expect(await screen.findByText('伏笔查询完成。')).toBeInTheDocument()
  })

  it('adds memory with content and optional fields', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.type(screen.getByLabelText('记忆内容'), 'Character is brave')
    await user.type(screen.getByLabelText('标签（英文逗号分隔）'), 'trait, plot')

    await user.click(screen.getByRole('button', { name: '添加记忆' }))

    await waitFor(() => {
      expect(mockAddMemory).toHaveBeenCalledWith(
        'Character is brave',
        expect.objectContaining({
          layer: 'session',
          dimension: 'context',
          tags: ['trait', 'plot'],
          use_focus_entity: false,
        }),
      )
    })

    expect(await screen.findByText('记忆添加成功。')).toBeInTheDocument()
  })

  it('shows error when memory content is empty', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.click(screen.getByRole('button', { name: '添加记忆' }))

    expect(await screen.findByText('请输入记忆内容。')).toBeInTheDocument()
    expect(mockAddMemory).not.toHaveBeenCalled()
  })

  it('clears memory content input after successful addition', async () => {
    const user = userEvent.setup()
    render(<MemoryFormHarness />)

    await user.type(screen.getByLabelText('记忆内容'), 'Will be cleared')
    await user.click(screen.getByRole('button', { name: '添加记忆' }))

    await waitFor(() => {
      expect(screen.getByText('记忆添加成功。')).toBeInTheDocument()
    })

    expect((screen.getByLabelText('记忆内容') as HTMLInputElement).value).toBe('')
  })

  it('shows the focus entity button when focusEntityId is set', async () => {
    useAppStore.setState((state) => ({
      ...state,
      currentWorkspace: {
        ...state.currentWorkspace,
        knowledge: {
          ...state.currentWorkspace.knowledge,
          focusEntityId: 'entity-42',
        },
      },
    }))

    render(<MemoryFormHarness />)

    const focusButton = screen.getByText('entity-42')
    expect(focusButton).toBeInTheDocument()
  })
})

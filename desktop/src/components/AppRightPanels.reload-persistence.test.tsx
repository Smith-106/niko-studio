import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { resetMockAppStore, useAppStoreMock } = vi.hoisted(() => {
  const createMockWorkspace = () => ({
    workflow: {
      level: 'L3',
      planId: '',
      sessionId: null,
    },
    chat: {
      conversationId: null,
    },
  })

  const state: {
    currentConversationId: string | null
    currentWorkspace: ReturnType<typeof createMockWorkspace>
    conversationsById: Record<string, { workspace?: ReturnType<typeof createMockWorkspace> }>
    addMessage: ReturnType<typeof vi.fn>
    setCurrentWorkspace: ReturnType<typeof vi.fn>
    syncConversationWorkspace: ReturnType<typeof vi.fn>
  } = {
    currentConversationId: null,
    currentWorkspace: createMockWorkspace(),
    conversationsById: {},
    addMessage: vi.fn(),
    setCurrentWorkspace: vi.fn(),
    syncConversationWorkspace: vi.fn(),
  }

  const mergeWorkspacePatch = (
    currentWorkspace: ReturnType<typeof createMockWorkspace>,
    workspacePatch: Record<string, unknown>,
  ) => ({
    ...currentWorkspace,
    ...workspacePatch,
    workflow: {
      ...currentWorkspace.workflow,
      ...(workspacePatch.workflow as Record<string, unknown> | undefined),
    },
    chat: {
      ...currentWorkspace.chat,
      ...(workspacePatch.chat as Record<string, unknown> | undefined),
    },
  })

  const resetMockAppStore = () => {
    state.currentConversationId = null
    state.currentWorkspace = createMockWorkspace()
    state.conversationsById = {}
    state.addMessage = vi.fn()
    state.setCurrentWorkspace = vi.fn((workspacePatch: Record<string, unknown>) => {
      state.currentWorkspace = mergeWorkspacePatch(state.currentWorkspace, workspacePatch)
    })
    state.syncConversationWorkspace = vi.fn((conversationId: string, workspacePatch: Record<string, unknown>) => {
      const currentConversation = state.conversationsById[conversationId]
      state.conversationsById[conversationId] = {
        ...currentConversation,
        workspace: mergeWorkspacePatch(
          currentConversation?.workspace ?? createMockWorkspace(),
          workspacePatch,
        ),
      }
    })
  }

  resetMockAppStore()

  const useAppStoreMock = Object.assign(
    <T,>(selector?: (storeState: typeof state) => T) => (
      selector ? selector(state) : (state as T)
    ),
    {
      getState: () => state,
      setState: (
        partial:
          | Partial<typeof state>
          | ((currentState: typeof state) => Partial<typeof state>),
      ) => {
        Object.assign(state, typeof partial === 'function' ? partial(state) : partial)
      },
    },
  )

  return {
    resetMockAppStore,
    useAppStoreMock,
  }
})

vi.mock('@/types/settingsOwnership', () => ({
  PERSISTED_SETTINGS_KEYS: [],
}))

vi.mock('../api/client', () => ({
  evaluateContent: vi.fn(),
  getImprovementSuggestions: vi.fn(),
  novelQualityCheck: vi.fn(),
  createCheckpoint: vi.fn(),
  listCheckpoints: vi.fn(),
  restoreCheckpoint: vi.fn(),
  applyRecommendation: vi.fn(),
  undoRecommendation: vi.fn(),
  batchApplyRecommendations: vi.fn(),
  routeWorkflow: vi.fn(),
  createPlan: vi.fn(),
  executePlan: vi.fn(),
  workflowLifecycle: vi.fn(),
  processWritingHelper: vi.fn(),
  polishContent: vi.fn(),
}))

vi.mock('../api/writing', () => ({
  processWritingHelper: vi.fn(),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(),
}))

vi.mock('./SettingsModal', () => ({
  SettingsModal: () => null,
}))

vi.mock('./KnowledgeModal', () => ({
  KnowledgeModal: () => null,
}))

vi.mock('./AutomationPanel', () => ({
  AutomationPanel: () => null,
}))

vi.mock('./McpStatusPanel', () => ({
  McpStatusPanel: () => null,
}))

vi.mock('./AiTextOptimizer', () => ({
  AiTextOptimizer: () => null,
}))

vi.mock('./EvaluationPanel', () => ({
  EvaluationPanel: ({
    onOpenWritingHelper,
  }: {
    onOpenWritingHelper: (handoff: {
      content: string
      guidance: string
      mode: 'rewrite'
      maxSentences: number
      maxItems: number
      handoff: {
        source: 'evaluation'
        suggestionTitle: string
        suggestionReason: string
        guidance: string
        carriedContent: 'revision-preview'
        preset: {
          mode: 'rewrite'
          maxSentences: number
          maxItems: number
        }
      }
    }) => void
  }) => (
    <div>
      <div>{translations.zh.evaluationSuggestions}</div>
      <button type="button">生成修改预览</button>
      <div>交给写作助手的预览稿。</div>
      <button
        type="button"
        onClick={() => onOpenWritingHelper({
          content: '交给写作助手的预览稿。',
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
          handoff: {
            source: 'evaluation',
            suggestionTitle: '增加冲突',
            suggestionReason: '提升张力',
            guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
            carriedContent: 'revision-preview',
            preset: {
              mode: 'rewrite',
              maxSentences: 4,
              maxItems: 6,
            },
          },
        })}
      >
        带着修改预览继续到写作助手
      </button>
    </div>
  ),
}))

import { evaluateContent, getImprovementSuggestions, listCheckpoints } from '../api/client'
import { processWritingHelper } from '../api/writing'
import { useAppUiPersistence } from '../hooks/useAppUiPersistence'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { getEditorHandle } from '../utils/editorHandle'
import { AppRightPanels } from './AppRightPanels'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedGetImprovementSuggestions = vi.mocked(getImprovementSuggestions)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedProcessWritingHelper = vi.mocked(processWritingHelper)
const mockedGetEditorHandle = vi.mocked(getEditorHandle)
const zh = translations.zh

function PersistedAppRightPanelsHarness() {
  const uiPersistence = useAppUiPersistence()

  return (
    <AppRightPanels
      activeRightPanel={uiPersistence.activeRightPanel}
      settingsOpen={false}
      evaluationSources={[
        {
          kind: 'latestAssistantReply',
          label: '最近一次助手回复',
          content: '测试内容',
        },
      ]}
      writingHelperDraft={uiPersistence.writingHelperDraft}
      closeRightPanel={() => uiPersistence.setActiveRightPanel('none')}
      closeSettings={() => {}}
      openDetailedDiagnostics={() => {}}
      openSettingsFromWritingHelper={() => {}}
      openSettingsFromTextOptimizer={() => {}}
      openSettingsFromAutomation={() => {}}
      onOpenAutomationFromEvaluation={() => {}}
      onOpenWritingHelperFromEvaluation={(handoff) => {
        uiPersistence.setWritingHelperDraft({
          content: handoff.content,
          mode: handoff.mode,
          maxSentences: handoff.maxSentences,
          maxItems: handoff.maxItems,
          guidance: handoff.guidance,
          handoff: handoff.handoff,
        })
        uiPersistence.setActiveRightPanel('writingHelper')
      }}
      setWritingHelperDraft={uiPersistence.setWritingHelperDraft}
      clearWritingHelperDraft={uiPersistence.clearWritingHelperDraft}
    />
  )
}

describe('AppRightPanels persisted evaluation handoff reload', () => {
  beforeEach(() => {
    resetMockAppStore()
    localStorage.clear()
    localStorage.setItem('niko.active-right-panel-v1', 'evaluation')
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()

    mockedGetEditorHandle.mockReturnValue(null)
    mockedEvaluateContent.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 72,
        lock_score: 24,
        style_score: 24,
        logic_score: 24,
        actionable_feedback: '补强冲突推进',
        suggestions: [
          { id: 'rec-01', title: '增加冲突', reason: '提升张力', action: 'apply' },
        ],
      },
    })
    mockedGetImprovementSuggestions.mockResolvedValue({
      success: true,
      data: [],
    })
    mockedListCheckpoints.mockResolvedValue({
      success: true,
      data: [],
    })
    mockedProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '交给写作助手的预览稿。',
      },
    })
  })

  it('survives remount with the persisted revision-preview handoff intact', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PersistedAppRightPanelsHarness />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '生成修改预览' }))
    await screen.findByText('交给写作助手的预览稿。')
    await user.click(screen.getByRole('button', { name: '带着修改预览继续到写作助手' }))

    expect(await screen.findByRole('dialog', { name: zh.writingHelperTitle })).toBeInTheDocument()
    expect(screen.getByLabelText(zh.writingHelperInputText)).toHaveValue('交给写作助手的预览稿。')
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('原因：提升张力')).toBeInTheDocument()
    expect(screen.getByText('携带：修改预览')).toBeInTheDocument()
    expect(screen.getByText('推荐：4 句')).toBeInTheDocument()

    await waitFor(() => {
      expect(localStorage.getItem('niko.active-right-panel-v1')).toBe('writingHelper')
    })
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('niko.writing-helper-draft-v1') ?? 'null')).toMatchObject({
        content: '交给写作助手的预览稿。',
        guidance: expect.stringContaining('优先处理这条评估建议：增加冲突'),
        handoff: {
          source: 'evaluation',
          suggestionTitle: '增加冲突',
          suggestionReason: '提升张力',
          guidance: expect.stringContaining('优先处理这条评估建议：增加冲突'),
          carriedContent: 'revision-preview',
          preset: {
            mode: 'rewrite',
            maxSentences: 4,
            maxItems: 6,
          },
        },
      })
    })

    unmount()
    render(<PersistedAppRightPanelsHarness />)

    expect(await screen.findByRole('dialog', { name: zh.writingHelperTitle })).toBeInTheDocument()
    expect(screen.getByLabelText(zh.writingHelperInputText)).toHaveValue('交给写作助手的预览稿。')
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('原因：提升张力')).toBeInTheDocument()
    expect(screen.getByText('携带：修改预览')).toBeInTheDocument()
    expect(screen.getByText('推荐：4 句')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    expect(screen.getByText(/优先处理这条评估建议：增加冲突/)).toBeInTheDocument()
  })
})

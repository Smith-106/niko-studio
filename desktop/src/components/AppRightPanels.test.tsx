import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('./McpStatusPanel', () => ({
  McpStatusPanel: () => null,
}))

vi.mock('./EvaluationPanel', () => ({
  EvaluationPanel: ({
    onOpenAutomation,
    onOpenWritingHelper,
  }: {
    onOpenAutomation: () => void
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
      <div>写作助手预设：改写 · 4 句 · 6 条</div>
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
      <button type="button">更多工具</button>
      <button type="button" onClick={onOpenAutomation}>
        打开自动化任务面板
      </button>
    </div>
  ),
}))
vi.mock('./AutomationPanel', () => ({
  AutomationPanel: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <button data-testid="automation-open-settings" onClick={onOpenSettings}>
      automation-open-settings
    </button>
  ),
}))

vi.mock('./AiTextOptimizer', () => ({
  AiTextOptimizer: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <button data-testid="text-optimizer-open-settings" onClick={onOpenSettings}>
      text-optimizer-open-settings
    </button>
  ),
}))

import { evaluateContent, getImprovementSuggestions, listCheckpoints } from '../api/client'
import { processWritingHelper } from '../api/writing'
import { translations } from '../i18n'
import type { RightPanelType, WritingHelperDraftState } from '../hooks/useAppUiPersistence'
import type { EvaluationSourceDescriptor } from '../stores/selectors'
import { useSettingsStore } from '../stores/settingsStore'
import { getEditorHandle } from '../utils/editorHandle'
import { AppRightPanels } from './AppRightPanels'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedGetImprovementSuggestions = vi.mocked(getImprovementSuggestions)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedProcessWritingHelper = vi.mocked(processWritingHelper)
const mockedGetEditorHandle = vi.mocked(getEditorHandle)
const zh = translations.zh

const defaultDraft: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
  guidance: '',
  handoff: null,
}

const defaultEvaluationSources: EvaluationSourceDescriptor[] = [
  {
    kind: 'latestAssistantReply',
    label: '最近一次助手回复',
    content: '测试内容',
  },
]

function AppRightPanelsHarness() {
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>('evaluation')
  const [draft, setDraft] = useState<WritingHelperDraftState>(defaultDraft)

  return (
    <AppRightPanels
      activeRightPanel={activeRightPanel}
      settingsOpen={false}
      evaluationSources={defaultEvaluationSources}
      writingHelperDraft={draft}
      closeRightPanel={() => setActiveRightPanel('none')}
      closeSettings={() => {}}
      openDetailedDiagnostics={() => {}}
      openSettingsFromWritingHelper={() => {}}
      openSettingsFromTextOptimizer={() => {}}
      openSettingsFromAutomation={() => {}}
      onOpenAutomationFromEvaluation={() => setActiveRightPanel('automation')}
      onOpenWritingHelperFromEvaluation={(handoff) => {
        setDraft({
          ...draft,
          ...handoff,
          handoff: handoff.handoff,
        })
        setActiveRightPanel('writingHelper')
      }}
      setWritingHelperDraft={setDraft}
      clearWritingHelperDraft={() => setDraft(defaultDraft)}
    />
  )
}

describe('AppRightPanels writer handoff continuity', () => {
  beforeEach(() => {
    resetMockAppStore()
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
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

  it('keeps the evaluation source summary visible after the real panel switch and guidance clear', async () => {
    const user = userEvent.setup()

    render(<AppRightPanelsHarness />)

    await screen.findByText(zh.evaluationSuggestions)
    expect(screen.getByText('写作助手预设：改写 · 4 句 · 6 条')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成修改预览' }))
    await screen.findByText('交给写作助手的预览稿。')

    await user.click(screen.getByRole('button', { name: '带着修改预览继续到写作助手' }))

    expect(await screen.findByRole('dialog', { name: zh.writingHelperTitle })).toBeInTheDocument()
    expect(screen.getByText('评估接力预设')).toBeInTheDocument()
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('携带：修改预览')).toBeInTheDocument()
    expect(screen.getByText('原因：提升张力')).toBeInTheDocument()
    expect(screen.getByText('推荐：4 句')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))
    await user.click(screen.getByRole('button', { name: '清除说明' }))

    expect(screen.getByText('交接说明已清除，你仍可恢复推荐参数。')).toBeInTheDocument()
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('携带：修改预览')).toBeInTheDocument()
  })

  it('switches to automation panel when evaluation requests automation handoff', async () => {
    const user = userEvent.setup()

    render(<AppRightPanelsHarness />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '更多工具' }))
    await user.click(screen.getByRole('button', { name: /打开自动化任务面板/ }))

    expect(await screen.findByTestId('automation-open-settings')).toBeInTheDocument()
  })

  it('routes settings opens back through the originating panel callback', async () => {
    const user = userEvent.setup()
    const openSettingsFromWritingHelper = vi.fn()
    const openSettingsFromTextOptimizer = vi.fn()
    const openSettingsFromAutomation = vi.fn()

    const { rerender } = render(
      <AppRightPanels
        activeRightPanel="writingHelper"
        settingsOpen={false}
        evaluationSources={[]}
        writingHelperDraft={defaultDraft}
        closeRightPanel={() => {}}
        closeSettings={() => {}}
        openDetailedDiagnostics={() => {}}
        openSettingsFromWritingHelper={openSettingsFromWritingHelper}
        openSettingsFromTextOptimizer={openSettingsFromTextOptimizer}
        openSettingsFromAutomation={openSettingsFromAutomation}
        onOpenAutomationFromEvaluation={() => {}}
        onOpenWritingHelperFromEvaluation={() => {}}
        setWritingHelperDraft={() => {}}
        clearWritingHelperDraft={() => {}}
      />,
    )

    await user.click(await screen.findByRole('button', { name: zh.writingHelperOpenSettings }))
    expect(openSettingsFromWritingHelper).toHaveBeenCalledTimes(1)
    expect(openSettingsFromTextOptimizer).not.toHaveBeenCalled()
    expect(openSettingsFromAutomation).not.toHaveBeenCalled()

    rerender(
      <AppRightPanels
        activeRightPanel="textOptimizer"
        settingsOpen={false}
        evaluationSources={[]}
        writingHelperDraft={defaultDraft}
        closeRightPanel={() => {}}
        closeSettings={() => {}}
        openDetailedDiagnostics={() => {}}
        openSettingsFromWritingHelper={openSettingsFromWritingHelper}
        openSettingsFromTextOptimizer={openSettingsFromTextOptimizer}
        openSettingsFromAutomation={openSettingsFromAutomation}
        onOpenAutomationFromEvaluation={() => {}}
        onOpenWritingHelperFromEvaluation={() => {}}
        setWritingHelperDraft={() => {}}
        clearWritingHelperDraft={() => {}}
      />,
    )

    await user.click(await screen.findByTestId('text-optimizer-open-settings'))
    expect(openSettingsFromTextOptimizer).toHaveBeenCalledTimes(1)

    rerender(
      <AppRightPanels
        activeRightPanel="automation"
        settingsOpen={false}
        evaluationSources={[]}
        writingHelperDraft={defaultDraft}
        closeRightPanel={() => {}}
        closeSettings={() => {}}
        openDetailedDiagnostics={() => {}}
        openSettingsFromWritingHelper={openSettingsFromWritingHelper}
        openSettingsFromTextOptimizer={openSettingsFromTextOptimizer}
        openSettingsFromAutomation={openSettingsFromAutomation}
        onOpenAutomationFromEvaluation={() => {}}
        onOpenWritingHelperFromEvaluation={() => {}}
        setWritingHelperDraft={() => {}}
        clearWritingHelperDraft={() => {}}
      />,
    )

    await user.click(await screen.findByTestId('automation-open-settings'))
    expect(openSettingsFromAutomation).toHaveBeenCalledTimes(1)
  })
})


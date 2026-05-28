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

import {
  evaluateContent,
  getImprovementSuggestions,
  listCheckpoints,
} from '../api/client'
import { processWritingHelper } from '../api/writing'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { getEditorHandle } from '../utils/editorHandle'
import { EvaluationPanel } from './EvaluationPanel'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedGetImprovementSuggestions = vi.mocked(getImprovementSuggestions)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedProcessWritingHelper = vi.mocked(processWritingHelper)
const mockedGetEditorHandle = vi.mocked(getEditorHandle)

const zh = translations.zh

describe('EvaluationPanel revision loop', () => {
  beforeEach(() => {
    resetMockAppStore()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()

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
  })

  it('generates a revision preview and applies it through revision-safe editor actions', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => ({ from: 2, to: 6, text: '测试内容' })),
      replaceSelectionSnapshot: vi.fn(() => true),
      insertBelowSelectionSnapshot: vi.fn(() => true),
      undoLastRevisionApply: vi.fn(() => true),
      triggerAIContinue: vi.fn(),
    }

    mockedGetEditorHandle.mockReturnValue(editorHandle)
    mockedProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '修改后的回复。',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '生成修改预览' }))

    await waitFor(() => {
      expect(mockedProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
        content: '测试内容',
        mode: 'rewrite',
        instruction: expect.stringContaining('增加冲突'),
      }))
    })

    expect(await screen.findByText('修改预览')).toBeInTheDocument()
    expect(screen.getByText('原文')).toBeInTheDocument()
    expect(screen.getByText('建议版本')).toBeInTheDocument()
    expect(screen.getByText('修改后的回复。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '替换选区' }))
    expect(editorHandle.replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 2, to: 6, text: '测试内容' },
      '修改后的回复。',
    )
    expect(screen.getByText('已替换当前选区。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '作为备选插入' }))
    expect(editorHandle.insertBelowSelectionSnapshot).toHaveBeenCalledWith(
      { from: 2, to: 6, text: '测试内容' },
      '修改后的回复。',
    )
    expect(screen.getByText('已作为备选插入到原文后。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '撤销上次应用' }))
    expect(editorHandle.undoLastRevisionApply).toHaveBeenCalledTimes(1)
    expect(screen.getByText('已撤销上次应用。')).toBeInTheDocument()
  })

  it('falls back to plain insert when no matching selection snapshot exists', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => null),
      replaceSelectionSnapshot: vi.fn(() => false),
      insertBelowSelectionSnapshot: vi.fn(() => false),
      undoLastRevisionApply: vi.fn(() => false),
      triggerAIContinue: vi.fn(),
    }

    mockedGetEditorHandle.mockReturnValue(editorHandle)
    mockedProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '插入版修改。',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '生成修改预览' }))
    await screen.findByText('插入版修改。')

    expect(screen.getByRole('button', { name: '插入到编辑器' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '作为备选插入' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '插入到编辑器' }))
    expect(editorHandle.insertText).toHaveBeenCalledWith('插入版修改。')
    expect(screen.getByText('已插入到编辑器。')).toBeInTheDocument()
  })

  it('hands the generated revision draft off to writing helper when the user continues there', async () => {
    const user = userEvent.setup()
    const onOpenWritingHelper = vi.fn()

    mockedProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '交给写作助手的预览稿。',
      },
    })

    render(
      <EvaluationPanel
        content="测试内容"
        onClose={() => {}}
        onOpenWritingHelper={onOpenWritingHelper}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '生成修改预览' }))
    await screen.findByText('交给写作助手的预览稿。')

    await user.click(screen.getByRole('button', { name: '带着修改预览继续到写作助手' }))

    expect(onOpenWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: '交给写作助手的预览稿。',
      mode: 'rewrite',
      maxSentences: 4,
      maxItems: 6,
      guidance: expect.stringContaining('优先处理这条评估建议：增加冲突\n原因：提升张力'),
      handoff: expect.objectContaining({
        source: 'evaluation',
        suggestionTitle: '增加冲突',
        suggestionReason: '提升张力',
        guidance: expect.stringContaining('优先处理这条评估建议：增加冲突\n原因：提升张力'),
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
      }),
    }))
    expect(onOpenWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      guidance: expect.stringContaining('本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。'),
    }))
  })

  it('lets detailed review suggestions enter the same revision preview loop without removing the original apply actions', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => ({ from: 2, to: 6, text: '测试内容' })),
      replaceSelectionSnapshot: vi.fn(() => true),
      insertBelowSelectionSnapshot: vi.fn(() => true),
      undoLastRevisionApply: vi.fn(() => true),
      triggerAIContinue: vi.fn(),
    }

    mockedGetEditorHandle.mockReturnValue(editorHandle)
    mockedProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '详细评估里的修改结果。',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '详细评估' }))

    expect(screen.getAllByRole('button', { name: '生成修改预览' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: zh.evaluationApply }).length).toBeGreaterThan(0)

    const previewButtons = screen.getAllByRole('button', { name: '生成修改预览' })
    await user.click(previewButtons[previewButtons.length - 1])

    expect(await screen.findByText('详细评估里的修改结果。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '替换选区' }))

    expect(editorHandle.replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 2, to: 6, text: '测试内容' },
      '详细评估里的修改结果。',
    )
  })

  it('maps detail-focused suggestions to an expand preset before opening writing helper', async () => {
    const user = userEvent.setup()
    const onOpenWritingHelper = vi.fn()

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 68,
        lock_score: 22,
        style_score: 23,
        logic_score: 23,
        actionable_feedback: '补足场景画面',
        suggestions: [
          { id: 'rec-02', title: '补足场景细节', reason: '增强画面感', action: 'apply' },
        ],
      },
    })

    render(
      <EvaluationPanel
        content="测试内容"
        onClose={() => {}}
        onOpenWritingHelper={onOpenWritingHelper}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '带着原始回复继续到写作助手' }))

    expect(onOpenWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: '测试内容',
      mode: 'expand',
      maxSentences: 5,
      maxItems: 6,
      guidance: expect.stringContaining('优先处理这条评估建议：补足场景细节'),
      handoff: expect.objectContaining({
        source: 'evaluation',
        suggestionTitle: '补足场景细节',
        suggestionReason: '增强画面感',
        guidance: expect.stringContaining('优先处理这条评估建议：补足场景细节'),
        carriedContent: 'original-reply',
        preset: {
          mode: 'expand',
          maxSentences: 5,
          maxItems: 6,
        },
      }),
    }))
  })
})

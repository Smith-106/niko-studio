import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/client', () => ({
  checkBackendHealth: vi.fn(),
  listSkills: vi.fn(),
  chat: vi.fn(),
  chatStream: vi.fn(),
  agentRoute: vi.fn(),
  agentWrite: vi.fn(),
  agentRevise: vi.fn(),
  agentGetContext: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreCheckpoint: vi.fn(),
  uploadMemoryFile: vi.fn(),
  quickRollbackWorkflow: vi.fn(),
  evaluateContent: vi.fn(),
  novelQualityCheck: vi.fn(),
  listCheckpoints: vi.fn(),
  applyRecommendation: vi.fn(),
  undoRecommendation: vi.fn(),
  batchApplyRecommendations: vi.fn(),
  routeWorkflow: vi.fn(),
  createPlan: vi.fn(),
  executePlan: vi.fn(),
  workflowLifecycle: vi.fn(),
}))

import { ChatArea } from '../components/ChatArea'
import { EvaluationPanel } from '../components/EvaluationPanel'
import { Sidebar } from '../components/Sidebar'
import { translations } from '../i18n'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  batchApplyRecommendations,
  chat,
  chatStream,
  createCheckpoint,
  createPlan,
  evaluateContent,
  executePlan,
  listCheckpoints,
  novelQualityCheck,
  restoreCheckpoint,
  routeWorkflow,
  workflowLifecycle,
} from '../api/client'
import { createDefaultProjectWorkspaceContext } from '@/types/workspace'

const zh = translations.zh
const mockedChat = vi.mocked(chat)
const mockedChatStream = vi.mocked(chatStream)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedNovelQualityCheck = vi.mocked(novelQualityCheck)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedBatchApplyRecommendations = vi.mocked(batchApplyRecommendations)
const mockedRouteWorkflow = vi.mocked(routeWorkflow)
const mockedCreatePlan = vi.mocked(createPlan)
const mockedExecutePlan = vi.mocked(executePlan)
const mockedWorkflowLifecycle = vi.mocked(workflowLifecycle)

function buildWorkspace() {
  return createDefaultProjectWorkspaceContext({
    fallbackProjectId: 'atlas-project',
    workspaceRoot: '/tmp/atlas-project',
  })
}

function resetStores() {
  localStorage.clear()
  useSettingsStore.getState().resetSettings()
  useSettingsStore.setState((state) => ({
    ...state,
    settings: {
      ...state.settings,
      language: 'zh',
    },
  }))

  useAppStore.setState((state) => ({
    ...state,
    backendStatus: false,
    currentWorkspace: buildWorkspace(),
    conversationsById: {},
    allConversationIds: [],
    currentConversationId: null,
    selectedSkills: [],
    availableSkills: [],
    loadingMap: {},
    refreshAvailableSkills: vi.fn().mockResolvedValue(undefined),
  }))
}

function seedMeaningfulWorkspace() {
  useAppStore.getState().setCurrentWorkspace({
    identity: {
      projectId: 'atlas-project',
      projectName: '星港计划',
      workspaceRoot: '/tmp/atlas-project',
    },
    manuscript: {
      chapterId: 'chapter-7',
      chapterTitle: '第七章 暗潮',
      chapterNumber: 7,
    },
    storyBible: {
      draftId: 'story-bible-v3',
      storage: 'workspace',
    },
    knowledge: {
      focusEntityId: 'captain-lin',
    },
  })
}

function seedConversationFixtures() {
  const scopedWorkspace = createDefaultProjectWorkspaceContext({
    fallbackProjectId: 'atlas-project',
    workspaceRoot: '/tmp/atlas-project',
  })

  const currentConversationId = 'conversation-current'
  const legacyConversationId = 'conversation-legacy'
  useAppStore.setState((state) => ({
    ...state,
    currentWorkspace: {
      ...state.currentWorkspace,
      workflow: {
        sessionId: 'workflow-session-9',
        planId: 'plan-9',
        level: 'L4',
      },
      chat: {
        conversationId: 'chat-9',
        comparisonEnabled: true,
      },
    },
    conversationsById: {
      [currentConversationId]: {
        id: currentConversationId,
        title: 'Current conversation',
        messages: [],
        createdAt: new Date('2026-04-08T00:00:00Z'),
        updatedAt: new Date('2026-04-08T00:00:00Z'),
        workspace: {
          ...scopedWorkspace,
          identity: {
            ...scopedWorkspace.identity,
            projectName: '星港计划',
          },
          manuscript: {
            ...scopedWorkspace.manuscript,
            chapterId: 'chapter-7',
            chapterTitle: '第七章 暗潮',
            chapterNumber: 7,
          },
          storyBible: {
            ...scopedWorkspace.storyBible,
            draftId: 'story-bible-v3',
          },
          knowledge: {
            ...scopedWorkspace.knowledge,
            focusEntityId: 'captain-lin',
          },
          workflow: {
            sessionId: 'workflow-session-9',
            planId: 'plan-9',
            level: 'L4',
          },
          chat: {
            conversationId: 'chat-9',
            comparisonEnabled: true,
          },
        },
      },
      [legacyConversationId]: {
        id: legacyConversationId,
        title: 'Legacy conversation',
        messages: [],
        createdAt: new Date('2026-04-08T00:00:00Z'),
        updatedAt: new Date('2026-04-08T00:00:00Z'),
      },
    },
    allConversationIds: [legacyConversationId, currentConversationId],
    currentConversationId,
  }))

  return { currentConversationId, legacyConversationId }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('btoa', (value: string) => value)
  resetStores()
  seedMeaningfulWorkspace()

  mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
  mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
  mockedChat.mockResolvedValue({ success: true, data: { content: 'fallback', skills_used: [] } })
  mockedChatStream.mockImplementation(async (_request, callbacks) => {
    callbacks.onContent?.('流式回复', 0)
    callbacks.onDone?.({ status: 'completed', skills_used: [] })
  })

  mockedEvaluateContent.mockResolvedValue({
    success: true,
    data: {
      decision: 'REVISE',
      total_score: 72,
      lock_score: 24,
      style_score: 24,
      logic_score: 24,
      actionable_feedback: '补强冲突推进',
      suggestions: [],
    },
  })
  mockedNovelQualityCheck.mockResolvedValue({
    success: true,
    data: {
      decision: 'REVISE',
      total_score: 74,
      lock_score: 26,
      style_score: 24,
      logic_score: 24,
      actionable_feedback: '补强角色动机',
    },
  })
  mockedListCheckpoints.mockResolvedValue({ success: true, data: [] })
  mockedBatchApplyRecommendations.mockResolvedValue({
    success: true,
    data: {
      total: 0,
      applied: 0,
      undone: 0,
      failed: 0,
      results: [],
    },
  })
  mockedRouteWorkflow.mockResolvedValue({ success: true, data: { level: 'L3' } })
  mockedCreatePlan.mockResolvedValue({
    success: true,
    data: {
      plan_id: 'plan-1',
      task: 'task',
      level: 'L3',
      status: 'ready',
      runner_state: 'idle',
      steps: [],
      progress: '0/0',
      execution_mode: 'serial',
      observability_metrics: {},
      budget_guardrail: {
        threshold_triggered: false,
        degraded: false,
        degrade_mode: 'none',
      },
      handoff_package: {},
    },
  })
  mockedExecutePlan.mockResolvedValue({
    success: true,
    data: {
      status: 'completed',
      execution_mode: 'serial',
      observability_metrics: {},
      budget_guardrail: {
        threshold_triggered: false,
        degraded: false,
        degrade_mode: 'none',
      },
      current_phase: 'execute',
      state_trace_id: 'trace-1',
      can_resume_from_checkpoint: true,
      plan_id: 'plan-1',
      step_id: 'step-1',
    },
  })
  mockedWorkflowLifecycle.mockResolvedValue({
    success: true,
    data: {
      plan_id: 'plan-1',
      action: 'status',
      runner_state: 'running',
      plan_status: 'in_progress',
      execution_mode: 'serial',
      observability_metrics: {},
      budget_guardrail: {
        threshold_triggered: false,
        degraded: false,
        degrade_mode: 'none',
      },
      handoff_package: {},
    },
  })
})

describe('writer workflow experience', () => {
  it('shows the writer project card and quick entrypoints in the sidebar', async () => {
    const onOpenKnowledge = vi.fn()
    const onOpenEvaluation = vi.fn()

    render(
      <Sidebar
        collapsed={false}
        onToggle={vi.fn()}
        onOpenKnowledge={onOpenKnowledge}
        onOpenPrompts={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenEvaluation={onOpenEvaluation}
        onOpenMcpStatus={vi.fn()}
      />,
    )

    expect(screen.getByText('当前写作项目')).toBeInTheDocument()
    expect(screen.getByText('星港计划')).toBeInTheDocument()
    expect(screen.getByText('第七章 暗潮')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '审阅当前草稿' }))
    await userEvent.click(screen.getByRole('button', { name: '打开故事设定' }))

    expect(onOpenEvaluation).toHaveBeenCalledTimes(1)
    expect(onOpenKnowledge).toHaveBeenCalledTimes(1)
  })

  it('anchors chat requests to the current workspace and surfaces that context in the UI', async () => {
    render(<ChatArea />)

    expect(screen.getByText('当前写作上下文')).toBeInTheDocument()
    expect(screen.getAllByText('星港计划').length).toBeGreaterThan(0)
    expect(screen.getAllByText('第七章 暗潮').length).toBeGreaterThan(0)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '根据当前项目继续写作{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({
            identity: expect.objectContaining({
              projectId: 'atlas-project',
              projectName: '星港计划',
            }),
            manuscript: expect.objectContaining({
              chapterId: 'chapter-7',
            }),
          }),
        }),
        expect.any(Object),
        expect.any(Object),
      )
    })
  })

  it('drops stale chat scope when switching to a legacy conversation without workspace state', async () => {
    const { legacyConversationId } = seedConversationFixtures()

    act(() => {
      useAppStore.getState().selectConversation(legacyConversationId)
    })

    render(<ChatArea />)

    const input = screen.getByPlaceholderText(zh.inputPlaceholder)
    await userEvent.type(input, '切到旧对话后继续写{enter}')

    await waitFor(() => {
      expect(mockedChatStream).toHaveBeenCalled()
    })

    const lastCall = mockedChatStream.mock.calls[mockedChatStream.mock.calls.length - 1]
    const request = lastCall?.[0]
    expect(request?.workspace).toBeUndefined()
  })

  it('adds writer presets while keeping advanced workflow controls available in evaluation', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenCalled()
    })

    expect(screen.getByText('下一步写作流程')).toBeInTheDocument()
    expect(screen.getByText('高级控制')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.evaluationWorkflowRoute })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /制定修订计划/ }))

    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledWith(
        expect.stringContaining('第七章 暗潮'),
        'L3',
        undefined,
        undefined,
        expect.objectContaining({
          identity: expect.objectContaining({
            projectId: 'atlas-project',
            projectName: '星港计划',
          }),
          manuscript: expect.objectContaining({
            chapterId: 'chapter-7',
          }),
        }),
      )
    })
  })

  it('clears stale workflow identifiers when switching to a legacy conversation', async () => {
    const { legacyConversationId } = seedConversationFixtures()

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenCalled()
    })

    await userEvent.click(screen.getByRole('button', { name: /制定修订计划/ }))

    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useAppStore.getState().selectConversation(legacyConversationId)
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowExecute }))

    expect(mockedExecutePlan).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /制定修订计划/ }))

    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledTimes(2)
    })
    const legacyPlanCall = mockedCreatePlan.mock.calls[1]
    expect(legacyPlanCall).toHaveLength(2)
    expect(legacyPlanCall[1]).toBe('L3')
    expect(legacyPlanCall[0]).toContain('default-project')
    expect(legacyPlanCall[0]).not.toContain('星港计划')
    expect(legacyPlanCall[0]).not.toContain('第七章 暗潮')
  })
})

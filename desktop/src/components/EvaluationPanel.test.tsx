import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvaluationPanel } from './EvaluationPanel'
import { type ProjectWorkspaceContext } from '../types/workspace'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'

const {
  resetMockAppStore,
  revisionOrchestratorCtorMock,
  revisionOrchestratorRunMock,
  useAppStoreMock,
} = vi.hoisted(() => {
  const revisionOrchestratorCtorMock = vi.fn()
  const revisionOrchestratorRunMock = vi.fn()

  const createMockWorkspace = (): ProjectWorkspaceContext => ({
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'default-project',
      projectId: 'default-project',
      projectName: 'default-project',
      workspaceRoot: null,
    },
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
      storage: 'workspace' as const,
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
    },
    authority: {
      recordSetId: null,
      activeSceneId: null,
      activeEventId: null,
      activeTimelineId: null,
      consistencyRunId: null,
    },
    workflow: {
      level: 'L3',
      planId: '',
      sessionId: null,
    },
    chat: {
      conversationId: null,
      comparisonEnabled: null,
    },
    compatibility: {
      additiveContract: true as const,
      migratedLegacyFields: [],
      notes: [],
    },
  })

  const state: {
    currentConversationId: string | null
    currentWorkspace: ProjectWorkspaceContext
    conversationsById: Record<string, { workspace?: ProjectWorkspaceContext }>
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
    currentWorkspace: ProjectWorkspaceContext,
    workspacePatch: Record<string, unknown>,
  ): ProjectWorkspaceContext => ({
    ...currentWorkspace,
    ...workspacePatch,
    identity: {
      ...currentWorkspace.identity,
      ...(workspacePatch.identity as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['identity'],
    manuscript: {
      ...currentWorkspace.manuscript,
      ...(workspacePatch.manuscript as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['manuscript'],
    storyBible: {
      ...currentWorkspace.storyBible,
      ...(workspacePatch.storyBible as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['storyBible'],
    knowledge: {
      ...currentWorkspace.knowledge,
      ...(workspacePatch.knowledge as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['knowledge'],
    authority: {
      ...currentWorkspace.authority,
      ...(workspacePatch.authority as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['authority'],
    workflow: {
      ...currentWorkspace.workflow,
      ...(workspacePatch.workflow as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['workflow'],
    chat: {
      ...currentWorkspace.chat,
      ...(workspacePatch.chat as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['chat'],
    compatibility: {
      ...currentWorkspace.compatibility,
      ...(workspacePatch.compatibility as Record<string, unknown> | undefined),
    } as ProjectWorkspaceContext['compatibility'],
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
    revisionOrchestratorCtorMock,
    revisionOrchestratorRunMock,
    useAppStoreMock,
  }
})

vi.mock('@/types/settingsOwnership', () => ({
  PERSISTED_SETTINGS_KEYS: ['language'],
}))

vi.mock('../api/client', () => ({
  evaluateContent: vi.fn(),
  getImprovementSuggestions: vi.fn(),
  novelQualityCheck: vi.fn(),
  runConsistencyCheck: vi.fn(),
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

vi.mock('../services/revisionOrchestrator', () => ({
  RevisionOrchestrator: vi.fn().mockImplementation((config) => {
    revisionOrchestratorCtorMock(config)
    return {
      run: (content: string) => revisionOrchestratorRunMock(content, config),
    }
  }),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

import {
  applyRecommendation,
  batchApplyRecommendations,
  createCheckpoint,
  createPlan,
  evaluateContent,
  executePlan,
  getImprovementSuggestions,
  listCheckpoints,
  novelQualityCheck,
  restoreCheckpoint,
  routeWorkflow,
  runConsistencyCheck,
  undoRecommendation,
  workflowLifecycle,
  type WorkflowExecuteResponse,
  type WorkflowLifecycleResponse,
  type WorkflowPlanStatusResponse,
} from '../api/client'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedGetImprovementSuggestions = vi.mocked(getImprovementSuggestions)
const mockedNovelQualityCheck = vi.mocked(novelQualityCheck)
const mockedRunConsistencyCheck = vi.mocked(runConsistencyCheck)
const mockedListCheckpoints = vi.mocked(listCheckpoints)
const mockedCreateCheckpoint = vi.mocked(createCheckpoint)
const mockedRestoreCheckpoint = vi.mocked(restoreCheckpoint)
const mockedApplyRecommendation = vi.mocked(applyRecommendation)
const mockedUndoRecommendation = vi.mocked(undoRecommendation)
const mockedBatchApplyRecommendations = vi.mocked(batchApplyRecommendations)
const mockedRouteWorkflow = vi.mocked(routeWorkflow)
const mockedCreatePlan = vi.mocked(createPlan)
const mockedExecutePlan = vi.mocked(executePlan)
const mockedWorkflowLifecycle = vi.mocked(workflowLifecycle)
const en = translations.en
const zh = translations.zh
const evaluationAdvancedControlsLabel = '高级控制'
const evaluationDetailedReviewLabel = '详细评估'
const evaluationSupportToolsLabel = '更多工具'
const evaluationWorkflowSuccessRoute = `${zh.evaluationWorkflowRoute}: ${zh.evaluationWorkflowSuccess}`
const evaluationWorkflowSuccessLifecycle = `${zh.evaluationWorkflowLifecycle}: ${zh.evaluationWorkflowSuccess}`
const createMeaningfulWorkspace = (): ProjectWorkspaceContext => ({
  schemaVersion: '2026-04-08',
  identity: {
    workspaceId: 'atlas-workspace',
    projectId: 'atlas-project',
    projectName: 'Atlas',
    workspaceRoot: '/tmp/atlas',
  },
  manuscript: {
    manuscriptId: null,
    title: null,
    chapterId: 'chapter-9',
    chapterTitle: 'Chapter 9',
    chapterNumber: 9,
  },
  storyBible: {
    storyBibleId: null,
    draftId: null,
    version: null,
    storage: 'workspace' as const,
  },
  knowledge: {
    focusEntityId: null,
    graphEntityIds: [],
    memoryEntryIds: [],
  },
  authority: {
    recordSetId: null,
    activeSceneId: null,
    activeEventId: null,
    activeTimelineId: null,
    consistencyRunId: null,
  },
  workflow: {
    level: 'L3',
    planId: '',
    sessionId: null,
  },
  chat: {
    conversationId: null,
    comparisonEnabled: null,
  },
  compatibility: {
    additiveContract: true as const,
    migratedLegacyFields: [],
    notes: [],
  },
})
const expectWorkflowRequestWorkspace = () => expect.objectContaining({
  workflow: expect.objectContaining({
    level: 'L3',
  }),
  chat: expect.objectContaining({
    conversationId: null,
  }),
})

const defaultPlanResponse: WorkflowPlanStatusResponse = {
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
}

const defaultExecuteResponse: WorkflowExecuteResponse = {
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
}

const defaultLifecycleResponse: WorkflowLifecycleResponse = {
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
}

describe('EvaluationPanel actions', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMockAppStore()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    revisionOrchestratorRunMock.mockReset()
    revisionOrchestratorCtorMock.mockClear()

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
          { id: 'rec-02', title: '收束视角', reason: '保证一致', action: 'apply' },
        ],
      },
    })

    mockedListCheckpoints.mockResolvedValue({ success: true, data: [] })
    mockedGetImprovementSuggestions.mockResolvedValue({
      success: true,
      data: [
        { issue: '意象薄弱', suggestion: '强化意象', priority: 'high' },
      ],
    })
    mockedNovelQualityCheck.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 74,
        lock_score: 71,
        style_score: 76,
        logic_score: 73,
        actionable_feedback: '补强角色动机',
      },
    })
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
    mockedRouteWorkflow.mockResolvedValue({ success: true, data: { level: 'L3', reason: 'matched', suggested_workflow: 'plan' } })
    mockedCreatePlan.mockResolvedValue({ success: true, data: defaultPlanResponse })
    mockedExecutePlan.mockResolvedValue({ success: true, data: defaultExecuteResponse })
    mockedWorkflowLifecycle.mockResolvedValue({ success: true, data: defaultLifecycleResponse })
  })

  it('shows an empty state instead of failing when there is no content to evaluate', async () => {
    render(<EvaluationPanel content="" onClose={() => {}} />)

    expect(await screen.findByText(zh.evaluationNoContent)).toBeInTheDocument()
    expect(mockedEvaluateContent).not.toHaveBeenCalled()
  })

  it('lets the user switch evaluation sources explicitly', async () => {
    const user = userEvent.setup()

    render(
      <EvaluationPanel
        evaluationSources={[
          {
            kind: 'latestAssistantReply',
            label: '最近一次助手回复',
            content: '助手回复',
          },
          {
            kind: 'currentDraft',
            label: '当前写作草稿',
            content: '草稿正文',
          },
        ]}
        onClose={() => {}}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)

    expect(mockedEvaluateContent).toHaveBeenCalledWith(
      '助手回复',
      undefined,
      undefined,
      expect.any(Object),
    )
    expect(screen.getByRole('button', { name: '最近一次助手回复' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '当前写作草稿' }))

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenCalledWith(
        '草稿正文',
        undefined,
        undefined,
        expect.any(Object),
      )
      expect(screen.getByRole('button', { name: '当前写作草稿' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('falls back to default source copy and Chinese remaining-suggestions hint when source metadata is sparse', async () => {
    mockedEvaluateContent.mockResolvedValueOnce({
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
          { id: 'rec-02', title: '收束视角', reason: '保证一致', action: 'apply' },
          { id: 'rec-03', title: '补充细节', reason: '增强画面感', action: 'apply' },
        ],
      },
    })

    render(
      <EvaluationPanel
        evaluationSources={[
          {
            kind: 'currentDraft',
            label: undefined,
            content: '  当前草稿正文  ',
          } as any,
        ]}
        onClose={() => {}}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)

    expect(mockedEvaluateContent).toHaveBeenCalledWith(
      '当前草稿正文',
      undefined,
      undefined,
      expect.any(Object),
    )
    expect(screen.getByText('评估来源')).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('当前面板会基于这个来源给出评分'))).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('还有 1 条建议') && text.includes('详细评估'))).toBeInTheDocument()
  })

  it('falls back to the remaining source when the selected source disappears', async () => {
    const user = userEvent.setup()
    const view = render(
      <EvaluationPanel
        evaluationSources={[
          {
            kind: 'latestAssistantReply',
            label: '最近一次助手回复',
            content: '助手回复',
          },
          {
            kind: 'currentDraft',
            label: '当前写作草稿',
            content: '草稿正文',
          },
        ]}
        onClose={() => {}}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: '当前写作草稿' }))

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenCalledWith(
        '草稿正文',
        undefined,
        undefined,
        expect.any(Object),
      )
    })

    view.rerender(
      <EvaluationPanel
        evaluationSources={[
          {
            kind: 'latestAssistantReply',
            label: '最近一次助手回复',
            content: '助手回复',
          },
        ]}
        onClose={() => {}}
      />,
    )

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenLastCalledWith(
        '助手回复',
        undefined,
        undefined,
        expect.any(Object),
      )
    })
  })

  it('keeps detailed review and extra tools collapsed by default', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    expect(screen.queryByRole('button', { name: zh.evaluationBatchApply })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: zh.evaluationQualityCheckRun })).not.toBeInTheDocument()
    expect(screen.queryByText(zh.evaluationDimensionAnalysis)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: evaluationDetailedReviewLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: evaluationSupportToolsLabel })).toBeInTheDocument()
  })

  it('makes the writing helper CTA explicit about carrying the original reply and shows the matched preset inline', async () => {
    mockedEvaluateContent.mockResolvedValueOnce({
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

    render(
      <EvaluationPanel
        content="测试内容"
        onClose={() => {}}
        onOpenWritingHelper={() => {}}
      />,
    )

    await screen.findByText(zh.evaluationSuggestions)

    expect(screen.getByRole('button', { name: '带着原始回复继续到写作助手' })).toBeInTheDocument()
    expect(screen.getByText('写作助手预设：改写 · 4 句 · 6 条')).toBeInTheDocument()
  })

  it('supports apply and undo flow for a single suggestion', async () => {
    mockedApplyRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'applied',
        message: 'recommendation applied',
      },
    })

    mockedUndoRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'undone',
        message: 'recommendation undone',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    expect(mockedEvaluateContent).toHaveBeenCalledWith(
      '测试内容',
      undefined,
      undefined,
      expect.objectContaining({
        naturalness: 85,
        readability: 80,
        coherence: 80,
        style_consistency: 78,
      })
    )

    await userEvent.click(screen.getByRole('button', { name: evaluationDetailedReviewLabel }))
    const applyButtons = await screen.findAllByRole('button', { name: zh.evaluationApply })
    await userEvent.click(applyButtons[0])

    await waitFor(() => {
      expect(mockedApplyRecommendation).toHaveBeenCalledWith(
        '测试内容',
        expect.objectContaining({ id: 'rec-01' })
      )
      expect(screen.getByText('recommendation applied')).toBeInTheDocument()
    })

    const undoButtons = await screen.findAllByRole('button', { name: zh.evaluationUndo })
    await userEvent.click(undoButtons[0])

    await waitFor(() => {
      expect(mockedUndoRecommendation).toHaveBeenCalledWith(
        '测试内容',
        expect.objectContaining({ id: 'rec-01' })
      )
      expect(screen.getByText('recommendation undone')).toBeInTheDocument()
    })
  })

  it('uses the right panel shell offset and closes from the header button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<EvaluationPanel content="测试内容" onClose={onClose} />)

    const dialog = await screen.findByRole('dialog', { name: zh.evaluationTitle })
    expect(dialog.className).toContain('top-14')
    expect(dialog.className).toContain('z-30')

    await user.click(screen.getByRole('button', { name: zh.evaluationClose }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('runs novel quality check and renders result fields', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationQualityCheckRun }))

    await waitFor(() => {
      expect(mockedNovelQualityCheck).toHaveBeenCalledWith(
        '测试内容',
        undefined,
        undefined,
        expect.objectContaining({
          naturalness: 85,
          readability: 80,
          coherence: 80,
          style_consistency: 78,
        })
      )
      expect(screen.getByText(`${zh.evaluationQualityCheckDecision}: REVISE`)).toBeInTheDocument()
      expect(screen.getByText(`${zh.evaluationQualityCheckTotal}: 74`)).toBeInTheDocument()
      expect(screen.getByText(`${zh.evaluationQualityCheckFeedback}: 补强角色动机`)).toBeInTheDocument()
    })
  })

  it('shows quality check error message when request fails', async () => {
    mockedNovelQualityCheck.mockResolvedValueOnce({
      success: false,
      error: 'service unavailable',
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationQualityCheckRun }))

    await waitFor(() => {
      expect(screen.getByText(`${zh.failureCategoryEvaluation}：${zh.failureMessageEvaluation}`)).toBeInTheDocument()
    })
  })

  it('runs consistency governance with workspace scope and syncs returned authority state', async () => {
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    mockedRunConsistencyCheck.mockResolvedValueOnce({
      success: true,
      data: {
        character: {},
        timeline: {},
        worldview: {},
        combined: {
          totalConflicts: 1,
          criticalCount: 0,
          majorCount: 1,
          minorCount: 0,
          infoCount: 0,
          conflicts: [],
          overallScore: 8.2,
          moduleScores: {
            character: 9.0,
            timeline: 7.5,
            worldview: 8.1,
          },
          summary: 'Found one major conflict.',
        },
        analyzedAt: '2026-04-25T12:00:00.000Z',
        runId: 'consistency-atlas-workspace-20260425120000',
        workspace: {
          ...createMeaningfulWorkspace(),
          authority: {
            recordSetId: 'atlas-workspace',
            activeSceneId: null,
            activeEventId: null,
            activeTimelineId: null,
            consistencyRunId: 'consistency-atlas-workspace-20260425120000',
          },
        } satisfies ProjectWorkspaceContext,
        narrativeAuthority: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          consistencyRunId: 'consistency-atlas-workspace-20260425120000',
        },
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationConsistencyRun }))

    await waitFor(() => {
      expect(mockedRunConsistencyCheck).toHaveBeenCalledWith(
        ['测试内容'],
        [{ chapterNumber: 9, title: 'Chapter 9' }],
        undefined,
        expect.objectContaining({
          identity: expect.objectContaining({
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
          }),
        }),
      )
      expect(screen.getByText(`${zh.evaluationConsistencyRunId}: consistency-atlas-workspace-20260425120000`)).toBeInTheDocument()
      expect(screen.getByText(`${zh.evaluationConsistencyScore}: 8.2`)).toBeInTheDocument()
      expect(useAppStoreMock.getState().currentWorkspace.authority.consistencyRunId).toBe('consistency-atlas-workspace-20260425120000')
    })
  })

  it('disables consistency governance when no meaningful workspace scope exists', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))

    expect(screen.getByRole('button', { name: zh.evaluationConsistencyRun })).toBeDisabled()
  })
  it('shows consistency errors when the consistency run throws', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()

    mockedRunConsistencyCheck.mockRejectedValueOnce(new Error('consistency offline'))

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: en.evaluationConsistencyRun }))

    expect(await screen.findByText('consistency offline')).toBeInTheDocument()
  })

  it('syncs consistency results through the active conversation and uses fallback chapter metadata when needed', async () => {
    useAppStoreMock.setState({
      currentConversationId: 'conv-42',
      currentWorkspace: {
        ...createMeaningfulWorkspace(),
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: null,
          chapterTitle: null,
          chapterNumber: null,
        },
        chat: {
          conversationId: 'conv-42',
          comparisonEnabled: null,
        },
      } as any,
      conversationsById: {
        'conv-42': {
          workspace: {
            ...createMeaningfulWorkspace(),
            chat: {
              conversationId: 'conv-42',
              comparisonEnabled: null,
            },
          },
        },
      },
    })
    mockedRunConsistencyCheck.mockResolvedValueOnce({
      success: true,
      data: {
        character: {},
        timeline: {},
        worldview: {},
        combined: {
          totalConflicts: 0,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 0,
          infoCount: 0,
          conflicts: [],
          overallScore: 8.8,
          summary: 'All clear.',
        },
        analyzedAt: '2026-04-25T12:00:00.000Z',
        runId: 'consistency-fallback',
        workspace: {
          ...createMeaningfulWorkspace(),
          authority: {
            recordSetId: 'atlas-workspace',
            activeSceneId: null,
            activeEventId: null,
            activeTimelineId: null,
            consistencyRunId: 'consistency-fallback',
          },
          chat: {
            conversationId: 'conv-42',
            comparisonEnabled: null,
          },
        } satisfies ProjectWorkspaceContext,
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationConsistencyRun }))

    await waitFor(() => {
      expect(mockedRunConsistencyCheck).toHaveBeenCalledWith(
        ['测试内容'],
        [{ chapterNumber: 1, title: 'Chapter 1' }],
        undefined,
        expect.objectContaining({
          identity: expect.objectContaining({
            workspaceId: 'atlas-workspace',
          }),
        }),
      )
      expect(useAppStoreMock.getState().syncConversationWorkspace).toHaveBeenCalledWith(
        'conv-42',
        expect.objectContaining({
          authority: expect.objectContaining({
            consistencyRunId: 'consistency-fallback',
          }),
        }),
      )
    })
  })

  it('shows string-based consistency failures from thrown non-Error values', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()

    mockedRunConsistencyCheck.mockRejectedValueOnce('consistency string failure')

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: en.evaluationConsistencyRun }))

    expect(await screen.findByText('consistency string failure')).toBeInTheDocument()
  })

  it('shows a classified failure state when the initial evaluation request fails', async () => {
    mockedEvaluateContent.mockResolvedValueOnce({
      success: false,
      error: 'Request failed',
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    expect(await screen.findByText(zh.failureCategoryEvaluation)).toBeInTheDocument()
    expect(screen.getByText(zh.failureMessageEvaluation)).toBeInTheDocument()
    expect(screen.getByText('Request failed')).toBeInTheDocument()
  })

  it('allows retrying after the initial evaluation fails', async () => {
    mockedEvaluateContent
      .mockResolvedValueOnce({
        success: false,
        error: 'Request failed',
      })
      .mockResolvedValueOnce({
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

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    expect(await screen.findByText(zh.failureCategoryEvaluation)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationRefresh }))

    await waitFor(() => {
      expect(mockedEvaluateContent).toHaveBeenCalledTimes(2)
      expect(screen.getByText(zh.evaluationSuggestions)).toBeInTheDocument()
    })
  })

  it('supports direct workflow actions and autofills IDs from response', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: evaluationAdvancedControlsLabel }))

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowRoute }))
    await waitFor(() => {
      expect(mockedRouteWorkflow).toHaveBeenCalledWith(
        '测试内容',
        'L3',
        expectWorkflowRequestWorkspace()
      )
      expect(screen.getByText(evaluationWorkflowSuccessRoute)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowPlan }))
    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledWith(
        '测试内容',
        'L3',
        undefined,
        undefined,
        expectWorkflowRequestWorkspace()
      )
      expect((screen.getByLabelText(zh.evaluationWorkflowPlanIdPlaceholder) as HTMLInputElement).value).toBe('plan-1')
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowExecute }))
    await waitFor(() => {
      expect(mockedExecutePlan).toHaveBeenCalledWith(
        'plan-1',
        undefined,
        undefined,
        undefined,
        undefined,
        expectWorkflowRequestWorkspace()
      )
      expect((screen.getByLabelText(zh.evaluationWorkflowStepIdPlaceholder) as HTMLInputElement).value).toBe('step-1')
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowLifecycle }))
    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith(
        'plan-1',
        'status',
        undefined,
        expectWorkflowRequestWorkspace()
      )
      expect(screen.getByText(evaluationWorkflowSuccessLifecycle)).toBeInTheDocument()
    })
  })

  it('shows workflow error state and supports retry', async () => {
    mockedRouteWorkflow
      .mockResolvedValueOnce({ success: false, error: 'route failed' })
      .mockResolvedValueOnce({ success: true, data: { level: 'L3' } })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: evaluationAdvancedControlsLabel }))

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowRoute }))
    await waitFor(() => {
      expect(screen.getByText(`${zh.evaluationWorkflowRoute}: route failed`)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowRetry }))
    await waitFor(() => {
      expect(mockedRouteWorkflow).toHaveBeenCalledTimes(2)
      expect(screen.getByText(evaluationWorkflowSuccessRoute)).toBeInTheDocument()
    })
  })

  it('shows workflow error state when response payload contains top-level error', async () => {
    mockedRouteWorkflow.mockResolvedValueOnce({
      success: true,
      data: { error: 'route failed', status: 'failed' },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await userEvent.click(screen.getByRole('button', { name: evaluationAdvancedControlsLabel }))

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationWorkflowRoute }))
    await waitFor(() => {
      expect(screen.getByText(`${zh.evaluationWorkflowRoute}: route failed`)).toBeInTheDocument()
    })
  })

  it('supports batch apply and batch undo flow', async () => {
    mockedBatchApplyRecommendations.mockResolvedValue({
      success: true,
      data: {
        total: 2,
        applied: 2,
        undone: 0,
        failed: 0,
        results: [
          {
            recommendation_id: 'rec-01',
            status: 'applied',
            message: 'recommendation applied',
          },
          {
            recommendation_id: 'rec-02',
            status: 'applied',
            message: 'recommendation applied',
          },
        ],
      },
    })

    mockedUndoRecommendation.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'undone',
        message: 'recommendation undone',
      },
    })

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await userEvent.click(screen.getByRole('button', { name: evaluationDetailedReviewLabel }))

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationBatchApply }))

    await waitFor(() => {
      expect(mockedBatchApplyRecommendations).toHaveBeenCalledWith(
        '测试内容',
        expect.arrayContaining([
          expect.objectContaining({ id: 'rec-01' }),
          expect.objectContaining({ id: 'rec-02' }),
        ])
      )
      expect(screen.getByText(zh.evaluationBatchResult.replace('{applied}', '2').replace('{failed}', '0'))).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: zh.evaluationBatchUndo }))

    await waitFor(() => {
      expect(mockedUndoRecommendation).toHaveBeenCalledTimes(2)
      expect(screen.getByText(zh.evaluationBatchUndoResult.replace('{success}', '2').replace('{failed}', '0'))).toBeInTheDocument()
    })
  })

  it('renders English approved verdicts with high score styling and remaining suggestions hint', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const onOpenWritingHelper = vi.fn()

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 86,
        lock_score: 32,
        style_score: 34,
        logic_score: 34,
        actionable_feedback: 'Ready for the next draft pass.',
        suggestions: [
          { id: 'style-01', title: 'Polish tone', reason: 'style clarity', action: 'apply' },
          { id: 'conflict-01', title: 'Raise conflict', reason: 'increase tension', action: 'apply' },
          { id: 'detail-01', title: 'Add scene details', reason: 'ground the imagery', action: 'apply' },
        ],
        module_scores: {
          pacing: 8.8,
        },
      },
    })

    render(
      <EvaluationPanel
        content="The draft already lands cleanly."
        onClose={() => {}}
        onOpenWritingHelper={onOpenWritingHelper}
      />,
    )

    expect(await screen.findByRole('dialog', { name: en.evaluationTitle })).toBeInTheDocument()
    expect(screen.getByText('8.6 / 10')).toBeInTheDocument()
    expect(screen.getByText(en.evaluationPassed)).toBeInTheDocument()
    expect(screen.getByText('Ready for the next draft pass.')).toBeInTheDocument()
    expect(screen.getByText('1 more suggestions are available in detailed review.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Continue to Writing Helper with the original reply' }).length).toBeGreaterThan(0)
  })

  it('renders rewrite and unknown decision branches without treating them as approved', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'REWRITE',
        total_score: 42,
        lock_score: 12,
        style_score: 14,
        logic_score: 16,
        actionable_feedback: 'The scene needs a full rewrite.',
        suggestions: [],
      },
    })

    const firstRender = render(<EvaluationPanel content="Weak scene draft." onClose={() => {}} />)
    expect(await screen.findByText(en.evaluationNeedRewrite)).toBeInTheDocument()
    expect(screen.getByText('4.2 / 10')).toBeInTheDocument()
    firstRender.unmount()

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'NEEDS_EDITOR',
        total_score: 55,
        lock_score: 18,
        style_score: 19,
        logic_score: 18,
        actionable_feedback: 'The evaluator returned a custom state.',
        suggestions: [],
      },
    })

    render(<EvaluationPanel content="Ambiguous evaluator state." onClose={() => {}} />)
    expect(await screen.findByText(en.evaluationUnknown)).toBeInTheDocument()
    expect(screen.getByText('5.5 / 10')).toBeInTheDocument()
  })

  it('runs multi-pass revision and carries revision session metadata into writing-helper handoff', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()
    const onOpenWritingHelper = vi.fn()

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 72,
        lock_score: 24,
        style_score: 24,
        logic_score: 24,
        actionable_feedback: 'Strengthen the protagonist pressure.',
        suggestions: [
          { id: 'rec-english-01', title: 'Raise conflict earlier', reason: 'increase tension', action: 'apply' },
        ],
      },
    })
    revisionOrchestratorRunMock.mockResolvedValueOnce({
      initialContent: 'Draft under review.',
      revisedContent: 'Revised draft.',
      initialScore: 6.5,
      finalScore: 8.7,
      iterations: 2,
      completed: true,
      reason: 'target_reached',
      sessionId: 'checkpoint-42',
      revisionSession: {
        id: 'revision-session-42',
        chapterId: 'chapter-9',
        state: 'revised',
        iteration: 2,
        comparisonSummary: 'Sharper pressure.',
      },
    })

    render(
      <EvaluationPanel
        content="Draft under review."
        onClose={() => {}}
        onOpenWritingHelper={onOpenWritingHelper}
      />,
    )

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))

    const [targetInput, maxIterationsInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(targetInput, { target: { value: '9.5' } })
    fireEvent.change(maxIterationsInput, { target: { value: '3' } })
    await user.click(screen.getByRole('button', { name: 'Run Multi-Pass' }))

    await waitFor(() => {
      expect(revisionOrchestratorCtorMock).toHaveBeenCalledWith(expect.objectContaining({
        targetScore: 9.5,
        maxIterations: 3,
        workspace: expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'atlas-workspace' }),
        }),
      }))
      expect(revisionOrchestratorRunMock).toHaveBeenCalledWith(
        'Draft under review.',
        expect.objectContaining({ targetScore: 9.5, maxIterations: 3 }),
      )
    })

    expect(screen.getByText('Iterations: 2')).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('Initial Score') && text.includes('6.5') && text.includes('Final Score') && text.includes('8.7'))).toBeInTheDocument()
    expect(screen.getByText('Reason: target_reached')).toBeInTheDocument()
    expect(screen.getByText('Session ID: checkpoint-42')).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('Session State') && text.includes('revised') && text.includes('Iteration 2'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue to Writing Helper with the original reply' }))
    expect(onOpenWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: 'Draft under review.',
      handoff: expect.objectContaining({
        carriedContent: 'original-reply',
        revisionSession: {
          id: 'checkpoint-42',
          chapterId: 'chapter-9',
          state: 'revised',
          iteration: 2,
          comparisonSummary: 'Sharper pressure.',
        },
      }),
    }))
  })

  it('shows the multi-pass fallback result when the revision orchestrator fails', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const user = userEvent.setup()
    revisionOrchestratorRunMock.mockRejectedValueOnce(new Error('offline'))

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: 'Run Multi-Pass' }))

    expect(await screen.findByText('Iterations: 0')).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('Initial Score') && text.includes('0.0') && text.includes('Final Score'))).toBeInTheDocument()
    expect(screen.getByText('Reason: error')).toBeInTheDocument()
  })

  it('creates, refreshes, and restores checkpoints from the parent support-tools callbacks', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    const user = userEvent.setup()

    mockedListCheckpoints.mockResolvedValue({
      success: true,
      data: [
        { id: 'cp-restore', description: 'Before revision pass', created_at: '2026-06-06T00:00:00.000Z' },
      ],
    })
    mockedCreateCheckpoint.mockResolvedValue({
      success: true,
      data: { checkpoint_id: 'cp-new' },
    })
    mockedRestoreCheckpoint.mockResolvedValue({
      success: true,
      data: { status: 'ok' },
    })

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.type(screen.getByLabelText(en.evaluationCheckpointPlaceholder), 'Before revision pass')
    await user.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(mockedCreateCheckpoint).toHaveBeenCalledWith(
        'Before revision pass',
        undefined,
        expect.objectContaining({
          workflow: expect.objectContaining({ level: 'L3' }),
        }),
      )
    })
    expect(await screen.findByText('Before revision pass')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en.evaluationRefresh }))
    await waitFor(() => {
      expect(mockedListCheckpoints).toHaveBeenCalledTimes(2)
    })

    await user.click(screen.getByRole('button', { name: en.restore }))
    await waitFor(() => {
      expect(mockedRestoreCheckpoint).toHaveBeenCalledWith(
        'cp-restore',
        expect.objectContaining({
          workflow: expect.objectContaining({ level: 'L3' }),
        }),
      )
      expect(useAppStoreMock.getState().addMessage).toHaveBeenCalledWith(
        'assistant',
        expect.stringContaining('cp-restore'),
      )
    })
  })

  it('supports workflow confirmation, lifecycle action selection, and writer workflow presets', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()

    mockedExecutePlan
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          plan_id: 'plan-confirm',
          step_id: 'step-1',
          gate: { reason: 'Needs approval' },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'completed',
          plan_id: 'plan-confirm',
          step_id: 'step-2',
        },
      })

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: /Find the next writing move/ }))
    await waitFor(() => {
      expect(mockedRouteWorkflow).toHaveBeenCalledWith(
        expect.stringContaining('Choose the best next writing workflow'),
        'L3',
        expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'atlas-workspace' }),
        }),
      )
    })

    await user.click(screen.getByRole('button', { name: /Continue the current workflow/ }))
    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledWith(
        expect.stringContaining('Continue the workflow'),
        'L3',
        undefined,
        undefined,
        expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'atlas-workspace' }),
        }),
      )
    })

    await user.click(screen.getByRole('button', { name: 'Advanced controls' }))
    await user.clear(screen.getByLabelText(en.evaluationWorkflowPlanIdPlaceholder))
    await user.type(screen.getByLabelText(en.evaluationWorkflowPlanIdPlaceholder), 'plan-confirm')
    await user.selectOptions(screen.getByLabelText(en.evaluationWorkflowLifecycleActionLabel), 'pause')
    await user.click(screen.getByRole('button', { name: en.evaluationWorkflowLifecycle }))
    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith(
        'plan-confirm',
        'pause',
        undefined,
        expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'atlas-workspace' }),
        }),
      )
    })

    await user.click(screen.getByRole('button', { name: en.evaluationWorkflowExecute }))
    expect(await screen.findByText(en.evaluationWorkflowWaitingConfirmation)).toBeInTheDocument()
    expect(screen.getByText(`${en.evaluationWorkflowGateReason}: Needs approval`)).toBeInTheDocument()

    await user.type(screen.getByLabelText(en.evaluationWorkflowConfirmTokenPlaceholder), 'APPROVE')
    await user.click(screen.getByRole('button', { name: en.evaluationWorkflowConfirmAndContinue }))
    await waitFor(() => {
      expect(mockedExecutePlan).toHaveBeenLastCalledWith(
        'plan-confirm',
        'step-1',
        undefined,
        undefined,
        'APPROVE',
        expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'atlas-workspace' }),
        }),
      )
    })
  })

  it('uses the default workflow scope copy when no meaningful workspace is available', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: {
        ...useAppStoreMock.getState().currentWorkspace,
        identity: {
          ...useAppStoreMock.getState().currentWorkspace.identity,
          projectName: '',
        },
      },
    })
    const user = userEvent.setup()

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: /Find the next writing move/ }))

    await waitFor(() => {
      expect(mockedRouteWorkflow).toHaveBeenCalledWith(
        expect.stringContaining('the current draft'),
        'L3',
        expect.objectContaining({
          identity: expect.objectContaining({ workspaceId: 'default-project' }),
        }),
      )
    })
  })

  it('continues the current workflow by executing a seeded plan id from the active conversation', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentConversationId: 'conv-42',
      currentWorkspace: {
        ...createMeaningfulWorkspace(),
        workflow: {
          level: 'L3',
          planId: 'plan-seeded',
          sessionId: null,
        },
      },
      conversationsById: {
        'conv-42': {
          workspace: {
            ...createMeaningfulWorkspace(),
            workflow: {
              level: 'L3',
              planId: 'plan-seeded',
              sessionId: 'conv-42',
            },
            chat: {
              conversationId: 'conv-42',
              comparisonEnabled: null,
            },
          },
        },
      },
    })
    const user = userEvent.setup()

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: /Continue the current workflow/ }))

    await waitFor(() => {
      expect(mockedExecutePlan).toHaveBeenCalledWith(
        'plan-seeded',
        undefined,
        undefined,
        undefined,
        undefined,
        expect.objectContaining({
          workflow: expect.objectContaining({
            planId: 'plan-seeded',
            sessionId: 'conv-42',
          }),
          chat: expect.objectContaining({
            conversationId: 'conv-42',
          }),
        }),
      )
    })
  })

  it('uses English fallback copy for source title and multi-source hint when metadata is sparse', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(
      <EvaluationPanel
        evaluationSources={[
          {
            kind: 'currentDraft',
            label: undefined,
            content: '  Draft body  ',
          } as any,
          {
            kind: 'editorSelection',
            label: 'Editor selection',
            content: 'Selected passage',
          },
        ]}
        onClose={() => {}}
      />,
    )

    await screen.findByText(en.evaluationSuggestions)

    expect(screen.getByText('Evaluation source')).toBeInTheDocument()
    expect(screen.getByText((text) => text.includes('Scores, suggestions, and Writing Helper handoff all use the selected source.'))).toBeInTheDocument()
    expect(mockedEvaluateContent).toHaveBeenCalledWith(
      'Draft body',
      undefined,
      undefined,
      expect.any(Object),
    )
  })

  it('shows the fallback consistency error when the run fails without an explicit error message', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()

    mockedRunConsistencyCheck.mockResolvedValueOnce({ success: false })

    render(<EvaluationPanel content="Draft under review." onClose={() => {}} />)

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: en.evaluationConsistencyRun }))

    expect(await screen.findByText(en.evaluationConsistencyFailed)).toBeInTheDocument()
  })

  it('uses the Chinese current-draft fallback copy in workflow presets when no scope labels exist', async () => {
    useAppStoreMock.setState({
      currentWorkspace: {
        ...useAppStoreMock.getState().currentWorkspace,
        identity: {
          ...useAppStoreMock.getState().currentWorkspace.identity,
          projectName: '',
        },
      },
    })
    const user = userEvent.setup()

    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: evaluationSupportToolsLabel }))
    await user.click(screen.getByRole('button', { name: /制定修订计划/ }))

    await waitFor(() => {
      expect(mockedCreatePlan).toHaveBeenCalledWith(
        expect.stringContaining('当前草稿'),
        'L3',
        undefined,
        undefined,
        expect.any(Object),
      )
    })
  })

  it('uses fallback revision-session fields when multi-pass metadata is partial', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    useAppStoreMock.setState({
      currentWorkspace: createMeaningfulWorkspace(),
    })
    const user = userEvent.setup()
    const onOpenWritingHelper = vi.fn()

    mockedEvaluateContent.mockResolvedValueOnce({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 72,
        lock_score: 24,
        style_score: 24,
        logic_score: 24,
        actionable_feedback: 'Strengthen the protagonist pressure.',
        suggestions: [
          { id: 'rec-english-01', title: 'Raise conflict earlier', reason: 'increase tension', action: 'apply' },
        ],
      },
    })
    revisionOrchestratorRunMock.mockResolvedValueOnce({
      initialContent: 'Draft under review.',
      revisedContent: 'Revised draft.',
      initialScore: 6.5,
      finalScore: 8.1,
      iterations: 1,
      completed: true,
      reason: 'target_reached',
      revisionSession: {
        chapterId: 'chapter-9',
        state: 'revised',
        iteration: 1,
      },
    })

    render(
      <EvaluationPanel
        content="Draft under review."
        onClose={() => {}}
        onOpenWritingHelper={onOpenWritingHelper}
      />,
    )

    await screen.findByText(en.evaluationSuggestions)
    await user.click(screen.getByRole('button', { name: 'More tools' }))
    await user.click(screen.getByRole('button', { name: 'Run Multi-Pass' }))

    await waitFor(() => {
      expect(screen.getByText('Iterations: 1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Continue to Writing Helper with the original reply' }))

    expect(onOpenWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      handoff: expect.objectContaining({
        revisionSession: {
          id: 'revision-session',
          chapterId: 'chapter-9',
          state: 'revised',
          iteration: 1,
          comparisonSummary: null,
        },
      }),
    }))
  })
})

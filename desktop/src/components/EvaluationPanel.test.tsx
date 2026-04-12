import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EvaluationPanel } from './EvaluationPanel'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'

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
  listCheckpoints,
  novelQualityCheck,
  restoreCheckpoint,
  routeWorkflow,
  undoRecommendation,
  workflowLifecycle,
  type WorkflowExecuteResponse,
  type WorkflowLifecycleResponse,
  type WorkflowPlanStatusResponse,
} from '../api/client'

const mockedEvaluateContent = vi.mocked(evaluateContent)
const mockedNovelQualityCheck = vi.mocked(novelQualityCheck)
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
const zh = translations.zh
const evaluationWorkflowSuccessRoute = `${zh.evaluationWorkflowRoute}: ${zh.evaluationWorkflowSuccess}`
const evaluationWorkflowSuccessLifecycle = `${zh.evaluationWorkflowLifecycle}: ${zh.evaluationWorkflowSuccess}`
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
    mockedCreateCheckpoint.mockResolvedValue({ success: true, data: { checkpoint_id: 'cp-1' } })
    mockedRestoreCheckpoint.mockResolvedValue({ success: true, data: { status: 'ok' } })
    mockedRouteWorkflow.mockResolvedValue({ success: true, data: { level: 'L3', reason: 'matched', suggested_workflow: 'plan' } })
    mockedCreatePlan.mockResolvedValue({ success: true, data: defaultPlanResponse })
    mockedExecutePlan.mockResolvedValue({ success: true, data: defaultExecuteResponse })
    mockedWorkflowLifecycle.mockResolvedValue({ success: true, data: defaultLifecycleResponse })
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

  it('runs novel quality check and renders result fields', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)
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
    await userEvent.click(screen.getByRole('button', { name: zh.evaluationQualityCheckRun }))

    await waitFor(() => {
      expect(screen.getByText('service unavailable')).toBeInTheDocument()
    })
  })

  it('supports direct workflow actions and autofills IDs from response', async () => {
    render(<EvaluationPanel content="测试内容" onClose={() => {}} />)

    await screen.findByText(zh.evaluationSuggestions)

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
})

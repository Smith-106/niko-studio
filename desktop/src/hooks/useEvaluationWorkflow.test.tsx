import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeWorkflowMock = vi.hoisted(() => vi.fn())
const createPlanMock = vi.hoisted(() => vi.fn())
const executePlanMock = vi.hoisted(() => vi.fn())
const workflowLifecycleMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  routeWorkflow: routeWorkflowMock,
  createPlan: createPlanMock,
  executePlan: executePlanMock,
  workflowLifecycle: workflowLifecycleMock,
}))

const appStoreState = {
  currentConversationId: null,
  currentWorkspace: null as any,
  setCurrentWorkspace: vi.fn(),
  syncConversationWorkspace: vi.fn(),
  conversationsById: {},
}

vi.mock('../stores/appStore', () => ({
  useAppStore: Object.assign(
    (selector: (s: typeof appStoreState) => unknown) => selector(appStoreState),
    {
      getState: () => appStoreState,
      setState: (partial: any) => Object.assign(appStoreState, partial),
    },
  ),
}))

import { useEvaluationWorkflow } from './useEvaluationWorkflow'

const defaultT = {
  evaluationWorkflowLoading: 'Loading...',
  evaluationWorkflowError: 'Error',
  evaluationWorkflowSuccess: 'Success',
  evaluationWorkflowPlanIdRequired: 'Plan ID required',
  evaluationWorkflowConfirmTokenRequired: 'Confirm token required',
}

describe('useEvaluationWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appStoreState.currentConversationId = null
    appStoreState.currentWorkspace = null
    appStoreState.conversationsById = {}
    appStoreState.setCurrentWorkspace.mockReset()
    appStoreState.syncConversationWorkspace.mockReset()
  })

  it('initializes with idle workflow states', () => {
    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'test', defaultLevel: 'L3', t: defaultT }),
    )

    expect(result.current.workflowStates.route.status).toBe('idle')
    expect(result.current.workflowStates.plan.status).toBe('idle')
    expect(result.current.workflowStates.execute.status).toBe('idle')
    expect(result.current.workflowStates.lifecycle.status).toBe('idle')
    expect(result.current.workflowResult).toBe('')
    expect(result.current.workflowPlanId).toBe('')
    expect(result.current.workflowWaitingConfirmation).toBe(false)
  })

  it('sets workflow task from content prop', () => {
    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'Write a battle scene', defaultLevel: 'L3', t: defaultT }),
    )

    expect(result.current.workflowTask).toBe('Write a battle scene')
    expect(result.current.workflowLevel).toBe('L3')
  })

  it('sets loading and success states during route', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: { plan_id: 'plan-1', step_id: 'step-1' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task text', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowStates.route.status).toBe('success')
    expect(result.current.workflowStates.route.message).toBe('Success')
  })

  it('sets error state when route fails', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: false,
      error: 'routing failed',
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowStates.route.status).toBe('error')
    expect(result.current.workflowStates.route.message).toBe('routing failed')
  })

  it('sets error state when plan response contains payload error', async () => {
    createPlanMock.mockResolvedValue({
      success: true,
      data: { error: 'missing scene context' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowPlan()
    })

    expect(result.current.workflowStates.plan.status).toBe('error')
    expect(result.current.workflowStates.plan.message).toBe('missing scene context')
  })

  it('sets error when execute is called without plan ID', async () => {
    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowStates.execute.status).toBe('error')
    expect(result.current.workflowStates.execute.message).toBe('Plan ID required')
  })

  it('calls execute with plan ID when set', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: { status: 'completed', step_id: 'step-2' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(executePlanMock).toHaveBeenCalled()
    expect(result.current.workflowStates.execute.status).toBe('success')
  })

  it('detects waiting_confirmation from response payload', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: {
        status: 'waiting_confirmation',
        gate: { reason: 'Destructive action requires confirmation' },
      },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(true)
    expect(result.current.workflowGateReason).toBe('Destructive action requires confirmation')
  })

  it('resets waiting confirmation when response does not contain it', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: { status: 'completed' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(false)
    expect(result.current.workflowGateReason).toBeNull()
  })

  it('requires confirm token for handleWorkflowConfirmAndContinue', async () => {
    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
    })

    await act(async () => {
      await result.current.handleWorkflowConfirmAndContinue()
    })

    expect(result.current.workflowStates.execute.status).toBe('error')
    expect(result.current.workflowStates.execute.message).toBe('Confirm token required')
  })

  it('calls lifecycle action with correct plan ID', async () => {
    workflowLifecycleMock.mockResolvedValue({
      success: true,
      data: { plan_id: 'plan-1', action: 'pause', runner_state: 'paused' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
      result.current.setWorkflowLifecycleAction('pause')
    })

    await act(async () => {
      await result.current.handleWorkflowLifecycle()
    })

    expect(workflowLifecycleMock).toHaveBeenCalledWith(
      'plan-1',
      'pause',
    )
    expect(result.current.workflowStates.lifecycle.status).toBe('success')
  })

  it('updates workflow result as JSON string on success', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: { workflow_level: 'L3', scene_type: 'conflict' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    const parsed = JSON.parse(result.current.workflowResult)
    expect(parsed.workflow_level).toBe('L3')
  })

  it('retryWorkflowAction delegates to the correct action handler', async () => {
    routeWorkflowMock.mockResolvedValue({ success: true, data: {} })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.retryWorkflowAction('route')
    })

    expect(routeWorkflowMock).toHaveBeenCalled()
  })

  it('syncs workspace patches into the current workspace when no conversation is active', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-workspace',
        level: 'L4',
        workspace: {
          workflow: {
            sessionId: 'workspace-session',
          },
          chat: {
            conversationId: 'existing-chat',
          },
        },
      },
    })

    appStoreState.currentWorkspace = {
      workflow: { sessionId: 'current-session', level: 'L2', planId: null },
      chat: { conversationId: null },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({
        content: 'task text',
        defaultLevel: 'L3',
        workspace: appStoreState.currentWorkspace,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute({ task: 'route this', level: 'L4' })
    })

    expect(routeWorkflowMock).toHaveBeenCalledWith(
      'route this',
      'L4',
      {
        workflow: { sessionId: 'current-session', level: 'L2', planId: null },
        chat: { conversationId: null },
      },
    )
    expect(appStoreState.setCurrentWorkspace).toHaveBeenCalledWith({
      workflow: {
        sessionId: 'workspace-session',
        planId: 'plan-workspace',
        level: 'L4',
      },
      chat: {
        conversationId: 'existing-chat',
      },
    })
    expect(result.current.workflowPlanId).toBe('plan-workspace')
    expect(result.current.workflowLevel).toBe('L4')
  })

  it('syncs workflow workspace into the active conversation and injects missing session/chat ids', async () => {
    createPlanMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-conversation',
        workspace: {
          workflow: {},
          chat: {},
        },
      },
    })

    appStoreState.currentConversationId = 'conversation-1'
    appStoreState.conversationsById = {
      'conversation-1': {
        workspace: {
          workflow: { level: 'L5', planId: 'old-plan', sessionId: '' },
          chat: { conversationId: '' },
        },
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowPlan({ task: 'plan this' })
    })

    expect(createPlanMock).toHaveBeenCalledWith('plan this', 'L5')
    expect(appStoreState.syncConversationWorkspace).toHaveBeenCalledWith('conversation-1', {
      workflow: {
        planId: 'plan-conversation',
        level: 'L5',
        sessionId: 'conversation-1',
      },
      chat: {
        conversationId: 'conversation-1',
      },
    })
  })

  it('supports confirm-and-continue, reject-and-pause, and lifecycle retries with overrides', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: {
        status: 'completed',
        step_id: 'step-confirmed',
      },
    })
    workflowLifecycleMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          plan_id: 'plan-2',
          action: 'pause',
          runner_state: 'paused',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          plan_id: 'plan-3',
          action: 'resume',
          runner_state: 'running',
        },
      })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-1')
      result.current.setWorkflowStepId('step-1')
      result.current.setWorkflowConfirmToken('token-1')
      result.current.setWorkflowLifecycleAction('resume')
    })

    await act(async () => {
      await result.current.handleWorkflowApproveAndContinue()
    })

    expect(executePlanMock).toHaveBeenCalledWith(
      'plan-1',
      'step-1',
      undefined,
      undefined,
      'token-1',
    )
    expect(result.current.workflowStates.execute.status).toBe('success')
    expect(result.current.workflowStepId).toBe('step-confirmed')

    await act(async () => {
      await result.current.handleWorkflowRejectAndPause({ planId: 'plan-2' })
    })

    expect(workflowLifecycleMock).toHaveBeenNthCalledWith(1, 'plan-2', 'pause')
    expect(result.current.workflowStates.lifecycle.status).toBe('success')

    await act(async () => {
      await result.current.handleWorkflowRetryAction('lifecycle', { planId: 'plan-3', lifecycleAction: 'resume' })
    })

    expect(workflowLifecycleMock).toHaveBeenNthCalledWith(2, 'plan-3', 'resume')
    expect(result.current.workflowLifecycleAction).toBe('resume')
  })

  it('routes execute retries through confirm-and-continue when waiting confirmation and a token exist', async () => {
    executePlanMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          gate: { reason: 'Need approval' },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'completed',
          step_id: 'step-final',
        },
      })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-9')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(true)
    expect(result.current.workflowGateReason).toBe('Need approval')

    await act(async () => {
      await result.current.retryWorkflowAction('execute', {
        confirmToken: 'approved-token',
      })
    })

    expect(executePlanMock).toHaveBeenNthCalledWith(2, 'plan-9', undefined, undefined, undefined, 'approved-token')
    expect(result.current.workflowWaitingConfirmation).toBe(false)
    expect(result.current.workflowGateReason).toBeNull()
  })

  it('stringifies non-serializable payloads via String fallback and surfaces thrown action errors', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    routeWorkflowMock
      .mockResolvedValueOnce({ success: true, data: circular })
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowResult).toBe('[object Object]')
    expect(result.current.workflowStates.route.status).toBe('success')

    await act(async () => {
      await result.current.handleWorkflowRoute({ task: 'throw now' })
    })

    expect(result.current.workflowStates.route).toEqual({
      status: 'error',
      message: 'Error: boom',
    })
  })

  it('handles primitive success payloads and resets confirmation state', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: 'ok',
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-primitive')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowStates.execute).toEqual({
      status: 'success',
      message: 'Success',
    })
    expect(result.current.workflowWaitingConfirmation).toBe(false)
    expect(result.current.workflowGateReason).toBeNull()
    expect(result.current.workflowResult).toBe('"ok"')
  })

  it('returns plan-id errors for confirm, reject, and lifecycle actions without a plan', async () => {
    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowConfirmToken('token-ready')
    })

    await act(async () => {
      await result.current.handleWorkflowConfirmAndContinue()
    })
    expect(result.current.workflowStates.execute.message).toBe('Plan ID required')

    await act(async () => {
      await result.current.handleWorkflowRejectAndPause()
    })
    expect(result.current.workflowStates.lifecycle.message).toBe('Plan ID required')

    await act(async () => {
      await result.current.handleWorkflowLifecycle()
    })
    expect(result.current.workflowStates.lifecycle.message).toBe('Plan ID required')
  })

  it('routes retryWorkflowAction through plan and execute handlers when not waiting for confirmation', async () => {
    createPlanMock.mockResolvedValue({
      success: true,
      data: { plan_id: 'retry-plan' },
    })
    executePlanMock.mockResolvedValue({
      success: true,
      data: { status: 'completed', step_id: 'retry-step' },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.retryWorkflowAction('plan', {
        task: 'retry task',
        level: 'L4',
      })
    })

    expect(createPlanMock).toHaveBeenCalledWith('retry task', 'L4')
    expect(result.current.workflowPlanId).toBe('retry-plan')

    await act(async () => {
      await result.current.retryWorkflowAction('execute', {
        planId: 'retry-plan',
        stepId: 'retry-step',
      })
    })

    expect(executePlanMock).toHaveBeenCalledWith(
      'retry-plan',
      'retry-step',
      undefined,
      undefined,
      undefined,
    )
    expect(result.current.workflowStepId).toBe('retry-step')
  })

  it('skips workspace sync when setCurrentWorkspace is unavailable', async () => {
    const originalSetCurrentWorkspace = appStoreState.setCurrentWorkspace
    appStoreState.setCurrentWorkspace = undefined as unknown as typeof appStoreState.setCurrentWorkspace
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-no-sync',
        workspace: {
          workflow: { level: 'L4' },
        },
      },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowPlanId).toBe('plan-no-sync')
    expect(appStoreState.syncConversationWorkspace).not.toHaveBeenCalled()

    appStoreState.setCurrentWorkspace = originalSetCurrentWorkspace
  })

  it('passes resolved workspace through confirm-and-continue and lifecycle actions, then syncs returned workspace ids', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-exec',
        step_id: 'step-exec',
        status: 'completed',
        level: 'L5',
        workspace: {
          workflow: {},
          chat: {},
        },
      },
    })
    workflowLifecycleMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-exec',
        action: 'status',
        workspace: {
          workflow: {},
          chat: {},
        },
      },
    })

    appStoreState.currentConversationId = 'conversation-exec'
    appStoreState.currentWorkspace = {
      workflow: { level: 'L2', planId: null, sessionId: '' },
      chat: { conversationId: '' },
    }
    appStoreState.conversationsById = {
      'conversation-exec': {
        workspace: {
          workflow: { level: 'L2', planId: null, sessionId: '' },
          chat: { conversationId: '' },
        },
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({
        content: 'task',
        defaultLevel: 'L3',
        workspace: appStoreState.currentWorkspace,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.handleWorkflowConfirmAndContinue({
        planId: 'plan-exec',
        stepId: 'step-seed',
        confirmToken: '  approved-token  ',
      })
    })

    expect(executePlanMock).toHaveBeenCalledWith(
      'plan-exec',
      'step-seed',
      undefined,
      undefined,
      'approved-token',
      {
        workflow: { level: 'L2', planId: null, sessionId: '' },
        chat: { conversationId: '' },
      },
    )
    expect(appStoreState.syncConversationWorkspace).toHaveBeenCalledWith('conversation-exec', {
      workflow: {
        planId: 'plan-exec',
        level: 'L5',
        sessionId: 'conversation-exec',
      },
      chat: {
        conversationId: 'conversation-exec',
      },
    })

    await act(async () => {
      await result.current.handleWorkflowLifecycle({
        planId: 'plan-exec',
        lifecycleAction: 'status',
      })
    })

    expect(workflowLifecycleMock).toHaveBeenCalledWith(
      'plan-exec',
      'status',
      undefined,
      {
        workflow: { level: 'L2', planId: null, sessionId: '' },
        chat: { conversationId: '' },
      },
    )
  })

  it('passes undefined step and confirm token through execute when workspace context exists', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-execute-empty',
        status: 'completed',
      },
    })

    appStoreState.currentConversationId = 'conversation-execute-empty'
    appStoreState.currentWorkspace = {
      workflow: { level: 'L4', planId: null, sessionId: '' },
      chat: { conversationId: '' },
    }
    appStoreState.conversationsById = {
      'conversation-execute-empty': {
        workspace: appStoreState.currentWorkspace,
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({
        content: 'task',
        defaultLevel: 'L3',
        workspace: appStoreState.currentWorkspace,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.handleWorkflowExecute({
        planId: 'plan-execute-empty',
        stepId: '',
      })
    })

    expect(executePlanMock).toHaveBeenCalledWith(
      'plan-execute-empty',
      undefined,
      undefined,
      undefined,
      undefined,
      {
        workflow: { level: 'L4', planId: null, sessionId: '' },
        chat: { conversationId: '' },
      },
    )
    expect(result.current.workflowStates.execute.status).toBe('success')
  })

  it('passes workspace through plan requests and injects a missing chat patch for active conversations', async () => {
    createPlanMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-workspace-request',
        workspace: {
          workflow: {},
        },
      },
    })

    appStoreState.currentConversationId = 'conversation-plan'
    appStoreState.currentWorkspace = {
      workflow: { level: 'L6', planId: null, sessionId: '' },
      chat: { conversationId: '' },
    }
    appStoreState.conversationsById = {
      'conversation-plan': {
        workspace: appStoreState.currentWorkspace,
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({
        content: 'task',
        defaultLevel: 'L3',
        workspace: appStoreState.currentWorkspace,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.handleWorkflowPlan({ task: 'plan workspace task' })
    })

    expect(createPlanMock).toHaveBeenCalledWith(
      'plan workspace task',
      'L6',
      undefined,
      undefined,
      {
        workflow: { level: 'L6', planId: null, sessionId: '' },
        chat: { conversationId: '' },
      },
    )
    expect(appStoreState.syncConversationWorkspace).toHaveBeenCalledWith('conversation-plan', {
      workflow: {
        planId: 'plan-workspace-request',
        level: 'L6',
        sessionId: 'conversation-plan',
      },
      chat: {
        conversationId: 'conversation-plan',
      },
    })
  })

  it('falls back to the default error message when an action fails without response.error', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: false,
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowStates.route).toEqual({
      status: 'error',
      message: 'Error',
    })
  })

  it('treats missing and blank confirmation gate reasons as null', async () => {
    executePlanMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          gate: 'manual-review',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          gate: { reason: '   ' },
        },
      })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-gate')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(true)
    expect(result.current.workflowGateReason).toBeNull()

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(true)
    expect(result.current.workflowGateReason).toBeNull()
  })

  it('does not sync workspace state when the response has no workspace patch to apply', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: {},
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute({ level: '' })
    })

    expect(appStoreState.setCurrentWorkspace).not.toHaveBeenCalled()
    expect(appStoreState.syncConversationWorkspace).not.toHaveBeenCalled()
    expect(result.current.workflowResult).toBe('{}')
  })

  it('serializes an undefined payload as an empty object', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: undefined,
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(result.current.workflowResult).toBe('{}')
    expect(result.current.workflowStates.route.status).toBe('success')
  })

  it('injects conversation identifiers into request workspace when they are null', async () => {
    routeWorkflowMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-request-injected',
      },
    })

    appStoreState.currentConversationId = 'conversation-request'
    appStoreState.currentWorkspace = {
      workflow: { level: 'L4', planId: null, sessionId: null },
      chat: { conversationId: null },
    }
    appStoreState.conversationsById = {
      'conversation-request': {
        workspace: appStoreState.currentWorkspace,
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({
        content: 'task',
        defaultLevel: 'L3',
        workspace: appStoreState.currentWorkspace,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.handleWorkflowRoute()
    })

    expect(routeWorkflowMock).toHaveBeenCalledWith(
      'task',
      'L4',
      {
        workflow: { level: 'L4', planId: null, sessionId: 'conversation-request' },
        chat: { conversationId: 'conversation-request' },
      },
    )
  })

  it('preserves non-empty workflow and chat identifiers returned from payload patches', async () => {
    createPlanMock.mockResolvedValue({
      success: true,
      data: {
        plan_id: 'plan-preserved',
        workspace: {
          workflow: {
            level: 'L7',
            sessionId: 'session-preserved',
          },
          chat: {
            conversationId: 'chat-preserved',
          },
        },
      },
    })

    appStoreState.currentConversationId = 'conversation-preserved'
    appStoreState.conversationsById = {
      'conversation-preserved': {
        workspace: {
          workflow: { level: 'L7', planId: null, sessionId: '' },
          chat: { conversationId: '' },
        },
      },
    }

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    await act(async () => {
      await result.current.handleWorkflowPlan()
    })

    expect(appStoreState.syncConversationWorkspace).toHaveBeenCalledWith('conversation-preserved', {
      workflow: {
        planId: 'plan-preserved',
        level: 'L7',
        sessionId: 'session-preserved',
      },
      chat: {
        conversationId: 'chat-preserved',
      },
    })
    expect(result.current.workflowPlanId).toBe('plan-preserved')
  })

  it('keeps waiting confirmation active when the gate object has no reason field', async () => {
    executePlanMock.mockResolvedValue({
      success: true,
      data: {
        status: 'waiting_confirmation',
        gate: {},
      },
    })

    const { result } = renderHook(() =>
      useEvaluationWorkflow({ content: 'task', defaultLevel: 'L3', t: defaultT }),
    )

    act(() => {
      result.current.setWorkflowPlanId('plan-gate-empty')
    })

    await act(async () => {
      await result.current.handleWorkflowExecute()
    })

    expect(result.current.workflowWaitingConfirmation).toBe(true)
    expect(result.current.workflowGateReason).toBeNull()
  })
})

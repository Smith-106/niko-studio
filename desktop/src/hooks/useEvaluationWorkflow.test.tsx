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
})

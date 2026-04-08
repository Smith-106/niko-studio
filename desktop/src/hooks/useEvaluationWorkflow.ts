import { useEffect, useState } from 'react'

import type { ProjectWorkspaceContext } from '@/types/workspace'

import { createPlan, executePlan, routeWorkflow, workflowLifecycle } from '../api/client'
import { useAppStore } from '../stores/appStore'

export type WorkflowAction = 'route' | 'plan' | 'execute' | 'lifecycle'
export type WorkflowLifecycleAction = 'start' | 'pause' | 'resume' | 'stop' | 'status'

export interface WorkflowActionState {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

const defaultWorkflowActionStates = (): Record<WorkflowAction, WorkflowActionState> => ({
  route: { status: 'idle' },
  plan: { status: 'idle' },
  execute: { status: 'idle' },
  lifecycle: { status: 'idle' },
})

const stringifyWorkflowPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload ?? {}, null, 2)
  } catch {
    return String(payload)
  }
}

const readRecord = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  return payload as Record<string, unknown>
}

const readStringField = (payload: unknown, key: 'plan_id' | 'step_id'): string | null => {
  const value = readRecord(payload)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

interface UseEvaluationWorkflowOptions {
  content: string
  defaultLevel: string
  workspace?: ProjectWorkspaceContext | null
  t: {
    evaluationWorkflowLoading: string
    evaluationWorkflowError: string
    evaluationWorkflowSuccess: string
    evaluationWorkflowPlanIdRequired: string
    evaluationWorkflowConfirmTokenRequired: string
  }
}

interface WorkflowActionOverrides {
  task?: string
  level?: string
  planId?: string
  stepId?: string
  lifecycleAction?: WorkflowLifecycleAction
  confirmToken?: string
}

export function useEvaluationWorkflow({ content, defaultLevel, workspace, t }: UseEvaluationWorkflowOptions) {
  const [workflowTask, setWorkflowTask] = useState(content)
  const [workflowLevel, setWorkflowLevel] = useState(defaultLevel)
  const [workflowPlanId, setWorkflowPlanId] = useState('')
  const [workflowStepId, setWorkflowStepId] = useState('')
  const [workflowLifecycleAction, setWorkflowLifecycleAction] = useState<WorkflowLifecycleAction>('status')
  const [workflowStates, setWorkflowStates] = useState<Record<WorkflowAction, WorkflowActionState>>(defaultWorkflowActionStates())
  const [workflowResult, setWorkflowResult] = useState('')
  const [workflowConfirmToken, setWorkflowConfirmToken] = useState('')
  const [workflowGateReason, setWorkflowGateReason] = useState<string | null>(null)
  const [workflowWaitingConfirmation, setWorkflowWaitingConfirmation] = useState(false)
  const syncCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace)

  useEffect(() => {
    setWorkflowTask(content)
  }, [content])

  const setWorkflowState = (action: WorkflowAction, next: WorkflowActionState) => {
    setWorkflowStates((prev) => ({
      ...prev,
      [action]: next,
    }))
  }

  const syncWorkflowIdsFromPayload = (payload: unknown) => {
    const planId = readStringField(payload, 'plan_id')
    if (planId) {
      setWorkflowPlanId(planId)
    }
    const stepId = readStringField(payload, 'step_id')
    if (stepId) {
      setWorkflowStepId(stepId)
    }
  }

  const syncWorkflowConfirmationFromPayload = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      setWorkflowWaitingConfirmation(false)
      setWorkflowGateReason(null)
      return
    }

    const record = payload as Record<string, unknown>
    if (record.status === 'waiting_confirmation') {
      setWorkflowWaitingConfirmation(true)
      const gate = record.gate
      const reason = gate && typeof gate === 'object' ? String((gate as { reason?: unknown }).reason ?? '') : ''
      setWorkflowGateReason(reason.trim().length > 0 ? reason : null)
      return
    }

    setWorkflowWaitingConfirmation(false)
    setWorkflowGateReason(null)
  }

  const syncWorkflowWorkspaceFromPayload = (payload: unknown, levelHint?: string) => {
    if (typeof syncCurrentWorkspace !== 'function') {
      return
    }

    const record = readRecord(payload)
    if (record.workspace && typeof record.workspace === 'object') {
      syncCurrentWorkspace(record.workspace as Record<string, unknown>)
      return
    }

    const planId = readStringField(payload, 'plan_id')
    const level = typeof record.level === 'string' && record.level.trim()
      ? record.level.trim()
      : levelHint?.trim() || null

    if (!planId && !level) return

    syncCurrentWorkspace({
      workflow: {
        planId: planId ?? undefined,
        level: level ?? undefined,
      },
    })
  }

  const executeWorkflowAction = async (
    action: WorkflowAction,
    run: () => Promise<{ success: boolean; data?: unknown; error?: string }>,
    options?: {
      onSuccess?: (payload: unknown) => void
    },
  ) => {
    setWorkflowState(action, { status: 'loading', message: t.evaluationWorkflowLoading })
    try {
      const response = await run()
      if (!response.success) {
        setWorkflowState(action, {
          status: 'error',
          message: response.error || t.evaluationWorkflowError,
        })
        return
      }
      syncWorkflowIdsFromPayload(response.data)
      syncWorkflowConfirmationFromPayload(response.data)
      options?.onSuccess?.(response.data)
      setWorkflowResult(stringifyWorkflowPayload(response.data))
      setWorkflowState(action, { status: 'success', message: t.evaluationWorkflowSuccess })
    } catch (error) {
      setWorkflowState(action, {
        status: 'error',
        message: String(error),
      })
    }
  }

  const syncRequestedOverrides = (overrides?: WorkflowActionOverrides) => {
    if (!overrides) return
    if (typeof overrides.task === 'string') setWorkflowTask(overrides.task)
    if (typeof overrides.level === 'string') setWorkflowLevel(overrides.level)
    if (typeof overrides.planId === 'string') setWorkflowPlanId(overrides.planId)
    if (typeof overrides.stepId === 'string') setWorkflowStepId(overrides.stepId)
    if (typeof overrides.confirmToken === 'string') setWorkflowConfirmToken(overrides.confirmToken)
    if (overrides.lifecycleAction) setWorkflowLifecycleAction(overrides.lifecycleAction)
  }

  const handleWorkflowRoute = async (overrides?: WorkflowActionOverrides) => {
    const nextTask = overrides?.task ?? workflowTask
    const nextLevel = overrides?.level ?? workflowLevel
    syncRequestedOverrides(overrides)
    await executeWorkflowAction(
      'route',
      () => workspace
        ? routeWorkflow(nextTask, nextLevel, workspace)
        : routeWorkflow(nextTask, nextLevel),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, nextLevel),
      },
    )
  }

  const handleWorkflowPlan = async (overrides?: WorkflowActionOverrides) => {
    const nextTask = overrides?.task ?? workflowTask
    const nextLevel = overrides?.level ?? workflowLevel
    syncRequestedOverrides(overrides)
    await executeWorkflowAction(
      'plan',
      () => workspace
        ? createPlan(nextTask, nextLevel, undefined, undefined, workspace)
        : createPlan(nextTask, nextLevel),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, nextLevel),
      },
    )
  }

  const handleWorkflowExecute = async (overrides?: WorkflowActionOverrides) => {
    const nextPlanId = overrides?.planId ?? workflowPlanId
    const nextStepId = overrides?.stepId ?? workflowStepId
    syncRequestedOverrides(overrides)
    if (!nextPlanId.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowAction(
      'execute',
      () => workspace
        ? executePlan(nextPlanId, nextStepId || undefined, undefined, undefined, undefined, workspace)
        : executePlan(nextPlanId, nextStepId || undefined),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, workflowLevel),
      },
    )
  }

  const handleWorkflowConfirmAndContinue = async (overrides?: WorkflowActionOverrides) => {
    const nextPlanId = overrides?.planId ?? workflowPlanId
    const nextStepId = overrides?.stepId ?? workflowStepId
    const nextConfirmToken = overrides?.confirmToken ?? workflowConfirmToken
    syncRequestedOverrides(overrides)
    if (!nextPlanId.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    if (!nextConfirmToken.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowConfirmTokenRequired })
      return
    }
    await executeWorkflowAction(
      'execute',
      () => workspace
        ? executePlan(
          nextPlanId,
          nextStepId || undefined,
          undefined,
          undefined,
          nextConfirmToken.trim(),
          workspace,
        )
        : executePlan(nextPlanId, nextStepId || undefined, undefined, undefined, nextConfirmToken.trim()),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, workflowLevel),
      },
    )
  }

  const handleWorkflowLifecycle = async (overrides?: WorkflowActionOverrides) => {
    const nextPlanId = overrides?.planId ?? workflowPlanId
    const nextLifecycleAction = overrides?.lifecycleAction ?? workflowLifecycleAction
    syncRequestedOverrides(overrides)
    if (!nextPlanId.trim()) {
      setWorkflowState('lifecycle', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowAction(
      'lifecycle',
      () => workspace
        ? workflowLifecycle(nextPlanId, nextLifecycleAction, undefined, workspace)
        : workflowLifecycle(nextPlanId, nextLifecycleAction),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, workflowLevel),
      },
    )
  }

  const retryWorkflowAction = async (action: WorkflowAction) => {
    if (action === 'route') {
      await handleWorkflowRoute()
      return
    }
    if (action === 'plan') {
      await handleWorkflowPlan()
      return
    }
    if (action === 'execute') {
      await handleWorkflowExecute()
      return
    }
    await handleWorkflowLifecycle()
  }

  return {
    workflowTask,
    workflowLevel,
    workflowPlanId,
    workflowStepId,
    workflowLifecycleAction,
    workflowStates,
    workflowResult,
    workflowConfirmToken,
    workflowGateReason,
    workflowWaitingConfirmation,
    setWorkflowTask,
    setWorkflowLevel,
    setWorkflowPlanId,
    setWorkflowStepId,
    setWorkflowLifecycleAction,
    setWorkflowConfirmToken,
    handleWorkflowRoute,
    handleWorkflowPlan,
    handleWorkflowExecute,
    handleWorkflowConfirmAndContinue,
    handleWorkflowLifecycle,
    retryWorkflowAction,
  }
}

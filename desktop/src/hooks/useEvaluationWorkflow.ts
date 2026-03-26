import { useEffect, useState } from 'react'
import { createPlan, executePlan, routeWorkflow, workflowLifecycle } from '../api/client'

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
  t: {
    evaluationWorkflowLoading: string
    evaluationWorkflowError: string
    evaluationWorkflowSuccess: string
    evaluationWorkflowPlanIdRequired: string
    evaluationWorkflowConfirmTokenRequired: string
  }
}

export function useEvaluationWorkflow({ content, defaultLevel, t }: UseEvaluationWorkflowOptions) {
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

  const executeWorkflowAction = async (
    action: WorkflowAction,
    run: () => Promise<{ success: boolean; data?: unknown; error?: string }>
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
      setWorkflowResult(stringifyWorkflowPayload(response.data))
      setWorkflowState(action, { status: 'success', message: t.evaluationWorkflowSuccess })
    } catch (error) {
      setWorkflowState(action, {
        status: 'error',
        message: String(error),
      })
    }
  }

  const handleWorkflowRoute = async () => {
    await executeWorkflowAction('route', () => routeWorkflow(workflowTask, workflowLevel))
  }

  const handleWorkflowPlan = async () => {
    await executeWorkflowAction('plan', () => createPlan(workflowTask, workflowLevel))
  }

  const handleWorkflowExecute = async () => {
    if (!workflowPlanId.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowAction('execute', () => executePlan(workflowPlanId, workflowStepId || undefined))
  }

  const handleWorkflowConfirmAndContinue = async () => {
    if (!workflowPlanId.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    if (!workflowConfirmToken.trim()) {
      setWorkflowState('execute', { status: 'error', message: t.evaluationWorkflowConfirmTokenRequired })
      return
    }
    await executeWorkflowAction('execute', () =>
      executePlan(workflowPlanId, workflowStepId || undefined, undefined, undefined, workflowConfirmToken.trim())
    )
  }

  const handleWorkflowLifecycle = async () => {
    if (!workflowPlanId.trim()) {
      setWorkflowState('lifecycle', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowAction('lifecycle', () => workflowLifecycle(workflowPlanId, workflowLifecycleAction))
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

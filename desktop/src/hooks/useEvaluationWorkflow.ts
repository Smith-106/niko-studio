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

const readPayloadError = (payload: unknown): string | null => {
  const value = readRecord(payload).error
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
  const currentConversationId = useAppStore((state) => state.currentConversationId)
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const syncCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace)
  const syncConversationWorkspace = useAppStore((state) => state.syncConversationWorkspace)

  useEffect(() => {
    setWorkflowTask(content)
  }, [content])

  useEffect(() => {
    const conversationWorkspace = currentConversationId
      ? useAppStore.getState().conversationsById[currentConversationId]?.workspace
      : null

    setWorkflowLevel(conversationWorkspace?.workflow.level ?? defaultLevel)
    setWorkflowPlanId(conversationWorkspace?.workflow.planId ?? '')
    setWorkflowStepId('')
    setWorkflowLifecycleAction('status')
    setWorkflowStates(defaultWorkflowActionStates())
    setWorkflowResult('')
    setWorkflowConfirmToken('')
    setWorkflowGateReason(null)
    setWorkflowWaitingConfirmation(false)
  }, [currentConversationId, defaultLevel])

  const resolveWorkflowRequestWorkspace = (): ProjectWorkspaceContext | null => {
    const baseWorkspace = workspace ?? currentWorkspace ?? null
    if (!baseWorkspace) return null
    if (!currentConversationId) return baseWorkspace

    return {
      ...baseWorkspace,
      workflow: {
        ...baseWorkspace.workflow,
        sessionId: baseWorkspace.workflow.sessionId ?? currentConversationId,
      },
      chat: {
        ...baseWorkspace.chat,
        conversationId: baseWorkspace.chat.conversationId ?? currentConversationId,
      },
    }
  }

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

    const syncWorkspacePatch = (workspacePatch: Record<string, unknown>) => {
      const activeConversationId = useAppStore.getState().currentConversationId
      const activeConversation = activeConversationId
        ? useAppStore.getState().conversationsById[activeConversationId]
        : null

      if (activeConversationId && activeConversation) {
        syncConversationWorkspace(activeConversationId, workspacePatch)
        return
      }

      syncCurrentWorkspace(workspacePatch)
    }

    const record = readRecord(payload)
    const workspacePatch: Record<string, unknown> = record.workspace && typeof record.workspace === 'object'
      ? { ...(record.workspace as Record<string, unknown>) }
      : {}
    const planId = readStringField(payload, 'plan_id')
    const level = typeof record.level === 'string' && record.level.trim()
      ? record.level.trim()
      : levelHint?.trim() || null

    const workflowPatch: Record<string, unknown> = workspacePatch.workflow && typeof workspacePatch.workflow === 'object'
      ? { ...(workspacePatch.workflow as Record<string, unknown>) }
      : {}

    if (planId) workflowPatch.planId = planId
    if (level) workflowPatch.level = level
    if (
      currentConversationId
      && (typeof workflowPatch.sessionId !== 'string' || !workflowPatch.sessionId.trim())
    ) {
      workflowPatch.sessionId = currentConversationId
    }

    if (Object.keys(workflowPatch).length > 0) {
      workspacePatch.workflow = workflowPatch
    }

    if (currentConversationId) {
      const chatPatch: Record<string, unknown> = workspacePatch.chat && typeof workspacePatch.chat === 'object'
        ? { ...(workspacePatch.chat as Record<string, unknown>) }
        : {}
      if (typeof chatPatch.conversationId !== 'string' || !chatPatch.conversationId.trim()) {
        chatPatch.conversationId = currentConversationId
      }
      workspacePatch.chat = chatPatch
    }

    if (Object.keys(workspacePatch).length === 0) return
    syncWorkspacePatch(workspacePatch)
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
      const payloadError = readPayloadError(response.data)
      if (payloadError) {
        setWorkflowResult(stringifyWorkflowPayload(response.data))
        setWorkflowState(action, {
          status: 'error',
          message: payloadError,
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
    const requestWorkspace = resolveWorkflowRequestWorkspace()
    syncRequestedOverrides(overrides)
    await executeWorkflowAction(
      'route',
      () => requestWorkspace
        ? routeWorkflow(nextTask, nextLevel, requestWorkspace)
        : routeWorkflow(nextTask, nextLevel),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, nextLevel),
      },
    )
  }

  const handleWorkflowPlan = async (overrides?: WorkflowActionOverrides) => {
    const nextTask = overrides?.task ?? workflowTask
    const nextLevel = overrides?.level ?? workflowLevel
    const requestWorkspace = resolveWorkflowRequestWorkspace()
    syncRequestedOverrides(overrides)
    await executeWorkflowAction(
      'plan',
      () => requestWorkspace
        ? createPlan(nextTask, nextLevel, undefined, undefined, requestWorkspace)
        : createPlan(nextTask, nextLevel),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, nextLevel),
      },
    )
  }

  const executeWorkflowStepCore = async (
    planId: string,
    stepId?: string,
    confirmToken?: string,
  ) => {
    const requestWorkspace = resolveWorkflowRequestWorkspace()
    await executeWorkflowAction(
      'execute',
      () => requestWorkspace
        ? executePlan(
          planId,
          stepId || undefined,
          undefined,
          undefined,
          confirmToken && confirmToken.trim().length > 0 ? confirmToken.trim() : undefined,
          requestWorkspace,
        )
        : executePlan(
          planId,
          stepId || undefined,
          undefined,
          undefined,
          confirmToken && confirmToken.trim().length > 0 ? confirmToken.trim() : undefined,
        ),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, workflowLevel),
      },
    )
  }

  const executeWorkflowLifecycleCore = async (
    planId: string,
    lifecycleAction: WorkflowLifecycleAction,
  ) => {
    const requestWorkspace = resolveWorkflowRequestWorkspace()
    await executeWorkflowAction(
      'lifecycle',
      () => requestWorkspace
        ? workflowLifecycle(planId, lifecycleAction, undefined, requestWorkspace)
        : workflowLifecycle(planId, lifecycleAction),
      {
        onSuccess: (payload) => syncWorkflowWorkspaceFromPayload(payload, workflowLevel),
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
    await executeWorkflowStepCore(nextPlanId, nextStepId)
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
    await executeWorkflowStepCore(nextPlanId, nextStepId, nextConfirmToken)
  }

  const handleWorkflowRejectAndPause = async (overrides?: WorkflowActionOverrides) => {
    const nextPlanId = overrides?.planId ?? workflowPlanId
    syncRequestedOverrides(overrides)
    if (!nextPlanId.trim()) {
      setWorkflowState('lifecycle', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowLifecycleCore(nextPlanId, 'pause')
  }

  const handleWorkflowLifecycle = async (overrides?: WorkflowActionOverrides) => {
    const nextPlanId = overrides?.planId ?? workflowPlanId
    const nextLifecycleAction = overrides?.lifecycleAction ?? workflowLifecycleAction
    syncRequestedOverrides(overrides)
    if (!nextPlanId.trim()) {
      setWorkflowState('lifecycle', { status: 'error', message: t.evaluationWorkflowPlanIdRequired })
      return
    }
    await executeWorkflowLifecycleCore(nextPlanId, nextLifecycleAction)
  }

  const retryWorkflowAction = async (action: WorkflowAction, overrides?: WorkflowActionOverrides) => {
    if (action === 'route') {
      await handleWorkflowRoute(overrides)
      return
    }
    if (action === 'plan') {
      await handleWorkflowPlan(overrides)
      return
    }
    if (action === 'execute') {
      const nextConfirmToken = overrides?.confirmToken ?? workflowConfirmToken
      if (workflowWaitingConfirmation && nextConfirmToken.trim().length > 0) {
        await handleWorkflowConfirmAndContinue(overrides)
        return
      }
      await handleWorkflowExecute(overrides)
      return
    }
    await handleWorkflowLifecycle(overrides)
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
    handleWorkflowApproveAndContinue: handleWorkflowConfirmAndContinue,
    handleWorkflowRejectAndPause,
    handleWorkflowRetryAction: retryWorkflowAction,
    handleWorkflowLifecycleAction: handleWorkflowLifecycle,
  }
}

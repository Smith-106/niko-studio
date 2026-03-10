import { useState, useEffect, useRef } from 'react'
import { BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import {
  evaluateContent,
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  applyRecommendation,
  undoRecommendation,
  batchApplyRecommendations,
  getImprovementSuggestions,
  novelQualityCheck,
  routeWorkflow,
  createPlan,
  executePlan,
  workflowLifecycle,
  type RecommendationPayload,
  type RecommendationExecutionResult,
} from '../api/client'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Translations } from '../i18n'

interface EvaluationPanelProps {
  content: string
  onClose: () => void
}

interface EvaluationViewModel {
  score: number
  dimensions: {
    name: string
    score: number
    feedback: string
  }[]
  suggestions: RecommendationPayload[]
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
}

interface NovelQualityViewModel {
  decision: string
  totalScore: number
  lockScore: number
  styleScore: number
  logicScore: number
  feedback: string
}

type WorkflowAction = 'route' | 'plan' | 'execute' | 'lifecycle'
type WorkflowLifecycleAction = 'start' | 'pause' | 'resume' | 'stop' | 'status'

interface WorkflowActionState {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

interface SuggestionActionState {
  mode: 'idle' | 'processing' | 'rollback-ready'
  status: 'idle' | 'success' | 'error'
  message?: string
}

interface BatchActionState {
  mode: 'idle' | 'processing' | 'rollback-ready'
  status: 'idle' | 'success' | 'error'
  message?: string
  lastAppliedIds: string[]
}

interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

const buildDimensions = (
  data: {
    lock_score: number
    style_score: number
    logic_score: number
    actionable_feedback: string
  },
  fallbackFeedback: string,
  t: Translations,
) => {
  return [
    { name: t.evaluationDimensionLock, score: Number((data.lock_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionStyle, score: Number((data.style_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionLogic, score: Number((data.logic_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
  ]
}

const toRecommendationPayload = (
  raw: unknown,
  index: number,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload => {
  if (typeof raw === 'string') {
    const title = raw.trim()
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title,
      reason: title,
      action: 'apply',
    }
  }

  if (!raw || typeof raw !== 'object') {
    const fallback = translate('evaluationRecommendationFallback', { index: index + 1 })
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title: fallback,
      reason: fallback,
      action: 'apply',
    }
  }

  const record = raw as Record<string, unknown>
  const titleRaw = record.title ?? record.name ?? record.recommendation
  const fallbackTitle = translate('evaluationRecommendationFallback', { index: index + 1 })
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : fallbackTitle
  const reasonRaw = record.reason
  const actionRaw = record.action

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `rec-${String(index + 1).padStart(2, '0')}`,
    title,
    reason: typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : title,
    action: typeof actionRaw === 'string' && actionRaw.trim() ? actionRaw.trim() : 'apply',
  }
}

const normalizeSuggestionPayloads = (
  rawSuggestions: unknown,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload[] => {
  if (!Array.isArray(rawSuggestions)) {
    return []
  }

  return rawSuggestions
    .map((item, index) => toRecommendationPayload(item, index, translate))
    .filter((item) => item.title.length > 0)
}

const defaultSuggestionState = (): SuggestionActionState => ({
  mode: 'idle',
  status: 'idle',
})

const defaultBatchState = (): BatchActionState => ({
  mode: 'idle',
  status: 'idle',
  lastAppliedIds: [],
})

const defaultWorkflowActionStates = (): Record<WorkflowAction, WorkflowActionState> => ({
  route: { status: 'idle' },
  plan: { status: 'idle' },
  execute: { status: 'idle' },
  lifecycle: { status: 'idle' },
})

const getWorkflowActionLabel = (action: WorkflowAction, t: Translations): string => {
  if (action === 'route') return t.evaluationWorkflowRoute
  if (action === 'plan') return t.evaluationWorkflowPlan
  if (action === 'execute') return t.evaluationWorkflowExecute
  return t.evaluationWorkflowLifecycle
}

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

const formatSuggestionMessage = (
  result: RecommendationExecutionResult,
  fallbackAction: 'apply' | 'undo',
  t: Translations,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): string => {
  const actionLabel = fallbackAction === 'apply' ? t.evaluationApply : t.evaluationUndo
  if (result.error) {
    return translate('evaluationActionFailedWithReason', { action: actionLabel, reason: result.error })
  }
  if (result.message) {
    return result.message
  }
  if (result.status === 'failed') {
    return `${actionLabel}${t.restoreFailed}`
  }
  return fallbackAction === 'apply' ? t.evaluationApply : t.evaluationUndo
}

export function EvaluationPanel({ content, onClose }: EvaluationPanelProps) {
  const { t, translate } = useI18n()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<EvaluationViewModel | null>(null)
  const [checkpointDescription, setCheckpointDescription] = useState('')
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [checkpointError, setCheckpointError] = useState<string | null>(null)
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionActionState>>({})
  const [batchState, setBatchState] = useState<BatchActionState>(defaultBatchState())
  const [suggestionsRefreshing, setSuggestionsRefreshing] = useState(false)
  const [qualityChecking, setQualityChecking] = useState(false)
  const [qualityCheckError, setQualityCheckError] = useState<string | null>(null)
  const [qualityCheckResult, setQualityCheckResult] = useState<NovelQualityViewModel | null>(null)
  const [workflowTask, setWorkflowTask] = useState(content)
  const [workflowLevel, setWorkflowLevel] = useState('L3')
  const [workflowPlanId, setWorkflowPlanId] = useState('')
  const [workflowStepId, setWorkflowStepId] = useState('')
  const [workflowLifecycleAction, setWorkflowLifecycleAction] = useState<WorkflowLifecycleAction>('status')
  const [workflowStates, setWorkflowStates] = useState<Record<WorkflowAction, WorkflowActionState>>(defaultWorkflowActionStates())
  const [workflowResult, setWorkflowResult] = useState<string>('')
  const { addMessage } = useAppStore()
  const qualityGoals = useSettingsStore((state) => state.settings.qualityGoals)

  useEffect(() => {
    setWorkflowTask(content)
  }, [content])

  useEffect(() => {
    runEvaluation()
  }, [content])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusPanel = () => {
      const panel = dialogRef.current
      if (!panel) return
      const focusable = panel.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (focusable) {
        focusable.focus()
      } else {
        panel.focus()
      }
    }

    focusPanel()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const panel = dialogRef.current
      if (!panel) return

      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (!active || active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [onClose])

  const setSuggestionState = (id: string, next: SuggestionActionState) => {
    setSuggestionStates((prev) => ({
      ...prev,
      [id]: next,
    }))
  }

  const resetSuggestionStates = (suggestions: RecommendationPayload[]) => {
    const next: Record<string, SuggestionActionState> = {}
    for (const suggestion of suggestions) {
      next[suggestion.id] = defaultSuggestionState()
    }
    setSuggestionStates(next)
  }

  const runEvaluation = async () => {
    setLoading(true)
    try {
      const response = await evaluateContent(content, undefined, undefined, {
        naturalness: qualityGoals.naturalness,
        readability: qualityGoals.readability,
        coherence: qualityGoals.coherence,
        style_consistency: qualityGoals.styleConsistency,
      })
      if (response.success && response.data) {
        const data = response.data
        const suggestions = normalizeSuggestionPayloads(data.suggestions, translate)
        setResult({
          score: Number((data.total_score / 10).toFixed(1)),
          dimensions: buildDimensions(data, t.evaluationNoFeedback, t),
          suggestions,
          decision: data.decision,
        })
        resetSuggestionStates(suggestions)
        setBatchState(defaultBatchState())
      } else {
        setResult(null)
      }
    } catch (error) {
      console.error('Evaluation failed:', error)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshSuggestions = async () => {
    setSuggestionsRefreshing(true)
    try {
      const issues = result?.suggestions.map((item) => item.title).filter(Boolean)
      const response = await getImprovementSuggestions(content, issues, 8)
      if (response.success && Array.isArray(response.data) && result) {
        const suggestions = normalizeSuggestionPayloads(response.data, translate)
        setResult({
          ...result,
          suggestions,
        })
        resetSuggestionStates(suggestions)
        setBatchState(defaultBatchState())
      }
    } finally {
      setSuggestionsRefreshing(false)
    }
  }

  const runNovelQualityCheck = async () => {
    setQualityChecking(true)
    setQualityCheckError(null)
    try {
      const response = await novelQualityCheck(content, undefined, undefined, {
        naturalness: qualityGoals.naturalness,
        readability: qualityGoals.readability,
        coherence: qualityGoals.coherence,
        style_consistency: qualityGoals.styleConsistency,
      })
      if (!response.success || !response.data) {
        setQualityCheckResult(null)
        setQualityCheckError(response.error || t.evaluationQualityCheckFailed)
        return
      }

      const payload = response.data
      setQualityCheckResult({
        decision: payload.decision || 'UNKNOWN',
        totalScore: Number(payload.total_score.toFixed(1)),
        lockScore: payload.lock_score != null ? Number(payload.lock_score.toFixed(1)) : 0,
        styleScore: payload.style_score != null ? Number(payload.style_score.toFixed(1)) : 0,
        logicScore: payload.logic_score != null ? Number(payload.logic_score.toFixed(1)) : 0,
        feedback: payload.actionable_feedback?.trim() || t.evaluationNoFeedback,
      })
    } catch (error) {
      setQualityCheckResult(null)
      setQualityCheckError(String(error))
    } finally {
      setQualityChecking(false)
    }
  }

  const refreshCheckpoints = async () => {
    setCheckpointError(null)
    try {
      const response = await listCheckpoints(20)
      if (response.success && Array.isArray(response.data)) {
        setCheckpoints(response.data)
      } else {
        setCheckpointError(t.loadingCheckpoints)
      }
    } catch {
      setCheckpointError(t.loadingCheckpoints)
    }
  }

  const handleCreateCheckpoint = async () => {
    setCheckpointError(null)
    try {
      const response = await createCheckpoint(checkpointDescription || t.evaluationCheckpointPlaceholder)
      if (response.success) {
        setCheckpointDescription('')
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || t.save)
      }
    } catch {
      setCheckpointError(t.save)
    }
  }

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    setCheckpointError(null)
    try {
      const response = await restoreCheckpoint(checkpointId)
      if (response.success) {
        addMessage('assistant', translate('restoreSuccessWithCheckpoint', { checkpointId }))
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || t.restoreFailed)
      }
    } catch {
      setCheckpointError(t.restoreFailed)
    }
  }

  const handleApplySuggestion = async (suggestion: RecommendationPayload) => {
    if (!result) return

    setSuggestionState(suggestion.id, {
      mode: 'processing',
      status: 'idle',
      message: t.evaluationApplying,
    })

    const response = await applyRecommendation(content, suggestion)
    if (!response.success || !response.data) {
      setSuggestionState(suggestion.id, {
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || t.evaluationFailed,
      })
      return
    }

    const nextMode = response.data.status === 'applied' ? 'rollback-ready' : 'rollback-ready'
    const nextStatus = response.data.status === 'applied' ? 'success' : 'error'

    setSuggestionState(suggestion.id, {
      mode: nextMode,
      status: nextStatus,
      message: formatSuggestionMessage(response.data, 'apply', t, translate),
    })
  }

  const handleUndoSuggestion = async (suggestion: RecommendationPayload) => {
    if (!result) return

    setSuggestionState(suggestion.id, {
      mode: 'processing',
      status: 'idle',
      message: t.evaluationUndoing,
    })

    const response = await undoRecommendation(content, suggestion)
    if (!response.success || !response.data) {
      setSuggestionState(suggestion.id, {
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || t.evaluationFailed,
      })
      return
    }

    const nextMode = response.data.status === 'undone' ? 'idle' : 'rollback-ready'
    const nextStatus = response.data.status === 'undone' ? 'success' : 'error'

    setSuggestionState(suggestion.id, {
      mode: nextMode,
      status: nextStatus,
      message: formatSuggestionMessage(response.data, 'undo', t, translate),
    })
  }

  const handleBatchApply = async () => {
    if (!result || result.suggestions.length === 0) {
      return
    }

    setBatchState({
      mode: 'processing',
      status: 'idle',
      message: t.evaluationBatchApplying,
      lastAppliedIds: [],
    })

    const response = await batchApplyRecommendations(content, result.suggestions)
    if (!response.success || !response.data) {
      setBatchState({
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || t.evaluationFailed,
        lastAppliedIds: [],
      })
      return
    }

    const appliedIds = response.data.results
      .filter((item) => item.status === 'applied')
      .map((item) => item.recommendation_id)

    for (const item of response.data.results) {
      setSuggestionState(item.recommendation_id, {
        mode: item.status === 'applied' ? 'rollback-ready' : 'rollback-ready',
        status: item.status === 'applied' ? 'success' : 'error',
        message: formatSuggestionMessage(item, 'apply', t, translate),
      })
    }

    setBatchState({
      mode: response.data.failed > 0 || appliedIds.length > 0 ? 'rollback-ready' : 'idle',
      status: response.data.failed > 0 ? 'error' : 'success',
      message: translate('evaluationBatchResult', {
        applied: response.data.applied,
        failed: response.data.failed,
      }),
      lastAppliedIds: appliedIds,
    })
  }

  const handleBatchUndo = async () => {
    if (!result || batchState.lastAppliedIds.length === 0) {
      return
    }

    setBatchState((prev) => ({
      ...prev,
      mode: 'processing',
      status: 'idle',
      message: t.evaluationBatchUndoing,
    }))

    const appliedSuggestions = result.suggestions.filter((item) => batchState.lastAppliedIds.includes(item.id))
    let successCount = 0
    let failedCount = 0

    for (const suggestion of appliedSuggestions) {
      const response = await undoRecommendation(content, suggestion)
      if (response.success && response.data && response.data.status === 'undone') {
        successCount += 1
        setSuggestionState(suggestion.id, {
          mode: 'idle',
          status: 'success',
          message: formatSuggestionMessage(response.data, 'undo', t, translate),
        })
      } else {
        failedCount += 1
        setSuggestionState(suggestion.id, {
          mode: 'rollback-ready',
          status: 'error',
          message: response.error || t.evaluationFailed,
        })
      }
    }

    setBatchState({
      mode: failedCount > 0 ? 'rollback-ready' : 'idle',
      status: failedCount > 0 ? 'error' : 'success',
      message: translate('evaluationBatchUndoResult', {
        success: successCount,
        failed: failedCount,
      }),
      lastAppliedIds: failedCount > 0 ? batchState.lastAppliedIds : [],
    })
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400'
    return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  }

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', label: t.evaluationPassed }
      case 'REVISE':
        return { icon: AlertCircle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: t.evaluationNeedRevise }
      case 'REWRITE':
        return { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: t.evaluationNeedRewrite }
      default:
        return { icon: AlertCircle, color: 'text-gray-600 dark:text-dark-text-secondary', bg: 'bg-gray-50 dark:bg-dark-bg', label: t.evaluationUnknown }
    }
  }

  if (loading) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg p-4">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg p-4">
        <div className="text-center text-gray-400 dark:text-dark-text-secondary">{t.evaluationFailed}</div>
      </div>
    )
  }

  const decisionStyle = getDecisionStyle(result.decision)
  const DecisionIcon = decisionStyle.icon

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t.evaluationTitle}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-dark-text">{t.evaluationTitle}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={t.evaluationClose}
          title={t.evaluationClose}
        >
          ×
        </button>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.evaluationOverallScore}</span>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.score)}`}>
            {result.score.toFixed(1)} / 10
          </div>
        </div>
        <div className={`flex items-center gap-2 p-3 rounded-lg ${decisionStyle.bg}`}>
          <DecisionIcon size={20} className={decisionStyle.color} />
          <span className={`font-medium ${decisionStyle.color}`}>{decisionStyle.label}</span>
        </div>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.evaluationQualityCheckTitle}</span>
          <button
            onClick={runNovelQualityCheck}
            disabled={qualityChecking}
            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
            aria-label={t.evaluationQualityCheckRun}
            title={t.evaluationQualityCheckRun}
          >
            {qualityChecking ? t.evaluationQualityCheckRunning : t.evaluationQualityCheckRun}
          </button>
        </div>
        {qualityCheckError && (
          <p className="text-xs text-red-500">{qualityCheckError}</p>
        )}
        {qualityCheckResult && (
          <div className="mt-2 p-2 rounded border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-xs text-gray-700 dark:text-dark-text-secondary">
            <div className="font-medium text-gray-800 dark:text-dark-text mb-1">
              {t.evaluationQualityCheckDecision}: {qualityCheckResult.decision}
            </div>
            <div>{t.evaluationQualityCheckTotal}: {qualityCheckResult.totalScore}</div>
            <div>{t.evaluationQualityCheckLock}: {qualityCheckResult.lockScore}</div>
            <div>{t.evaluationQualityCheckStyle}: {qualityCheckResult.styleScore}</div>
            <div>{t.evaluationQualityCheckLogic}: {qualityCheckResult.logicScore}</div>
            <div className="mt-1">{t.evaluationQualityCheckFeedback}: {qualityCheckResult.feedback}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.evaluationDimensionAnalysis}</h3>
        <div className="space-y-3">
          {result.dimensions.map((dim, index) => (
            <div key={index} className="p-3 bg-gray-50 dark:bg-dark-bg rounded-lg border border-gray-200 dark:border-dark-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{dim.name}</span>
                <span className={`text-sm font-medium ${dim.score >= 7 ? 'text-green-600' : dim.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {dim.score}/10
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full ${dim.score >= 7 ? 'bg-green-500' : dim.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${dim.score * 10}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{dim.feedback}</p>
            </div>
          ))}
        </div>

        {result.suggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3 flex items-center gap-2">
              <TrendingUp size={16} />
              {t.evaluationSuggestions}
            </h3>
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={refreshSuggestions}
                disabled={suggestionsRefreshing}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                aria-label={t.evaluationSuggestionsRefresh}
                title={t.evaluationSuggestionsRefresh}
              >
                {suggestionsRefreshing ? t.evaluationSuggestionsRefreshing : t.evaluationSuggestionsRefresh}
              </button>
              <button
                onClick={handleBatchApply}
                disabled={batchState.mode === 'processing'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                aria-label={t.evaluationBatchApply}
                title={t.evaluationBatchApply}
              >
                {t.evaluationBatchApply}
              </button>
              <button
                onClick={handleBatchUndo}
                disabled={batchState.mode === 'processing' || batchState.lastAppliedIds.length === 0}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                aria-label={t.evaluationBatchUndo}
                title={t.evaluationBatchUndo}
              >
                {t.evaluationBatchUndo}
              </button>
            </div>
            {batchState.message && (
              <p className={`mb-3 text-xs ${batchState.status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {batchState.message}
              </p>
            )}
            <ul className="space-y-2">
              {result.suggestions.map((suggestion) => {
                const actionState = suggestionStates[suggestion.id] || defaultSuggestionState()
                return (
                  <li key={suggestion.id} className="text-sm text-gray-600 dark:text-dark-text-secondary border border-gray-200 dark:border-dark-border rounded p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-700 dark:text-dark-text">{suggestion.title}</p>
                        <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{suggestion.reason}</p>
                        {actionState.message && (
                          <p className={`text-xs mt-1 ${actionState.status === 'error' ? 'text-red-500' : actionState.status === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                            {actionState.message}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            disabled={actionState.mode === 'processing'}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                            aria-label={t.evaluationApply}
                            title={t.evaluationApply}
                          >
                            {t.evaluationApply}
                          </button>
                          <button
                            onClick={() => handleUndoSuggestion(suggestion)}
                            disabled={actionState.mode === 'processing'}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                            aria-label={t.evaluationUndo}
                            title={t.evaluationUndo}
                          >
                            {t.evaluationUndo}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-6 border-t border-gray-200 dark:border-dark-border pt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.evaluationWorkflowTitle}</h3>
          <div className="space-y-2">
            <input
              value={workflowTask}
              onChange={(e) => setWorkflowTask(e.target.value)}
              placeholder={t.evaluationWorkflowTaskPlaceholder}
              aria-label={t.evaluationWorkflowTaskPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <input
              value={workflowLevel}
              onChange={(e) => setWorkflowLevel(e.target.value)}
              placeholder={t.evaluationWorkflowLevelPlaceholder}
              aria-label={t.evaluationWorkflowLevelPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <input
              value={workflowPlanId}
              onChange={(e) => setWorkflowPlanId(e.target.value)}
              placeholder={t.evaluationWorkflowPlanIdPlaceholder}
              aria-label={t.evaluationWorkflowPlanIdPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <input
              value={workflowStepId}
              onChange={(e) => setWorkflowStepId(e.target.value)}
              placeholder={t.evaluationWorkflowStepIdPlaceholder}
              aria-label={t.evaluationWorkflowStepIdPlaceholder}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <select
              value={workflowLifecycleAction}
              onChange={(e) => setWorkflowLifecycleAction(e.target.value as WorkflowLifecycleAction)}
              aria-label={t.evaluationWorkflowLifecycleActionLabel}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            >
              <option value="status">{t.evaluationWorkflowLifecycleStatus}</option>
              <option value="start">{t.evaluationWorkflowLifecycleStart}</option>
              <option value="pause">{t.evaluationWorkflowLifecyclePause}</option>
              <option value="resume">{t.evaluationWorkflowLifecycleResume}</option>
              <option value="stop">{t.evaluationWorkflowLifecycleStop}</option>
            </select>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={handleWorkflowRoute}
              disabled={workflowStates.route.status === 'loading'}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {t.evaluationWorkflowRoute}
            </button>
            <button
              onClick={handleWorkflowPlan}
              disabled={workflowStates.plan.status === 'loading'}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {t.evaluationWorkflowPlan}
            </button>
            <button
              onClick={handleWorkflowExecute}
              disabled={workflowStates.execute.status === 'loading'}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {t.evaluationWorkflowExecute}
            </button>
            <button
              onClick={handleWorkflowLifecycle}
              disabled={workflowStates.lifecycle.status === 'loading'}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {t.evaluationWorkflowLifecycle}
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            {(['route', 'plan', 'execute', 'lifecycle'] as WorkflowAction[]).map((action) => {
              const state = workflowStates[action]
              if (state.status === 'idle' || !state.message) {
                return null
              }
              return (
                <div key={action} className="flex items-center justify-between gap-2">
                  <span className={state.status === 'error' ? 'text-red-500' : state.status === 'success' ? 'text-green-600' : 'text-gray-500'}>
                    {getWorkflowActionLabel(action, t)}: {state.message}
                  </span>
                  {state.status === 'error' && (
                    <button
                      onClick={() => retryWorkflowAction(action)}
                      className="px-2 py-1 bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                    >
                      {t.evaluationWorkflowRetry}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {workflowResult && (
            <pre className="mt-3 p-2 rounded border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-[11px] text-gray-700 dark:text-dark-text-secondary overflow-x-auto whitespace-pre-wrap">
              {workflowResult}
            </pre>
          )}
        </div>

        <div className="mt-6 border-t border-gray-200 dark:border-dark-border pt-4">
          <div className="flex gap-2 mb-3">
            <input
              value={checkpointDescription}
              onChange={(e) => setCheckpointDescription(e.target.value)}
              placeholder={t.evaluationCheckpointPlaceholder}
              aria-label={t.evaluationCheckpointPlaceholder}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <button
              onClick={handleCreateCheckpoint}
              className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              aria-label={t.save}
              title={t.save}
            >
              {t.save}
            </button>
            <button
              onClick={refreshCheckpoints}
              className="px-3 py-2 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
              aria-label={t.evaluationRefresh}
              title={t.evaluationRefresh}
            >
              {t.evaluationRefresh}
            </button>
          </div>
          {checkpointError && (
            <p className="text-xs text-red-500 mb-2">{checkpointError}</p>
          )}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="p-2 border border-gray-200 dark:border-dark-border rounded"
              >
                <div className="text-xs text-gray-700 dark:text-dark-text">{checkpoint.description || checkpoint.id}</div>
                <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                <button
                  onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                  className="mt-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                  aria-label={t.restore}
                  title={t.restore}
                >
                  {t.restore}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

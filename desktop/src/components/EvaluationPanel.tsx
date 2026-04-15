import { useEffect, useRef } from 'react'
import { BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import {
  type RecommendationPayload,
} from '../api/client'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Translations } from '../i18n'
import { useEvaluationWorkflow, type WorkflowAction, type WorkflowLifecycleAction } from '../hooks/useEvaluationWorkflow'
import { useEvaluationRecommendations, defaultSuggestionState } from '../hooks/useEvaluationRecommendations'
import { useEvaluationCheckpoints } from '../hooks/useEvaluationCheckpoints'
import { useEvaluationQualityCheck } from '../hooks/useEvaluationQualityCheck'
import { useEvaluationData } from '../hooks/useEvaluationData'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'

interface EvaluationPanelProps {
  content: string
  onClose: () => void
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

const getWorkflowActionLabel = (action: WorkflowAction, t: Translations): string => {
  if (action === 'route') return t.evaluationWorkflowRoute
  if (action === 'plan') return t.evaluationWorkflowPlan
  if (action === 'execute') return t.evaluationWorkflowExecute
  return t.evaluationWorkflowLifecycle
}

const panelShellClassName =
  'fixed right-0 top-14 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg z-30'

export function EvaluationPanel({ content, onClose }: EvaluationPanelProps) {
  const { t, translate, language } = useI18n()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const qualityGoals = useSettingsStore((state) => state.settings.qualityGoals)
  const workspaceSummary = useWriterWorkspaceSummary()
  const isZh = language === 'zh'
  const writerWorkflowTitle = isZh ? '下一步写作流程' : 'Next writing workflow'
  const writerWorkflowHint = isZh
    ? '先用面向作者的操作决定接下来要做什么。需要 plan_id、step_id 或生命周期控制时，再使用下方高级控制。'
    : 'Start with writer-facing actions to decide the next step. Use the advanced controls below when you need plan_id, step_id, or lifecycle commands.'
  const writerAdvancedTitle = isZh ? '高级控制' : 'Advanced controls'
  const writerAdvancedHint = isZh
    ? '保留完整流程能力，但把底层控制和确认令牌集中在这里。'
    : 'Full workflow power stays available here, with low-level controls and confirmation tokens kept out of the main path.'
  const {
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
  } = useEvaluationWorkflow({
    content,
    defaultLevel: 'L3',
    workspace: workspaceSummary.meaningfulWorkspace,
    t: {
      evaluationWorkflowLoading: t.evaluationWorkflowLoading,
      evaluationWorkflowError: t.evaluationWorkflowError,
      evaluationWorkflowSuccess: t.evaluationWorkflowSuccess,
      evaluationWorkflowPlanIdRequired: t.evaluationWorkflowPlanIdRequired,
      evaluationWorkflowConfirmTokenRequired: t.evaluationWorkflowConfirmTokenRequired,
    },
  })
  const {
    loading,
    result,
    suggestionsRefreshing,
    suggestionsRefreshError,
    refreshSuggestions,
  } = useEvaluationData({
    content,
    qualityGoals,
    t: {
      evaluationSuggestionsRefreshFailed: t.evaluationSuggestionsRefreshFailed,
    },
    translateSuggestions: (rawSuggestions) => normalizeSuggestionPayloads(rawSuggestions, translate),
    buildViewModel: (data) => ({
      score: Number((data.total_score / 10).toFixed(1)),
      dimensions: buildDimensions(
        {
          lock_score: data.lock_score as number,
          style_score: data.style_score as number,
          logic_score: data.logic_score as number,
          actionable_feedback: data.actionable_feedback as string,
        },
        t.evaluationNoFeedback,
        t,
      ),
      suggestions: data.suggestions,
      decision: data.decision,
    }),
  })
  const {
    suggestionStates,
    batchState,
    resetRecommendationStates,
    handleApplySuggestion,
    handleUndoSuggestion,
    handleBatchApply,
    handleBatchUndo,
  } = useEvaluationRecommendations({
    content,
    suggestions: result?.suggestions ?? [],
    t,
    translate,
  })
  const { addMessage } = useAppStore()
  const {
    checkpointDescription,
    checkpoints,
    checkpointError,
    setCheckpointDescription,
    refreshCheckpoints,
    handleCreateCheckpoint,
    handleRestoreCheckpoint,
  } = useEvaluationCheckpoints({
    t: {
      loadingCheckpoints: t.loadingCheckpoints,
      evaluationCheckpointPlaceholder: t.evaluationCheckpointPlaceholder,
      save: t.save,
      restoreFailed: t.restoreFailed,
    },
    onRestoreSuccess: async (checkpointId) => {
      addMessage('assistant', translate('restoreSuccessWithCheckpoint', { checkpointId }))
    },
  })
  const {
    qualityChecking,
    qualityCheckError,
    qualityCheckResult,
    runNovelQualityCheck,
  } = useEvaluationQualityCheck({
    content,
    qualityGoals,
    t: {
      evaluationQualityCheckFailed: t.evaluationQualityCheckFailed,
      evaluationNoFeedback: t.evaluationNoFeedback,
    },
  })

  useEffect(() => {
    resetRecommendationStates(result?.suggestions ?? [])
  }, [result?.suggestions])

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
  })

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
      <div className={`${panelShellClassName} p-4`}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={`${panelShellClassName} p-4`}>
        <div className="text-center text-gray-400 dark:text-dark-text-secondary">{t.evaluationFailed}</div>
      </div>
    )
  }

  const decisionStyle = getDecisionStyle(result.decision)
  const DecisionIcon = decisionStyle.icon
  const scopeSubject = workspaceSummary.chapterLabel
    ?? workspaceSummary.projectLabel
    ?? (isZh ? '当前草稿' : 'the current draft')
  const writerWorkflowPresets = [
    {
      id: 'next-step',
      title: isZh ? '找出下一步写作重点' : 'Find the next writing move',
      description: isZh
        ? '让系统基于当前项目范围，为这一段内容推荐最合适的写作流程。'
        : 'Route this draft through the workflow that best fits the current project scope.',
      action: () => handleWorkflowRoute({
        task: isZh
          ? `围绕${scopeSubject}判断下一步最合适的写作流程，并说明为什么。`
          : `Choose the best next writing workflow for ${scopeSubject} and explain why.`,
        level: 'L3',
      }),
    },
    {
      id: 'revision-plan',
      title: isZh ? '制定修订计划' : 'Plan a revision pass',
      description: isZh
        ? '按当前章节与设定整理下一轮修订清单，优先处理连贯性、角色动机和节奏。'
        : 'Build the next revision pass for this draft with continuity, character motivation, and pacing at the top.',
      action: () => handleWorkflowPlan({
        task: isZh
          ? `为${scopeSubject}制定下一轮修订计划，优先检查连贯性、角色动机和节奏。`
          : `Create the next revision plan for ${scopeSubject}, focusing on continuity, motivation, and pacing.`,
        level: 'L3',
      }),
    },
    {
      id: 'continue-plan',
      title: isZh ? '继续当前流程' : 'Continue the current workflow',
      description: isZh
        ? '如果已经有计划，就继续执行；如果还没有，就先生成一个可执行计划。'
        : 'Resume the active plan when one exists, or create an executable plan first.',
      action: () => workflowPlanId.trim()
        ? handleWorkflowExecute({ planId: workflowPlanId })
        : handleWorkflowPlan({
          task: isZh
            ? `继续推进${scopeSubject}的写作流程，并给出当前最安全的下一步。`
            : `Continue the workflow for ${scopeSubject} and surface the safest next writing step.`,
          level: 'L3',
        }),
    },
  ]

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`${panelShellClassName} flex flex-col`}
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
            {suggestionsRefreshError && (
              <p className="mb-3 text-xs text-red-500" role="alert">
                {suggestionsRefreshError}
              </p>
            )}
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
          <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{writerWorkflowTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
            {writerWorkflowHint}
          </p>
          {workspaceSummary.hasMeaningfulScope && (
            <div className="mt-3 flex flex-wrap gap-2">
              {workspaceSummary.scopeChips.map((chip) => (
                <span
                  key={`evaluation-scope-${chip}`}
                  className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 space-y-2">
            {writerWorkflowPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  void preset.action()
                }}
                className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 dark:border-dark-border dark:bg-dark-bg dark:hover:border-primary-500/30 dark:hover:bg-dark-surface"
              >
                <div className="text-sm font-medium text-gray-800 dark:text-dark-text">{preset.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
              {writerAdvancedTitle}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
              {writerAdvancedHint}
            </p>
            <div className="mt-3 space-y-2">
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
                onClick={() => {
                  void handleWorkflowRoute()
                }}
                disabled={workflowStates.route.status === 'loading'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {t.evaluationWorkflowRoute}
              </button>
              <button
                onClick={() => {
                  void handleWorkflowPlan()
                }}
                disabled={workflowStates.plan.status === 'loading'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {t.evaluationWorkflowPlan}
              </button>
              <button
                onClick={() => {
                  void handleWorkflowExecute()
                }}
                disabled={workflowStates.execute.status === 'loading'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {t.evaluationWorkflowExecute}
              </button>
              <button
                onClick={() => {
                  void handleWorkflowLifecycle()
                }}
                disabled={workflowStates.lifecycle.status === 'loading'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {t.evaluationWorkflowLifecycle}
              </button>
            </div>

            {workflowWaitingConfirmation && (
              <div className="mt-3 rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-2 text-xs">
                <div className="font-medium text-amber-700 dark:text-amber-200">{t.evaluationWorkflowWaitingConfirmation}</div>
                {workflowGateReason && (
                  <div className="mt-1 text-amber-700/80 dark:text-amber-200/80">{t.evaluationWorkflowGateReason}: {workflowGateReason}</div>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    value={workflowConfirmToken}
                    onChange={(e) => setWorkflowConfirmToken(e.target.value)}
                    placeholder={t.evaluationWorkflowConfirmTokenPlaceholder}
                    aria-label={t.evaluationWorkflowConfirmTokenPlaceholder}
                    className="flex-1 px-2 py-1 text-xs border border-amber-200 dark:border-amber-700 dark:bg-dark-bg dark:text-dark-text rounded"
                  />
                  <button
                    onClick={() => {
                      void handleWorkflowConfirmAndContinue()
                    }}
                    disabled={workflowStates.execute.status === 'loading'}
                    className="px-2 py-1 text-xs bg-amber-600 text-white rounded disabled:opacity-50"
                  >
                    {t.evaluationWorkflowConfirmAndContinue}
                  </button>
                </div>
              </div>
            )}

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
                        onClick={() => {
                          void retryWorkflowAction(action)
                        }}
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

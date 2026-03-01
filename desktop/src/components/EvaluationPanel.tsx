import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import {
  evaluateContent,
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  applyRecommendation,
  undoRecommendation,
  batchApplyRecommendations,
  type RecommendationPayload,
  type RecommendationExecutionResult,
} from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'

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

const buildDimensions = (data: {
  lock_score: number
  style_score: number
  logic_score: number
  actionable_feedback: string
}) => {
  return [
    { name: 'Readability', score: Number((data.lock_score / 4).toFixed(1)), feedback: data.actionable_feedback || 'N/A' },
    { name: 'Style Consistency', score: Number((data.style_score / 4).toFixed(1)), feedback: data.actionable_feedback || 'N/A' },
    { name: 'Logic & Coherence', score: Number((data.logic_score / 4).toFixed(1)), feedback: data.actionable_feedback || 'N/A' },
  ]
}

const toRecommendationPayload = (raw: unknown, index: number): RecommendationPayload => {
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
    const fallback = `recommendation-${index + 1}`
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title: fallback,
      reason: fallback,
      action: 'apply',
    }
  }

  const record = raw as Record<string, unknown>
  const titleRaw = record.title ?? record.name ?? record.recommendation
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : `recommendation-${index + 1}`
  const reasonRaw = record.reason
  const actionRaw = record.action

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `rec-${String(index + 1).padStart(2, '0')}`,
    title,
    reason: typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : title,
    action: typeof actionRaw === 'string' && actionRaw.trim() ? actionRaw.trim() : 'apply',
  }
}

const normalizeSuggestionPayloads = (rawSuggestions: unknown): RecommendationPayload[] => {
  if (!Array.isArray(rawSuggestions)) {
    return []
  }

  return rawSuggestions
    .map((item, index) => toRecommendationPayload(item, index))
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

const buildQualityGoals = (enabled: boolean, preset: 'balanced' | 'strict' | 'creative') => {
  if (!enabled) {
    return undefined
  }

  return {
    naturalness: true,
    readability: true,
    styleConsistency: true,
    coherence: true,
    editingGuidance: true,
    preset,
  }
}

const PANEL_CARD_CLASS = 'p-3 bg-slate-50 dark:bg-dark-bg rounded-lg border border-slate-200 dark:border-dark-border'

const formatSuggestionMessage = (result: RecommendationExecutionResult, fallbackAction: 'apply' | 'undo'): string => {
  const actionLabel = fallbackAction === 'apply' ? '应用' : '撤销'
  if (result.error) {
    return `${actionLabel}失败：${result.error}`
  }
  if (result.message) {
    return result.message
  }
  if (result.status === 'failed') {
    return `${actionLabel}失败`
  }
  return fallbackAction === 'apply' ? '建议已应用' : '建议已撤销'
}

export function EvaluationPanel({ content, onClose }: EvaluationPanelProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<EvaluationViewModel | null>(null)
  const [checkpointDescription, setCheckpointDescription] = useState('')
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [checkpointError, setCheckpointError] = useState<string | null>(null)
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionActionState>>({})
  const [batchState, setBatchState] = useState<BatchActionState>(defaultBatchState())
  const { addMessage } = useAppStore()
  const writingQuality = useSettingsStore((state) => state.settings.writingQuality)

  useEffect(() => {
    runEvaluation()
  }, [content])

  useEffect(() => {
    refreshCheckpoints()
  }, [])

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
        qualityGoals: buildQualityGoals(writingQuality.enabled, writingQuality.preset),
      })
      if (response.success && response.data) {
        const data = response.data
        const suggestions = normalizeSuggestionPayloads(data.suggestions)
        setResult({
          score: Number((data.total_score / 10).toFixed(1)),
          dimensions: buildDimensions(data),
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

  const refreshCheckpoints = async () => {
    setCheckpointError(null)
    try {
      const response = await listCheckpoints(20)
      if (response.success && Array.isArray(response.data)) {
        setCheckpoints(response.data)
      } else {
        setCheckpointError('加载 checkpoint 失败')
      }
    } catch {
      setCheckpointError('加载 checkpoint 失败')
    }
  }

  const handleCreateCheckpoint = async () => {
    setCheckpointError(null)
    try {
      const response = await createCheckpoint(checkpointDescription || '手动保存 checkpoint')
      if (response.success) {
        setCheckpointDescription('')
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || '创建 checkpoint 失败')
      }
    } catch {
      setCheckpointError('创建 checkpoint 失败')
    }
  }

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    setCheckpointError(null)
    try {
      const response = await restoreCheckpoint(checkpointId)
      if (response.success) {
        addMessage('assistant', `系统提示：已恢复 checkpoint ${checkpointId}`)
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || '恢复 checkpoint 失败')
      }
    } catch {
      setCheckpointError('恢复 checkpoint 失败')
    }
  }

  const handleApplySuggestion = async (suggestion: RecommendationPayload) => {
    if (!result) return

    setSuggestionState(suggestion.id, {
      mode: 'processing',
      status: 'idle',
      message: '执行中...'
    })

    const response = await applyRecommendation(content, suggestion)
    if (!response.success || !response.data) {
      setSuggestionState(suggestion.id, {
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || '应用失败',
      })
      return
    }

    const nextMode = response.data.status === 'applied' ? 'rollback-ready' : 'rollback-ready'
    const nextStatus = response.data.status === 'applied' ? 'success' : 'error'

    setSuggestionState(suggestion.id, {
      mode: nextMode,
      status: nextStatus,
      message: formatSuggestionMessage(response.data, 'apply'),
    })
  }

  const handleUndoSuggestion = async (suggestion: RecommendationPayload) => {
    if (!result) return

    setSuggestionState(suggestion.id, {
      mode: 'processing',
      status: 'idle',
      message: '撤销中...'
    })

    const response = await undoRecommendation(content, suggestion)
    if (!response.success || !response.data) {
      setSuggestionState(suggestion.id, {
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || '撤销失败',
      })
      return
    }

    const nextMode = response.data.status === 'undone' ? 'idle' : 'rollback-ready'
    const nextStatus = response.data.status === 'undone' ? 'success' : 'error'

    setSuggestionState(suggestion.id, {
      mode: nextMode,
      status: nextStatus,
      message: formatSuggestionMessage(response.data, 'undo'),
    })
  }

  const handleBatchApply = async () => {
    if (!result || result.suggestions.length === 0) {
      return
    }

    setBatchState({
      mode: 'processing',
      status: 'idle',
      message: '批量执行中...',
      lastAppliedIds: [],
    })

    const response = await batchApplyRecommendations(content, result.suggestions)
    if (!response.success || !response.data) {
      setBatchState({
        mode: 'rollback-ready',
        status: 'error',
        message: response.error || '批量应用失败',
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
        message: formatSuggestionMessage(item, 'apply'),
      })
    }

    setBatchState({
      mode: response.data.failed > 0 || appliedIds.length > 0 ? 'rollback-ready' : 'idle',
      status: response.data.failed > 0 ? 'error' : 'success',
      message: `批量结果：成功 ${response.data.applied}，失败 ${response.data.failed}`,
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
      message: '批量撤销中...',
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
          message: formatSuggestionMessage(response.data, 'undo'),
        })
      } else {
        failedCount += 1
        setSuggestionState(suggestion.id, {
          mode: 'rollback-ready',
          status: 'error',
          message: response.error || '撤销失败',
        })
      }
    }

    setBatchState({
      mode: failedCount > 0 ? 'rollback-ready' : 'idle',
      status: failedCount > 0 ? 'error' : 'success',
      message: `批量撤销结果：成功 ${successCount}，失败 ${failedCount}`,
      lastAppliedIds: failedCount > 0 ? batchState.lastAppliedIds : [],
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400'
    return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  }

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', label: '通过' }
      case 'REVISE':
        return { icon: AlertCircle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', label: '需修改' }
      case 'REWRITE':
        return { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: '需重写' }
      default:
        return { icon: AlertCircle, color: 'text-slate-600 dark:text-dark-text-secondary', bg: 'bg-slate-50 dark:bg-dark-bg', label: '未知' }
    }
  }

  if (loading) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-slate-200 dark:border-dark-border shadow-lg p-4">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-slate-200 dark:border-dark-border shadow-lg p-4">
        <div className="text-center text-slate-400 dark:text-dark-text-secondary">评估失败</div>
      </div>
    )
  }

  const decisionStyle = getDecisionStyle(result.decision)
  const DecisionIcon = decisionStyle.icon

  return (
    <div className="fixed right-0 top-12 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-slate-200 dark:border-dark-border shadow-lg flex flex-col" role="dialog" aria-modal="true" aria-label="评估面板">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-teal-600" />
          <span className="font-semibold text-slate-900 dark:text-dark-text">质量评估</span>
        </div>
        <button onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500 rounded" aria-label="关闭评估面板">
          ✕
        </button>
      </div>

      <div className="p-4 border-b border-slate-200 dark:border-dark-border">
        <div className="text-xs text-slate-500 dark:text-dark-text-secondary mb-2">
          质量增强预设：{writingQuality.enabled ? writingQuality.preset : 'off'}
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-slate-500 dark:text-dark-text-secondary">综合评分</span>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.score)}`}>
            {result.score.toFixed(1)} / 10
          </div>
        </div>
        <div className={`flex items-center gap-2 p-3 rounded-lg ${decisionStyle.bg}`}>
          <DecisionIcon size={20} className={decisionStyle.color} />
          <span className={`font-medium ${decisionStyle.color}`}>{decisionStyle.label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-3">维度分析</h3>
        <div className="space-y-3">
          {result.dimensions.map((dim, index) => (
            <div key={index} className={PANEL_CARD_CLASS}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-dark-text">{dim.name}</span>
                <span className={`text-sm font-medium ${dim.score >= 7 ? 'text-green-600' : dim.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {dim.score}/10
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-dark-border rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full ${dim.score >= 7 ? 'bg-green-500' : dim.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${dim.score * 10}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-dark-text-secondary">{dim.feedback}</p>
            </div>
          ))}
        </div>

        {result.suggestions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-3 flex items-center gap-2">
              <TrendingUp size={16} />
              改进建议
            </h3>
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={handleBatchApply}
                disabled={batchState.mode === 'processing'}
                className="cursor-pointer px-2 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                批量应用
              </button>
              <button
                onClick={handleBatchUndo}
                disabled={batchState.mode === 'processing' || batchState.lastAppliedIds.length === 0}
                className="cursor-pointer px-2 py-1 text-xs bg-slate-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                批量撤销
              </button>
            </div>
            {batchState.message && (
              <p aria-live="polite" className={`mb-3 text-xs ${batchState.status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {batchState.message}
              </p>
            )}
            <ul className="space-y-2">
              {result.suggestions.map((suggestion) => {
                const actionState = suggestionStates[suggestion.id] || defaultSuggestionState()
                return (
                  <li key={suggestion.id} className="text-sm text-slate-600 dark:text-dark-text-secondary border border-slate-200 dark:border-dark-border rounded p-2">
                    <div className="flex items-start gap-2">
                      <span className="text-teal-500">•</span>
                      <div className="flex-1">
                        <p className="font-medium text-slate-700 dark:text-dark-text">{suggestion.title}</p>
                        <p className="text-xs text-slate-500 dark:text-dark-text-secondary">{suggestion.reason}</p>
                        {actionState.message && (
                          <p aria-live="polite" className={`text-xs mt-1 ${actionState.status === 'error' ? 'text-red-500' : actionState.status === 'success' ? 'text-green-600' : 'text-slate-500'}`}>
                            {actionState.message}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApplySuggestion(suggestion)}
                            disabled={actionState.mode === 'processing'}
                            className="cursor-pointer px-2 py-1 text-xs bg-teal-600 text-white rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            apply
                          </button>
                          <button
                            onClick={() => handleUndoSuggestion(suggestion)}
                            disabled={actionState.mode === 'processing'}
                            className="cursor-pointer px-2 py-1 text-xs bg-slate-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            undo
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

        <div className="mt-6 border-t border-slate-200 dark:border-dark-border pt-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-dark-text mb-3">Checkpoint</h3>
          <div className="flex gap-2 mb-3">
            <input
              value={checkpointDescription}
              onChange={(e) => setCheckpointDescription(e.target.value)}
              placeholder="checkpoint 描述"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
            />
            <button
              onClick={handleCreateCheckpoint}
              className="cursor-pointer px-3 py-2 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              保存
            </button>
            <button
              onClick={refreshCheckpoints}
              className="cursor-pointer px-3 py-2 text-xs bg-slate-100 dark:bg-dark-border dark:text-dark-text rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              刷新
            </button>
          </div>
          {checkpointError && (
            <p className="text-xs text-red-500 mb-2">{checkpointError}</p>
          )}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="p-2 border border-slate-200 dark:border-dark-border rounded"
              >
                <div className="text-xs text-slate-700 dark:text-dark-text">{checkpoint.description || checkpoint.id}</div>
                <div className="text-[11px] text-slate-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                <button
                  onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                  className="cursor-pointer mt-1 px-2 py-1 text-xs bg-slate-100 dark:bg-dark-border dark:text-dark-text rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

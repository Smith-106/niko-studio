import { useState } from 'react'
import { applyRecommendation, batchApplyRecommendations, undoRecommendation, type RecommendationExecutionResult, type RecommendationPayload } from '../api/client'
import type { Translations } from '../i18n'

export interface SuggestionActionState {
  mode: 'idle' | 'processing' | 'rollback-ready'
  status: 'idle' | 'success' | 'error'
  message?: string
}

export interface BatchActionState {
  mode: 'idle' | 'processing' | 'rollback-ready'
  status: 'idle' | 'success' | 'error'
  message?: string
  lastAppliedIds: string[]
}

export const defaultSuggestionState = (): SuggestionActionState => ({
  mode: 'idle',
  status: 'idle',
})

export const defaultBatchState = (): BatchActionState => ({
  mode: 'idle',
  status: 'idle',
  lastAppliedIds: [],
})

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

interface UseEvaluationRecommendationsOptions {
  content: string
  suggestions: RecommendationPayload[]
  t: Translations
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string
}

export function useEvaluationRecommendations({
  content,
  suggestions,
  t,
  translate,
}: UseEvaluationRecommendationsOptions) {
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionActionState>>({})
  const [batchState, setBatchState] = useState<BatchActionState>(defaultBatchState())

  const setSuggestionState = (id: string, next: SuggestionActionState) => {
    setSuggestionStates((prev) => ({
      ...prev,
      [id]: next,
    }))
  }

  const resetSuggestionStates = (nextSuggestions: RecommendationPayload[]) => {
    const next: Record<string, SuggestionActionState> = {}
    for (const suggestion of nextSuggestions) {
      next[suggestion.id] = defaultSuggestionState()
    }
    setSuggestionStates(next)
  }

  const resetRecommendationStates = (nextSuggestions: RecommendationPayload[]) => {
    resetSuggestionStates(nextSuggestions)
    setBatchState(defaultBatchState())
  }

  const handleApplySuggestion = async (suggestion: RecommendationPayload) => {
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

    setSuggestionState(suggestion.id, {
      mode: 'rollback-ready',
      status: response.data.status === 'applied' ? 'success' : 'error',
      message: formatSuggestionMessage(response.data, 'apply', t, translate),
    })
  }

  const handleUndoSuggestion = async (suggestion: RecommendationPayload) => {
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

    setSuggestionState(suggestion.id, {
      mode: response.data.status === 'undone' ? 'idle' : 'rollback-ready',
      status: response.data.status === 'undone' ? 'success' : 'error',
      message: formatSuggestionMessage(response.data, 'undo', t, translate),
    })
  }

  const handleBatchApply = async () => {
    if (suggestions.length === 0) {
      return
    }

    setBatchState({
      mode: 'processing',
      status: 'idle',
      message: t.evaluationBatchApplying,
      lastAppliedIds: [],
    })

    const response = await batchApplyRecommendations(content, suggestions)
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
        mode: 'rollback-ready',
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
    if (batchState.lastAppliedIds.length === 0) {
      return
    }

    setBatchState((prev) => ({
      ...prev,
      mode: 'processing',
      status: 'idle',
      message: t.evaluationBatchUndoing,
    }))

    const appliedSuggestions = suggestions.filter((item) => batchState.lastAppliedIds.includes(item.id))
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

  return {
    suggestionStates,
    batchState,
    resetRecommendationStates,
    handleApplySuggestion,
    handleUndoSuggestion,
    handleBatchApply,
    handleBatchUndo,
  }
}

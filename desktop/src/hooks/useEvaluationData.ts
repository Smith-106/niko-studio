import { useEffect, useState } from 'react'
import { evaluateContent, getImprovementSuggestions, type RecommendationPayload } from '../api/client'
import { buildFailurePresentation, type FailurePresentation } from '../utils/failurePresentation'
import { logger } from '../utils/logger'

export interface EvaluationViewModel {
  score: number
  dimensions: {
    name: string
    score: number
    feedback: string
  }[]
  modules: {
    name: string
    score: number
    feedback: string
  }[]
  suggestions: RecommendationPayload[]
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
}

interface UseEvaluationDataOptions {
  content: string
  qualityGoals: {
    naturalness: number
    readability: number
    coherence: number
    styleConsistency: number
  }
  t: {
    evaluationFailed: string
    evaluationSuggestionsRefreshFailed: string
    failureCategoryGeneration: string
    failureCategoryEvaluation: string
    failureCategoryRetrieval: string
    failureCategoryConnection: string
    failureMessageGeneration: string
    failureMessageEvaluation: string
    failureMessageRetrieval: string
    failureMessageConnection: string
  }
  translateSuggestions: (rawSuggestions: unknown) => RecommendationPayload[]
  buildViewModel: (payload: {
    total_score: number
    suggestions: RecommendationPayload[]
    decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
    [key: string]: unknown
  }) => EvaluationViewModel
}

export function useEvaluationData({
  content,
  qualityGoals,
  t,
  translateSuggestions,
  buildViewModel,
}: UseEvaluationDataOptions) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<EvaluationViewModel | null>(null)
  const [evaluationError, setEvaluationError] = useState<FailurePresentation | null>(null)
  const [suggestionsRefreshing, setSuggestionsRefreshing] = useState(false)
  const [suggestionsRefreshError, setSuggestionsRefreshError] = useState<string | null>(null)

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
        const suggestions = translateSuggestions(response.data.suggestions)
        setResult(buildViewModel({ ...response.data, suggestions }))
        setEvaluationError(null)
      } else {
        setResult(null)
        setEvaluationError(buildFailurePresentation({
          t,
          source: 'evaluation',
          error: response.error,
          fallbackMessage: t.evaluationFailed,
        }))
      }
    } catch (error) {
      logger.error('Evaluation failed:', error)
      setResult(null)
      setEvaluationError(buildFailurePresentation({
        t,
        source: 'evaluation',
        error,
        fallbackMessage: t.evaluationFailed,
      }))
    } finally {
      setLoading(false)
    }
  }

  const refreshSuggestions = async () => {
    setSuggestionsRefreshing(true)
    setSuggestionsRefreshError(null)
    try {
      const issues = result?.suggestions.map((item) => item.title).filter(Boolean)
      const response = await getImprovementSuggestions(content, issues, 8)
      if (response.success && Array.isArray(response.data) && result) {
        const suggestions = translateSuggestions(response.data)
        setResult({
          ...result,
          suggestions,
        })
        return
      }
      const failure = buildFailurePresentation({
        t,
        source: 'evaluation',
        error: response.error,
        fallbackMessage: t.evaluationSuggestionsRefreshFailed,
      })
      setSuggestionsRefreshError(`${failure.label}：${failure.message}`)
    } catch (error) {
      logger.error('Refreshing suggestions failed:', error)
      const failure = buildFailurePresentation({
        t,
        source: 'evaluation',
        error,
        fallbackMessage: t.evaluationSuggestionsRefreshFailed,
      })
      setSuggestionsRefreshError(`${failure.label}：${failure.message}`)
    } finally {
      setSuggestionsRefreshing(false)
    }
  }

  useEffect(() => {
    setSuggestionsRefreshError(null)
    if (!content.trim()) {
      setLoading(false)
      setResult(null)
      setEvaluationError(null)
      return
    }
    runEvaluation()
  }, [content])

  return {
    evaluationError,
    loading,
    result,
    suggestionsRefreshing,
    suggestionsRefreshError,
    runEvaluation,
    refreshSuggestions,
  }
}

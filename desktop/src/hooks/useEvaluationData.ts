import { useEffect, useState } from 'react'
import { evaluateContent, getImprovementSuggestions, type RecommendationPayload } from '../api/client'

export interface EvaluationViewModel {
  score: number
  dimensions: {
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
    evaluationSuggestionsRefreshFailed: string
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
      setSuggestionsRefreshError(response.error || t.evaluationSuggestionsRefreshFailed)
    } catch (error) {
      console.error('Refreshing suggestions failed:', error)
      setSuggestionsRefreshError(t.evaluationSuggestionsRefreshFailed)
    } finally {
      setSuggestionsRefreshing(false)
    }
  }

  useEffect(() => {
    setSuggestionsRefreshError(null)
    runEvaluation()
  }, [content])

  return {
    loading,
    result,
    suggestionsRefreshing,
    suggestionsRefreshError,
    runEvaluation,
    refreshSuggestions,
  }
}

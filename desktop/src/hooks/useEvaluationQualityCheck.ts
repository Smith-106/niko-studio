import { useState } from 'react'
import { novelQualityCheck } from '../api/client'
import { buildFailurePresentation } from '../utils/failurePresentation'

export interface NovelQualityViewModel {
  decision: string
  totalScore: number
  lockScore: number
  styleScore: number
  logicScore: number
  feedback: string
}

interface UseEvaluationQualityCheckOptions {
  content: string
  qualityGoals: {
    naturalness: number
    readability: number
    coherence: number
    styleConsistency: number
  }
  t: {
    evaluationQualityCheckFailed: string
    evaluationNoFeedback: string
    failureCategoryGeneration: string
    failureCategoryEvaluation: string
    failureCategoryRetrieval: string
    failureCategoryConnection: string
    failureMessageGeneration: string
    failureMessageEvaluation: string
    failureMessageRetrieval: string
    failureMessageConnection: string
  }
}

export function useEvaluationQualityCheck({ content, qualityGoals, t }: UseEvaluationQualityCheckOptions) {
  const [qualityChecking, setQualityChecking] = useState(false)
  const [qualityCheckError, setQualityCheckError] = useState<string | null>(null)
  const [qualityCheckResult, setQualityCheckResult] = useState<NovelQualityViewModel | null>(null)

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
        const failure = buildFailurePresentation({
          t,
          source: 'evaluation',
          error: response.error,
          fallbackMessage: t.evaluationQualityCheckFailed,
        })
        setQualityCheckError(`${failure.label}：${failure.message}`)
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
      const failure = buildFailurePresentation({
        t,
        source: 'evaluation',
        error,
        fallbackMessage: t.evaluationQualityCheckFailed,
      })
      setQualityCheckError(`${failure.label}：${failure.message}`)
    } finally {
      setQualityChecking(false)
    }
  }

  return {
    qualityChecking,
    qualityCheckError,
    qualityCheckResult,
    runNovelQualityCheck,
  }
}

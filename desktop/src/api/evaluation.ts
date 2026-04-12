import { type ApiResponse, callApi } from './core'
import type { QualityGoalsPayload } from './chat'
import type { RecommendationInput } from './workflow'
// ============ Critic API ============

export interface EvaluationResult {
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
  total_score: number
  lock_score: number
  style_score: number
  logic_score: number
  actionable_feedback: string
  suggestions: RecommendationInput[]
}

export interface NovelQualityCheckResult {
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW' | string
  total_score: number
  lock_score?: number
  style_score?: number
  logic_score?: number
  actionable_feedback?: string
  suggestions?: RecommendationInput[]
  [key: string]: unknown
}

export async function evaluateContent(
  content: string,
  sceneCard?: Record<string, unknown>,
  dimensions?: string[],
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<EvaluationResult>> {
  return callApi('/critic/evaluate', 'POST', {
    content,
    scene_card: sceneCard,
    dimensions,
    quality_goals: qualityGoals,
  })
}

export async function novelQualityCheck(
  content: string,
  sceneCard?: Record<string, unknown>,
  dimensions?: string[],
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<NovelQualityCheckResult>> {
  return callApi('/writing/quality', 'POST', {
    content,
    scene_card: sceneCard,
    dimensions,
    quality_goals: qualityGoals,
  })
}

export async function getImprovementSuggestions(
  content: string,
  issues?: string[],
  maxSuggestions?: number
): Promise<ApiResponse<Array<{ issue: string; suggestion: string; priority: string }>>> {
  return callApi('/critic/suggestions', 'POST', {
    content,
    issues,
    max_suggestions: maxSuggestions,
  })
}

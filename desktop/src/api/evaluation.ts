import { type ApiResponse, callApi } from './core'
import type { QualityGoalsPayload } from './chat'
import type { RecommendationInput } from './workflow'
import { appendWorkspacePayload, type ProjectWorkspaceContext } from './workspace'
// ============ Critic API ============

export interface EvaluationResult {
  decision: 'APPROVED' | 'REVISE' | 'REWRITE' | 'HUMAN_REVIEW'
  total_score: number
  lock_score: number
  style_score: number
  logic_score: number
  actionable_feedback: string
  suggestions: RecommendationInput[]
  module_scores?: Record<string, number>
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

export interface ConsistencyConflict {
  severity: string
  type: string
  source: 'character' | 'timeline' | 'worldview'
  description: string
  chaptersInvolved: number[]
  suggestion?: string
}

export interface ConsistencyCheckResult {
  character: Record<string, unknown>
  timeline: Record<string, unknown>
  worldview: Record<string, unknown>
  combined: {
    totalConflicts: number
    criticalCount: number
    majorCount: number
    minorCount: number
    infoCount: number
    conflicts: ConsistencyConflict[]
    overallScore: number
    moduleScores: {
      character: number
      timeline: number
      worldview: number
    }
    summary: string
  }
  analyzedAt: string
  runId: string
  workspace: ProjectWorkspaceContext
  narrativeAuthority: Record<string, unknown>
}

export async function evaluateWithModules(
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
    include_module_scores: true,
  })
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

export async function runConsistencyCheck(
  chapters: string[],
  chapterMeta: Array<{ chapterNumber: number; title: string }>,
  worldRules?: Array<{
    id: string
    category: string
    name: string
    description: string
    constraints: string[]
    establishedIn: number
  }>,
  workspace?: ProjectWorkspaceContext | Record<string, unknown> | null,
): Promise<ApiResponse<ConsistencyCheckResult>> {
  return callApi(
    '/critic/consistency',
    'POST',
    appendWorkspacePayload(
      {
        chapters,
        chapterMeta,
        worldRules,
      },
      workspace,
    ),
  )
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

export async function runStandaloneConsistencyCheck(
  content: string,
  options?: { checkTypes?: string[]; workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ valid: boolean; issues: string[]; score: number }>> {
  return callApi('/consistency/check', 'POST', {
    content,
    check_types: options?.checkTypes,
    workspace: options?.workspace,
  })
}

import { useSettingsStore } from '@/stores/settingsStore'

import type { ApiResponse } from '../core'
import type {
  RecommendationBatchResult,
  RecommendationExecutionResult,
  RecommendationInput,
} from './contracts'
import {
  mergeRecommendationBatchResults,
  normalizeRecommendations,
  readError,
  readPlanId,
  readStepId,
} from './contracts'
import { createPlan, executePlan } from './plans'

export async function applyRecommendation(
  task: string,
  recommendation: RecommendationInput,
  level?: string,
): Promise<ApiResponse<RecommendationExecutionResult>> {
  const normalized = normalizeRecommendations([recommendation], 'apply')
  if (normalized.length === 0) {
    return {
      success: false,
      error: 'invalid recommendation payload',
    }
  }

  const mode = useSettingsStore.getState().settings.workflowBackendMode
  const planResponse = await createPlan(task, level, normalized, mode)
  if (!planResponse.success) {
    return {
      success: false,
      error: planResponse.error || 'create plan failed',
    }
  }

  const planId = readPlanId(planResponse.data)
  if (!planId) {
    return {
      success: false,
      error: 'missing plan_id from workflow plan response',
    }
  }

  const executeResponse = await executePlan(planId, undefined, normalized, mode)
  if (!executeResponse.success) {
    return {
      success: false,
      error: executeResponse.error || 'execute plan failed',
    }
  }

  const executeError = readError(executeResponse.data)
  if (executeError) {
    const failedStepId = readStepId(executeResponse.data)
    return {
      success: true,
      data: {
        recommendation_id: normalized[0].id,
        status: 'failed',
        plan_id: planId,
        ...(failedStepId ? { step_id: failedStepId } : {}),
        error: executeError,
      },
    }
  }

  return {
    success: true,
    data: {
      recommendation_id: normalized[0].id,
      status: 'applied',
      plan_id: planId,
      step_id: readStepId(executeResponse.data),
      message: 'recommendation applied',
    },
  }
}

export async function undoRecommendation(
  task: string,
  recommendation: RecommendationInput,
  level?: string,
): Promise<ApiResponse<RecommendationExecutionResult>> {
  const normalized = normalizeRecommendations([recommendation], 'undo')
  if (normalized.length === 0) {
    return {
      success: false,
      error: 'invalid recommendation payload',
    }
  }

  const mode = useSettingsStore.getState().settings.workflowBackendMode
  const planResponse = await createPlan(task, level, normalized, mode)
  if (!planResponse.success) {
    return {
      success: false,
      error: planResponse.error || 'create plan failed',
    }
  }

  const planId = readPlanId(planResponse.data)
  if (!planId) {
    return {
      success: false,
      error: 'missing plan_id from workflow plan response',
    }
  }

  const executeResponse = await executePlan(planId, undefined, normalized, mode)
  if (!executeResponse.success) {
    return {
      success: false,
      error: executeResponse.error || 'execute plan failed',
    }
  }

  const executeError = readError(executeResponse.data)
  if (executeError) {
    const failedStepId = readStepId(executeResponse.data)
    return {
      success: true,
      data: {
        recommendation_id: normalized[0].id,
        status: 'failed',
        plan_id: planId,
        ...(failedStepId ? { step_id: failedStepId } : {}),
        error: executeError,
      },
    }
  }

  return {
    success: true,
    data: {
      recommendation_id: normalized[0].id,
      status: 'undone',
      plan_id: planId,
      step_id: readStepId(executeResponse.data),
      message: 'recommendation undone',
    },
  }
}

export async function batchApplyRecommendations(
  task: string,
  recommendations: RecommendationInput[],
  level?: string,
): Promise<ApiResponse<RecommendationBatchResult>> {
  if (recommendations.length === 0) {
    return {
      success: true,
      data: mergeRecommendationBatchResults([]),
    }
  }

  const normalized = normalizeRecommendations(recommendations, 'apply')
  const results: RecommendationExecutionResult[] = []

  for (const recommendation of normalized) {
    const response = await applyRecommendation(task, recommendation, level)
    if (response.success && response.data) {
      results.push(response.data)
      continue
    }

    results.push({
      recommendation_id: recommendation.id,
      status: 'failed',
      error: response.error || 'apply recommendation failed',
    })
  }

  return {
    success: true,
    data: mergeRecommendationBatchResults(results),
  }
}

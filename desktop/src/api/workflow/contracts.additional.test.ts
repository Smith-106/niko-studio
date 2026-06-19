import { describe, expect, it } from 'vitest'

import {
  mergeRecommendationBatchResults,
  normalizeRecommendations,
  readError,
  readPlanId,
  readStepId,
  type RecommendationExecutionResult,
} from './contracts'

describe('workflow contracts additional coverage', () => {
  it('normalizes string and object recommendations with fallbacks', () => {
    expect(normalizeRecommendations(undefined)).toEqual([])

    expect(
      normalizeRecommendations([
        'Add stronger opening',
        {
          id: ' custom-id ',
          title: '  ',
          action: 'Apply rewrite',
          feedback: 'Use a sharper hook',
        },
        {
          description: 'Preserve character voice',
          action: '  ',
        },
        {
          title: 'Keep the current title',
          reason: 'Because it already works',
          action: 'apply-as-is',
        },
        {
          action: 'No-op',
        },
        '',
      ]),
    ).toEqual([
      {
        id: 'rec-01',
        title: 'Add stronger opening',
        reason: 'Add stronger opening',
        action: 'apply',
      },
      {
        id: ' custom-id ',
        title: 'Apply rewrite',
        reason: 'Use a sharper hook',
        action: 'Apply rewrite',
      },
      {
        id: 'rec-03',
        title: 'Recommendation 3',
        reason: 'Preserve character voice',
        action: 'apply',
      },
      {
        id: 'rec-04',
        title: 'Keep the current title',
        reason: 'Because it already works',
        action: 'apply-as-is',
      },
      {
        id: 'rec-05',
        title: 'No-op',
        reason: '',
        action: 'No-op',
      },
    ])
  })

  it('reads identifiers and errors from unknown payloads', () => {
    expect(readPlanId({ plan_id: 'plan-1' })).toBe('plan-1')
    expect(readPlanId({ plan_id: '   ' })).toBeUndefined()
    expect(readPlanId(null)).toBeUndefined()

    expect(readStepId({ step_id: 'step-2' })).toBe('step-2')
    expect(readStepId({ step_id: 3 })).toBeUndefined()

    expect(readError({ error: 'gateway failed' })).toBe('gateway failed')
    expect(readError({ error: '   ', status: 'failed' })).toBe('workflow execute failed')
    expect(readError({ status: 'completed' })).toBeUndefined()
    expect(readError([])).toBeUndefined()
  })

  it('aggregates recommendation execution results by status', () => {
    const results: RecommendationExecutionResult[] = [
      { recommendation_id: 'rec-1', status: 'applied' },
      { recommendation_id: 'rec-2', status: 'undone' },
      { recommendation_id: 'rec-3', status: 'failed', error: 'boom' },
      { recommendation_id: 'rec-4', status: 'applied' },
    ]

    expect(mergeRecommendationBatchResults(results)).toEqual({
      total: 4,
      applied: 2,
      undone: 1,
      failed: 1,
      results,
    })
  })
})

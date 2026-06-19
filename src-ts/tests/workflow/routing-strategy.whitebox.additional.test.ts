import { describe, expect, it, vi } from 'vitest'

import { DefaultWorkflowRoutingStrategy } from '../../workflow/strategies/routing-strategy.js'
import { WorkflowLevel } from '../../workflow/types.js'

describe('workflow/strategies/routing-strategy whitebox coverage', () => {
  it('handles sparse feature models, invalid regexes, and zero-weight long-text escalation', () => {
    const strategy = new DefaultWorkflowRoutingStrategy(() => [], (payload) => payload)
    const router = (strategy as unknown as {
      router: {
        getRoutingFeatureModel?: () => Record<string, unknown>
        getLevelIndicators?: () => Record<number, string[]>
        scoreRouteFeatures: (task: string) => Record<string, unknown>
      }
    }).router

    router.getRoutingFeatureModel = () => ({
      weights: {},
      thresholds: {},
      category_explanations: {},
      levels: {
        [WorkflowLevel.L1_RAPID]: {
          keyword: ['alpha', '[broken'],
        },
      },
    })
    router.getLevelIndicators = () => ({
      [WorkflowLevel.L1_RAPID]: ['alpha', '[broken'],
      [WorkflowLevel.L4_BRAINSTORM]: ['should-be-skipped'],
    })

    const undefinedTask = router.scoreRouteFeatures(undefined as unknown as string)
    const longTask = router.scoreRouteFeatures('alpha '.repeat(30))

    expect(undefinedTask.matched_level).toBe(WorkflowLevel.L3_STANDARD)
    expect(longTask.matched_level).toBe(WorkflowLevel.L3_STANDARD)
    expect(longTask.structured_scores).toMatchObject({ L1: 0, L3: 0 })
    expect(
      (longTask.matched_features as Array<Record<string, unknown>>).some(
        (feature) => feature.signal === 'alpha' && feature.weight === 0 && feature.explanation === '',
      ),
    ).toBe(true)
    expect(
      (longTask.matched_features as Array<Record<string, unknown>>).some(
        (feature) =>
          feature.category === 'long_text_escalation'
          && feature.signal === 'len>100'
          && feature.weight === 0
          && feature.explanation === '',
      ),
    ).toBe(true)
  })

  it('falls back to L3 diagnostics when routing scores omit matched level and top score', async () => {
    const resolveTemplate = vi.fn((level: number) => [
      { name: `step-${level}`, description: 'template step' },
    ])
    const strategy = new DefaultWorkflowRoutingStrategy(resolveTemplate, (payload) => payload)

    ;(
      strategy as unknown as {
        router: {
          scoreRouteFeatures: ReturnType<typeof vi.fn>
        }
      }
    ).router = {
      scoreRouteFeatures: vi.fn(() => ({
        matched_level: undefined,
        structured_scores: {},
        legacy_scores: {},
        matched_features: [],
        structured_top_score: undefined,
        legacy_level: WorkflowLevel.L3_STANDARD,
        legacy_top_score: 0,
        feature_model: {},
      })),
    }

    const result = await strategy.route('manual override')

    expect(resolveTemplate).toHaveBeenCalledWith(WorkflowLevel.L3_STANDARD)
    expect(result.level).toBe('L3')
    expect(result.final_level).toBe('L3')
    expect(result.score).toBe(0)
    expect(result.reason).toContain('0')
  })
})

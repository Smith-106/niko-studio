import { describe, expect, it } from 'vitest'

describe('workflow barrel exports', () => {
  it('re-exports contracts types and helpers', async () => {
    const mod = await import('./workflow')

    // Contracts types
    expect(mod.normalizeRecommendations).toBeDefined()
    expect(mod.readPlanId).toBeDefined()
    expect(mod.readStepId).toBeDefined()
    expect(mod.readError).toBeDefined()
    expect(mod.mergeRecommendationBatchResults).toBeDefined()
  })

  it('re-exports plan functions', async () => {
    const mod = await import('./workflow')

    expect(mod.routeWorkflow).toBeDefined()
    expect(mod.createPlan).toBeDefined()
    expect(mod.executePlan).toBeDefined()
    expect(mod.workflowLifecycle).toBeDefined()
    expect(mod.getPlanStatus).toBeDefined()
  })

  it('re-exports ui-bridge plan functions', async () => {
    const mod = await import('./workflow')

    expect(mod.uiRouteWorkflow).toBeDefined()
    expect(mod.uiCreatePlan).toBeDefined()
    expect(mod.uiExecutePlan).toBeDefined()
    expect(mod.uiWorkflowLifecycle).toBeDefined()
  })

  it('re-exports recommendation functions', async () => {
    const mod = await import('./workflow')

    expect(mod.applyRecommendation).toBeDefined()
    expect(mod.undoRecommendation).toBeDefined()
    expect(mod.batchApplyRecommendations).toBeDefined()
  })

  it('re-exports checkpoint functions', async () => {
    const mod = await import('./workflow')

    expect(mod.quickRollbackWorkflow).toBeDefined()
    expect(mod.createCheckpoint).toBeDefined()
    expect(mod.restoreCheckpoint).toBeDefined()
    expect(mod.listCheckpoints).toBeDefined()
  })

  it('re-exports scheduler functions', async () => {
    const mod = await import('./workflow')

    expect(mod.workflowSchedulerRegister).toBeDefined()
    expect(mod.workflowSchedulerList).toBeDefined()
    expect(mod.workflowSchedulerPause).toBeDefined()
    expect(mod.workflowSchedulerResume).toBeDefined()
    expect(mod.workflowSchedulerRunNow).toBeDefined()
    expect(mod.workflowSchedulerImportLitePlan).toBeDefined()
  })
})

describe('normalizeRecommendations', () => {
  it('normalizes string recommendations', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations(['increase suspense', 'fix pacing'])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'rec-01',
      title: 'increase suspense',
      reason: 'increase suspense',
      action: 'apply',
    })
    expect(result[1]).toEqual({
      id: 'rec-02',
      title: 'fix pacing',
      reason: 'fix pacing',
      action: 'apply',
    })
  })

  it('normalizes object recommendations', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations([
      { id: 'r1', title: 'Deepen conflict', reason: 'Scene lacks tension', action: 'apply' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r1')
    expect(result[0].title).toBe('Deepen conflict')
  })

  it('uses fallback id when id is missing', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations([{ title: 'Some suggestion' }])
    expect(result[0].id).toBe('rec-01')
  })

  it('filters out recommendations with empty titles', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations(['valid', '', '  '])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('valid')
  })

  it('returns empty array for non-array input', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations(undefined as any)
    expect(result).toEqual([])
  })

  it('normalizes with undo action', async () => {
    const { normalizeRecommendations } = await import('./workflow')
    const result = normalizeRecommendations(['remove suspense'], 'undo')
    expect(result[0].action).toBe('undo')
  })
})

describe('readPlanId', () => {
  it('reads plan_id from payload', async () => {
    const { readPlanId } = await import('./workflow')
    expect(readPlanId({ plan_id: 'plan-1' })).toBe('plan-1')
  })

  it('returns undefined when plan_id is missing', async () => {
    const { readPlanId } = await import('./workflow')
    expect(readPlanId({})).toBeUndefined()
  })

  it('returns undefined for whitespace-only plan_id', async () => {
    const { readPlanId } = await import('./workflow')
    expect(readPlanId({ plan_id: '   ' })).toBeUndefined()
  })
})

describe('readStepId', () => {
  it('reads step_id from payload', async () => {
    const { readStepId } = await import('./workflow')
    expect(readStepId({ step_id: 'step-1' })).toBe('step-1')
  })

  it('returns undefined when step_id is missing', async () => {
    const { readStepId } = await import('./workflow')
    expect(readStepId({ status: 'completed' })).toBeUndefined()
  })
})

describe('readError', () => {
  it('reads error string from payload', async () => {
    const { readError } = await import('./workflow')
    expect(readError({ error: 'something went wrong' })).toBe('something went wrong')
  })

  it('returns generic message when status is failed without error field', async () => {
    const { readError } = await import('./workflow')
    expect(readError({ status: 'failed' })).toBe('workflow execute failed')
  })

  it('returns undefined when no error is present', async () => {
    const { readError } = await import('./workflow')
    expect(readError({ status: 'completed' })).toBeUndefined()
  })
})

describe('mergeRecommendationBatchResults', () => {
  it('merges counts by status', async () => {
    const { mergeRecommendationBatchResults } = await import('./workflow')
    const result = mergeRecommendationBatchResults([
      { recommendation_id: 'r1', status: 'applied' },
      { recommendation_id: 'r2', status: 'failed', error: 'boom' },
      { recommendation_id: 'r3', status: 'undone' },
      { recommendation_id: 'r4', status: 'applied' },
    ])
    expect(result).toEqual({
      total: 4,
      applied: 2,
      undone: 1,
      failed: 1,
      results: [
        { recommendation_id: 'r1', status: 'applied' },
        { recommendation_id: 'r2', status: 'failed', error: 'boom' },
        { recommendation_id: 'r3', status: 'undone' },
        { recommendation_id: 'r4', status: 'applied' },
      ],
    })
  })

  it('returns zero counts for empty array', async () => {
    const { mergeRecommendationBatchResults } = await import('./workflow')
    const result = mergeRecommendationBatchResults([])
    expect(result).toEqual({
      total: 0,
      applied: 0,
      undone: 0,
      failed: 0,
      results: [],
    })
  })
})

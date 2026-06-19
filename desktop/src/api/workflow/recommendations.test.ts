import { beforeEach, describe, expect, it, vi } from 'vitest'

const readRuntimePreferencesMock = vi.hoisted(() => vi.fn())
const createPlanMock = vi.hoisted(() => vi.fn())
const executePlanMock = vi.hoisted(() => vi.fn())
const mergeRecommendationBatchResultsMock = vi.hoisted(() => vi.fn())
const normalizeRecommendationsMock = vi.hoisted(() => vi.fn())
const readErrorMock = vi.hoisted(() => vi.fn())
const readPlanIdMock = vi.hoisted(() => vi.fn())
const readStepIdMock = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/preferences', () => ({
  readRuntimePreferences: readRuntimePreferencesMock,
}))

vi.mock('./plans', () => ({
  createPlan: createPlanMock,
  executePlan: executePlanMock,
}))

vi.mock('./contracts', () => ({
  mergeRecommendationBatchResults: mergeRecommendationBatchResultsMock,
  normalizeRecommendations: normalizeRecommendationsMock,
  readError: readErrorMock,
  readPlanId: readPlanIdMock,
  readStepId: readStepIdMock,
}))

import {
  applyRecommendation,
  batchApplyRecommendations,
  undoRecommendation,
} from './recommendations'

describe('workflow recommendations api bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readRuntimePreferencesMock.mockReturnValue({ workflowBackendMode: 'standard' })
    normalizeRecommendationsMock.mockImplementation((input: unknown, action = 'apply') => {
      if (!Array.isArray(input)) {
        return []
      }

      return input
        .filter(Boolean)
        .map((item, index) => {
          if (typeof item === 'string') {
            return {
              id: `rec-${index + 1}`,
              title: item,
              reason: '',
              action,
            }
          }

          const record = item as Record<string, unknown>
          return {
            id: String(record.id ?? `rec-${index + 1}`),
            title: String(record.title ?? `Recommendation ${index + 1}`),
            reason: String(record.reason ?? ''),
            action,
          }
        })
    })
    mergeRecommendationBatchResultsMock.mockImplementation((results: Array<{ status: string }>) => ({
      total: results.length,
      applied: results.filter((item) => item.status === 'applied').length,
      undone: results.filter((item) => item.status === 'undone').length,
      failed: results.filter((item) => item.status === 'failed').length,
      results,
    }))
    createPlanMock.mockResolvedValue({ success: true, data: { plan_id: 'plan-1' } })
    executePlanMock.mockResolvedValue({ success: true, data: { step_id: 'step-1' } })
    readPlanIdMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.plan_id)
    readStepIdMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.step_id)
    readErrorMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.error)
  })

  it('rejects invalid recommendation payloads before creating a plan', async () => {
    normalizeRecommendationsMock.mockReturnValueOnce([])

    const response = await applyRecommendation('Revise conflict cadence', { title: '' })

    expect(response).toEqual({
      success: false,
      error: 'invalid recommendation payload',
    })
    expect(createPlanMock).not.toHaveBeenCalled()
    expect(executePlanMock).not.toHaveBeenCalled()
  })

  it('surfaces create-plan and execute-plan failures', async () => {
    createPlanMock.mockResolvedValueOnce({ success: false, error: 'plan service offline' })

    await expect(
      applyRecommendation('Revise conflict cadence', { id: 'rec-1', title: 'Tighten opening' }),
    ).resolves.toEqual({
      success: false,
      error: 'plan service offline',
    })

    createPlanMock.mockResolvedValueOnce({ success: true, data: { plan_id: 'plan-2' } })
    executePlanMock.mockResolvedValueOnce({ success: false, error: 'execution rejected' })

    await expect(
      applyRecommendation('Revise conflict cadence', { id: 'rec-2', title: 'Trim exposition' }),
    ).resolves.toEqual({
      success: false,
      error: 'execution rejected',
    })

    createPlanMock.mockResolvedValueOnce({ success: false })
    await expect(
      applyRecommendation('Revise conflict cadence', { id: 'rec-2b', title: 'Fallback create-plan error' }),
    ).resolves.toEqual({
      success: false,
      error: 'create plan failed',
    })

    createPlanMock.mockResolvedValueOnce({ success: true, data: { plan_id: 'plan-2b' } })
    executePlanMock.mockResolvedValueOnce({ success: false })
    await expect(
      applyRecommendation('Revise conflict cadence', { id: 'rec-2c', title: 'Fallback execute error' }),
    ).resolves.toEqual({
      success: false,
      error: 'execute plan failed',
    })
  })

  it('fails fast when the workflow backend does not return a plan id', async () => {
    readPlanIdMock.mockReturnValueOnce(undefined)

    const response = await applyRecommendation('Revise conflict cadence', {
      id: 'rec-3',
      title: 'Keep pressure on the reveal',
    })

    expect(response).toEqual({
      success: false,
      error: 'missing plan_id from workflow plan response',
    })
    expect(executePlanMock).not.toHaveBeenCalled()
  })

  it('returns a failed execution result when the backend reports a step error', async () => {
    executePlanMock.mockResolvedValueOnce({
      success: true,
      data: {
        step_id: 'step-7',
        error: 'gate blocked',
      },
    })

    const response = await applyRecommendation('Revise conflict cadence', {
      id: 'rec-4',
      title: 'Escalate the midpoint turn',
    })

    expect(createPlanMock).toHaveBeenCalledWith(
      'Revise conflict cadence',
      undefined,
      [
        {
          id: 'rec-4',
          title: 'Escalate the midpoint turn',
          reason: '',
          action: 'apply',
        },
      ],
      'standard',
    )
    expect(executePlanMock).toHaveBeenCalledWith(
      'plan-1',
      undefined,
      [
        {
          id: 'rec-4',
          title: 'Escalate the midpoint turn',
          reason: '',
          action: 'apply',
        },
      ],
      'standard',
    )
    expect(response).toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-4',
        status: 'failed',
        plan_id: 'plan-1',
        step_id: 'step-7',
        error: 'gate blocked',
      },
    })
  })

  it('returns the applied and undone statuses for successful execution paths', async () => {
    const applyResponse = await applyRecommendation('Revise conflict cadence', {
      id: 'rec-5',
      title: 'Sharpen the cliffhanger',
    })

    expect(applyResponse).toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-5',
        status: 'applied',
        plan_id: 'plan-1',
        step_id: 'step-1',
        message: 'recommendation applied',
      },
    })

    const undoResponse = await undoRecommendation('Revise conflict cadence', {
      id: 'rec-6',
      title: 'Undo the extra reveal',
    })

    expect(normalizeRecommendationsMock).toHaveBeenLastCalledWith(
      [{ id: 'rec-6', title: 'Undo the extra reveal' }],
      'undo',
    )
    expect(undoResponse).toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-6',
        status: 'undone',
        plan_id: 'plan-1',
        step_id: 'step-1',
        message: 'recommendation undone',
      },
    })
  })

  it('covers undo-specific invalid, missing-plan, and failed-step branches', async () => {
    normalizeRecommendationsMock.mockReturnValueOnce([])
    await expect(
      undoRecommendation('Revise conflict cadence', { title: '' }),
    ).resolves.toEqual({
      success: false,
      error: 'invalid recommendation payload',
    })

    readPlanIdMock.mockReturnValueOnce(undefined)
    await expect(
      undoRecommendation('Revise conflict cadence', { id: 'rec-7', title: 'Missing undo plan id' }),
    ).resolves.toEqual({
      success: false,
      error: 'missing plan_id from workflow plan response',
    })

    executePlanMock.mockResolvedValueOnce({
      success: true,
      data: {
        error: 'undo blocked',
      },
    })
    readStepIdMock.mockReturnValueOnce('step-undo-7')
    await expect(
      undoRecommendation('Revise conflict cadence', { id: 'rec-8', title: 'Undo blocked by workflow' }),
    ).resolves.toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-8',
        status: 'failed',
        plan_id: 'plan-1',
        step_id: 'step-undo-7',
        error: 'undo blocked',
      },
    })
  })

  it('omits step_id from failed undo results when the workflow payload does not expose one', async () => {
    executePlanMock.mockResolvedValueOnce({
      success: true,
      data: {
        error: 'undo blocked without step',
      },
    })
    readStepIdMock.mockReturnValueOnce(undefined)

    await expect(
      undoRecommendation('Revise conflict cadence', { id: 'rec-8b', title: 'Undo blocked without step id' }),
    ).resolves.toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-8b',
        status: 'failed',
        plan_id: 'plan-1',
        error: 'undo blocked without step',
      },
    })
  })

  it('returns an empty merged batch result when there are no recommendations', async () => {
    const response = await batchApplyRecommendations('Revise conflict cadence', [])

    expect(mergeRecommendationBatchResultsMock).toHaveBeenCalledWith([])
    expect(response).toEqual({
      success: true,
      data: {
        total: 0,
        applied: 0,
        undone: 0,
        failed: 0,
        results: [],
      },
    })
  })

  it('merges batch results across successful and failed recommendations', async () => {
    normalizeRecommendationsMock
      .mockReturnValueOnce([
        { id: 'rec-10', title: 'Keep the hook visible', reason: '', action: 'apply' },
        { id: 'rec-11', title: 'Compress the bridge scene', reason: '', action: 'apply' },
      ])
      .mockReturnValueOnce([
        { id: 'rec-10', title: 'Keep the hook visible', reason: '', action: 'apply' },
      ])
      .mockReturnValueOnce([
        { id: 'rec-11', title: 'Compress the bridge scene', reason: '', action: 'apply' },
      ])

    createPlanMock
      .mockResolvedValueOnce({ success: true, data: { plan_id: 'plan-a' } })
      .mockResolvedValueOnce({ success: false, error: 'plan generation failed' })
    executePlanMock.mockResolvedValueOnce({ success: true, data: { step_id: 'step-a' } })
    readPlanIdMock.mockReturnValueOnce('plan-a')
    readErrorMock.mockReturnValueOnce(undefined)
    readStepIdMock.mockReturnValueOnce('step-a')

    const response = await batchApplyRecommendations('Revise conflict cadence', [
      { id: 'rec-10', title: 'Keep the hook visible' },
      { id: 'rec-11', title: 'Compress the bridge scene' },
    ])

    expect(response).toEqual({
      success: true,
      data: {
        total: 2,
        applied: 1,
        undone: 0,
        failed: 1,
        results: [
          {
            recommendation_id: 'rec-10',
            status: 'applied',
            plan_id: 'plan-a',
            step_id: 'step-a',
            message: 'recommendation applied',
          },
          {
            recommendation_id: 'rec-11',
            status: 'failed',
            error: 'plan generation failed',
          },
        ],
      },
    })
  })

  it('surfaces the applyRecommendation fallback error when batch plan creation omits an error message', async () => {
    normalizeRecommendationsMock
      .mockReturnValueOnce([
        { id: 'rec-12', title: 'Keep the hook visible', reason: '', action: 'apply' },
      ])
      .mockReturnValueOnce([
        { id: 'rec-12', title: 'Keep the hook visible', reason: '', action: 'apply' },
      ])

    createPlanMock.mockResolvedValueOnce({ success: false })

    const response = await batchApplyRecommendations('Revise conflict cadence', [
      { id: 'rec-12', title: 'Keep the hook visible' },
    ])

    expect(response).toEqual({
      success: true,
      data: {
        total: 1,
        applied: 0,
        undone: 0,
        failed: 1,
        results: [
          {
            recommendation_id: 'rec-12',
            status: 'failed',
            error: 'create plan failed',
          },
        ],
      },
    })
  })
})

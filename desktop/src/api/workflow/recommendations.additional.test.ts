import { beforeEach, describe, expect, it, vi } from 'vitest'

const readRuntimePreferencesMock = vi.hoisted(() => vi.fn())
const createPlanMock = vi.hoisted(() => vi.fn())
const executePlanMock = vi.hoisted(() => vi.fn())
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

vi.mock('./contracts', async () => {
  const actual = await vi.importActual<typeof import('./contracts')>('./contracts')
  return {
    ...actual,
    normalizeRecommendations: normalizeRecommendationsMock,
    readError: readErrorMock,
    readPlanId: readPlanIdMock,
    readStepId: readStepIdMock,
  }
})

import { undoRecommendation } from './recommendations'

describe('workflow recommendations api bridge additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readRuntimePreferencesMock.mockReturnValue({ workflowBackendMode: 'standard' })
    normalizeRecommendationsMock.mockImplementation((input: unknown, action = 'apply') => {
      if (!Array.isArray(input)) {
        return []
      }

      return input.map((item, index) => {
        const record = (item ?? {}) as Record<string, unknown>
        return {
          id: String(record.id ?? `rec-${index + 1}`),
          title: String(record.title ?? `Recommendation ${index + 1}`),
          reason: String(record.reason ?? ''),
          action,
        }
      })
    })
    readPlanIdMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.plan_id)
    readStepIdMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.step_id)
    readErrorMock.mockImplementation((payload: Record<string, unknown> | undefined) => payload?.error)
  })

  it('falls back to generic undo errors when plan or execution failures omit details', async () => {
    createPlanMock.mockResolvedValueOnce({ success: false })

    await expect(
      undoRecommendation('Revise conflict cadence', { id: 'rec-undo-1', title: 'Undo with plan fallback' }),
    ).resolves.toEqual({
      success: false,
      error: 'create plan failed',
    })

    createPlanMock.mockResolvedValueOnce({ success: true, data: { plan_id: 'plan-undo-2' } })
    executePlanMock.mockResolvedValueOnce({ success: false })

    await expect(
      undoRecommendation('Revise conflict cadence', { id: 'rec-undo-2', title: 'Undo with execute fallback' }),
    ).resolves.toEqual({
      success: false,
      error: 'execute plan failed',
    })
  })
})

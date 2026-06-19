import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyRecommendationMock = vi.hoisted(() => vi.fn())
const batchApplyRecommendationsMock = vi.hoisted(() => vi.fn())
const undoRecommendationMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  applyRecommendation: applyRecommendationMock,
  batchApplyRecommendations: batchApplyRecommendationsMock,
  undoRecommendation: undoRecommendationMock,
}))

import type { RecommendationPayload } from '../api/workflow/contracts'
import type { Translations } from '../i18n'
import { useEvaluationRecommendations } from './useEvaluationRecommendations'

const suggestionA: RecommendationPayload = {
  id: 'rec-1',
  title: 'Tighten opening',
  reason: 'More urgency',
  action: 'apply',
}

const t = {
  evaluationApply: 'Apply',
  evaluationUndo: 'Undo',
  evaluationApplying: 'Applying...',
  evaluationUndoing: 'Undoing...',
  evaluationBatchApplying: 'Batch applying...',
  evaluationBatchUndoing: 'Batch undoing...',
  evaluationFailed: 'Operation failed',
  restoreFailed: ' failed',
} as unknown as Translations

const translate = vi.fn((key: keyof Translations, params?: Record<string, string | number>) => {
  if (key === 'evaluationActionFailedWithReason') {
    return `${params?.action} failed: ${params?.reason}`
  }
  if (key === 'evaluationBatchResult') {
    return `Applied ${params?.applied}, failed ${params?.failed}`
  }
  if (key === 'evaluationBatchUndoResult') {
    return `Undid ${params?.success}, failed ${params?.failed}`
  }
  return String(key)
})

describe('useEvaluationRecommendations additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses fallback failure copy when applying a suggestion returns no explicit error', async () => {
    applyRecommendationMock.mockResolvedValue({ success: false })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA],
        t,
        translate,
      }),
    )

    await act(async () => {
      await result.current.handleApplySuggestion(suggestionA)
    })

    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Operation failed',
    })
  })

  it('surfaces batch-apply failures when the bridge errors or omits a payload', async () => {
    batchApplyRecommendationsMock
      .mockResolvedValueOnce({ success: false, error: 'scheduler offline' })
      .mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA],
        t,
        translate,
      }),
    )

    await act(async () => {
      await result.current.handleBatchApply()
    })

    expect(result.current.batchState).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'scheduler offline',
      lastAppliedIds: [],
    })

    await act(async () => {
      await result.current.handleBatchApply()
    })

    expect(result.current.batchState).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Operation failed',
      lastAppliedIds: [],
    })
  })

  it('returns batch mode to idle when no recommendations are applied or failed', async () => {
    batchApplyRecommendationsMock.mockResolvedValue({
      success: true,
      data: {
        applied: 0,
        failed: 0,
        results: [],
      },
    })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA],
        t,
        translate,
      }),
    )

    await act(async () => {
      await result.current.handleBatchApply()
    })

    expect(result.current.batchState).toEqual({
      mode: 'idle',
      status: 'success',
      message: 'Applied 0, failed 0',
      lastAppliedIds: [],
    })
  })

  it('uses fallback failure copy when batch undo fails without an explicit error', async () => {
    batchApplyRecommendationsMock.mockResolvedValue({
      success: true,
      data: {
        applied: 1,
        failed: 0,
        results: [
          {
            recommendation_id: 'rec-1',
            status: 'applied',
          },
        ],
      },
    })
    undoRecommendationMock.mockResolvedValue({ success: false })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA],
        t,
        translate,
      }),
    )

    await act(async () => {
      await result.current.handleBatchApply()
    })

    await act(async () => {
      await result.current.handleBatchUndo()
    })

    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Operation failed',
    })
    expect(result.current.batchState).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Undid 0, failed 1',
      lastAppliedIds: ['rec-1'],
    })
  })
})

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
import {
  defaultBatchState,
  defaultSuggestionState,
  useEvaluationRecommendations,
} from './useEvaluationRecommendations'

const suggestionA: RecommendationPayload = {
  id: 'rec-1',
  title: 'Tighten opening',
  reason: 'More urgency',
  action: 'apply',
}

const suggestionB: RecommendationPayload = {
  id: 'rec-2',
  title: 'Clarify stakes',
  reason: 'Reader focus',
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

describe('useEvaluationRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets per-suggestion state and ignores batch actions without applicable suggestions', async () => {
    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [],
        t,
        translate,
      }),
    )

    act(() => {
      result.current.resetRecommendationStates([suggestionA, suggestionB])
    })

    expect(result.current.suggestionStates).toEqual({
      'rec-1': defaultSuggestionState(),
      'rec-2': defaultSuggestionState(),
    })
    expect(result.current.batchState).toEqual(defaultBatchState())

    await act(async () => {
      await result.current.handleBatchApply()
      await result.current.handleBatchUndo()
    })

    expect(batchApplyRecommendationsMock).not.toHaveBeenCalled()
    expect(undoRecommendationMock).not.toHaveBeenCalled()
  })

  it('handles apply failures, fallback failed states, and explicit success messages', async () => {
    applyRecommendationMock
      .mockResolvedValueOnce({ success: false, error: 'provider blocked' })
      .mockResolvedValueOnce({
        success: true,
        data: {
          recommendation_id: 'rec-1',
          status: 'failed',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          recommendation_id: 'rec-1',
          status: 'applied',
          message: 'Applied cleanly',
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
      await result.current.handleApplySuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'provider blocked',
    })

    await act(async () => {
      await result.current.handleApplySuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Apply failed',
    })

    await act(async () => {
      await result.current.handleApplySuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'success',
      message: 'Applied cleanly',
    })
  })

  it('handles undo failures, plain undo success, and translated undo errors', async () => {
    undoRecommendationMock
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({
        success: true,
        data: {
          recommendation_id: 'rec-1',
          status: 'undone',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          recommendation_id: 'rec-1',
          status: 'failed',
          error: 'undo blocked',
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
      await result.current.handleUndoSuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Operation failed',
    })

    await act(async () => {
      await result.current.handleUndoSuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'idle',
      status: 'success',
      message: 'Undo',
    })

    await act(async () => {
      await result.current.handleUndoSuggestion(suggestionA)
    })
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Undo failed: undo blocked',
    })
  })

  it('applies batches, tracks per-suggestion results, and clears applied ids after successful undo', async () => {
    batchApplyRecommendationsMock.mockResolvedValue({
      success: true,
      data: {
        applied: 1,
        failed: 1,
        results: [
          {
            recommendation_id: 'rec-1',
            status: 'applied',
            message: 'Applied A',
          },
          {
            recommendation_id: 'rec-2',
            status: 'failed',
            error: 'blocked',
          },
        ],
      },
    })
    undoRecommendationMock.mockResolvedValue({
      success: true,
      data: {
        recommendation_id: 'rec-1',
        status: 'undone',
        message: 'Undid A',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA, suggestionB],
        t,
        translate,
      }),
    )

    await act(async () => {
      await result.current.handleBatchApply()
    })

    expect(batchApplyRecommendationsMock).toHaveBeenCalledWith('Scene draft', [suggestionA, suggestionB])
    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'rollback-ready',
      status: 'success',
      message: 'Applied A',
    })
    expect(result.current.suggestionStates['rec-2']).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Apply failed: blocked',
    })
    expect(result.current.batchState).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Applied 1, failed 1',
      lastAppliedIds: ['rec-1'],
    })

    await act(async () => {
      await result.current.handleBatchUndo()
    })

    expect(result.current.suggestionStates['rec-1']).toEqual({
      mode: 'idle',
      status: 'success',
      message: 'Undid A',
    })
    expect(result.current.batchState).toEqual({
      mode: 'idle',
      status: 'success',
      message: 'Undid 1, failed 0',
      lastAppliedIds: [],
    })
  })

  it('preserves applied ids when batch undo only partially succeeds', async () => {
    batchApplyRecommendationsMock.mockResolvedValue({
      success: true,
      data: {
        applied: 2,
        failed: 0,
        results: [
          {
            recommendation_id: 'rec-1',
            status: 'applied',
          },
          {
            recommendation_id: 'rec-2',
            status: 'applied',
          },
        ],
      },
    })
    undoRecommendationMock
      .mockResolvedValueOnce({ success: false, error: 'cannot undo' })
      .mockResolvedValueOnce({
        success: true,
        data: {
          recommendation_id: 'rec-2',
          status: 'undone',
        },
      })

    const { result } = renderHook(() =>
      useEvaluationRecommendations({
        content: 'Scene draft',
        suggestions: [suggestionA, suggestionB],
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
      message: 'cannot undo',
    })
    expect(result.current.suggestionStates['rec-2']).toEqual({
      mode: 'idle',
      status: 'success',
      message: 'Undo',
    })
    expect(result.current.batchState).toEqual({
      mode: 'rollback-ready',
      status: 'error',
      message: 'Undid 1, failed 1',
      lastAppliedIds: ['rec-1', 'rec-2'],
    })
  })
})

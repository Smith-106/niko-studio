import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const novelQualityCheckMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  novelQualityCheck: novelQualityCheckMock,
}))

vi.mock('../utils/failurePresentation', () => ({
  buildFailurePresentation: ({
    t,
    source,
    error,
    fallbackMessage,
  }: {
    t: typeof defaultT
    source: string
    error: unknown
    fallbackMessage?: string
  }) => {
    const detail = typeof error === 'string' ? error : null
    return {
      category: source === 'evaluation' ? 'evaluation' : 'generation',
      label: source === 'evaluation' ? t.failureCategoryEvaluation : t.failureCategoryGeneration,
      message: detail ?? fallbackMessage ?? 'Unknown error',
      detail,
    }
  },
}))

import { useEvaluationQualityCheck } from './useEvaluationQualityCheck'

const defaultQualityGoals = {
  naturalness: 85,
  readability: 80,
  coherence: 78,
  styleConsistency: 82,
}

const defaultT = {
  evaluationQualityCheckFailed: 'Quality check failed',
  evaluationNoFeedback: 'No feedback available',
  failureCategoryGeneration: 'Generation error',
  failureCategoryEvaluation: 'Evaluation error',
  failureCategoryRetrieval: 'Retrieval error',
  failureCategoryConnection: 'Connection error',
  failureMessageGeneration: 'Generation failed',
  failureMessageEvaluation: 'Evaluation failed',
  failureMessageRetrieval: 'Retrieval failed',
  failureMessageConnection: 'Connection lost',
}

describe('useEvaluationQualityCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with null result and no error', () => {
    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: '',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    expect(result.current.qualityChecking).toBe(false)
    expect(result.current.qualityCheckError).toBeNull()
    expect(result.current.qualityCheckResult).toBeNull()
  })

  it('returns quality check result on success', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 88.7,
        lock_score: 85.2,
        style_score: 90.1,
        logic_score: 82.4,
        actionable_feedback: 'Good pacing and character voice.',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'Chapter text here',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityChecking).toBe(false)
    expect(result.current.qualityCheckError).toBeNull()
    expect(result.current.qualityCheckResult).toEqual({
      decision: 'APPROVED',
      totalScore: 88.7,
      lockScore: 85.2,
      styleScore: 90.1,
      logicScore: 82.4,
      feedback: 'Good pacing and character voice.',
    })
  })

  it('rounds score values to one decimal place', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 72.333333,
        lock_score: 68.999999,
        style_score: 75.111111,
        logic_score: 60.0,
        actionable_feedback: '',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult?.totalScore).toBe(72.3)
    expect(result.current.qualityCheckResult?.lockScore).toBe(69.0)
    expect(result.current.qualityCheckResult?.styleScore).toBe(75.1)
  })

  it('defaults missing scores to 0', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'HUMAN_REVIEW',
        total_score: 70,
        actionable_feedback: 'Ambiguous ending.',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult?.lockScore).toBe(0)
    expect(result.current.qualityCheckResult?.styleScore).toBe(0)
    expect(result.current.qualityCheckResult?.logicScore).toBe(0)
  })

  it('uses fallback feedback when actionable_feedback is empty', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'REVISE',
        total_score: 65,
        actionable_feedback: '',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult?.feedback).toBe('No feedback available')
  })

  it('trims whitespace from feedback', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        decision: 'APPROVED',
        total_score: 90,
        actionable_feedback: '   good feedback   ',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult?.feedback).toBe('good feedback')
  })

  it('sets error when API call fails', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: false,
      error: 'service unavailable',
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityChecking).toBe(false)
    expect(result.current.qualityCheckResult).toBeNull()
    expect(result.current.qualityCheckError).toBeTruthy()
    expect(result.current.qualityCheckError).toContain('Evaluation error')
  })

  it('sets error when API returns no data', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: null,
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult).toBeNull()
    expect(result.current.qualityCheckError).toBeTruthy()
  })

  it('handles exceptions from API call', async () => {
    novelQualityCheckMock.mockRejectedValue(new Error('network timeout'))

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityChecking).toBe(false)
    expect(result.current.qualityCheckResult).toBeNull()
    expect(result.current.qualityCheckError).toBeTruthy()
  })

  it('sets loading state during API call', async () => {
    let resolveCheck!: () => void
    novelQualityCheckMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveCheck = resolve }),
    )

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    act(() => {
      result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityChecking).toBe(true)

    await act(async () => {
      resolveCheck()
      // Wait for the promise to settle
      await vi.waitFor(() => !result.current.qualityChecking)
    })
  })

  it('uses UNKNOWN decision when decision field is missing', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: {
        total_score: 75,
        actionable_feedback: 'feedback',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(result.current.qualityCheckResult?.decision).toBe('UNKNOWN')
  })

  it('passes quality goals with correct key mapping', async () => {
    novelQualityCheckMock.mockResolvedValue({
      success: true,
      data: { decision: 'APPROVED', total_score: 90, actionable_feedback: 'ok' },
    })

    const { result } = renderHook(() =>
      useEvaluationQualityCheck({
        content: 'text',
        qualityGoals: {
          naturalness: 91,
          readability: 82,
          coherence: 78,
          styleConsistency: 84,
        },
        t: defaultT,
      }),
    )

    await act(async () => {
      await result.current.runNovelQualityCheck()
    })

    expect(novelQualityCheckMock).toHaveBeenCalledWith(
      'text',
      undefined,
      undefined,
      {
        naturalness: 91,
        readability: 82,
        coherence: 78,
        style_consistency: 84,
      },
    )
  })
})

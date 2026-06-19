import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const evaluateContentMock = vi.hoisted(() => vi.fn())
const getImprovementSuggestionsMock = vi.hoisted(() => vi.fn())
const buildFailurePresentationMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  evaluateContent: evaluateContentMock,
  getImprovementSuggestions: getImprovementSuggestionsMock,
}))

vi.mock('../utils/failurePresentation', () => ({
  buildFailurePresentation: buildFailurePresentationMock,
}))

vi.mock('../utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

import { useEvaluationData } from './useEvaluationData'

const defaultQualityGoals = {
  naturalness: 91,
  readability: 84,
  coherence: 79,
  styleConsistency: 88,
}

const defaultT = {
  evaluationFailed: 'Evaluation failed',
  evaluationSuggestionsRefreshFailed: 'Refresh failed',
  failureCategoryGeneration: 'Generation',
  failureCategoryEvaluation: 'Evaluation',
  failureCategoryRetrieval: 'Retrieval',
  failureCategoryConnection: 'Connection',
  failureMessageGeneration: 'Generation failed',
  failureMessageEvaluation: 'Evaluation failed',
  failureMessageRetrieval: 'Retrieval failed',
  failureMessageConnection: 'Connection failed',
}

const initialSuggestions = [
  { id: 'rec-1', title: 'Tighten opening', reason: 'More urgency', action: 'apply' },
  { id: 'rec-2', title: '', reason: 'Ignored blank title', action: 'apply' },
]

const refreshedSuggestions = [
  { id: 'rec-3', title: 'Clarify stakes', reason: 'Reader focus', action: 'apply' },
]

describe('useEvaluationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildFailurePresentationMock.mockImplementation(
      ({ fallbackMessage, error }: { fallbackMessage: string; error?: unknown }) => ({
        category: 'evaluation',
        label: 'Evaluation',
        message: typeof error === 'string' && error.trim().length > 0 ? error : fallbackMessage,
        detail: typeof error === 'string' ? error : null,
      }),
    )
  })

  it('skips evaluation when content is blank and clears stale state', async () => {
    const translateSuggestions = vi.fn()
    const buildViewModel = vi.fn()

    const { result } = renderHook(() =>
      useEvaluationData({
        content: '   ',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions,
        buildViewModel,
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.result).toBeNull()
    expect(result.current.evaluationError).toBeNull()
    expect(result.current.suggestionsRefreshError).toBeNull()
    expect(evaluateContentMock).not.toHaveBeenCalled()
    expect(translateSuggestions).not.toHaveBeenCalled()
    expect(buildViewModel).not.toHaveBeenCalled()
  })

  it('runs evaluation on mount, maps quality goals, and builds the view model', async () => {
    const translateSuggestions = vi.fn().mockReturnValue(initialSuggestions)
    const buildViewModel = vi.fn().mockImplementation((payload: { total_score: number; suggestions: typeof initialSuggestions; decision: 'APPROVED' }) => ({
      score: payload.total_score,
      dimensions: [],
      modules: [],
      suggestions: payload.suggestions,
      decision: payload.decision,
    }))

    evaluateContentMock.mockResolvedValue({
      success: true,
      data: {
        total_score: 92,
        suggestions: [{ title: 'Raw suggestion' }],
        decision: 'APPROVED',
      },
    })

    const { result } = renderHook(() =>
      useEvaluationData({
        content: 'A tense opening scene',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions,
        buildViewModel,
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.score).toBe(92)
    })

    expect(evaluateContentMock).toHaveBeenCalledWith(
      'A tense opening scene',
      undefined,
      undefined,
      {
        naturalness: 91,
        readability: 84,
        coherence: 79,
        style_consistency: 88,
      },
    )
    expect(translateSuggestions).toHaveBeenCalledWith([{ title: 'Raw suggestion' }])
    expect(buildViewModel).toHaveBeenCalledWith({
      total_score: 92,
      suggestions: initialSuggestions,
      decision: 'APPROVED',
    })
    expect(result.current.evaluationError).toBeNull()
  })

  it('stores a presentation error when evaluation responds without usable data', async () => {
    evaluateContentMock.mockResolvedValue({
      success: false,
      error: 'critic unavailable',
    })

    const { result } = renderHook(() =>
      useEvaluationData({
        content: 'A tense opening scene',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions: vi.fn(),
        buildViewModel: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(buildFailurePresentationMock).toHaveBeenCalledWith({
      t: defaultT,
      source: 'evaluation',
      error: 'critic unavailable',
      fallbackMessage: 'Evaluation failed',
    })
    expect(result.current.result).toBeNull()
    expect(result.current.evaluationError).toEqual({
      category: 'evaluation',
      label: 'Evaluation',
      message: 'critic unavailable',
      detail: 'critic unavailable',
    })
  })

  it('logs and surfaces thrown evaluation failures', async () => {
    const failure = new Error('network timeout')

    evaluateContentMock.mockRejectedValue(failure)

    const { result } = renderHook(() =>
      useEvaluationData({
        content: 'A tense opening scene',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions: vi.fn(),
        buildViewModel: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.evaluationError).not.toBeNull()
    })

    expect(loggerErrorMock).toHaveBeenCalledWith('Evaluation failed:', failure)
    expect(buildFailurePresentationMock).toHaveBeenCalledWith({
      t: defaultT,
      source: 'evaluation',
      error: failure,
      fallbackMessage: 'Evaluation failed',
    })
    expect(result.current.result).toBeNull()
  })

  it('refreshes suggestions from existing evaluation issues', async () => {
    const translateSuggestions = vi.fn()
      .mockReturnValueOnce(initialSuggestions)
      .mockReturnValueOnce(refreshedSuggestions)
    const buildViewModel = vi.fn().mockImplementation((payload: { total_score: number; suggestions: typeof initialSuggestions; decision: 'APPROVED' }) => ({
      score: payload.total_score,
      dimensions: [],
      modules: [],
      suggestions: payload.suggestions,
      decision: payload.decision,
    }))

    evaluateContentMock.mockResolvedValue({
      success: true,
      data: {
        total_score: 88,
        suggestions: [{ title: 'Tighten opening' }, { title: '' }],
        decision: 'APPROVED',
      },
    })
    getImprovementSuggestionsMock.mockResolvedValue({
      success: true,
      data: [{ title: 'Clarify stakes' }],
    })

    const { result } = renderHook(() =>
      useEvaluationData({
        content: 'A tense opening scene',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions,
        buildViewModel,
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.suggestions).toEqual(initialSuggestions)
    })

    await act(async () => {
      await result.current.refreshSuggestions()
    })

    expect(getImprovementSuggestionsMock).toHaveBeenCalledWith(
      'A tense opening scene',
      ['Tighten opening'],
      8,
    )
    expect(result.current.suggestionsRefreshing).toBe(false)
    expect(result.current.suggestionsRefreshError).toBeNull()
    expect(result.current.result?.suggestions).toEqual(refreshedSuggestions)
  })

  it('surfaces refresh failures when no evaluation result exists yet', async () => {
    getImprovementSuggestionsMock.mockResolvedValue({
      success: true,
      data: [{ title: 'Clarify stakes' }],
    })

    const { result } = renderHook(() =>
      useEvaluationData({
        content: '   ',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions: vi.fn(),
        buildViewModel: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.refreshSuggestions()
    })

    expect(getImprovementSuggestionsMock).toHaveBeenCalledWith('   ', undefined, 8)
    expect(buildFailurePresentationMock).toHaveBeenCalledWith({
      t: defaultT,
      source: 'evaluation',
      error: undefined,
      fallbackMessage: 'Refresh failed',
    })
    expect(result.current.suggestionsRefreshError).toContain('Evaluation')
    expect(result.current.suggestionsRefreshError).toContain('Refresh failed')
  })

  it('logs and surfaces thrown suggestion refresh failures', async () => {
    const refreshError = new Error('rate limited')
    const translateSuggestions = vi.fn().mockReturnValue(initialSuggestions)
    const buildViewModel = vi.fn().mockImplementation((payload: { total_score: number; suggestions: typeof initialSuggestions; decision: 'APPROVED' }) => ({
      score: payload.total_score,
      dimensions: [],
      modules: [],
      suggestions: payload.suggestions,
      decision: payload.decision,
    }))

    evaluateContentMock.mockResolvedValue({
      success: true,
      data: {
        total_score: 88,
        suggestions: [{ title: 'Tighten opening' }],
        decision: 'APPROVED',
      },
    })
    getImprovementSuggestionsMock.mockRejectedValue(refreshError)

    const { result } = renderHook(() =>
      useEvaluationData({
        content: 'A tense opening scene',
        qualityGoals: defaultQualityGoals,
        t: defaultT,
        translateSuggestions,
        buildViewModel,
      }),
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result).not.toBeNull()
    })

    await act(async () => {
      await result.current.refreshSuggestions()
    })

    expect(loggerErrorMock).toHaveBeenCalledWith('Refreshing suggestions failed:', refreshError)
    expect(buildFailurePresentationMock).toHaveBeenCalledWith({
      t: defaultT,
      source: 'evaluation',
      error: refreshError,
      fallbackMessage: 'Refresh failed',
    })
    expect(result.current.suggestionsRefreshing).toBe(false)
    expect(result.current.suggestionsRefreshError).toContain('Evaluation')
    expect(result.current.suggestionsRefreshError).toContain('Refresh failed')
  })
})

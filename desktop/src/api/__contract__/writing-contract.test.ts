/**
 * Contract verification tests for writing/quality (CF-003)
 * Backend never returns 'decision' field but frontend NovelQualityCheckResult requires it
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

vi.mock('../workspace', () => ({
  appendWorkspacePayload: vi.fn((payload, _ws) => payload),
  appendLegacyChatWorkspacePayload: vi.fn((payload, _ws) => payload),
  appendLegacyMemoryWorkspacePayload: vi.fn((payload, _ws, _opts) => payload),
}))

vi.mock('../chat', () => ({}))

vi.mock('../workflow', () => ({}))

import { novelQualityCheck } from '../evaluation'
import type { NovelQualityCheckResult } from '../evaluation'

describe('CF-003: writing/quality decision field missing from backend', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('novelQualityCheck: backend response lacks decision field', async () => {
    // Simulate actual backend response (from novelQualityCheckEndpoint)
    const backendRawBody = {
      status: 'ok',
      total_score: 85,
      lock_score: 80,
      style_score: 90,
      logic_score: 85,
      actionable_feedback: 'Good writing, minor issues.',
      suggestions: [],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await novelQualityCheck('Sample text content')

    expect(result.success).toBe(true)
    // CF-003 MISMATCH: NovelQualityCheckResult.decision is required but backend never returns it
    expect((result.data as Record<string, unknown>).decision).toBeUndefined()
    // Backend returns 'status' which is not in the frontend type
    expect((result.data as Record<string, unknown>).status).toBe('ok')
    // Frontend code checking result.data.decision will get undefined
    // This means branching logic like if (decision === 'APPROVED') will never match
  })

  it('novelQualityCheck: backend returns zeroed scores on exception (swallowed as 200)', async () => {
    // When evaluateNovelQuality throws, backend returns qualityDefaultPayload() with 200
    const errorFallback = {
      status: 'ok',
      total_score: 0,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: '',
      suggestions: [],
    }
    callApiMock.mockResolvedValue({ success: true, data: errorFallback })

    const result = await novelQualityCheck('some text')

    // W-007: Error swallowed as 200 success with useless zeroed data
    expect(result.success).toBe(true)
    expect((result.data as Record<string, unknown>).decision).toBeUndefined()
    expect((result.data as NovelQualityCheckResult).total_score).toBe(0)
    // Frontend cannot distinguish real 0-score from error fallback
  })

  it('novelQualityCheck: frontend sends 3 fields that backend ignores', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { status: 'ok', total_score: 0, lock_score: 0, style_score: 0, logic_score: 0, actionable_feedback: '', suggestions: [] },
    })

    await novelQualityCheck('text', { scene: 1 }, ['style'], { targets: { overall: 80 } })

    // Verify callApi is called with the extra fields
    expect(callApiMock).toHaveBeenCalledWith('/writing/quality', 'POST', {
      content: 'text',
      scene_card: { scene: 1 },
      dimensions: ['style'],
      quality_goals: { targets: { overall: 80 } },
    })
    // Note: Backend endpoint reads body.content but ignores scene_card, dimensions, quality_goals
  })
})

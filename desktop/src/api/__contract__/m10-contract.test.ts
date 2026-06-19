/**
 * Contract verification tests for m10-apis.ts (CF-005)
 * getStyleProfile returns null but typed as Record<string, unknown>
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import { getStyleProfile, extractStyleProfile, runMultiPassRevision } from '../m10-apis'

describe('CF-005: getStyleProfile returns null but typed as Record', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('getStyleProfile: backend always returns null (unimplemented)', async () => {
    // Backend styleProfileEndpoint returns null for any projectId
    callApiMock.mockResolvedValue({ success: true, data: null })

    const result = await getStyleProfile('project-1')

    expect(result.success).toBe(true)
    // CF-005 MISMATCH: type says Record<string, unknown> but actual is null
    expect(result.data).toBeNull()
    // Accessing any property on null throws TypeError
    // e.g., (result.data as Record<string, unknown>).avgSentenceLength → TypeError
  })
})

describe('W-015: runMultiPassRevision extra backend fields', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('runMultiPassRevision: backend returns 3 extra fields not in frontend type', async () => {
    // Actual backend response includes finalDecision, learningInsights, comparison
    const backendRawBody = {
      completed: true,
      revisedContent: 'improved text',
      iterations: 3,
      initialScore: 60,
      finalScore: 85,
      finalDecision: 'go',
      learningInsights: ['pattern1'],
      comparison: { improvements: 5 },
      reason: 'target reached',
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await runMultiPassRevision({ text: 'original' })

    // MultiPassRevisionResult doesn't include finalDecision, learningInsights, comparison
    // But they exist in the actual response data (absorbed by extra properties silently)
    expect((result.data as Record<string, unknown>).finalDecision).toBe('go')
    expect((result.data as Record<string, unknown>).learningInsights).toEqual(['pattern1'])
    expect((result.data as Record<string, unknown>).comparison).toEqual({ improvements: 5 })
  })
})

describe('W-018: extractStyleProfile returns specific shape but typed as Record', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('extractStyleProfile: backend returns 9 specific fields but type is Record<string,unknown>', async () => {
    const backendRawBody = {
      avgSentenceLength: 15.2,
      vocabRichness: 0.65,
      dialogueRatio: 0.3,
      tensePreference: 'past',
      avgParagraphLength: 45,
      sentenceLengthDistribution: [0.1, 0.3, 0.4, 0.2],
      dominantPOV: 'third',
      sampleHash: 'abc123',
      extractedAt: '2026-06-14T00:00:00Z',
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await extractStyleProfile('sample text')

    expect(result.success).toBe(true)
    // All fields are accessible but untyped
    expect((result.data as Record<string, unknown>).avgSentenceLength).toBe(15.2)
    // Lost type safety - no dedicated StyleProfile interface
  })
})

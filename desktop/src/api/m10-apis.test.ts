import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./core', () => ({
  callApi: vi.fn(),
}))

import { callApi } from './core'
import {
  runMultiPassRevision,
  extractStyleProfile,
  getStyleProfile,
  applyStyle,
  runCrossChapterConsistency,
  getContextAwareSuggestions,
} from './m10-apis'

const mockCallApi = vi.mocked(callApi)

beforeEach(() => {
  mockCallApi.mockReset()
})

describe('runMultiPassRevision', () => {
  it('calls /agent/revise-multi-pass with POST', async () => {
    mockCallApi.mockResolvedValue({ success: true, data: { completed: true, revisedContent: 'better text', iterations: 2, initialScore: 6, finalScore: 8.5, reason: 'target_reached' } })
    const result = await runMultiPassRevision({ text: 'test text', target_score: 8.0, max_iterations: 5 })
    expect(mockCallApi).toHaveBeenCalledWith('/agent/revise-multi-pass', 'POST', expect.objectContaining({ text: 'test text' }))
    expect(result.success).toBe(true)
  })
})

describe('extractStyleProfile', () => {
  it('calls /style/extract with POST', async () => {
    mockCallApi.mockResolvedValue({ success: true, data: { avgSentenceLength: 15.2 } })
    const result = await extractStyleProfile('sample text')
    expect(mockCallApi).toHaveBeenCalledWith('/style/extract', 'POST', { text: 'sample text' })
    expect(result.success).toBe(true)
  })
})

describe('getStyleProfile', () => {
  it('calls /style/profile/{projectId} with GET', async () => {
    mockCallApi.mockResolvedValue({ success: true, data: { avgSentenceLength: 12 } })
    const result = await getStyleProfile('proj-123')
    expect(mockCallApi).toHaveBeenCalledWith('/style/profile/proj-123', 'GET')
    expect(result.success).toBe(true)
  })

  it('encodes project ID safely', async () => {
    mockCallApi.mockResolvedValue({ success: true })
    await getStyleProfile('proj/special')
    expect(mockCallApi).toHaveBeenCalledWith('/style/profile/proj%2Fspecial', 'GET')
  })
})

describe('applyStyle', () => {
  it('calls /style/apply with POST', async () => {
    mockCallApi.mockResolvedValue({ success: true, data: { context: 'style guidance' } })
    const result = await applyStyle({ text: 'text', style_profile: { avgSentenceLength: 10 } })
    expect(mockCallApi).toHaveBeenCalledWith('/style/apply', 'POST', expect.objectContaining({ text: 'text' }))
    expect(result.success).toBe(true)
  })
})

describe('runCrossChapterConsistency', () => {
  it('calls /consistency/cross-chapter with POST', async () => {
    const chapters = [{ chapterNumber: 1, title: 'Ch1', content: 'text' }]
    mockCallApi.mockResolvedValue({ success: true, data: { overallScore: 8.5, nameConflicts: [] } })
    const result = await runCrossChapterConsistency({ chapters })
    expect(mockCallApi).toHaveBeenCalledWith('/consistency/cross-chapter', 'POST', expect.objectContaining({ chapters }))
    expect(result.success).toBe(true)
  })
})

describe('getContextAwareSuggestions', () => {
  it('calls /suggestions/context-aware with POST', async () => {
    mockCallApi.mockResolvedValue({ success: true, data: { context: 'assembled context', suggestions: ['fix pacing'] } })
    const result = await getContextAwareSuggestions({ text: 'current text' })
    expect(mockCallApi).toHaveBeenCalledWith('/suggestions/context-aware', 'POST', expect.objectContaining({ text: 'current text' }))
    expect(result.success).toBe(true)
  })
})

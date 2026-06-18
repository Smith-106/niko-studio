import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import {
  analyzeReader,
  getReaderOverlay,
  getReaderPersonas,
  createCustomPersona,
  readerApi,
} from './reader'

describe('reader api bridge', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('routes analyze requests through the desktop bridge', async () => {
    await analyzeReader('novel-1', ['critic', 'reader'])

    expect(callApiMock).toHaveBeenCalledWith('/reader/analyze', 'POST', {
      novelId: 'novel-1',
      personaIds: ['critic', 'reader'],
    })
  })

  it('routes analyze requests without personaIds', async () => {
    await analyzeReader('novel-2')

    expect(callApiMock).toHaveBeenCalledWith('/reader/analyze', 'POST', {
      novelId: 'novel-2',
      personaIds: undefined,
    })
  })

  it('returns a full ConsensusReport from the backend', async () => {
    const mockResult = {
      novelId: 'novel-1',
      readerReactions: [
        {
          personaId: 'critic',
          personaName: '文学评论家',
          dimensions: { plotCoherence: 0.8 },
          highlights: [],
          overallScore: 0.8,
        },
      ],
      editorialAnalysis: {
        structuralIssues: [],
        styleNotes: [],
        pacingAssessment: '节奏适中',
        recommendations: [],
      },
      consensus: {
        items: [
          {
            description: 'Plot gap near midpoint',
            dimension: 'Plot Coherence',
            agreeingPersonas: ['critic'],
            disagreeingPersonas: [],
            severity: 'high',
            consensusStrength: 0.8,
            location: { chapter: '5', paragraph: 2 },
          },
        ],
        overallAssessment: '整体质量良好',
        criticalIssues: [
          {
            description: 'Plot gap near midpoint',
            dimension: 'Plot Coherence',
            agreeingPersonas: ['critic'],
            disagreeingPersonas: [],
            severity: 'high',
            consensusStrength: 0.8,
            location: { chapter: '5', paragraph: 2 },
          },
        ],
        dissentItems: [],
        dimensionSummaries: {
          'Plot Coherence': { avgScore: 0.8, consensus: 0.9 },
        },
      },
      dimensionScores: [
        {
          personaId: 'critic',
          personaName: '文学评论家',
          scores: [
            { dimension: 'plotCoherence', score: 0.8, weight: 0.5 },
          ],
        },
      ],
      timestamp: '2024-01-01T00:00:00Z',
    }

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: mockResult,
    })

    const result = await analyzeReader('novel-1')

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockResult)
    expect(result.data?.consensus.items).toHaveLength(1)
    expect(result.data?.consensus.criticalIssues).toHaveLength(1)
    expect(result.data?.consensus.dimensionSummaries['Plot Coherence']).toEqual({
      avgScore: 0.8,
      consensus: 0.9,
    })
  })

  it('routes overlay requests through the desktop bridge', async () => {
    await getReaderOverlay('novel-1')

    expect(callApiMock).toHaveBeenCalledWith('/reader/overlay', 'POST', {
      novelId: 'novel-1',
    })
  })

  it('returns overlay markers from the backend', async () => {
    const mockOverlay = {
      novelId: 'novel-1',
      markers: [
        {
          personaId: 'critic',
          personaName: '文学评论家',
          position: { chapter: '1', paragraph: 3 },
          reaction: 'negative',
          comment: '节奏拖沓',
          dimension: 'Pacing',
          text: '段落文本',
        },
      ],
      markerCount: 1,
      analysisTimestamp: '2024-01-01T00:00:00Z',
    }

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: mockOverlay,
    })

    const result = await getReaderOverlay('novel-1')

    expect(result.success).toBe(true)
    expect(result.data?.markers).toHaveLength(1)
    expect(result.data?.markerCount).toBe(1)
  })

  it('routes persona list requests through the desktop bridge', async () => {
    await getReaderPersonas()

    expect(callApiMock).toHaveBeenCalledWith('/reader/personas', 'GET')
  })

  it('returns preset and custom personas from the backend', async () => {
    const mockPersonas = {
      presets: [
        {
          id: 'suspense-enthusiast',
          name: '悬疑爱好者',
          description: '专注悬念和节奏',
          parameters: {
            plotWeight: 0.8,
            characterWeight: 0.5,
            styleWeight: 0.3,
            pacingWeight: 0.9,
            toleranceThreshold: 0.4,
            focusAreas: ['plot', 'pacing'],
            biases: [],
          },
        },
      ],
      custom: [],
      totalPresetCount: 1,
      totalCustomCount: 0,
    }

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: mockPersonas,
    })

    const result = await getReaderPersonas()

    expect(result.success).toBe(true)
    expect(result.data?.presets).toHaveLength(1)
    expect(result.data?.totalPresetCount).toBe(1)
  })

  it('routes custom persona creation through the desktop bridge', async () => {
    await createCustomPersona({
      name: '我的角色',
      parameters: {
        plotWeight: 0.7,
        characterWeight: 0.6,
      },
    })

    expect(callApiMock).toHaveBeenCalledWith('/reader/personas/custom', 'POST', {
      name: '我的角色',
      parameters: {
        plotWeight: 0.7,
        characterWeight: 0.6,
      },
    })
  })

  it('returns the created persona from the backend', async () => {
    const mockPersona = {
      persona: {
        id: 'custom-123',
        name: '我的角色',
        description: '自定义角色',
        parameters: {
          plotWeight: 0.7,
          characterWeight: 0.6,
          styleWeight: 0.5,
          pacingWeight: 0.5,
          toleranceThreshold: 0.5,
          focusAreas: [],
          biases: [],
        },
      },
    }

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: mockPersona,
    })

    const result = await createCustomPersona({
      name: '我的角色',
      parameters: { plotWeight: 0.7 },
    })

    expect(result.success).toBe(true)
    expect(result.data?.persona.id).toBe('custom-123')
  })

  it('passes through bridge failures unchanged', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'network unavailable',
    })

    await expect(analyzeReader('novel-1')).resolves.toEqual({
      success: false,
      error: 'network unavailable',
    })
  })

  it('exposes all functions via readerApi barrel', () => {
    expect(readerApi.analyzeReader).toBe(analyzeReader)
    expect(readerApi.getReaderOverlay).toBe(getReaderOverlay)
    expect(readerApi.getReaderPersonas).toBe(getReaderPersonas)
    expect(readerApi.createCustomPersona).toBe(createCustomPersona)
  })
})

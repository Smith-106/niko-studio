import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import { analyzeWritingCraft, analyzeWritingCraftLLM } from './writing-craft'
import {
  analyzeEmotionalArc,
  analyzeReaderImmersion,
  analyzeShowTell,
  analyzeVoiceConsistency,
  navigatePacing,
  analyzeWebnovelHooks,
  analyzeWebnovelCliffhangers,
  analyzeWebnovelPacing,
} from './writing-craft'

describe('writing-craft api bridge', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('routes analyze requests through the desktop bridge', async () => {
    await analyzeWritingCraft('章节正文', ['structure', 'dialogue'])

    expect(callApiMock).toHaveBeenCalledWith('/writing-craft/analyze', 'POST', {
      text: '章节正文',
      dimensions: ['structure', 'dialogue'],
    }, undefined)
  })

  it('routes llm deep-analysis requests with provider config', async () => {
    await analyzeWritingCraftLLM(
      '章节正文',
      {
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      },
      ['structure'],
    )

    expect(callApiMock).toHaveBeenCalledWith('/writing-craft/llm-analyze', 'POST', {
      text: '章节正文',
      dimensions: ['structure'],
      model: 'gpt-4o',
    }, {
      'X-LLM-API-Key': 'sk-test',
      'X-LLM-Base-Url': 'https://api.openai.com/v1',
    })
  })

  it('unwraps nested success envelopes for writing-craft endpoints', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 9.1,
          dimensions: [],
          textLength: 1280,
        },
      },
    })

    await expect(analyzeWritingCraft('章节正文')).resolves.toEqual({
      success: true,
      data: {
        overallScore: 9.1,
        dimensions: [],
        textLength: 1280,
      },
    })
  })

  it('maps a failed nested envelope to a request failure', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: false,
        data: null,
      },
    })

    await expect(analyzeWritingCraft('章节正文')).resolves.toEqual({
      success: false,
      error: 'Writing craft request failed.',
    })
  })

  it('passes through outer bridge failures unchanged', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'network unavailable',
    })

    await expect(analyzeWritingCraft('章节正文')).resolves.toEqual({
      success: false,
      error: 'network unavailable',
    })
  })

  it('extracts show-tell details from the aggregate analysis payload', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 7.8,
          textLength: 600,
          dimensions: [
            {
              dimension: 'show_tell',
              label: '展示与讲述',
              score: 7.8,
              maxScore: 10,
              evidence: [],
              suggestions: [],
              details: {
                showTellRatio: 2.4,
                showCount: 24,
                tellCount: 10,
                sensoryCoverage: {
                  visual: 3,
                  auditory: 2,
                  tactile: 1,
                  olfactory: 0,
                  gustatory: 0,
                  overall: 6,
                },
                abstractVsConcrete: 1.2,
                heatMap: [],
                suggestions: ['增加具象动作'],
              },
            },
          ],
        },
      },
    })

    await expect(analyzeShowTell('章节正文')).resolves.toEqual({
      success: true,
      data: {
        showTellRatio: 2.4,
        showCount: 24,
        tellCount: 10,
        sensoryCoverage: {
          visual: 3,
          auditory: 2,
          tactile: 1,
          olfactory: 0,
          gustatory: 0,
          overall: 6,
        },
        abstractVsConcrete: 1.2,
        heatMap: [],
        suggestions: ['增加具象动作'],
      },
    })

    expect(callApiMock).toHaveBeenCalledWith('/writing-craft/analyze', 'POST', {
      text: '章节正文',
      dimensions: ['show_tell'],
    }, undefined)
  })

  it('reports a missing show-tell dimension when the backend payload lacks details', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 7.8,
          textLength: 600,
          dimensions: [],
        },
      },
    })

    await expect(analyzeShowTell('章节正文')).resolves.toEqual({
      success: false,
      error: 'Missing show_tell result.',
    })
  })

  it('routes the specialized analysis helpers through their dedicated endpoints', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            timeline: [],
            tensionDeserts: [],
            curveMatches: [],
            overallArcScore: 8.3,
            suggestions: [],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            fingerprints: [],
            voiceDistinctness: 8.7,
            warnings: [],
            suggestions: [],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            chapterStates: [],
            averageImmersion: 7.9,
            averageDropoutRisk: 0.12,
            highRiskChapters: [],
            trajectory: 'stable',
            suggestions: [],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          data: {
            prescriptions: [],
            pacingScore: 8.1,
            suggestions: [],
          },
        },
      })

    const chapters = [
      { content: '第一章', chapterIndex: 1 },
      { content: '第二章', chapterIndex: 2 },
    ]

    await expect(analyzeEmotionalArc(chapters)).resolves.toEqual({
      success: true,
      data: {
        timeline: [],
        tensionDeserts: [],
        curveMatches: [],
        overallArcScore: 8.3,
        suggestions: [],
      },
    })
    await expect(analyzeVoiceConsistency('角色对白')).resolves.toEqual({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 8.7,
        warnings: [],
        suggestions: [],
      },
    })
    await expect(analyzeReaderImmersion(chapters)).resolves.toEqual({
      success: true,
      data: {
        chapterStates: [],
        averageImmersion: 7.9,
        averageDropoutRisk: 0.12,
        highRiskChapters: [],
        trajectory: 'stable',
        suggestions: [],
      },
    })
    await expect(navigatePacing(chapters)).resolves.toEqual({
      success: true,
      data: {
        prescriptions: [],
        pacingScore: 8.1,
        suggestions: [],
      },
    })

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/writing-craft/emotional-arc', 'POST', {
      chapters,
    }, undefined)
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/writing-craft/voice-consistency', 'POST', {
      text: '角色对白',
    }, undefined)
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/writing-craft/reader-immersion', 'POST', {
      chapters,
    }, undefined)
    expect(callApiMock).toHaveBeenNthCalledWith(4, '/writing-craft/pacing-navigator', 'POST', {
      chapters,
    }, undefined)
  })

  it('extracts webnovel hook details from the aggregate analysis payload', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 7.5,
          textLength: 300,
          dimensions: [
            {
              dimension: 'hook',
              label: '钩子',
              score: 7.5,
              maxScore: 10,
              evidence: [],
              suggestions: [],
              details: {
                hooks: [{ position: 0, text: '开头', strength: 0.8, type: 'opening' }],
                overallHookScore: 7.5,
                suggestions: ['加强钩子'],
              },
            },
          ],
        },
      },
    })

    await expect(analyzeWebnovelHooks('章节正文')).resolves.toEqual({
      success: true,
      data: {
        hooks: [{ position: 0, text: '开头', strength: 0.8, type: 'opening' }],
        overallHookScore: 7.5,
        suggestions: ['加强钩子'],
      },
    })

    expect(callApiMock).toHaveBeenCalledWith('/writing-craft/analyze', 'POST', {
      text: '章节正文',
      dimensions: ['hook'],
    }, undefined)
  })

  it('extracts webnovel cliffhanger details from the aggregate analysis payload', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 8,
          textLength: 300,
          dimensions: [
            {
              dimension: 'cliffhanger',
              label: '悬念',
              score: 8,
              maxScore: 10,
              evidence: [],
              suggestions: [],
              details: {
                cliffhangers: [{ position: 100, text: '结尾', intensity: 0.9, type: 'suspense' }],
                overallCliffhangerScore: 8,
                suggestions: ['保持悬念'],
              },
            },
          ],
        },
      },
    })

    await expect(analyzeWebnovelCliffhangers('章节正文')).resolves.toEqual({
      success: true,
      data: {
        cliffhangers: [{ position: 100, text: '结尾', intensity: 0.9, type: 'suspense' }],
        overallCliffhangerScore: 8,
        suggestions: ['保持悬念'],
      },
    })
  })

  it('extracts webnovel pacing details from the aggregate analysis payload', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 6.5,
          textLength: 600,
          dimensions: [
            {
              dimension: 'webnovel',
              label: '网文节奏',
              score: 6.5,
              maxScore: 10,
              evidence: [],
              suggestions: [],
              details: {
                chapterFlow: 7,
                retentionScore: 6,
                pacingPattern: 'uneven',
                suggestions: ['调整节奏'],
              },
            },
          ],
        },
      },
    })

    await expect(
      analyzeWebnovelPacing([
        { content: '第一章', chapterIndex: 1 },
        { content: '第二章', chapterIndex: 2 },
      ]),
    ).resolves.toEqual({
      success: true,
      data: {
        chapterFlow: 7,
        retentionScore: 6,
        pacingPattern: 'uneven',
        suggestions: ['调整节奏'],
      },
    })

    expect(callApiMock).toHaveBeenCalledWith('/writing-craft/analyze', 'POST', {
      text: '第一章\n第二章',
      dimensions: ['webnovel'],
    }, undefined)
  })

  it('reports missing webnovel pacing result when details are absent', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 6.5,
          textLength: 600,
          dimensions: [{ dimension: 'webnovel', label: '网文节奏', score: 6.5, maxScore: 10, evidence: [], suggestions: [] }],
        },
      },
    })

    await expect(analyzeWebnovelPacing([{ content: '第一章', chapterIndex: 1 }])).resolves.toEqual({
      success: false,
      error: 'Missing webnovel result.',
    })
  })

  it('reports missing webnovel pacing result when details are not an object', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 6.5,
          textLength: 600,
          dimensions: [{ dimension: 'webnovel', label: '网文节奏', score: 6.5, maxScore: 10, evidence: [], suggestions: [], details: null }],
        },
      },
    })

    await expect(analyzeWebnovelPacing([{ content: '第一章', chapterIndex: 1 }])).resolves.toEqual({
      success: false,
      error: 'Missing webnovel result.',
    })
  })
  it('reports missing webnovel dimension details when the backend payload lacks them', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 6.5,
          textLength: 600,
          dimensions: [],
        },
      },
    })

    await expect(analyzeWebnovelHooks('章节正文')).resolves.toEqual({
      success: false,
      error: 'Missing hook result.',
    })
  })

  it('reports missing cliffhanger result when details are absent', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        success: true,
        data: {
          overallScore: 8,
          textLength: 300,
          dimensions: [{ dimension: 'cliffhanger', label: '悬念', score: 8, maxScore: 10, evidence: [], suggestions: [] }],
        },
      },
    })

    await expect(analyzeWebnovelCliffhangers('章节正文')).resolves.toEqual({
      success: false,
      error: 'Missing cliffhanger result.',
    })
  })

  it('passes through outer bridge failures for webnovel helpers', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'bridge failure',
    })

    await expect(analyzeWebnovelPacing([{ content: '第一章', chapterIndex: 1 }])).resolves.toEqual({
      success: false,
      error: 'bridge failure',
    })
  })

  it('passes through outer bridge failures for hook helper', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'bridge failure',
    })

    await expect(analyzeWebnovelHooks('章节正文')).resolves.toEqual({
      success: false,
      error: 'bridge failure',
    })
  })

  it('passes through outer bridge failures for cliffhanger helper', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'bridge failure',
    })

    await expect(analyzeWebnovelCliffhangers('章节正文')).resolves.toEqual({
      success: false,
      error: 'bridge failure',
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../sentry', () => ({
  Sentry: {
    captureException: vi.fn(),
  },
}))

vi.mock('@/runtime/preferences', () => ({
  readRuntimePreferences: () => ({
    apiBaseUrl: '',
  }),
}))

vi.mock('./transport', () => ({
  callTauriApi: vi.fn(),
  checkTauriBackendHealth: vi.fn(),
  getRuntimeGatewayBase: vi.fn(),
  isTauriRuntime: vi.fn(() => false),
  normalizeGatewayBaseUrl: (value: string) => value.replace(/\/+$/, ''),
  startTauriBackend: vi.fn(),
}))

import { analyzeWritingCraft, analyzeWritingCraftLLM } from './writing-craft'

describe('writing-craft browser bridge integration', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('hits the analyze endpoint through fetch and unwraps the backend envelope', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        data: {
          overallScore: 8.2,
          textLength: 120,
          dimensions: [
            {
              dimension: 'structure',
              label: '结构分析',
              score: 8.2,
              maxScore: 10,
              evidence: ['节拍完整'],
              suggestions: ['补强结尾'],
              details: {},
            },
          ],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await analyzeWritingCraft('章节正文', ['structure'])

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/writing-craft/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '章节正文',
          dimensions: ['structure'],
        }),
      }),
    )

    expect(response).toEqual({
      success: true,
      data: {
        overallScore: 8.2,
        textLength: 120,
        dimensions: [
          expect.objectContaining({
            dimension: 'structure',
            score: 8.2,
          }),
        ],
      },
    })
  })

  it('hits the llm endpoint through fetch and unwraps the backend envelope', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        data: {
          overallScore: 7.9,
          textLength: 120,
          source: 'llm',
          dimensions: [
            {
              dimension: 'dialogue',
              label: '对话分析',
              score: 7.9,
              maxScore: 10,
              evidence: ['潜台词明确'],
              suggestions: ['增加角色区分度'],
              details: { analysis: '对话张力良好' },
            },
          ],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const response = await analyzeWritingCraftLLM(
      '章节正文',
      {
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      },
      ['dialogue'],
    )

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/writing-craft/llm-analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: '章节正文',
          dimensions: ['dialogue'],
          api_key: 'sk-test',
          base_url: 'https://api.openai.com/v1',
          model: 'gpt-4o',
        }),
      }),
    )

    expect(response).toEqual({
      success: true,
      data: {
        overallScore: 7.9,
        textLength: 120,
        source: 'llm',
        dimensions: [
          expect.objectContaining({
            dimension: 'dialogue',
            details: { analysis: '对话张力良好' },
          }),
        ],
      },
    })
  })
})

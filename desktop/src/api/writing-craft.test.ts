import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import { analyzeWritingCraft, analyzeWritingCraftLLM } from './writing-craft'

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
    })
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
      api_key: 'sk-test',
      base_url: 'https://api.openai.com/v1',
      model: 'gpt-4o',
    })
  })
})

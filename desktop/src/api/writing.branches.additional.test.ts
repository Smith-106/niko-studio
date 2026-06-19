import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

vi.mock('./workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import {
  polishContentCompat,
  processWritingHelper,
} from './writing'

describe('writing api bridge branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('processWritingHelper propagates callApi error envelope', async () => {
    callApiMock.mockResolvedValue({ success: false, error: 'service unavailable' })

    const result = await processWritingHelper({
      content: 'test draft',
      mode: 'polish',
      instruction: '',
    } as never)

    expect(result.success).toBe(false)
    expect(result.error).toBe('service unavailable')
  })

  it('processWritingHelper includes X-LLM-API-Key header when api_key is provided', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { processed_text: 'done' } })

    await processWritingHelper({
      content: 'draft',
      mode: 'polish',
      instruction: '',
      api_key: 'sk-test-key',
    } as never)

    expect(callApiMock).toHaveBeenCalledWith(
      '/writing/helper',
      'POST',
      expect.anything(),
      expect.objectContaining({ 'X-LLM-API-Key': 'sk-test-key' }),
    )
  })

  it('processWritingHelper includes X-LLM-Base-Url header when base_url is provided', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { processed_text: 'done' } })

    await processWritingHelper({
      content: 'draft',
      mode: 'polish',
      instruction: '',
      base_url: 'https://custom.api.com',
    } as never)

    expect(callApiMock).toHaveBeenCalledWith(
      '/writing/helper',
      'POST',
      expect.anything(),
      expect.objectContaining({ 'X-LLM-Base-Url': 'https://custom.api.com' }),
    )
  })

  it('processWritingHelper omits api_key and base_url from body payload', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { processed_text: 'done' } })

    await processWritingHelper({
      content: 'draft',
      mode: 'polish',
      instruction: '',
      api_key: 'sk-key',
      base_url: 'https://custom.api.com',
    } as never)

    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg).not.toHaveProperty('api_key')
    expect(bodyArg).not.toHaveProperty('base_url')
  })

  it('polishContentCompat maps business polishType to business instruction', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished business' },
    })

    const result = await polishContentCompat({
      originalText: 'some business text',
      polishType: 'business',
    })

    expect(result.error).toBeUndefined()
    expect(result.polishedText).toBe('polished business')
    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg.instruction).toContain('商务')
  })

  it('polishContentCompat maps academic polishType to academic instruction', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished academic' },
    })

    const result = await polishContentCompat({
      originalText: 'some academic text',
      polishType: 'academic',
    })

    expect(result.error).toBeUndefined()
    expect(result.polishedText).toBe('polished academic')
    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg.instruction).toContain('学术')
  })

  it('polishContentCompat maps creative polishType to creative instruction', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished creative' },
    })

    const result = await polishContentCompat({
      originalText: 'some creative text',
      polishType: 'creative',
    })

    expect(result.error).toBeUndefined()
    expect(result.polishedText).toBe('polished creative')
    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg.instruction).toContain('创意')
  })

  it('polishContentCompat maps standard polishType to empty instruction (default branch)', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished standard' },
    })

    const result = await polishContentCompat({
      originalText: 'some standard text',
      polishType: 'standard',
    })

    expect(result.error).toBeUndefined()
    expect(result.polishedText).toBe('polished standard')
    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg.instruction).toBe('')
  })

  it('polishContentCompat with undefined polishType uses empty instruction', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished default' },
    })

    const result = await polishContentCompat({
      originalText: 'some default text',
    })

    expect(result.error).toBeUndefined()
    const bodyArg = callApiMock.mock.calls[0][2] as Record<string, unknown>
    expect(bodyArg.instruction).toBe('')
  })

  it('polishContentCompat propagates callApi error when success is true but data is null', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: null,
    })

    const result = await polishContentCompat({
      originalText: 'text to polish',
      polishType: 'academic',
    })

    expect(result.error).toBe('polish request failed')
    expect(result.polishedText).toBe('')
    expect(result.diffMarkup).toBe('')
  })

  it('polishContentCompat propagates callApi error envelope with error message', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'gateway timeout',
    })

    const result = await polishContentCompat({
      originalText: 'text to polish',
      polishType: 'creative',
    })

    expect(result.error).toBe('gateway timeout')
    expect(result.polishedText).toBe('')
    expect(result.originalText).toBe('text to polish')
  })

  it('polishContentCompat with non-string originalText returns empty originalText error', async () => {
    const result = await polishContentCompat({
      originalText: 123 as unknown as string,
    })

    expect(result.error).toBe('originalText is required')
    expect(result.originalText).toBe('')
  })
})

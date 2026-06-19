import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const getErrorNameMock = vi.hoisted(() => vi.fn((error: unknown) => (error instanceof Error ? error.name : 'UnknownError')))
const normalizeGatewayBaseUrlMock = vi.hoisted(() => vi.fn((value: string) => value.replace(/\/+$/, '')))
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  GENERIC_API_ERROR_MESSAGE: 'Request failed. Please try again.',
  callApi: callApiMock,
  getErrorName: getErrorNameMock,
  normalizeGatewayBaseUrl: normalizeGatewayBaseUrlMock,
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

import { fetchProviderModels } from './models'

describe('gateway model discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns normalized and deduplicated gateway models from nested payloads', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        result: [
          { name: 'models/gpt-4o' },
          { id: 'gpt-4o' },
          ' gpt-4o-mini ',
          { model: 'GPT-4O-MINI' },
          null,
        ],
      },
    })

    const result = await fetchProviderModels('openai', 'https://api.openai.com', 'sk-test')

    expect(result).toEqual({
      success: true,
      data: {
        models: ['gpt-4o', 'gpt-4o-mini'],
        source: 'gateway',
      },
    })
  })

  it('skips falsy gateway payload branches and unknown records while keeping valid models', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        models: null,
        result: [
          {},
          '   ',
          { name: 'gemini-2.5-flash' },
          { name: 'models/gemini-2.5-pro' },
        ],
      },
    })

    const result = await fetchProviderModels('google', 'https://generativelanguage.googleapis.com', 'sk-test')

    expect(result).toEqual({
      success: true,
      data: {
        models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        source: 'gateway',
      },
    })
  })

  it('falls back to the local direct endpoint after a gateway exception', async () => {
    callApiMock.mockRejectedValueOnce(new Error('gateway exploded'))
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/llama3:latest' },
          { model: 'llama3:8b' },
          ' llama3:latest ',
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchProviderModels('local', 'http://localhost:11434/', '')

    expect(loggerErrorMock).toHaveBeenCalledWith('Gateway models fallback failed (Error)')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/api/tags', undefined)
    expect(result).toEqual({
      success: true,
      data: {
        models: ['llama3:latest', 'llama3:8b'],
        source: 'direct',
      },
    })
  })

  it('requires direct API keys for google, anthropic, and openrouter fallbacks', async () => {
    callApiMock.mockResolvedValue({ success: false, error: 'gateway unavailable' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchProviderModels('google', 'https://generativelanguage.googleapis.com', '   '),
    ).resolves.toEqual({
      success: false,
      error: 'gateway=gateway unavailable; direct=api_key_required',
    })

    await expect(
      fetchProviderModels('anthropic', 'https://api.anthropic.com', '   '),
    ).resolves.toEqual({
      success: false,
      error: 'gateway=gateway unavailable; direct=api_key_required',
    })

    await expect(
      fetchProviderModels('openrouter', 'https://openrouter.ai/api', '   '),
    ).resolves.toEqual({
      success: false,
      error: 'gateway=gateway unavailable; direct=api_key_required',
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to request_failed when the gateway returns a blank error message', async () => {
    callApiMock.mockResolvedValue({ success: false, error: '   ' })

    const result = await fetchProviderModels(
      'openai',
      'https://api.openai.com',
      '   ',
    )

    expect(result).toEqual({
      success: false,
      error: 'gateway=request_failed; direct=api_key_required',
    })
  })

  it('falls back to request_failed when the gateway omits the error field', async () => {
    callApiMock.mockResolvedValue({ success: false })

    const result = await fetchProviderModels(
      'openai',
      'https://api.openai.com',
      '   ',
    )

    expect(result).toEqual({
      success: false,
      error: 'gateway=request_failed; direct=api_key_required',
    })
  })

  it('uses provider-specific direct endpoints and reports empty direct results', async () => {
    callApiMock
      .mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
      .mockResolvedValueOnce({ success: true, data: { items: [] } })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'claude-3-7-sonnet' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const anthropic = await fetchProviderModels('anthropic', 'https://api.anthropic.com/', 'sk-ant')
    const openrouter = await fetchProviderModels('openrouter', 'https://openrouter.ai/api/', 'sk-router')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.anthropic.com/v1/models',
      {
        headers: {
          'x-api-key': 'sk-ant',
          'anthropic-version': '2023-06-01',
        },
      },
    )
    expect(anthropic).toEqual({
      success: true,
      data: {
        models: ['claude-3-7-sonnet'],
        source: 'direct',
      },
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://openrouter.ai/api/v1/models',
      {
        headers: {
          Authorization: 'Bearer sk-router',
        },
      },
    )
    expect(openrouter).toEqual({
      success: false,
      error: 'gateway=empty_models; direct=empty_models',
    })
  })

  it('uses the google direct endpoint when gateway results are unavailable', async () => {
    callApiMock.mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'models/gemini-1.5-pro' }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchProviderModels(
      'google',
      'https://generativelanguage.googleapis.com/',
      'sk-google',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models',
      {
        headers: {
          'X-Goog-Api-Key': 'sk-google',
        },
      },
    )
    expect(result).toEqual({
      success: true,
      data: {
        models: ['gemini-1.5-pro'],
        source: 'direct',
      },
    })
  })

  it('avoids double /v1 suffixes and combines direct fetch failures with gateway errors', async () => {
    callApiMock
      .mockResolvedValueOnce({ success: false, error: 'gateway offline' })
      .mockResolvedValueOnce({ success: false, error: 'gateway offline' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4.1' }],
        }),
      })
      .mockRejectedValueOnce('offline')
    vi.stubGlobal('fetch', fetchMock)

    const openai = await fetchProviderModels('openai', 'https://api.openai.com/v1/', 'sk-openai')
    const failed = await fetchProviderModels('openai', 'https://api.openai.com', 'sk-openai')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.openai.com/v1/models',
      {
        headers: {
          Authorization: 'Bearer sk-openai',
        },
      },
    )
    expect(openai).toEqual({
      success: true,
      data: {
        models: ['gpt-4.1'],
        source: 'direct',
      },
    })

    expect(loggerErrorMock).toHaveBeenCalledWith('Fetch provider models failed (UnknownError)')
    expect(failed).toEqual({
      success: false,
      error: 'gateway=gateway offline; direct=Request failed. Please try again.',
    })
  })

  it('reports HTTP status failures from direct fetches', async () => {
    callApiMock.mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchProviderModels('local', 'http://localhost:11434', '')

    expect(loggerErrorMock).toHaveBeenCalledWith('Fetch provider models failed (Error)')
    expect(result).toEqual({
      success: false,
      error: 'gateway=gateway unavailable; direct=HTTP error: 503',
    })
  })
})

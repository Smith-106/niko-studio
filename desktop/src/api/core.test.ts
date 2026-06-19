import { beforeEach, describe, expect, it, vi } from 'vitest'

const callTauriApiMock = vi.hoisted(() => vi.fn())
const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => true))
const normalizeGatewayBaseUrlMock = vi.hoisted(() => vi.fn((value: string) => value.replace(/\/+$/, '')))
const readRuntimePreferencesMock = vi.hoisted(() => vi.fn(() => ({ apiBaseUrl: '' })))
const captureExceptionMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('./transport', () => ({
  callTauriApi: callTauriApiMock,
  checkTauriBackendHealth: vi.fn(),
  getRuntimeGatewayBase: vi.fn(),
  isTauriRuntime: isTauriRuntimeMock,
  normalizeGatewayBaseUrl: normalizeGatewayBaseUrlMock,
  startTauriBackend: vi.fn(),
  restartTauriBackend: vi.fn(),
}))

vi.mock('@/runtime/preferences', () => ({
  readRuntimePreferences: readRuntimePreferencesMock,
}))

vi.mock('../sentry', () => ({
  captureException: captureExceptionMock,
}))

vi.mock('../utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import {
  callApi,
  clearApiCache,
  GENERIC_API_ERROR_MESSAGE,
  getErrorName,
  getResolvedApiBase,
} from './core'

const originalFetch = globalThis.fetch

describe('callApi Tauri bridge', () => {
  beforeEach(() => {
    callTauriApiMock.mockReset()
    isTauriRuntimeMock.mockReset()
    isTauriRuntimeMock.mockReturnValue(true)
    normalizeGatewayBaseUrlMock.mockClear()
    readRuntimePreferencesMock.mockReset()
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: '' })
    captureExceptionMock.mockReset()
    loggerErrorMock.mockReset()
    clearApiCache()
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
  })

  it('maps tauri non-2xx response payload into ApiResponse error', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 403,
      body: JSON.stringify({ error: 'UI Bridge is disabled', status: 'disabled' }),
    })

    const response = await callApi('/ui-bridge/workflow/route', 'POST', { task: 'route this' })

    expect(response).toEqual({
      success: false,
      error: 'UI Bridge is disabled',
      errorData: { error: 'UI Bridge is disabled', status: 'disabled' },
    })
  })

  it('returns tauri 2xx response payload as success data', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ plan_id: 'plan-1', step_id: 'step-1' }),
    })

    const response = await callApi<{ plan_id: string; step_id: string }>(
      '/workflow/execute',
      'POST',
      { plan_id: 'plan-1' },
    )

    expect(response).toEqual({
      success: true,
      data: { plan_id: 'plan-1', step_id: 'step-1' },
    })
  })

  it('falls back to trimmed plain-text tauri error messages when the body is not JSON', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 502,
      body: ' gateway unavailable ',
    })

    const response = await callApi('/workflow/execute', 'POST', { plan_id: 'plan-1' })

    expect(response).toEqual({
      success: false,
      error: 'gateway unavailable',
      errorData: ' gateway unavailable ',
    })
  })

  it('falls back to the HTTP status when the tauri error body is empty', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 503,
      body: '   ',
    })

    const response = await callApi('/workflow/execute', 'POST', { plan_id: 'plan-1' })

    expect(response).toEqual({
      success: false,
      error: 'HTTP error: 503',
      errorData: undefined,
    })
  })

  it('reports rejected tauri calls with the generic error and forwards them to Sentry when configured', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://dsn.example.invalid/1')
    callTauriApiMock.mockRejectedValue(new Error('bridge exploded'))

    const response = await callApi('/workflow/execute', 'POST', { plan_id: 'plan-1' })

    expect(response).toEqual({
      success: false,
      error: GENERIC_API_ERROR_MESSAGE,
    })
    expect(loggerErrorMock).toHaveBeenCalledWith('API call failed: /workflow/execute (Error)')
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.any(Error),
      { tags: { api_endpoint: '/workflow/execute', api_method: 'POST' } },
    )
  })

  it('logs UnknownError when a non-Error value is thrown from the tauri bridge', async () => {
    callTauriApiMock.mockRejectedValue('bridge exploded')

    const response = await callApi('/workflow/execute', 'POST', { plan_id: 'plan-1' })

    expect(response).toEqual({
      success: false,
      error: GENERIC_API_ERROR_MESSAGE,
    })
    expect(loggerErrorMock).toHaveBeenCalledWith('API call failed: /workflow/execute (UnknownError)')
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// callApi LRU 缓存（仅对 GET 请求生效）
// ---------------------------------------------------------------------------

describe('callApi LRU cache', () => {
  beforeEach(() => {
    callTauriApiMock.mockReset()
    clearApiCache()
  })

  it('caches GET requests and returns cached response within TTL', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ items: ['a', 'b'] }),
    })

    // 第一次调用 — 应发起 IPC
    const response1 = await callApi('/wiki/list', 'GET')
    expect(response1.success).toBe(true)
    expect(callTauriApiMock).toHaveBeenCalledTimes(1)

    // 第二次调用 — 同一 endpoint + method，应在缓存 TTL 内返回缓存
    const response2 = await callApi('/wiki/list', 'GET')
    expect(response2.success).toBe(true)
    expect(response2.data).toEqual(response1.data)
    expect(callTauriApiMock).toHaveBeenCalledTimes(1) // 仍然只调用一次
  })

  it('does NOT cache POST requests', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ id: 'new-item' }),
    })

    // POST 不应缓存
    await callApi('/memory/add', 'POST', { content: 'test' })
    await callApi('/memory/add', 'POST', { content: 'test' })
    expect(callTauriApiMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT cache PUT requests', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ updated: true }),
    })

    // PUT 不应缓存
    await callApi('/memory/update', 'PUT', { id: '1', content: 'test' })
    await callApi('/memory/update', 'PUT', { id: '1', content: 'test' })
    expect(callTauriApiMock).toHaveBeenCalledTimes(2)
  })

  it('does not cache error responses for GET requests', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    })

    const response1 = await callApi('/wiki/list', 'GET')
    expect(response1.success).toBe(false)

    // 错误响应不应缓存，第二次调用应重新发起 IPC
    const response2 = await callApi('/wiki/list', 'GET')
    expect(response2.success).toBe(false)
    expect(callTauriApiMock).toHaveBeenCalledTimes(2)
  })

  it('different GET endpoints produce different cache keys', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ data: 'test' }),
    })

    await callApi('/wiki/list', 'GET')
    await callApi('/wiki/page', 'GET')

    // 两个不同 endpoint，都应发起 IPC
    expect(callTauriApiMock).toHaveBeenCalledTimes(2)
  })
})

describe('core helpers', () => {
  beforeEach(() => {
    callTauriApiMock.mockReset()
    isTauriRuntimeMock.mockReset()
    isTauriRuntimeMock.mockReturnValue(true)
    normalizeGatewayBaseUrlMock.mockClear()
    readRuntimePreferencesMock.mockReset()
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: '' })
    captureExceptionMock.mockReset()
    loggerErrorMock.mockReset()
    clearApiCache()
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
  })

  it('returns the error name for Error instances and falls back for unknown values', () => {
    expect(getErrorName(new TypeError('boom'))).toBe('TypeError')
    expect(getErrorName('boom')).toBe('UnknownError')
  })

  it('prefers environment API base values over runtime preferences', () => {
    vi.stubEnv('NIKO_GATEWAY_URL', 'http://env-gateway.test:9100/')
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: 'http://prefs-gateway.test:9200/' })

    expect(getResolvedApiBase()).toBe('http://env-gateway.test:9100')
    expect(normalizeGatewayBaseUrlMock).toHaveBeenCalledWith('http://env-gateway.test:9100/')
  })

  it('falls back to runtime preferences and then the default API base', () => {
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: 'http://prefs-gateway.test:9200/' })

    expect(getResolvedApiBase()).toBe('http://prefs-gateway.test:9200')
    expect(normalizeGatewayBaseUrlMock).toHaveBeenCalledWith('http://prefs-gateway.test:9200/')

    normalizeGatewayBaseUrlMock.mockClear()
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: '   ' })

    expect(getResolvedApiBase()).toBe('http://127.0.0.1:8000')
    expect(normalizeGatewayBaseUrlMock).not.toHaveBeenCalled()
  })

  it('uses fetch outside Tauri, omits GET bodies, and reads the resolved API base', async () => {
    isTauriRuntimeMock.mockReturnValue(false)
    readRuntimePreferencesMock.mockReturnValue({ apiBaseUrl: 'http://prefs-gateway.test:9200/' })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'ok' }),
    })
    globalThis.fetch = fetchMock as typeof fetch

    const response = await callApi<{ status: string }>('/health', 'GET', { ignored: true })

    expect(response).toEqual({
      success: true,
      data: { status: 'ok' },
    })
    expect(fetchMock).toHaveBeenCalledWith('http://prefs-gateway.test:9200/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('returns HTTP-status fallback errors for failed fetch responses with no JSON body', async () => {
    isTauriRuntimeMock.mockReturnValue(false)

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    })
    globalThis.fetch = fetchMock as typeof fetch

    const response = await callApi('/teapot', 'POST', { brew: 'tea' })

    expect(response).toEqual({
      success: false,
      error: 'HTTP error: 418',
      errorData: undefined,
    })
  })
})

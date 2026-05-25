import { beforeEach, describe, expect, it, vi } from 'vitest'

const callTauriApiMock = vi.hoisted(() => vi.fn())

vi.mock('./transport', () => ({
  callTauriApi: callTauriApiMock,
  checkTauriBackendHealth: vi.fn(),
  getRuntimeGatewayBase: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
  normalizeGatewayBaseUrl: (value: string) => value.replace(/\/+$/, ''),
  startTauriBackend: vi.fn(),
}))

import { callApi, clearApiCache } from './core'

describe('callApi Tauri bridge', () => {
  beforeEach(() => {
    callTauriApiMock.mockReset()
    clearApiCache()
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
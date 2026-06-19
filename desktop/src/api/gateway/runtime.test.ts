import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const checkTauriBackendHealthMock = vi.hoisted(() => vi.fn())
const getResolvedApiBaseMock = vi.hoisted(() => vi.fn())
const isTauriRuntimeMock = vi.hoisted(() => vi.fn())
const startTauriBackendMock = vi.hoisted(() => vi.fn())
const restartTauriBackendMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
  checkTauriBackendHealth: checkTauriBackendHealthMock,
  getResolvedApiBase: getResolvedApiBaseMock,
  isTauriRuntime: isTauriRuntimeMock,
  startTauriBackend: startTauriBackendMock,
  restartTauriBackend: restartTauriBackendMock,
}))

import {
  checkBackendHealth,
  formatGatewayHealthError,
  getGatewayHealth,
  getGatewayMetrics,
  listGatewayTools,
  mergeGatewayHealthState,
  restartGatewayBackend,
  startBackend,
  toGatewayHealthFromErrorData,
} from './runtime'

describe('gateway runtime api bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:8000')
    isTauriRuntimeMock.mockReturnValue(false)
  })

  it('returns successful health responses unchanged and proxies metrics/tool endpoints', async () => {
    const success = {
      success: true,
      data: {
        status: 'ok',
        version: '11.0.0',
        services: { memory: 'ok' },
      },
    }
    callApiMock
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce({ success: true, data: { status: 'ok', metrics: { requests_total: 1 } } })
      .mockResolvedValueOnce({ success: true, data: { search: ['query'] } })

    await expect(getGatewayHealth()).resolves.toEqual(success)
    await getGatewayMetrics()
    await listGatewayTools()

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/health', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/metrics', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/tools', 'GET')
  })

  it('normalizes structured health error payloads and falls back to direct fetch when needed', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: false,
        error: 'gateway degraded',
        errorData: {
          status: 'degraded',
          diagnostic: {
            failure_class: 'integration_degraded',
            summary: 'top-level summary',
          },
          mcp_runtime: {
            diagnostic: {
              failure_class: 'integration_degraded',
              summary: 'runtime summary',
              detail: 'search timeout',
            },
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'gateway unavailable',
      })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        error: 'gateway offline',
        status: 'error',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'fallback summary',
        },
      }),
    }))

    const normalized = await getGatewayHealth()
    const fallback = await getGatewayHealth()

    expect(normalized).toEqual({
      success: false,
      error: 'gateway degraded',
      errorData: {
        status: 'degraded',
        diagnostic: {
          failure_class: 'integration_degraded',
          summary: 'runtime summary',
          detail: 'search timeout',
        },
        mcp_runtime: {
          diagnostic: {
            failure_class: 'integration_degraded',
            summary: 'runtime summary',
            detail: 'search timeout',
          },
        },
      },
    })
    expect(fallback).toEqual({
      success: false,
      error: 'gateway unavailable',
      errorData: {
        error: 'gateway offline',
        status: 'error',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'fallback summary',
        },
      },
    })
  })

  it('builds a synthetic runtime-unavailable payload when both health probes fail', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'fetch failed',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'))

    const response = await getGatewayHealth()

    expect(response.success).toBe(false)
    expect(response.error).toBe('fetch failed')
    expect(response.errorData).toEqual({
      error: 'Failed to fetch gateway health (gateway: http://127.0.0.1:8000)',
      status: 'error',
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'Failed to fetch gateway health',
        detail: 'Failed to fetch gateway health (gateway: http://127.0.0.1:8000)',
        action: 'Check that the gateway is running at http://127.0.0.1:8000/health',
      },
      mcp_runtime: {
        connection_state: 'disconnected',
        reconnect_state: 'failed',
        reconnect_attempts: 0,
        last_error: 'Failed to fetch gateway health (gateway: http://127.0.0.1:8000)',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'Failed to fetch gateway health',
          detail: 'Failed to fetch gateway health (gateway: http://127.0.0.1:8000)',
          action: 'Check that the gateway is running at http://127.0.0.1:8000/health',
        },
      },
    })
  })

  it('converts error payloads into degraded health state and formats the most useful message', () => {
    const errorData = {
      status: 'degraded',
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'top-level summary',
        detail: 'gateway detail',
      },
      mcp_runtime: {
        connection_state: 'connected',
        reconnect_state: 'idle',
        last_error: 'runtime detail',
        diagnostic: {
          failure_class: 'integration_degraded',
          summary: 'runtime summary',
          detail: 'runtime detail',
        },
      },
    }

    expect(toGatewayHealthFromErrorData(errorData)).toEqual({
      status: 'degraded',
      version: 'unavailable',
      services: {},
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'runtime summary',
        detail: 'runtime detail',
      },
      mcp_runtime: errorData.mcp_runtime,
    })

    expect(formatGatewayHealthError({
      success: false,
      error: 'gateway offline',
      errorData,
    })).toBe('runtime detail')

    expect(mergeGatewayHealthState(true, {
      success: false,
      error: 'gateway offline',
      errorData,
    })).toMatchObject({
      connectionState: 'degraded',
      reconnectState: 'idle',
      lastError: 'runtime detail',
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'runtime summary',
        detail: 'runtime detail',
      },
    })
  })

  it('handles tauri and browser runtime backend checks plus backend start/restart flows', async () => {
    isTauriRuntimeMock.mockReturnValueOnce(false)
    await expect(startBackend()).resolves.toEqual({
      success: false,
      error: 'Not in Tauri environment',
    })

    isTauriRuntimeMock.mockReturnValueOnce(true)
    startTauriBackendMock.mockResolvedValueOnce('started')
    await expect(startBackend()).resolves.toEqual({
      success: true,
      data: 'started',
    })

    isTauriRuntimeMock.mockReturnValueOnce(true)
    startTauriBackendMock.mockRejectedValueOnce(new Error('boom'))
    await expect(startBackend()).resolves.toEqual({
      success: false,
      error: 'Error: boom',
    })

    isTauriRuntimeMock.mockReturnValueOnce(true)
    checkTauriBackendHealthMock.mockResolvedValueOnce(true)
    await expect(checkBackendHealth()).resolves.toBe(true)

    isTauriRuntimeMock.mockReturnValueOnce(true)
    checkTauriBackendHealthMock.mockRejectedValueOnce(new Error('offline'))
    await expect(checkBackendHealth()).resolves.toBe(false)

    isTauriRuntimeMock.mockReturnValueOnce(false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('offline')))
    await expect(checkBackendHealth()).resolves.toBe(true)
    await expect(checkBackendHealth()).resolves.toBe(false)

    isTauriRuntimeMock.mockReturnValueOnce(false)
    await expect(restartGatewayBackend()).resolves.toEqual({
      success: false,
      error: 'Not in Tauri environment',
    })

    isTauriRuntimeMock.mockReturnValueOnce(true)
    restartTauriBackendMock.mockResolvedValueOnce('restarted')
    await expect(restartGatewayBackend()).resolves.toEqual({
      success: true,
      data: 'restarted',
    })

    isTauriRuntimeMock.mockReturnValueOnce(true)
    restartTauriBackendMock.mockRejectedValueOnce(new Error('restart failed'))
    await expect(restartGatewayBackend()).resolves.toEqual({
      success: false,
      error: 'Error: restart failed',
    })
  })
})

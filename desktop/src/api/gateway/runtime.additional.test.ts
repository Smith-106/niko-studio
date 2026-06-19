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

import { checkHealth, formatGatewayHealthError, mergeGatewayHealthState } from './runtime'

describe('gateway runtime additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:8000')
    isTauriRuntimeMock.mockReturnValue(false)
  })

  it('falls back to plain errors or null and preserves successful runtime payloads', () => {
    expect(formatGatewayHealthError({ success: false, error: 'plain gateway error' })).toBe('plain gateway error')
    expect(formatGatewayHealthError(undefined)).toBeNull()

    expect(
      mergeGatewayHealthState(false, {
        success: true,
        data: {
          status: 'ok',
          version: '11.0.0',
          services: { memory: 'ok' },
          mcp_runtime: {
            connection_state: 'connected',
            reconnect_state: 'idle',
            session_id: 'session-42',
            reconnect_attempts: 2,
            last_error: null,
            last_probe_at: '2026-06-07T08:00:00.000Z',
            diagnostic: null,
            servers: { memory: 'ok' },
          },
        },
      }),
    ).toMatchObject({
      connectionState: 'connected',
      reconnectState: 'idle',
      sessionId: 'session-42',
      reconnectAttempts: 2,
      servers: { memory: 'ok' },
    })
  })

  it('keeps fallback error state for non-degraded diagnostics and exposes the checkHealth alias', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(checkHealth()).resolves.toBe(false)

    expect(
      mergeGatewayHealthState(false, {
        success: false,
        error: 'gateway offline',
        errorData: {
          status: 'error',
          diagnostic: {
            failure_class: 'runtime_unavailable',
            summary: 'gateway offline',
          },
        },
      }),
    ).toMatchObject({
      connectionState: 'disconnected',
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'gateway offline',
      },
      lastError: 'gateway offline',
    })
  })

  it('uses the thrown Error message when building the synthetic health failure payload', async () => {
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'fetch failed',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('gateway exploded')))

    const mod = await import('./runtime')
    const response = await mod.getGatewayHealth()

    expect(response).toEqual({
      success: false,
      error: 'fetch failed',
      errorData: {
        error: 'gateway exploded (gateway: http://127.0.0.1:8000)',
        status: 'error',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'gateway exploded',
          detail: 'gateway exploded (gateway: http://127.0.0.1:8000)',
          action: 'Check that the gateway is running at http://127.0.0.1:8000/health',
        },
        mcp_runtime: {
          connection_state: 'disconnected',
          reconnect_state: 'failed',
          reconnect_attempts: 0,
          last_error: 'gateway exploded (gateway: http://127.0.0.1:8000)',
          diagnostic: {
            failure_class: 'runtime_unavailable',
            summary: 'gateway exploded',
            detail: 'gateway exploded (gateway: http://127.0.0.1:8000)',
            action: 'Check that the gateway is running at http://127.0.0.1:8000/health',
          },
        },
      },
    })
  })
})

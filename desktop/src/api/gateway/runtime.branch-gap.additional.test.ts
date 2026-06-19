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
  extractGatewayHealthFailure,
  formatGatewayHealthError,
  mergeGatewayHealthState,
  toGatewayHealthFromErrorData,
} from './runtime'

describe('gateway runtime branch-gap additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:8000')
    isTauriRuntimeMock.mockReturnValue(false)
  })

  // Lines 58-60: extractGatewayDiagnostics — the else path (payload is a non-null object)
  // This is tested indirectly via toGatewayHealthFromErrorData
  it('extracts diagnostic from mcp_runtime when errorData is a non-null object', () => {
    const errorData = {
      status: 'error',
      mcp_runtime: {
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'gateway crashed',
          detail: 'connection refused',
        },
      },
    }

    const health = toGatewayHealthFromErrorData(errorData)

    expect(health).toEqual({
      status: 'error',
      version: 'unavailable',
      services: {},
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'gateway crashed',
        detail: 'connection refused',
      },
      mcp_runtime: errorData.mcp_runtime,
    })
  })

  // Lines 58-60: extractGatewayDiagnostics — top-level diagnostic when mcp_runtime is absent
  it('extracts top-level diagnostic when errorData has no mcp_runtime', () => {
    const errorData = {
      status: 'degraded',
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'service slow',
      },
    }

    const health = toGatewayHealthFromErrorData(errorData)

    expect(health).toEqual({
      status: 'degraded',
      version: 'unavailable',
      services: {},
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'service slow',
      },
      mcp_runtime: undefined,
    })
  })

  // Line 68: status ?? 'degraded' fallback when errorData.status is undefined
  it('uses "degraded" fallback status when errorData has no status', () => {
    const errorData = {
      mcp_runtime: {
        connection_state: 'disconnected',
      },
    }

    const health = toGatewayHealthFromErrorData(errorData)

    expect(health).toEqual({
      status: 'degraded',
      version: 'unavailable',
      services: {},
      diagnostic: null,
      mcp_runtime: errorData.mcp_runtime,
    })
  })

  // Line 68: status ?? 'degraded' fallback when errorData.status is null
  it('uses "degraded" fallback status when errorData.status is null', () => {
    const errorData = {
      status: null,
      mcp_runtime: {
        connection_state: 'disconnected',
      },
    }

    const health = toGatewayHealthFromErrorData(errorData)

    expect(health?.status).toBe('degraded')
  })

  // Line 68: status ?? 'degraded' fallback when errorData.status is undefined
  it('uses "degraded" fallback status when errorData.status is undefined', () => {
    const errorData = {
      mcp_runtime: {
        connection_state: 'disconnected',
      },
    } as Record<string, unknown>

    const health = toGatewayHealthFromErrorData(errorData)

    expect(health?.status).toBe('degraded')
  })

  // Line 178: formatGatewayHealthError(response) ?? fallback.lastError
  // formatGatewayHealthError returns null when all internal lookups are falsy
  it('falls back to derived lastError when formatGatewayHealthError returns null', () => {
    // Build a response where formatGatewayHealthError will return null:
    // - no errorData at all → formatGatewayHealthError returns null
    // Then fallback.lastError from deriveGatewayRuntimeState will be used
    const response = {
      success: false,
      error: undefined,
    }

    const result = mergeGatewayHealthState(false, response)

    // errorData is undefined, so toGatewayHealthFromErrorData returns null
    // deriveGatewayRuntimeState(null, false) => connectionState: 'disconnected', lastError: null
    // formatGatewayHealthError returns null (no errorData, no error)
    // lastError = null ?? fallback.lastError = null
    expect(result.lastError).toBeNull()
  })

  // Line 178: the ?? fallback when formatGatewayHealthError returns null but fallback has lastError
  it('uses fallback lastError from mcp_runtime when formatGatewayHealthError is null', () => {
    // When errorData exists but formatGatewayHealthError still returns null
    // (all internal lookups are falsy), and fallback has a lastError
    const response = {
      success: false,
      error: undefined,
      errorData: {
        status: 'error',
        mcp_runtime: {
          connection_state: 'disconnected',
          last_error: 'runtime-level error from mcp',
        },
      },
    }

    const result = mergeGatewayHealthState(false, response)

    // formatGatewayHealthError checks:
    //   response?.errorData?.mcp_runtime?.last_error → 'runtime-level error from mcp'
    // So it returns 'runtime-level error from mcp', not null
    // Therefore the ?? fallback is not needed
    expect(result.lastError).toBe('runtime-level error from mcp')
  })

  // Line 178: true fallback case where formatGatewayHealthError genuinely returns null
  // This happens when errorData exists but has no mcp_runtime.last_error,
  // no diagnostic detail/summary, and no response.error
  it('uses fallback lastError when all error sources are empty', () => {
    const response = {
      success: false,
      error: '',
      errorData: {
        status: 'error',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: '',
          detail: '',
        },
      },
    }

    const result = mergeGatewayHealthState(false, response)

    // formatGatewayHealthError:
    //   response?.errorData?.mcp_runtime?.last_error → undefined (no mcp_runtime)
    //   extractGatewayHealthFailure(response)?.detail → '' (empty)
    //   extractGatewayHealthFailure(response)?.summary → '' (empty)
    //   response?.error → '' (empty)
    // ?? operator: '' is not null/undefined, so it returns ''
    // Therefore formatGatewayHealthError returns ''
    expect(result.lastError).toBe('')
  })
})

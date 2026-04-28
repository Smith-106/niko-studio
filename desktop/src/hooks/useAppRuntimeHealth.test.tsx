import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { GatewayRuntimeView } from '../api/client'

const mockCheckBackend = vi.fn().mockResolvedValue(undefined)
const mockGetGatewayHealth = vi.fn()
const mockMergeGatewayHealthState = vi.fn()

vi.mock('../api/client', () => ({
  getGatewayHealth: (...args: unknown[]) => mockGetGatewayHealth(...args),
  mergeGatewayHealthState: (...args: unknown[]) => mockMergeGatewayHealthState(...args),
}))

import { useAppRuntimeHealth } from './useAppRuntimeHealth'

const fakeRuntimeView: GatewayRuntimeView = {
  connectionState: 'connected',
  reconnectState: 'idle',
  sessionId: 'test-session-001',
  reconnectAttempts: 0,
  lastError: null,
  lastProbeAt: null,
  diagnostic: null,
  servers: {},
}

describe('useAppRuntimeHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckBackend.mockResolvedValue(undefined)
    mockMergeGatewayHealthState.mockReturnValue(fakeRuntimeView)
    mockGetGatewayHealth.mockResolvedValue({
      success: true,
      data: { status: 'ok' },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls checkBackend on mount', () => {
    renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: true,
        checkBackend: mockCheckBackend,
      }),
    )

    expect(mockCheckBackend).toHaveBeenCalledTimes(1)
  })

  it('returns null initially before health check resolves', () => {
    mockGetGatewayHealth.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: true,
        checkBackend: mockCheckBackend,
      }),
    )

    expect(result.current).toBeNull()
  })

  it('calls getGatewayHealth and sets runtimeView from merged successful response', async () => {
    const { result } = renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: true,
        checkBackend: mockCheckBackend,
      }),
    )

    await waitFor(() => {
      expect(result.current).toBe(fakeRuntimeView)
    })

    expect(mockGetGatewayHealth).toHaveBeenCalledTimes(1)
    expect(mockMergeGatewayHealthState).toHaveBeenCalledWith(
      true,
      { success: true, data: { status: 'ok' } },
    )
  })

  it('sets runtimeView via mergeGatewayHealthState(null-response) when getGatewayHealth fails', async () => {
    mockGetGatewayHealth.mockRejectedValue(new Error('network error'))
    const degradedView: GatewayRuntimeView = {
      ...fakeRuntimeView,
      connectionState: 'disconnected',
    }
    mockMergeGatewayHealthState.mockReturnValue(degradedView)

    const { result } = renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: false,
        checkBackend: mockCheckBackend,
      }),
    )

    await waitFor(() => {
      expect(result.current).toBe(degradedView)
    })

    expect(mockMergeGatewayHealthState).toHaveBeenCalledWith(false, null)
  })

  it('preserves structured unsuccessful health responses through mergeGatewayHealthState', async () => {
    mockGetGatewayHealth.mockResolvedValue({
      success: false,
      error: 'gateway offline',
      errorData: {
        status: 'error',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'Gateway offline',
        },
      },
    })

    const degradedView: GatewayRuntimeView = {
      ...fakeRuntimeView,
      connectionState: 'disconnected',
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'Gateway offline',
      },
    }
    mockMergeGatewayHealthState.mockReturnValue(degradedView)

    const { result } = renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: true,
        checkBackend: mockCheckBackend,
      }),
    )

    await waitFor(() => {
      expect(result.current).toBe(degradedView)
    })

    expect(mockMergeGatewayHealthState).toHaveBeenCalledWith(
      true,
      {
        success: false,
        error: 'gateway offline',
        errorData: {
          status: 'error',
          diagnostic: {
            failure_class: 'runtime_unavailable',
            summary: 'Gateway offline',
          },
        },
      },
    )
  })

  it('cleans up interval and visibilitychange listener on unmount', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useAppRuntimeHealth({
        backendStatus: true,
        checkBackend: mockCheckBackend,
      }),
    )

    expect(addSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    unmount()

    expect(removeSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

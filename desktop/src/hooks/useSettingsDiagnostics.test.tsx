import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSettingsDiagnostics } from './useSettingsDiagnostics'

const getGatewayMetricsMock = vi.hoisted(() => vi.fn())
const listGatewayToolsMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  getGatewayMetrics: getGatewayMetricsMock,
  listGatewayTools: listGatewayToolsMock,
  GatewayMetrics: {},
  GatewayTools: {},
}))

describe('useSettingsDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with null metrics and tools', () => {
    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    expect(result.current.gatewayMetrics).toBeNull()
    expect(result.current.gatewayTools).toBeNull()
    expect(result.current.diagnosticsError).toBeNull()
    expect(result.current.diagnosticsLoading).toBe(false)
  })

  it('fetches metrics and tools on refreshDiagnostics', async () => {
    getGatewayMetricsMock.mockResolvedValue({
      success: true,
      data: {
        metrics: {
          requests_total: 100,
          requests_failed_total: 2,
          requests_success_total: 98,
          latency_ms_avg: 45,
          latency_ms_max: 200,
        },
      },
    })
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: {
        tools: ['writer', 'critic'],
        skills_count: 8,
      },
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(getGatewayMetricsMock).toHaveBeenCalledOnce()
    expect(listGatewayToolsMock).toHaveBeenCalledOnce()
    expect(result.current.gatewayMetrics?.requests_total).toBe(100)
    expect(result.current.gatewayTools?.tools).toEqual(['writer', 'critic'])
    expect(result.current.diagnosticsError).toBeNull()
  })

  it('sets loading state during fetch', async () => {
    let resolveMetrics!: () => void
    getGatewayMetricsMock.mockImplementation(() => new Promise<void>((resolve) => { resolveMetrics = resolve }))
    listGatewayToolsMock.mockResolvedValue({ success: true, data: { tools: [] } })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    act(() => {
      result.current.refreshDiagnostics()
    })

    expect(result.current.diagnosticsLoading).toBe(true)

    await act(async () => {
      resolveMetrics()
      await vi.waitFor(() => !result.current.diagnosticsLoading)
    })
  })

  it('sets error when metrics fetch fails', async () => {
    getGatewayMetricsMock.mockResolvedValue({
      success: false,
      error: 'metrics endpoint unavailable',
    })
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: { tools: ['writer'] },
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(result.current.diagnosticsError).toBe('Fetch failed')
    expect(result.current.gatewayMetrics).toBeNull()
    expect(result.current.gatewayTools).toBeDefined()
  })

  it('sets error when tools fetch fails', async () => {
    getGatewayMetricsMock.mockResolvedValue({
      success: true,
      data: { metrics: { requests_total: 10, requests_failed_total: 0, requests_success_total: 10, latency_ms_avg: 10, latency_ms_max: 50 } },
    })
    listGatewayToolsMock.mockResolvedValue({
      success: false,
      error: 'tools endpoint error',
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(result.current.diagnosticsError).toBe('Fetch failed')
    expect(result.current.gatewayMetrics).toBeDefined()
    expect(result.current.gatewayTools).toBeNull()
  })

  it('sets error when both fetches fail', async () => {
    getGatewayMetricsMock.mockResolvedValue({
      success: false,
      error: 'down',
    })
    listGatewayToolsMock.mockResolvedValue({
      success: false,
      error: 'down',
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(result.current.diagnosticsError).toBe('Fetch failed')
    expect(result.current.gatewayMetrics).toBeNull()
    expect(result.current.gatewayTools).toBeNull()
  })

  it('handles metrics response without metrics field', async () => {
    getGatewayMetricsMock.mockResolvedValue({
      success: true,
      data: { status: 'ok' },
    })
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: { tools: [] },
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(result.current.gatewayMetrics).toBeNull()
    expect(result.current.diagnosticsError).toBe('Fetch failed')
  })

  it('handles exceptions from API calls', async () => {
    getGatewayMetricsMock.mockRejectedValue(new Error('network error'))
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: { tools: [] },
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })

    expect(result.current.diagnosticsError).toBe('Fetch failed')
    expect(result.current.gatewayMetrics).toBeNull()
  })

  it('resets error on successful refresh after failure', async () => {
    getGatewayMetricsMock
      .mockResolvedValueOnce({ success: false, error: 'fail' })
      .mockResolvedValueOnce({
        success: true,
        data: { metrics: { requests_total: 1, requests_failed_total: 0, requests_success_total: 1, latency_ms_avg: 10, latency_ms_max: 20 } },
      })
    listGatewayToolsMock.mockResolvedValue({
      success: true,
      data: { tools: [] },
    })

    const { result } = renderHook(() =>
      useSettingsDiagnostics({ settingsDiagnosticsFetchFailed: 'Fetch failed' }),
    )

    await act(async () => {
      await result.current.refreshDiagnostics()
    })
    expect(result.current.diagnosticsError).toBe('Fetch failed')

    await act(async () => {
      await result.current.refreshDiagnostics()
    })
    expect(result.current.diagnosticsError).toBeNull()
    expect(result.current.gatewayMetrics?.requests_total).toBe(1)
  })
})

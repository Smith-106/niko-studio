import { describe, expect, it } from 'vitest'

import { useAppHeaderViewModel } from './useAppHeaderViewModel'

const texts = {
  serviceRunning: 'Running',
  serviceDegraded: 'Degraded',
  serviceReconnecting: 'Reconnecting',
  serviceOffline: 'Offline',
}

describe('useAppHeaderViewModel', () => {
  it('maps runtime connection state and formats visible context usage', () => {
    const result = useAppHeaderViewModel({
      runtimeView: {
        connectionState: 'degraded',
      } as never,
      backendStatus: true,
      t: texts,
      contextUsage: {
        usedK: 4.25,
        totalK: 16,
        percent: 132,
      },
    })

    expect(result).toEqual({
      headerConnectionState: 'degraded',
      headerDotClass: 'bg-amber-500',
      headerConnectionText: 'Degraded',
      contextUsageVisible: true,
      contextUsageText: '4.3k/16k',
      contextUsageWidthPercent: 100,
    })
  })

  it('falls back to backend status when no runtime view is available and hides empty usage', () => {
    const result = useAppHeaderViewModel({
      runtimeView: null,
      backendStatus: false,
      t: texts,
      contextUsage: {
        usedK: 0,
        totalK: 32,
        percent: 0,
      },
    })

    expect(result).toEqual({
      headerConnectionState: 'disconnected',
      headerDotClass: 'bg-red-500',
      headerConnectionText: 'Offline',
      contextUsageVisible: false,
      contextUsageText: '0.0k/32k',
      contextUsageWidthPercent: 0,
    })
  })

  it('uses running status when backend is healthy and runtime view is unavailable', () => {
    const result = useAppHeaderViewModel({
      runtimeView: null,
      backendStatus: true,
      t: texts,
      contextUsage: {
        usedK: 0,
        totalK: 32,
        percent: 0,
      },
    })

    expect(result.headerConnectionState).toBe('connected')
    expect(result.headerDotClass).toBe('bg-green-500')
    expect(result.headerConnectionText).toBe('Running')
  })

  it('uses safe fallbacks for unknown runtime states and clamps negative percentages', () => {
    const result = useAppHeaderViewModel({
      runtimeView: {
        connectionState: 'mystery',
      } as never,
      backendStatus: true,
      t: texts,
      contextUsage: {
        usedK: 1,
        totalK: 8,
        percent: -25,
      },
    })

    expect(result.headerConnectionState).toBe('mystery')
    expect(result.headerDotClass).toBe('bg-red-500')
    expect(result.headerConnectionText).toBe('Running')
    expect(result.contextUsageVisible).toBe(true)
    expect(result.contextUsageWidthPercent).toBe(0)
  })

  it('uses offline label fallback for unknown runtime states when backend is unhealthy', () => {
    const result = useAppHeaderViewModel({
      runtimeView: {
        connectionState: 'mystery',
      } as never,
      backendStatus: false,
      t: texts,
      contextUsage: {
        usedK: 0,
        totalK: 8,
        percent: 1,
      },
    })

    expect(result.headerDotClass).toBe('bg-red-500')
    expect(result.headerConnectionText).toBe('Offline')
    expect(result.contextUsageVisible).toBe(true)
  })
})

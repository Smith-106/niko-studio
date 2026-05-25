import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useVisualizationState, ALL_EVENT_TYPES } from '../useVisualizationState'

describe('useVisualizationState', () => {
  it('has correct initial state', () => {
    const { result } = renderHook(() => useVisualizationState())

    expect(result.current.activeView).toBe('timeline')
    expect(result.current.selectedChapterId).toBeNull()
    expect(result.current.zoomScale).toBe(1.0)
    expect(result.current.zoomOffset).toEqual({ x: 0, y: 0 })
    expect(result.current.eventFilters).toEqual([...ALL_EVENT_TYPES])
  })

  it('changes active view via setActiveView', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setActiveView('tension')
    })

    expect(result.current.activeView).toBe('tension')
  })

  it('changes active view to characterGraph', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setActiveView('characterGraph')
    })

    expect(result.current.activeView).toBe('characterGraph')
  })

  it('changes selected chapter via setSelectedChapterId', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setSelectedChapterId('ch-1')
    })

    expect(result.current.selectedChapterId).toBe('ch-1')
  })

  it('can clear selected chapter by setting to null', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setSelectedChapterId('ch-1')
    })
    expect(result.current.selectedChapterId).toBe('ch-1')

    act(() => {
      result.current.setSelectedChapterId(null)
    })
    expect(result.current.selectedChapterId).toBeNull()
  })

  it('changes zoom scale via setZoomScale', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setZoomScale(2.5)
    })

    expect(result.current.zoomScale).toBe(2.5)
  })

  it('changes zoom offset via setZoomOffset', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setZoomOffset({ x: 10, y: 20 })
    })

    expect(result.current.zoomOffset).toEqual({ x: 10, y: 20 })
  })

  it('changes event filters via setEventFilters', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setEventFilters(['conflict'])
    })

    expect(result.current.eventFilters).toEqual(['conflict'])
  })

  it('resets zoom scale and offset via resetZoom', () => {
    const { result } = renderHook(() => useVisualizationState())

    act(() => {
      result.current.setZoomScale(3.0)
      result.current.setZoomOffset({ x: 50, y: 100 })
    })

    expect(result.current.zoomScale).toBe(3.0)
    expect(result.current.zoomOffset).toEqual({ x: 50, y: 100 })

    act(() => {
      result.current.resetZoom()
    })

    expect(result.current.zoomScale).toBe(1.0)
    expect(result.current.zoomOffset).toEqual({ x: 0, y: 0 })
  })

  it('provides available views with correct labels', () => {
    const { result } = renderHook(() => useVisualizationState())

    expect(result.current.availableViews).toEqual([
      { id: 'timeline', label: 'Timeline' },
      { id: 'tension', label: 'Tension' },
      { id: 'characterGraph', label: 'Character Graph' },
    ])
  })

  it('ALL_EVENT_TYPES contains all expected event types', () => {
    expect(ALL_EVENT_TYPES).toEqual(['turning_point', 'conflict', 'warning'])
  })
})

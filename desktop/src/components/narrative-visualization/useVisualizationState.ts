import { useMemo, useState } from 'react'

export type NarrativeVisualizationViewMode = 'timeline' | 'tension' | 'characterGraph'

export const ALL_EVENT_TYPES = ['turning_point', 'conflict', 'warning'] as const
export type NarrativeVisualizationEventType = (typeof ALL_EVENT_TYPES)[number]

export function useVisualizationState() {
  const [activeView, setActiveView] = useState<NarrativeVisualizationViewMode>('timeline')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1.0)
  const [zoomOffset, setZoomOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [eventFilters, setEventFilters] = useState<string[]>([...ALL_EVENT_TYPES])

  const availableViews = useMemo<Array<{ id: NarrativeVisualizationViewMode; label: string }>>(
    () => [
      { id: 'timeline', label: 'Timeline' },
      { id: 'tension', label: 'Tension' },
      { id: 'characterGraph', label: 'Character Graph' },
    ],
    [],
  )

  const resetZoom = () => {
    setZoomScale(1.0)
    setZoomOffset({ x: 0, y: 0 })
  }

  return {
    activeView,
    setActiveView,
    selectedChapterId,
    setSelectedChapterId,
    availableViews,
    zoomScale,
    setZoomScale,
    zoomOffset,
    setZoomOffset,
    eventFilters,
    setEventFilters,
    resetZoom,
  }
}

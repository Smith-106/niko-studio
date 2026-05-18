import { useMemo, useState } from 'react'

export type NarrativeVisualizationViewMode = 'timeline' | 'tension' | 'characterGraph'

export function useVisualizationState() {
  const [activeView, setActiveView] = useState<NarrativeVisualizationViewMode>('timeline')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)

  const availableViews = useMemo<Array<{ id: NarrativeVisualizationViewMode; label: string }>>(
    () => [
      { id: 'timeline', label: 'Timeline' },
      { id: 'tension', label: 'Tension' },
      { id: 'characterGraph', label: 'Character Graph' },
    ],
    [],
  )

  return {
    activeView,
    setActiveView,
    selectedChapterId,
    setSelectedChapterId,
    availableViews,
  }
}

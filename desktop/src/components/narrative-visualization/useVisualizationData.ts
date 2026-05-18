import { useMemo } from 'react'

import type {
  NarrativeVisualizationBundle,
} from '../../api/narrative-visualization'

export function createEmptyVisualizationBundle(): NarrativeVisualizationBundle {
  return {
    timeline: {
      chapters: [],
      events: [],
      summary: 'No timeline data available.',
      empty: true,
    },
    tension: {
      points: [],
      deserts: [],
      overallArcScore: 0,
      summary: 'No tension data available.',
      empty: true,
    },
    characterGraph: {
      nodes: [],
      edges: [],
      summary: 'No character graph data available.',
      empty: true,
    },
    meta: {
      chapterCount: 0,
      generatedAt: new Date(0).toISOString(),
      hasData: false,
      source: 'existing-analysis',
    },
  }
}

export function useVisualizationData(
  bundle?: NarrativeVisualizationBundle | null,
) {
  return useMemo(() => bundle ?? createEmptyVisualizationBundle(), [bundle])
}

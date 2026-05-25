import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { NarrativeVisualizationBundle } from '../../../api/narrative-visualization'
import { createEmptyVisualizationBundle, useVisualizationData } from '../useVisualizationData'

const sampleBundle: NarrativeVisualizationBundle = {
  timeline: {
    chapters: [
      {
        chapterId: 'ch-1',
        chapterIndex: 0,
        chapterNumber: 1,
        title: 'Opening',
        label: 'Ch 1',
        arcPosition: 0,
        tension: 0.7,
        eventCount: 1,
      },
    ],
    events: [
      {
        id: 'evt-1',
        label: 'conflict',
        chapterIndex: 0,
        chapterNumber: 1,
        type: 'conflict',
        severity: 'major',
        description: 'Major conflict',
      },
    ],
    summary: 'Timeline summary',
    empty: false,
  },
  tension: {
    points: [
      {
        chapterId: 'ch-1',
        chapterIndex: 0,
        chapterNumber: 1,
        title: 'Opening',
        tension: 0.8,
        engagement: 0.7,
        dominantEmotion: 'fear',
        label: 'Ch 1',
        readerState: {
          engagement: 0.65,
          immersion: 0.5,
          suspenseTension: 0.7,
          cognitiveLoad: 0.3,
          curiosity: 0.6,
        },
      },
    ],
    deserts: [],
    overallArcScore: 78,
    summary: 'Tension summary',
    empty: false,
    highRiskChapters: ['ch-1'],
  },
  characterGraph: {
    nodes: [
      { id: 'Alice', name: 'Alice', role: 'protagonist', importance: 3, chapterCount: 2 },
    ],
    edges: [
      { source: 'Alice', target: 'Bob', type: 'ally', weight: 0.8, label: 'Alice -> Bob' },
    ],
    summary: 'Character summary',
    empty: false,
  },
  meta: {
    chapterCount: 1,
    generatedAt: new Date().toISOString(),
    hasData: true,
    source: 'existing-analysis',
  },
}

describe('useVisualizationData', () => {
  it('returns empty bundle when bundle is null', () => {
    const { result } = renderHook(() => useVisualizationData(null))

    expect(result.current.timeline.empty).toBe(true)
    expect(result.current.tension.empty).toBe(true)
    expect(result.current.characterGraph.empty).toBe(true)
    expect(result.current.meta.hasData).toBe(false)
  })

  it('returns empty bundle when bundle is undefined', () => {
    const { result } = renderHook(() => useVisualizationData(undefined))

    expect(result.current.timeline.empty).toBe(true)
    expect(result.current.tension.empty).toBe(true)
    expect(result.current.characterGraph.empty).toBe(true)
  })

  it('returns provided bundle when valid', () => {
    const { result } = renderHook(() => useVisualizationData(sampleBundle))

    expect(result.current).toBe(sampleBundle)
  })

  it('returns timeline data from bundle', () => {
    const { result } = renderHook(() => useVisualizationData(sampleBundle))

    expect(result.current.timeline.chapters.length).toBe(1)
    expect(result.current.timeline.chapters[0].chapterId).toBe('ch-1')
    expect(result.current.timeline.events.length).toBe(1)
    expect(result.current.timeline.empty).toBe(false)
  })

  it('returns tension data from bundle with highRiskChapters', () => {
    const { result } = renderHook(() => useVisualizationData(sampleBundle))

    expect(result.current.tension.points.length).toBe(1)
    expect(result.current.tension.highRiskChapters).toEqual(['ch-1'])
    expect(result.current.tension.overallArcScore).toBe(78)
    expect(result.current.tension.empty).toBe(false)
  })

  it('returns character graph data from bundle', () => {
    const { result } = renderHook(() => useVisualizationData(sampleBundle))

    expect(result.current.characterGraph.nodes.length).toBe(1)
    expect(result.current.characterGraph.edges.length).toBe(1)
    expect(result.current.characterGraph.empty).toBe(false)
  })

  it('returns meta data from bundle', () => {
    const { result } = renderHook(() => useVisualizationData(sampleBundle))

    expect(result.current.meta.chapterCount).toBe(1)
    expect(result.current.meta.hasData).toBe(true)
    expect(result.current.meta.source).toBe('existing-analysis')
  })
})

describe('createEmptyVisualizationBundle', () => {
  it('creates bundle with all sections marked empty', () => {
    const empty = createEmptyVisualizationBundle()

    expect(empty.timeline.empty).toBe(true)
    expect(empty.tension.empty).toBe(true)
    expect(empty.characterGraph.empty).toBe(true)
    expect(empty.meta.hasData).toBe(false)
  })

  it('creates bundle with empty arrays', () => {
    const empty = createEmptyVisualizationBundle()

    expect(empty.timeline.chapters).toEqual([])
    expect(empty.timeline.events).toEqual([])
    expect(empty.tension.points).toEqual([])
    expect(empty.tension.deserts).toEqual([])
    expect(empty.tension.highRiskChapters).toEqual([])
    expect(empty.characterGraph.nodes).toEqual([])
    expect(empty.characterGraph.edges).toEqual([])
  })

  it('creates bundle with zero arc score', () => {
    const empty = createEmptyVisualizationBundle()

    expect(empty.tension.overallArcScore).toBe(0)
  })

  it('creates bundle with default summary messages', () => {
    const empty = createEmptyVisualizationBundle()

    expect(empty.timeline.summary).toBe('No timeline data available.')
    expect(empty.tension.summary).toBe('No tension data available.')
    expect(empty.characterGraph.summary).toBe('No character graph data available.')
  })
})

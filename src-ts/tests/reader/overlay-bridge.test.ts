import { afterEach, describe, expect, it } from 'vitest'

import {
  resetOverlayBridge,
  transformToOverlay,
  type ConsensusItem,
} from '../../reader/OverlayBridge'

afterEach(() => {
  resetOverlayBridge()
})

describe('reader/OverlayBridge', () => {
  it('transforms consensus items into overlay markers with copied fields and stable ids', () => {
    const items: ConsensusItem[] = [
      {
        dimension: 'Pacing',
        severity: 'high',
        description: 'Opening drifts before the core conflict arrives.',
        position: { chapterId: 'ch-01', paragraphIndex: 2 },
        consensusStrength: 0.8,
        personaIds: ['reader-a', 'reader-b'],
        score: 0.6,
      },
      {
        dimension: 'Clarity',
        severity: 'medium',
        description: 'Pronoun chain obscures the speaker.',
        position: { chapterId: 'ch-01', paragraphIndex: 5 },
        consensusStrength: 0.25,
        personaIds: ['reader-c'],
        score: 0.4,
      },
    ]

    const result = transformToOverlay(items)

    expect(result.markers).toEqual([
      {
        id: 'overlay-1',
        type: 'consensus',
        dimension: 'Pacing',
        severity: 'high',
        description: 'Opening drifts before the core conflict arrives.',
        position: { chapterId: 'ch-01', paragraphIndex: 2 },
        personaCount: 2,
        consensusStrength: 0.8,
        personaIds: ['reader-a', 'reader-b'],
      },
      {
        id: 'overlay-2',
        type: 'dissent',
        dimension: 'Clarity',
        severity: 'medium',
        description: 'Pronoun chain obscures the speaker.',
        position: { chapterId: 'ch-01', paragraphIndex: 5 },
        personaCount: 1,
        consensusStrength: 0.25,
        personaIds: ['reader-c'],
      },
    ])

    items[0].position.chapterId = 'mutated'
    items[0].personaIds.push('reader-z')
    expect(result.markers[0]?.position.chapterId).toBe('ch-01')
    expect(result.markers[0]?.personaIds).toEqual(['reader-a', 'reader-b'])
  })

  it('aggregates dimension scores, counts, and worst severity across duplicate dimensions', () => {
    const result = transformToOverlay([
      {
        dimension: 'Pacing',
        severity: 'low',
        description: 'Minor delay in setup.',
        position: { paragraphIndex: 1 },
        consensusStrength: 0.55,
        personaIds: ['a'],
        score: 0.9,
      },
      {
        dimension: 'Pacing',
        severity: 'critical',
        description: 'Conflict vanishes for too long.',
        position: { paragraphIndex: 8 },
        consensusStrength: 0.15,
        personaIds: ['b', 'c'],
        score: 0.3,
      },
      {
        dimension: 'Tone',
        severity: 'medium',
        description: 'Voice slips into exposition.',
        position: { chapterId: 'ch-02' },
        consensusStrength: 0.5,
        personaIds: [],
        score: 0.75,
      },
    ])

    expect(result.dimensionOverlay).toEqual({
      Pacing: {
        avgScore: 0.6,
        markerCount: 2,
        worstSeverity: 'critical',
      },
      Tone: {
        avgScore: 0.75,
        markerCount: 1,
        worstSeverity: 'medium',
      },
    })
  })

  it('returns empty overlay output for empty input and reset restarts marker ids', () => {
    expect(transformToOverlay([])).toEqual({
      markers: [],
      dimensionOverlay: {},
    })

    const first = transformToOverlay([
      {
        dimension: 'Tension',
        severity: 'high',
        description: 'A test marker.',
        position: {},
        consensusStrength: 1,
        personaIds: ['r1'],
        score: 1,
      },
    ])
    expect(first.markers[0]?.id).toBe('overlay-1')

    const second = transformToOverlay([
      {
        dimension: 'Tension',
        severity: 'high',
        description: 'Another marker.',
        position: {},
        consensusStrength: 1,
        personaIds: ['r2'],
        score: 1,
      },
    ])
    expect(second.markers[0]?.id).toBe('overlay-2')

    resetOverlayBridge()

    const reset = transformToOverlay([
      {
        dimension: 'Tension',
        severity: 'high',
        description: 'Reset marker.',
        position: {},
        consensusStrength: 1,
        personaIds: ['r3'],
        score: 1,
      },
    ])
    expect(reset.markers[0]?.id).toBe('overlay-1')
  })
})

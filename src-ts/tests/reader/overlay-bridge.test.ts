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
        location: { chapter: 'ch-01', paragraph: 2 },
        consensusStrength: 0.8,
        agreeingPersonas: ['reader-a', 'reader-b'],
        disagreeingPersonas: [],
      },
      {
        dimension: 'Clarity',
        severity: 'medium',
        description: 'Pronoun chain obscures the speaker.',
        location: { chapter: 'ch-01', paragraph: 5 },
        consensusStrength: 0.25,
        agreeingPersonas: ['reader-c'],
        disagreeingPersonas: [],
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

    items[0].location.chapter = 'mutated'
    items[0].agreeingPersonas.push('reader-z')
    expect(result.markers[0]?.position.chapterId).toBe('ch-01')
    expect(result.markers[0]?.personaIds).toEqual(['reader-a', 'reader-b'])
  })

  it('aggregates dimension scores, counts, and worst severity across duplicate dimensions', () => {
    const result = transformToOverlay([
      {
        dimension: 'Pacing',
        severity: 'low',
        description: 'Minor delay in setup.',
        location: { paragraph: 1 },
        consensusStrength: 0.55,
        agreeingPersonas: ['a'],
        disagreeingPersonas: [],
      },
      {
        dimension: 'Pacing',
        severity: 'critical',
        description: 'Conflict vanishes for too long.',
        location: { paragraph: 8 },
        consensusStrength: 0.15,
        agreeingPersonas: ['b', 'c'],
        disagreeingPersonas: [],
      },
      {
        dimension: 'Tone',
        severity: 'medium',
        description: 'Voice slips into exposition.',
        location: { chapter: 'ch-02' },
        consensusStrength: 0.5,
        agreeingPersonas: [],
        disagreeingPersonas: [],
      },
    ])

    expect(result.dimensionOverlay).toEqual({
      Pacing: {
        avgScore: 0,
        markerCount: 2,
        worstSeverity: 'critical',
      },
      Tone: {
        avgScore: 0,
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
        location: {},
        consensusStrength: 1,
        agreeingPersonas: ['r1'],
        disagreeingPersonas: [],
      },
    ])
    expect(first.markers[0]?.id).toBe('overlay-1')

    const second = transformToOverlay([
      {
        dimension: 'Tension',
        severity: 'high',
        description: 'Another marker.',
        location: {},
        consensusStrength: 1,
        agreeingPersonas: ['r2'],
        disagreeingPersonas: [],
      },
    ])
    expect(second.markers[0]?.id).toBe('overlay-2')

    resetOverlayBridge()

    const reset = transformToOverlay([
      {
        dimension: 'Tension',
        severity: 'high',
        description: 'Reset marker.',
        location: {},
        consensusStrength: 1,
        agreeingPersonas: ['r3'],
        disagreeingPersonas: [],
      },
    ])
    expect(reset.markers[0]?.id).toBe('overlay-1')
  })
})

import { afterEach, describe, expect, it } from 'vitest'

import {
  resetOverlayBridge,
  transformToOverlay,
  type ConsensusItem,
} from '../../reader/OverlayBridge'

afterEach(() => {
  resetOverlayBridge()
})

describe('reader/OverlayBridge additional coverage', () => {
  it('keeps the strongest known severity when an unknown severity is mixed in', () => {
    const items: ConsensusItem[] = [
      {
        dimension: 'Pacing',
        severity: 'mystery' as ConsensusItem['severity'],
        description: 'Unknown severity bucket from an external adapter.',
        location: {},
        consensusStrength: 0.2,
        agreeingPersonas: ['r1'],
        disagreeingPersonas: [],
      },
      {
        dimension: 'Pacing',
        severity: 'high',
        description: 'Known severity should still win.',
        location: {},
        consensusStrength: 0.8,
        agreeingPersonas: ['r2'],
        disagreeingPersonas: [],
      },
    ]

    const result = transformToOverlay(items)

    expect(result.dimensionOverlay.Pacing).toEqual({
      avgScore: 0,
      markerCount: 2,
      worstSeverity: 'high',
    })
  })

  it('preserves the existing severity when the incoming severity is unknown', () => {
    const items: ConsensusItem[] = [
      {
        dimension: 'Tone',
        severity: 'critical',
        description: 'Known critical issue sets the baseline.',
        location: {},
        consensusStrength: 0.9,
        agreeingPersonas: ['r1'],
        disagreeingPersonas: [],
      },
      {
        dimension: 'Tone',
        severity: 'mystery' as ConsensusItem['severity'],
        description: 'Unknown severity should not outrank known critical.',
        location: {},
        consensusStrength: 0.1,
        agreeingPersonas: ['r2'],
        disagreeingPersonas: [],
      },
    ]

    const result = transformToOverlay(items)

    expect(result.dimensionOverlay.Tone).toEqual({
      avgScore: 0,
      markerCount: 2,
      worstSeverity: 'critical',
    })
  })
})

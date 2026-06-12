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
        position: {},
        consensusStrength: 0.2,
        personaIds: ['r1'],
        score: 0.2,
      },
      {
        dimension: 'Pacing',
        severity: 'high',
        description: 'Known severity should still win.',
        position: {},
        consensusStrength: 0.8,
        personaIds: ['r2'],
        score: 0.9,
      },
    ]

    const result = transformToOverlay(items)

    expect(result.dimensionOverlay.Pacing).toEqual({
      avgScore: 0.55,
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
        position: {},
        consensusStrength: 0.9,
        personaIds: ['r1'],
        score: 0.3,
      },
      {
        dimension: 'Tone',
        severity: 'mystery' as ConsensusItem['severity'],
        description: 'Unknown severity should not outrank known critical.',
        position: {},
        consensusStrength: 0.1,
        personaIds: ['r2'],
        score: 0.4,
      },
    ]

    const result = transformToOverlay(items)

    expect(result.dimensionOverlay.Tone).toEqual({
      avgScore: 0.35,
      markerCount: 2,
      worstSeverity: 'critical',
    })
  })
})

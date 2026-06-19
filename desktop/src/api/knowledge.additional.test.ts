import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendLegacyMemoryWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

vi.mock('./workspace', () => ({
  appendLegacyMemoryWorkspacePayload: appendLegacyMemoryWorkspacePayloadMock,
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import {
  analyzeCharacterDepth,
  getCharacterProfile,
  getCharacterRelationships,
  getForeshadowStats,
  plantForeshadow,
} from './knowledge'

describe('knowledge api bridge additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('plants foreshadow entries with and without optional payload fields', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'f-1',
          description: 'The clock tower rings twice',
          state: 'planted',
          planted_at: 'scene-1',
          planted_time: '2026-06-03T10:00:00Z',
          hints: [],
          harvested_at: null,
          harvested_time: null,
          importance: 0.7,
          tags: ['mystery'],
          metadata: { source: 'outline' },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'f-2',
          description: 'A nameless warning',
          state: 'planted',
          planted_at: 'scene-2',
          planted_time: '2026-06-03T11:00:00Z',
          hints: [],
          harvested_at: null,
          harvested_time: null,
          importance: 0.2,
          tags: [],
          metadata: {},
        },
      })

    const withOptions = await plantForeshadow('The clock tower rings twice', {
      scene_id: 'scene-1',
      importance: 0.7,
      tags: ['mystery'],
      metadata: { source: 'outline' },
    })
    const minimal = await plantForeshadow('A nameless warning')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/foreshadow/plant', 'POST', {
      description: 'The clock tower rings twice',
      scene_id: 'scene-1',
      importance: 0.7,
      tags: ['mystery'],
      metadata: { source: 'outline' },
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/foreshadow/plant', 'POST', {
      description: 'A nameless warning',
      scene_id: undefined,
      importance: undefined,
      tags: undefined,
      metadata: undefined,
    })
    expect(withOptions.success).toBe(true)
    expect(minimal.success).toBe(true)
  })

  it('requests foreshadow stats via GET', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        total: 3,
        by_state: { planted: 2, hinted: 1, harvested: 0 },
        total_hints: 4,
        avg_hints_per_foreshadow: 1.33,
        harvest_rate: 0,
      },
    })

    const result = await getForeshadowStats()

    expect(callApiMock).toHaveBeenCalledWith('/foreshadow/stats', 'GET', undefined, undefined)
    expect(result.data?.total).toBe(3)
  })

  it('posts character-depth and profile lookups to the expected endpoints', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          character: 'Aria',
          scores: {
            dynamicScore: 8,
            competenceScore: 7,
            eccentricityScore: 6,
            contrastScore: 8,
            dualityScore: 9,
          },
          depth_level: 'high',
          suggestions: ['Show more contradiction'],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          id: 'char-1',
          name: 'Aria',
          role: 'protagonist',
          personality: {},
          background: {},
          motivation: {},
          relationships: {},
          growth: {},
          five_dimension_score: {},
          created_at: '2026-06-03T10:00:00Z',
          updated_at: '2026-06-03T10:05:00Z',
        },
      })

    const depth = await analyzeCharacterDepth('char-1')
    const profile = await getCharacterProfile('Aria')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/character/depth', 'POST', { id: 'char-1' })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/character/profile', 'POST', { name: 'Aria' })
    expect(depth.data?.character).toBe('Aria')
    expect(profile.data?.name).toBe('Aria')
  })

  it('loads relationship network data through the relationship endpoint', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        nodes: [{ id: 'aria', name: 'Aria', role: 'protagonist' }],
        edges: [{ source: 'aria', target: 'kael', type: 'rival', trust: 0.2 }],
      },
    })

    const result = await getCharacterRelationships()

    expect(callApiMock).toHaveBeenCalledWith('/character/relationships', 'POST', {})
    expect(result.data?.nodes).toHaveLength(1)
    expect(result.data?.edges[0]?.type).toBe('rival')
  })
})

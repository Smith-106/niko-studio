/**
 * Contract verification tests for knowledge.ts
 * Verifies frontend-backend interface consistency for CF-001, CF-002
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload, _ws) => payload))

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

vi.mock('../workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
  appendLegacyMemoryWorkspacePayload: vi.fn((payload) => payload),
}))

import {
  plantForeshadow,
  getForeshadowStats,
  analyzeCharacterDepth,
  getCharacterProfile,
  getCharacterRelationships,
} from '../knowledge'
import type { ForeshadowStats, CharacterDepthAssessment, CharacterProfile, CharacterRelationshipNetwork } from '../knowledge'

describe('CF-001: knowledge double-envelope mismatch', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload, _ws) => payload)
  })

  it('plantForeshadow: backend returns flat entity, not { success, data } envelope', async () => {
    // Simulate actual backend response shape (flat entity from graphAddEntity)
    const backendRawBody: Record<string, unknown> = {
      id: 'foreshadow-123',
      description: 'mysterious shadow',
      state: 'planted',
      planted_at: '2026-06-14T00:00:00Z',
      importance: 2,
      tags: ['suspense'],
      metadata: {},
    }
    // callApi wraps raw body into { success: true, data: <rawBody> }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await plantForeshadow('mysterious shadow')

    // Result.data should be the flat entity, NOT { success, data: entity }
    expect(result.success).toBe(true)
    // After fix: result.data is flat ForeshadowItem — no inner envelope
    expect(result.data).toEqual(backendRawBody)
    expect((result.data as unknown as Record<string, unknown>).success).toBeUndefined()
    expect((result.data as unknown as Record<string, unknown>).data).toBeUndefined()
  })

  it('analyzeCharacterDepth: backend returns flat shape, not { success, data } envelope', async () => {
    const backendRawBody = {
      character: 'Alice',
      scores: { dynamicScore: 50, competenceScore: 50, eccentricityScore: 50, contrastScore: 50, dualityScore: 50 },
      depth_level: 'moderate',
      suggestions: [] as string[],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await analyzeCharacterDepth('Alice')

    expect(result.success).toBe(true)
    // After fix: result.data is flat CharacterDepthAssessment
    expect((result.data as unknown as Record<string, unknown>).success).toBeUndefined()
    expect((result.data as unknown as Record<string, unknown>).data).toBeUndefined()
    expect((result.data as CharacterDepthAssessment).character).toBe('Alice')
  })

  it('getCharacterProfile: backend returns flat shape, not { success, data } envelope', async () => {
    const backendRawBody = {
      id: 'char-Alice',
      name: 'Alice',
      role: 'protagonist',
      personality: {},
      background: {},
      motivation: {},
      relationships: {},
      growth: {},
      five_dimension_score: {},
      created_at: '2026-06-14T00:00:00Z',
      updated_at: '2026-06-14T00:00:00Z',
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await getCharacterProfile('Alice')

    // After fix: result.data is flat CharacterProfile
    expect((result.data as unknown as Record<string, unknown>).success).toBeUndefined()
    expect((result.data as unknown as Record<string, unknown>).data).toBeUndefined()
    expect((result.data as CharacterProfile).name).toBe('Alice')
  })

  it('getCharacterRelationships: backend returns { nodes, edges }, not { success, data } envelope', async () => {
    const backendRawBody = {
      nodes: [{ id: 'n1', name: 'Alice', role: 'protagonist' }],
      edges: [{ source: 'n1', target: 'n2', type: 'allies', trust: 0.8 }],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await getCharacterRelationships()

    // After fix: result.data is CharacterRelationshipNetwork
    expect((result.data as unknown as Record<string, unknown>).success).toBeUndefined()
    expect((result.data as unknown as Record<string, unknown>).data).toBeUndefined()
    expect((result.data as CharacterRelationshipNetwork).nodes).toHaveLength(1)
  })
})

describe('CF-002: getForeshadowStats double-envelope + workspace header ignored', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload, _ws) => payload)
  })

  it('getForeshadowStats: backend returns flat stats, not { success, data } envelope', async () => {
    const backendRawBody = {
      total: 5,
      by_state: { planted: 3, hinted: 1, harvested: 1 },
      total_hints: 1,
      avg_hints_per_foreshadow: 0.2,
      harvest_rate: 0.2,
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await getForeshadowStats()

    // After fix: result.data is flat ForeshadowStats
    expect((result.data as unknown as Record<string, unknown>).success).toBeUndefined()
    expect((result.data as unknown as Record<string, unknown>).data).toBeUndefined()
    expect((result.data as ForeshadowStats).total).toBe(5)
  })

  it('getForeshadowStats: sends X-Workspace-Id header but backend ignores it', async () => {
    const workspace = {
      identity: { workspaceId: 'ws-1', projectId: 'proj-1' },
      workspaceRoot: '/path',
    } as any
    callApiMock.mockResolvedValue({ success: true, data: { total: 0, by_state: { planted: 0, hinted: 0, harvested: 0 }, total_hints: 0, avg_hints_per_foreshadow: 0, harvest_rate: 0 } })

    await getForeshadowStats(workspace)

    // Frontend passes header for workspace context
    expect(callApiMock).toHaveBeenCalledWith(
      '/foreshadow/stats', 'GET', undefined,
      { 'X-Workspace-Id': 'ws-1' },
    )
    // After fix (TASK-005): Backend now reads workspace from body/headers and passes scope
  })
})

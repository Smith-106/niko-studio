/**
 * Contract verification tests for analysis.ts (CF-004)
 * Frontend expects { success, data: T[] } envelope but backend returns bare arrays
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import { detectPatterns, clusterSessions } from '../analysis'

describe('CF-004: analysis response envelope mismatch', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('detectPatterns: backend returns bare array, not { success, data } envelope', async () => {
    // Simulate actual backend response (bare array)
    const backendRawBody = [
      { id: 'p1', name: 'repetition', category: 'style', occurrences: [], confidence: 0.8, avgSimilarity: 0.6 },
    ]
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await detectPatterns('style')

    expect(result.success).toBe(true)
    // CF-004 MISMATCH: Frontend type is ApiResponse<{ success: boolean; data: DetectedPattern[] }>
    // Actual result.data is a bare array, not { success, data: [...] }
    expect(Array.isArray(result.data)).toBe(true)
    // Accessing result.data.success would be undefined (arrays don't have 'success')
    expect((result.data as any).success).toBeUndefined()
    // Accessing result.data.data would also be undefined
    expect((result.data as any).data).toBeUndefined()
    // Correct access is result.data[0] (treating data as the bare array)
    expect(result.data).toHaveLength(1)
  })

  it('clusterSessions: backend returns empty array (stub), not { success, data } envelope', async () => {
    // Backend endpoint is a stub that always returns []
    const backendRawBody: unknown[] = []
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await clusterSessions([{ id: 's1', type: 'chat' }])

    // CF-004 MISMATCH: type says ApiResponse<{ success, data: SessionCluster[] }>
    // actual data is bare []
    expect(Array.isArray(result.data)).toBe(true)
    expect((result.data as any).success).toBeUndefined()
    expect((result.data as any).data).toBeUndefined()
    // Backend also ignores the sessions input entirely (stub)
  })
})

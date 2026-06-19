/**
 * Contract verification tests for skills.ts (CF-006)
 * listSkills response shape mismatch: flat array vs { skills: [] }
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import { listSkills, matchSkills, getSkillChain } from '../skills'

describe('CF-006: listSkills response shape mismatch', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('listSkills: backend wraps in { skills: [...] } but frontend expects flat array', async () => {
    // Actual backend response from skillsListEndpoint
    const backendRawBody = {
      skills: [
        { id: 'skill-1', name: 'Outline Coach' },
        { id: 'skill-2', name: 'Pacing Guard' },
      ],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await listSkills()

    // CF-006 MISMATCH: Frontend type is ApiResponse<Array<{ id, name }>>
    // But actual data is { skills: [...] }, not a flat array
    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(false)
    // result.data is an object { skills: [...] }, not an array
    expect((result.data as Record<string, unknown>).skills).toHaveLength(2)
    // Code that iterates result.data as array will fail:
    // for (const skill of result.data) { ... } → TypeError: not iterable
  })

  it('matchSkills: response shape depends on service layer (untyped)', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    const result = await matchSkills('writing', ['outline'])

    // Frontend type: Array<{ skill_id, relevance }>
    // Backend delegates to skillsMatch() - shape unknown from endpoint code alone
    expect(result.success).toBe(true)
  })

  it('getSkillChain: response shape depends on service layer (untyped)', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    const result = await getSkillChain('writing')

    // Frontend type: Array<{ skill_id, step }>
    // Backend delegates to skillsChain() - shape unknown from endpoint code alone
    expect(result.success).toBe(true)
  })
})

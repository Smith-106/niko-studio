import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendLegacyMock = vi.hoisted(() => vi.fn((p) => p))
const appendWorkspaceMock = vi.hoisted(() => vi.fn((p) => p))

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

vi.mock('./workspace', () => ({
  appendLegacyMemoryWorkspacePayload: appendLegacyMock,
  appendWorkspacePayload: appendWorkspaceMock,
}))

import {
  searchMemory,
  getCharacter,
  queryGraph,
  getTemporalFacts,
  addMemory,
} from './knowledge'

describe('knowledge integration: entity search flow', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendLegacyMock.mockImplementation((p) => p)
    appendWorkspaceMock.mockImplementation((p) => p)
  })

  it('searches memory then retrieves character profile for top result', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 'm1', content: 'Aria is the protagonist', score: 0.92 },
        { id: 'm2', content: 'Aria wields a silver blade', score: 0.78 },
      ],
    })
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Aria',
        role: 'protagonist',
        relationships: { Kael: 'rival' },
      },
    })

    const searchResult = await searchMemory('Aria')
    expect(searchResult.success).toBe(true)
    expect(searchResult.data).toHaveLength(2)

    const topEntity = searchResult.data![0]
    expect(topEntity.score).toBeGreaterThanOrEqual(0.9)

    const charResult = await getCharacter('Aria', true)
    expect(charResult.success).toBe(true)
    expect(charResult.data!.name).toBe('Aria')
    expect(charResult.data!.relationships).toHaveProperty('Kael')
  })

  it('queries graph for character relationships after memory search', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'm1', content: 'Kael betrayed the order', score: 0.88 }],
    })
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: [
        { name: 'Kael', role: 'antagonist' },
        { name: 'Aria', role: 'protagonist' },
      ],
    })

    const searchResult = await searchMemory('Kael betrayal')
    expect(searchResult.data).toHaveLength(1)

    const graphResult = await queryGraph('MATCH (c:Character {name: "Kael"}) RETURN c')
    expect(graphResult.success).toBe(true)
    expect(graphResult.data).toHaveLength(2)
  })

  it('handles partial failures in multi-step search flow', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'm1', content: 'legacy lore entry', score: 0.7 }],
    })
    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'graph service unavailable',
    })

    const searchResult = await searchMemory('legacy lore')
    expect(searchResult.success).toBe(true)

    const graphResult = await queryGraph('MATCH (n) RETURN n LIMIT 1')
    expect(graphResult.success).toBe(false)
    expect(graphResult.error).toBe('graph service unavailable')
  })

  it('enriches memory with temporal facts and adds new memory', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'tf-1', content: 'Aria arrived in Ch3' }],
    })
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: { id: 'mem-new', status: 'added' },
    })

    const factsResult = await getTemporalFacts('aria-1', 'chapter-3')
    expect(factsResult.success).toBe(true)
    expect(factsResult.data).toHaveLength(1)

    const addResult = await addMemory('Aria arrived at the fortress in chapter 3', {
      layer: 'plot',
      dimension: 'timeline',
      entity_id: 'aria-1',
    })
    expect(addResult.success).toBe(true)
    expect(addResult.data!.id).toBe('mem-new')
  })
})

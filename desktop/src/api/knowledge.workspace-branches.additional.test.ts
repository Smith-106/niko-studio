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
  addMemory,
  getCharacter,
  getForeshadows,
  queryGraph,
} from './knowledge'

describe('knowledge api workspace branch coverage', () => {
  const workspace = {
    identity: { projectId: 'proj-1' },
    knowledge: { focusEntityId: 'hero-1', graphEntityIds: ['graph-1'], memoryEntryIds: ['mem-1'] },
    workflow: { sessionId: 'sess-1' },
    chat: { conversationId: 'conv-1' },
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('includes the focused entity for addMemory when requested without an explicit entity id', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { id: 'mem-99', status: 'added' },
    })

    const result = await addMemory('Focused fact', {
      use_focus_entity: true,
      workspace,
    })

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { content: 'Focused fact', use_focus_entity: true, workspace },
      workspace,
      { includeFocusEntity: true },
    )
    expect(callApiMock).toHaveBeenCalledWith('/memory/add', 'POST', {
      content: 'Focused fact',
      use_focus_entity: true,
      workspace,
    })
    expect(result.data?.id).toBe('mem-99')
  })

  it('passes workspace-scoped graph payloads through query, character, and foreshadow requests', async () => {
    callApiMock
      .mockResolvedValueOnce({ success: true, data: [{ id: 'graph-row' }] })
      .mockResolvedValueOnce({
        success: true,
        data: { name: 'Hero', role: 'protagonist', relationships: {} },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 'f-1', description: 'A clue', status: 'open' }],
      })

    await queryGraph('MATCH (n) RETURN n LIMIT 1', { workspace })
    await getCharacter('Hero', true, { workspace })
    await getForeshadows('open', 3, { workspace })

    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(
      1,
      { cypher: 'MATCH (n) RETURN n LIMIT 1' },
      workspace,
    )
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(
      2,
      { name: 'Hero', include_relations: true },
      workspace,
    )
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(
      3,
      { status: 'open', chapter: 3 },
      workspace,
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      1,
      '/graph/query',
      'POST',
      { cypher: 'MATCH (n) RETURN n LIMIT 1' },
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      2,
      '/graph/character',
      'POST',
      { name: 'Hero', include_relations: true },
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      3,
      '/graph/foreshadows',
      'POST',
      { status: 'open', chapter: 3 },
    )
  })
})

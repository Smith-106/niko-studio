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
  getTemporalFacts,
  queryGraph,
  searchMemory,
  uploadMemoryFile,
} from './knowledge'

describe('searchMemory', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /memory/search with query', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [{ id: 'm1', content: 'plot outline', score: 0.95 }],
    })

    const result = await searchMemory('plot outline')

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { query: 'plot outline' },
      undefined,
      { includeFocusEntity: false },
    )
    expect(callApiMock).toHaveBeenCalledWith('/memory/search', 'POST', { query: 'plot outline' })
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('passes options including layer, dimensions, limit', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    await searchMemory('hero background', {
      layer: 'character',
      dimensions: ['motivation', 'backstory'],
      limit: 10,
    })

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { query: 'hero background', layer: 'character', dimensions: ['motivation', 'backstory'], limit: 10 },
      undefined,
      { includeFocusEntity: false },
    )
  })

  it('includes focus entity when use_focus_entity is true and entity_id is absent', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    const workspace = {
      identity: { projectId: 'proj-1' },
      knowledge: { focusEntityId: 'hero-1', graphEntityIds: [], memoryEntryIds: [] },
      workflow: { sessionId: 'sess-1' },
      chat: { conversationId: 'conv-1' },
    } as any

    await searchMemory('hero', { use_focus_entity: true, workspace })

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { query: 'hero', use_focus_entity: true, workspace },
      workspace,
      { includeFocusEntity: true },
    )
  })

  it('omits focus entity when entity_id is provided alongside use_focus_entity', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    await searchMemory('hero', { use_focus_entity: true, entity_id: 'custom-entity' })

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { query: 'hero', use_focus_entity: true, entity_id: 'custom-entity' },
      undefined,
      { includeFocusEntity: false },
    )
  })

  it('propagates API errors', async () => {
    callApiMock.mockResolvedValue({ success: false, error: 'memory service down' })

    const result = await searchMemory('test')
    expect(result.success).toBe(false)
    expect(result.error).toBe('memory service down')
  })
})

describe('addMemory', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /memory/add with content and options', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { id: 'mem-1', status: 'added' },
    })

    const result = await addMemory('Character is brave', {
      layer: 'character',
      dimension: 'personality',
      entity_id: 'hero-1',
      importance: 0.8,
      tags: ['brave', 'hero'],
    })

    expect(callApiMock).toHaveBeenCalledWith(
      '/memory/add',
      'POST',
      expect.objectContaining({
        content: 'Character is brave',
        layer: 'character',
        dimension: 'personality',
        entity_id: 'hero-1',
        importance: 0.8,
        tags: ['brave', 'hero'],
      }),
    )
    expect(result.data?.id).toBe('mem-1')
  })

  it('works with minimal content argument', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { id: 'mem-2', status: 'added' },
    })

    const result = await addMemory('simple fact')
    expect(result.success).toBe(true)
  })
})

describe('uploadMemoryFile', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /memory/upload with file payload', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        status: 'injected',
        file_name: 'notes.txt',
        session_id: 'sess-1',
        chunks: 12,
        memory_ids: ['m1', 'm2', 'm3'],
      },
    })

    const result = await uploadMemoryFile({
      file_name: 'notes.txt',
      file_content_base64: 'SGVsbG8gV29ybGQ=',
      session_id: 'sess-1',
      chunk_size: 500,
      chunk_overlap: 50,
    })

    expect(callApiMock).toHaveBeenCalledWith(
      '/memory/upload',
      'POST',
      expect.objectContaining({
        file_name: 'notes.txt',
        file_content_base64: 'SGVsbG8gV29ybGQ=',
        session_id: 'sess-1',
        chunk_size: 500,
        chunk_overlap: 50,
      }),
    )
    expect(result.data?.chunks).toBe(12)
    expect(result.data?.memory_ids).toHaveLength(3)
  })

  it('preserves structured upload error payloads', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'mammoth is required for DOCX support. Install with: npm install mammoth',
      errorData: {
        error: 'mammoth is required for DOCX support. Install with: npm install mammoth',
        error_code: 'PARSER_PREREQUISITE_MISSING',
        file_name: 'notes.docx',
        file_type: 'docx',
        parser: 'mammoth',
        dependency: 'mammoth',
      },
    })

    const result = await uploadMemoryFile({
      file_name: 'notes.docx',
      file_content_base64: 'ZmFrZS1kb2N4',
      session_id: 'sess-1',
    })

    expect(result.success).toBe(false)
    expect(result.errorData?.error_code).toBe('PARSER_PREREQUISITE_MISSING')
    expect(result.errorData?.parser).toBe('mammoth')
  })
})

describe('getTemporalFacts', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendLegacyMemoryWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /memory/temporal with entity_id and at_time', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [{ id: 'tf-1', content: 'Hero arrived at chapter 3' }],
    })

    const result = await getTemporalFacts('hero-1', 'chapter-3')

    expect(appendLegacyMemoryWorkspacePayloadMock).toHaveBeenCalledWith(
      { entity_id: 'hero-1', at_time: 'chapter-3' },
      undefined,
    )
    expect(callApiMock).toHaveBeenCalledWith(
      '/memory/temporal',
      'POST',
      expect.objectContaining({ entity_id: 'hero-1', at_time: 'chapter-3' }),
    )
    expect(result.data).toHaveLength(1)
  })

  it('works without at_time parameter', async () => {
    callApiMock.mockResolvedValue({ success: true, data: [] })

    await getTemporalFacts('hero-1')
    expect(callApiMock).toHaveBeenCalled()
  })
})

describe('queryGraph', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /graph/query with cypher string', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [{ name: 'Hero', role: 'protagonist' }],
    })

    const result = await queryGraph('MATCH (n:Character) RETURN n LIMIT 5')

    expect(appendWorkspacePayloadMock).toHaveBeenCalledWith(
      { cypher: 'MATCH (n:Character) RETURN n LIMIT 5' },
      undefined,
    )
    expect(callApiMock).toHaveBeenCalledWith(
      '/graph/query',
      'POST',
      expect.objectContaining({ cypher: 'MATCH (n:Character) RETURN n LIMIT 5' }),
    )
    expect(result.success).toBe(true)
  })
})

describe('getCharacter', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /graph/character with name', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { name: 'Hero', role: 'protagonist', relationships: {} },
    })

    const result = await getCharacter('Hero')

    expect(callApiMock).toHaveBeenCalledWith(
      '/graph/character',
      'POST',
      expect.objectContaining({ name: 'Hero', include_relations: undefined }),
    )
    expect(result.success).toBe(true)
  })
})

describe('getForeshadows', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /graph/foreshadows with filters', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: [{ id: 'f-1', description: 'Hidden clue', status: 'open' }],
    })

    const result = await getForeshadows('open', 3)

    expect(callApiMock).toHaveBeenCalledWith(
      '/graph/foreshadows',
      'POST',
      expect.objectContaining({ status: 'open', chapter: 3 }),
    )
    expect(result.success).toBe(true)
  })
})

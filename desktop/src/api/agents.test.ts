import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

vi.mock('./workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import { agentGetContext, agentRevise, agentRoute, agentWrite } from './agents'

describe('agentRoute', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /agent/route with task string', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        workflow_level: 'L3',
        workflow_level_slug: 'L3-team',
        scene_type: 'conflict',
        dispatched_skills: ['writer', 'critic'],
        task_assignments: [
          {
            task_id: 't1',
            agent_type: 'writer',
            instruction: 'write scene',
            skills: ['writer'],
          },
        ],
      },
    })

    const result = await agentRoute('Write a battle scene between two rivals')

    expect(callApiMock).toHaveBeenCalledWith('/agent/route', 'POST', { task: 'Write a battle scene between two rivals' })
    expect(result.success).toBe(true)
    expect(result.data?.workflow_level).toBe('L3')
    expect(result.data?.dispatched_skills).toEqual(['writer', 'critic'])
  })

  it('propagates API errors', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'routing service unavailable',
    })

    const result = await agentRoute('task')
    expect(result.success).toBe(false)
    expect(result.error).toBe('routing service unavailable')
  })
})

describe('agentWrite', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  it('calls /agent/write with scene card and skills', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { content: 'He drew his sword...', wordcount: 523 },
    })

    const result = await agentWrite(
      { scene_id: 'scene-1', task: 'Write battle scene' },
      ['writer', 'suspense-craft'],
      800,
      { coherence: 85, naturalness: 80 },
    )

    expect(appendWorkspacePayloadMock).toHaveBeenCalledWith(
      {
        scene_card: { scene_id: 'scene-1', task: 'Write battle scene' },
        skills: ['writer', 'suspense-craft'],
        word_target: 800,
        quality_goals: { coherence: 85, naturalness: 80 },
      },
      undefined,
    )
    expect(callApiMock).toHaveBeenCalledWith(
      '/agent/write',
      'POST',
      expect.objectContaining({
        scene_card: { scene_id: 'scene-1', task: 'Write battle scene' },
        skills: ['writer', 'suspense-craft'],
        word_target: 800,
      }),
    )
    expect(result.data?.content).toBe('He drew his sword...')
    expect(result.data?.wordcount).toBe(523)
  })

  it('works with minimal scene card', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { content: 'text', wordcount: 10 },
    })

    const result = await agentWrite({ scene_id: 's1' })
    expect(result.success).toBe(true)
  })

  it('passes workspace context through appendWorkspacePayload', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { content: 'text', wordcount: 10 },
    })

    const workspace = {
      identity: { projectId: 'proj-1' },
      workflow: { sessionId: 'sess-1' },
      chat: { conversationId: 'conv-1' },
    } as any

    await agentWrite({ scene_id: 's1' }, ['writer'], 500, undefined, workspace)

    expect(appendWorkspacePayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ scene_card: { scene_id: 's1' }, skills: ['writer'], word_target: 500 }),
      workspace,
    )
  })

  it('includes writer_metadata in response when present', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        content: 'written text',
        wordcount: 300,
        writer_metadata: { workspace_context: { projectId: 'proj-1' } },
      },
    })

    const result = await agentWrite({ scene_id: 's1' })
    expect(result.data?.writer_metadata).toBeDefined()
  })
})

describe('agentRevise', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /agent/revise with draft and feedback', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { content: 'Revised chapter text...' },
    })

    const result = await agentRevise(
      'Original draft text...',
      { pacing: 'too slow', dialogue: 'unrealistic' },
      { coherence: 90 },
    )

    expect(callApiMock).toHaveBeenCalledWith(
      '/agent/revise',
      'POST',
      {
        draft: 'Original draft text...',
        feedback: { pacing: 'too slow', dialogue: 'unrealistic' },
        quality_goals: { coherence: 90 },
      },
    )
    expect(result.data?.content).toBe('Revised chapter text...')
  })

  it('works without quality goals', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { content: 'revised' },
    })

    const result = await agentRevise('draft', { comment: 'fix this' })
    expect(result.success).toBe(true)
  })

  it('propagates errors', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'revision failed',
    })

    const result = await agentRevise('draft', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('revision failed')
  })
})

describe('agentGetContext', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('calls /agent/context with scene info', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {
        characters: ['Hero', 'Villain'],
        setting: 'Medieval castle',
        current_tension: 'high',
      },
    })

    const result = await agentGetContext(
      { scene_id: 's1', chapter: 3 },
      ['characters', 'setting', 'tension'],
    )

    expect(callApiMock).toHaveBeenCalledWith(
      '/agent/context',
      'POST',
      {
        scene_info: { scene_id: 's1', chapter: 3 },
        context_types: ['characters', 'setting', 'tension'],
      },
    )
    expect(result.success).toBe(true)
    expect(result.data?.characters).toEqual(['Hero', 'Villain'])
  })

  it('works without context types', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {},
    })

    const result = await agentGetContext({ scene_id: 's1' })
    expect(result.success).toBe(true)
  })

  it('propagates errors', async () => {
    callApiMock.mockResolvedValue({
      success: false,
      error: 'context retrieval failed',
    })

    const result = await agentGetContext({})
    expect(result.success).toBe(false)
    expect(result.error).toBe('context retrieval failed')
  })
})

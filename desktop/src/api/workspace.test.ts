import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: (...args: unknown[]) => callApiMock(...args),
}))

import {
  appendLegacyChatWorkspacePayload,
  appendLegacyMemoryWorkspacePayload,
  appendWorkspacePayload,
  normalizeWorkspaceInput,
  resolveWorkspaceContext,
} from './workspace'
import { createDefaultProjectWorkspaceContext } from '@/types/workspace'

function buildWorkspace() {
  return {
    ...createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/atlas',
      fallbackProjectId: 'atlas-project',
    }),
    identity: {
      ...createDefaultProjectWorkspaceContext({
        workspaceRoot: '/tmp/atlas',
        fallbackProjectId: 'atlas-project',
      }).identity,
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'Atlas Project',
      workspaceRoot: '/tmp/atlas',
    },
    manuscript: {
      ...createDefaultProjectWorkspaceContext({
        workspaceRoot: '/tmp/atlas',
        fallbackProjectId: 'atlas-project',
      }).manuscript,
      chapterId: 'chapter-5',
    },
    knowledge: {
      ...createDefaultProjectWorkspaceContext({
        workspaceRoot: '/tmp/atlas',
        fallbackProjectId: 'atlas-project',
      }).knowledge,
      focusEntityId: 'hero-5',
    },
    workflow: {
      ...createDefaultProjectWorkspaceContext({
        workspaceRoot: '/tmp/atlas',
        fallbackProjectId: 'atlas-project',
      }).workflow,
      sessionId: 'workflow-session-5',
    },
    chat: {
      ...createDefaultProjectWorkspaceContext({
        workspaceRoot: '/tmp/atlas',
        fallbackProjectId: 'atlas-project',
      }).chat,
      conversationId: 'conversation-5',
    },
  }
}

describe('workspace helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes workspace input and leaves empty inputs unset', () => {
    expect(normalizeWorkspaceInput()).toBeNull()
    expect(normalizeWorkspaceInput(null)).toBeNull()

    const normalized = normalizeWorkspaceInput({ identity: { projectId: 'atlas-project' } })
    expect(normalized?.identity.projectId).toBe('atlas-project')
  })

  it('appends canonical workspace payloads only when workspace exists', () => {
    const payload = { action: 'ping' }
    expect(appendWorkspacePayload(payload)).toBe(payload)

    const result = appendWorkspacePayload(payload, buildWorkspace())
    expect(result.workspace?.identity.projectId).toBe('atlas-project')
    expect(result.action).toBe('ping')
  })

  it('merges legacy chat context without dropping caller-provided fields', () => {
    const workspace = buildWorkspace()
    const result = appendLegacyChatWorkspacePayload(
      { action: 'chat', context: { chapterId: 'override-chapter', custom: true } },
      workspace,
    )

    expect(result.workspace?.identity.projectId).toBe('atlas-project')
    expect(result.context).toMatchObject({
      projectId: 'atlas-project',
      chapterId: 'override-chapter',
      custom: true,
    })
  })

  it('falls back to canonical legacy chat context when the caller passes a non-record context', () => {
    const workspace = buildWorkspace()
    const result = appendLegacyChatWorkspacePayload(
      { action: 'chat', context: ['invalid-context-shape'] as unknown as Record<string, unknown> },
      workspace,
    )

    expect(result.context).toMatchObject({
      projectId: 'atlas-project',
      chapterId: 'chapter-5',
    })
    expect(Array.isArray(result.context)).toBe(false)
  })

  it('leaves legacy chat payload unchanged when workspace is missing', () => {
    const payload = { action: 'chat', context: { custom: true } }

    expect(appendLegacyChatWorkspacePayload(payload)).toBe(payload)
    expect(appendLegacyChatWorkspacePayload(payload, null)).toBe(payload)
  })

  it('builds legacy memory scope with and without focus entity inclusion', () => {
    const workspace = buildWorkspace()
    const noWorkspacePayload = { query: 'atlas' }

    expect(appendLegacyMemoryWorkspacePayload(noWorkspacePayload)).toBe(noWorkspacePayload)

    const genericScope = appendLegacyMemoryWorkspacePayload({ query: 'atlas' }, workspace)
    expect(genericScope).toMatchObject({
      project_id: 'atlas-project',
      session_id: 'workflow-session-5',
      entity_id: undefined,
    })

    const focusedScope = appendLegacyMemoryWorkspacePayload(
      { query: 'atlas' },
      workspace,
      { includeFocusEntity: true },
    )
    expect(focusedScope).toMatchObject({
      project_id: 'atlas-project',
      session_id: 'workflow-session-5',
      entity_id: 'hero-5',
    })
  })

  it('routes canonical workspace resolution through callApi', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { ok: true } })

    const payload = { project_id: 'atlas-project', context: { chapterId: 'chapter-5' } }
    await resolveWorkspaceContext(payload)

    expect(callApiMock).toHaveBeenCalledWith(
      '/workspace/context',
      'POST',
      expect.objectContaining({
        workspace: expect.objectContaining({
          identity: expect.objectContaining({
            projectId: 'atlas-project',
          }),
        }),
      }),
    )
  })
})

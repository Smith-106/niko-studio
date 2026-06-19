import { describe, expect, it } from 'vitest'

import { createDefaultProjectWorkspaceContext, mergeProjectWorkspaceContext } from '@/types/workspace'

import type { Conversation } from './shared'
import { resolveConversationWorkspaceForSync } from './shared'

function createConversation(id: string): Conversation {
  return {
    id,
    title: 'Conversation',
    messages: [],
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    updatedAt: new Date('2026-06-07T00:00:00.000Z'),
  }
}

describe('shared conversation workspace helpers', () => {
  it('reuses the current workspace when syncing the active conversation without a stored workspace snapshot', () => {
    const currentWorkspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/current-project',
    })
    const patch = {
      authority: { activeSceneId: 'scene-active' },
      chat: { conversationId: 'conversation-active' },
    }

    const result = resolveConversationWorkspaceForSync({
      conversation: createConversation('conversation-active'),
      conversationId: 'conversation-active',
      currentConversationId: 'conversation-active',
      currentWorkspace,
      patch,
    })

    expect(result).not.toBeNull()
    expect(result?.conversationWorkspace).toEqual(
      mergeProjectWorkspaceContext(currentWorkspace, patch),
    )
    expect(result?.currentWorkspace).toEqual(
      mergeProjectWorkspaceContext(currentWorkspace, patch),
    )
  })

  it('falls back to a safe default workspace when syncing a background conversation without stored workspace', () => {
    const currentWorkspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/current-project',
    })
    const patch = {
      workflow: { sessionId: 'sync-session-2' },
      chat: { conversationId: 'conversation-background' },
    }

    const result = resolveConversationWorkspaceForSync({
      conversation: createConversation('conversation-background'),
      conversationId: 'conversation-background',
      currentConversationId: 'conversation-active',
      currentWorkspace,
      patch,
    })

    const expectedConversationWorkspace = mergeProjectWorkspaceContext(
      createDefaultProjectWorkspaceContext(),
      patch,
    )

    expect(result).not.toBeNull()
    expect(result?.conversationWorkspace).toEqual(expectedConversationWorkspace)
    expect(result?.currentWorkspace).toBe(currentWorkspace)
  })
})

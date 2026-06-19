import { describe, expect, it, vi } from 'vitest'

import { createDefaultProjectWorkspaceContext, type ProjectWorkspaceContext } from '@/types/workspace'

import { type Conversation, createConversationWorkspaceSeed } from './shared'
import { createWorkspaceSlice, type WorkspaceSlice } from './workspaceSlice'

type SetFn = Parameters<typeof createWorkspaceSlice>[0]

interface HarnessState extends WorkspaceSlice {
  conversationsById: Record<string, Conversation>
  currentConversationId: string | null
}

function createHarness(initialOverrides?: Partial<HarnessState>) {
  let state: HarnessState = {
    currentWorkspace: createDefaultProjectWorkspaceContext(),
    setCurrentWorkspace: () => {},
    syncConversationWorkspace: () => {},
    conversationsById: {},
    currentConversationId: null,
    ...initialOverrides,
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createWorkspaceSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }

  return {
    getState: () => state,
    patchState: (partial: Partial<HarnessState> | ((current: HarnessState) => Partial<HarnessState>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('workspaceSlice', () => {
  it('initializes currentWorkspace with createDefaultProjectWorkspaceContext()', () => {
    const store = createHarness()
    const expected = createDefaultProjectWorkspaceContext()
    expect(store.getState().currentWorkspace).toEqual(expected)
  })

  it('setCurrentWorkspace merges a partial patch into currentWorkspace', () => {
    const store = createHarness()
    const before = store.getState().currentWorkspace
    const patch = { identity: { projectId: 'merged-project' } } as never

    store.getState().setCurrentWorkspace(patch)

    expect(store.getState().currentWorkspace.identity.projectId).toBe('merged-project')
    // other fields remain from before
    expect(store.getState().currentWorkspace.identity.workspaceRoot).toBe(before.identity.workspaceRoot)
  })

  it('syncConversationWorkspace for active conversation updates both workspaces', () => {
    const convId = 'conv-1'
    const seed = createConversationWorkspaceSeed(createDefaultProjectWorkspaceContext())
    const conversation: Conversation = {
      id: convId,
      title: 'Test',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: seed,
    }

    vi.spyOn(Date, 'now').mockReturnValue(9999)
    const store = createHarness({
      conversationsById: { [convId]: conversation },
      currentConversationId: convId,
    })

    const patch = { identity: { projectId: 'synced-project' } } as never
    store.getState().syncConversationWorkspace(convId, patch)

    expect(store.getState().currentWorkspace.identity.projectId).toBe('synced-project')
    expect(store.getState().conversationsById[convId].workspace.identity.projectId).toBe('synced-project')
  })

  it('syncConversationWorkspace for inactive conversation updates only conversation workspace', () => {
    const activeConvId = 'conv-active'
    const otherConvId = 'conv-other'

    const activeSeed = createConversationWorkspaceSeed(createDefaultProjectWorkspaceContext())
    const otherSeed = createConversationWorkspaceSeed(createDefaultProjectWorkspaceContext())
    const activeConversation: Conversation = {
      id: activeConvId,
      title: 'Active',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: activeSeed,
    }
    const otherConversation: Conversation = {
      id: otherConvId,
      title: 'Other',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: otherSeed,
    }

    vi.spyOn(Date, 'now').mockReturnValue(9999)
    const store = createHarness({
      conversationsById: { [activeConvId]: activeConversation, [otherConvId]: otherConversation },
      currentConversationId: activeConvId,
    })

    const patch = { identity: { projectId: 'other-project' } } as never
    store.getState().syncConversationWorkspace(otherConvId, patch)

    // Active workspace should NOT change
    expect(store.getState().currentWorkspace.identity.projectId).not.toBe('other-project')
    // Other conversation workspace SHOULD change
    expect(store.getState().conversationsById[otherConvId].workspace.identity.projectId).toBe('other-project')
  })

  it('syncConversationWorkspace for missing conversation returns state unchanged', () => {
    const store = createHarness({
      conversationsById: {},
      currentConversationId: null,
    })

    const snapshot = { ...store.getState().currentWorkspace }
    const snapshotConversations = { ...store.getState().conversationsById }

    store.getState().syncConversationWorkspace('nonexistent', { identity: { projectId: 'ghost' } } as never)

    expect(store.getState().currentWorkspace).toEqual(snapshot)
    expect(store.getState().conversationsById).toEqual(snapshotConversations)
  })
})

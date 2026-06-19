import { describe, expect, it, vi } from 'vitest'

import { createDefaultProjectWorkspaceContext, type ProjectWorkspaceContext } from '@/types/workspace'

import {
  createConversationWorkspaceSeed,
  type Conversation,
} from './shared'
import { createConversationSlice, type ConversationSlice } from './conversationSlice'

type SetFn = Parameters<typeof createConversationSlice>[0]

interface HarnessState extends ConversationSlice {
  currentWorkspace: ProjectWorkspaceContext
}

function createHarness() {
  let state: HarnessState = {
    conversationsById: {},
    allConversationIds: [],
    currentConversationId: null,
    currentWorkspace: createDefaultProjectWorkspaceContext(),
    createConversation: () => {},
    selectConversation: () => {},
    updateConversationTitle: () => {},
    addMessage: () => {},
    deleteMessage: () => {},
    editMessage: () => {},
    getConversationById: () => undefined,
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createConversationSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }

  return {
    getState: () => state,
    patchState: (partial: Partial<HarnessState> | ((current: HarnessState) => Partial<HarnessState>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('conversationSlice additional coverage', () => {
  it('selectConversation with non-existent ID does not change state', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    store.getState().createConversation()
    const activeId = '1000'

    const snapshot = {
      currentConversationId: store.getState().currentConversationId,
      currentWorkspace: store.getState().currentWorkspace,
    }

    store.getState().selectConversation('nonexistent')

    expect(store.getState().currentConversationId).toBe(snapshot.currentConversationId)
    expect(store.getState().currentWorkspace).toEqual(snapshot.currentWorkspace)
  })

  it('updateConversationTitle with missing conversationId is a no-op', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    store.getState().createConversation()
    const convId = '2000'

    const snapshot = { ...store.getState().conversationsById }
    store.getState().updateConversationTitle('missing-id', 'New Title')

    expect(store.getState().conversationsById).toEqual(snapshot)
  })

  it('updateConversationTitle with same title is a no-op', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(3000)
    store.getState().createConversation()
    const convId = '3000'

    const currentTitle = store.getState().conversationsById[convId].title
    const snapshot = { ...store.getState().conversationsById }
    store.getState().updateConversationTitle(convId, currentTitle)

    expect(store.getState().conversationsById).toEqual(snapshot)
  })

  it('addMessage when currentConversationId is null auto-creates a conversation then adds the message', () => {
    const store = createHarness()
    expect(store.getState().currentConversationId).toBeNull()

    vi.spyOn(Date, 'now').mockReturnValue(4000)
    store.getState().addMessage('user', 'Auto-created message')

    expect(store.getState().currentConversationId).not.toBeNull()
    const convId = store.getState().currentConversationId!
    const conversation = store.getState().conversationsById[convId]
    expect(conversation).toBeDefined()
    expect(conversation.messages).toHaveLength(1)
    expect(conversation.messages[0].content).toBe('Auto-created message')
  })

  it('deleteMessage with no currentConversationId is an early return with no crash', () => {
    const store = createHarness()
    store.patchState({ currentConversationId: null })

    expect(() => store.getState().deleteMessage('some-message')).not.toThrow()
  })

  it('editMessage with no currentConversationId is an early return', () => {
    const store = createHarness()
    store.patchState({ currentConversationId: null })

    expect(() => store.getState().editMessage('some-message', 'new content')).not.toThrow()
  })

  it('createConversation seeds workspace from currentWorkspace via createConversationWorkspaceSeed', () => {
    const store = createHarness()
    const customWorkspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/custom-project',
    })
    store.patchState({ currentWorkspace: customWorkspace })

    vi.spyOn(Date, 'now').mockReturnValue(5000)
    store.getState().createConversation()
    const convId = '5000'

    const expectedSeed = createConversationWorkspaceSeed(customWorkspace)
    expect(store.getState().conversationsById[convId].workspace).toEqual(expectedSeed)
  })
})

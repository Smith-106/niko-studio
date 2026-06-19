import { describe, expect, it, vi } from 'vitest'

import { createDefaultProjectWorkspaceContext, type ProjectWorkspaceContext } from '@/types/workspace'

import {
  createConversationRecord,
  createConversationWorkspaceSeed,
  resolveConversationStateForMessage,
  updateConversationMessages,
  type Conversation,
  type Message,
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

describe('conversationSlice', () => {
  it('createConversation creates entry in conversationsById and adds ID to allConversationIds', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(1000)

    store.getState().createConversation()

    const id = '1000'
    expect(store.getState().conversationsById[id]).toBeDefined()
    expect(store.getState().allConversationIds).toContain(id)
    expect(store.getState().currentConversationId).toBe(id)
  })

  it('createConversation sets currentWorkspace to the conversation seed', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(2000)

    const workspaceBefore = store.getState().currentWorkspace
    store.getState().createConversation()

    expect(store.getState().currentWorkspace).toEqual(
      createConversationWorkspaceSeed(workspaceBefore),
    )
  })

  it('selectConversation switches the active conversation', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(3000)
    store.getState().createConversation()
    const firstId = '3000'

    vi.spyOn(Date, 'now').mockReturnValue(4000)
    store.getState().createConversation()
    const secondId = '4000'

    expect(store.getState().currentConversationId).toBe(secondId)

    store.getState().selectConversation(firstId)
    expect(store.getState().currentConversationId).toBe(firstId)
  })

  it('addMessage adds a message to the current conversation', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(5000)
    store.getState().createConversation()
    const id = '5000'

    vi.spyOn(Date, 'now').mockReturnValue(5001)
    store.getState().addMessage('user', 'Hello world')

    const conversation = store.getState().conversationsById[id]
    expect(conversation.messages).toHaveLength(1)
    expect(conversation.messages[0].role).toBe('user')
    expect(conversation.messages[0].content).toBe('Hello world')
  })

  it('deleteMessage removes a message by messageId', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(6000)
    store.getState().createConversation()
    const convId = '6000'

    vi.spyOn(Date, 'now').mockReturnValue(6001)
    store.getState().addMessage('user', 'First message')
    vi.spyOn(Date, 'now').mockReturnValue(6002)
    store.getState().addMessage('assistant', 'Second message')

    const firstMessageId = store.getState().conversationsById[convId].messages[0].id
    store.getState().deleteMessage(firstMessageId)

    const messages = store.getState().conversationsById[convId].messages
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
  })

  it('editMessage updates content and timestamp', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(7000)
    store.getState().createConversation()
    const convId = '7000'

    vi.spyOn(Date, 'now').mockReturnValue(7001)
    store.getState().addMessage('user', 'Original content')

    const messageId = store.getState().conversationsById[convId].messages[0].id
    const originalTimestamp = store.getState().conversationsById[convId].messages[0].timestamp

    vi.spyOn(Date, 'now').mockReturnValue(7999)
    store.getState().editMessage(messageId, 'Updated content')

    const message = store.getState().conversationsById[convId].messages[0]
    expect(message.content).toBe('Updated content')
    expect(message.timestamp.getTime()).toBeGreaterThanOrEqual(originalTimestamp.getTime())
  })

  it('getConversationById returns the correct conversation', () => {
    const store = createHarness()
    vi.spyOn(Date, 'now').mockReturnValue(8000)
    store.getState().createConversation()
    const id = '8000'

    expect(store.getState().getConversationById(id)).toBe(
      store.getState().conversationsById[id],
    )
  })

  it('getConversationById returns undefined for missing id', () => {
    const store = createHarness()
    expect(store.getState().getConversationById('nonexistent')).toBeUndefined()
  })
})

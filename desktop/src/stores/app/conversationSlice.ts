import type { WriterMetadata } from '@/api/client'

import {
  createConversationRecord,
  createConversationWorkspaceSeed,
  resolveConversationStateForMessage,
  resolveSelectedConversationWorkspace,
  updateConversationMessages,
  type Conversation,
  type MessageComparison,
} from './shared'
import type { AppSlice } from '../appStore'

export interface ConversationSlice {
  conversationsById: Record<string, Conversation>
  allConversationIds: string[]
  currentConversationId: string | null
  createConversation: () => void
  selectConversation: (id: string) => void
  updateConversationTitle: (conversationId: string, title: string) => void
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    skills?: string[],
    comparison?: MessageComparison,
    writerMetadata?: WriterMetadata,
  ) => void
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string) => void
  getConversationById: (id: string) => Conversation | undefined
}

export const createConversationSlice: AppSlice<ConversationSlice> = (set, get) => ({
  conversationsById: {},
  allConversationIds: [],
  currentConversationId: null,

  createConversation: () => {
    const id = Date.now().toString()
    const seedWorkspace = createConversationWorkspaceSeed(get().currentWorkspace)
    const conversation = createConversationRecord({ id, workspace: seedWorkspace })

    set((state) => ({
      conversationsById: { ...state.conversationsById, [id]: conversation },
      allConversationIds: [id, ...state.allConversationIds],
      currentConversationId: id,
      currentWorkspace: seedWorkspace,
    }))
  },

  selectConversation: (id) => {
    const conversation = get().conversationsById[id]
    if (!conversation) return

    set({
      currentConversationId: id,
      currentWorkspace: resolveSelectedConversationWorkspace(conversation),
    })
  },

  updateConversationTitle: (conversationId, title) => {
    set((state) => {
      const conversation = state.conversationsById[conversationId]
      if (!conversation) return state
      if (conversation.title === title) return state

      return {
        conversationsById: {
          ...state.conversationsById,
          [conversationId]: {
            ...conversation,
            title,
            updatedAt: new Date(),
          },
        },
      }
    })
  },

  addMessage: (role, content, skills, comparison, writerMetadata) => {
    const { currentConversationId, conversationsById, currentWorkspace } = get()
    if (!currentConversationId) {
      get().createConversation()
      get().addMessage(role, content, skills, comparison, writerMetadata)
      return
    }

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    const { nextWorkspace, nextConversation } = resolveConversationStateForMessage({
      conversation,
      currentWorkspace,
      role,
      content,
      skills,
      comparison,
      writerMetadata,
    })

    set({
      currentWorkspace: nextWorkspace,
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: nextConversation,
      },
    })
  },

  deleteMessage: (messageId) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: updateConversationMessages(
          conversation,
          (messages) => messages.filter((message) => message.id !== messageId),
        ),
      },
    })
  },

  editMessage: (messageId, content) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: updateConversationMessages(
          conversation,
          (messages) => messages.map((message) => (
            message.id === messageId ? { ...message, content, timestamp: new Date() } : message
          )),
        ),
      },
    })
  },

  getConversationById: (id) => get().conversationsById[id],
})

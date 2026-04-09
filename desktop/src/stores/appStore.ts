import { create } from 'zustand'
import { checkBackendHealth, listSkills, type WriterMetadata } from '@/api/client'
import {
  createDefaultProjectWorkspaceContext,
  mergeProjectWorkspaceContext,
  type ProjectWorkspaceContext,
} from '@/types/workspace'

import {
  createConversationWorkspaceSeed,
  createSafeDefaultWorkspace,
  generateTitle,
  mergeConversationWorkspace,
  resolveSelectedConversationWorkspace,
  resolveWorkspaceFromWriterMetadata,
  type Conversation,
  type MessageComparison,
} from './app/shared'

export type {
  Conversation,
  Message,
  MessageComparison,
  MessageComparisonItem,
} from './app/shared'

interface AppState {
  backendStatus: boolean
  checkBackend: () => Promise<void>
  currentWorkspace: ProjectWorkspaceContext
  setCurrentWorkspace: (workspace: ProjectWorkspaceContext | Record<string, unknown>) => void
  syncConversationWorkspace: (conversationId: string, workspace: ProjectWorkspaceContext | Record<string, unknown>) => void
  conversationsById: Record<string, Conversation>
  allConversationIds: string[]
  currentConversationId: string | null
  createConversation: () => void
  selectConversation: (id: string) => void
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
  availableSkills: string[]
  selectedSkills: string[]
  toggleSkill: (skill: string) => void
  refreshAvailableSkills: () => Promise<void>
  loadingMap: Record<string, boolean>
  startLoading: (id: string) => void
  finishLoading: (id: string) => void
  isLoading: (id: string) => boolean
}

export const useAppStore = create<AppState>((set, get) => ({
  backendStatus: false,
  checkBackend: async () => {
    try {
      const healthy = await checkBackendHealth()
      set({ backendStatus: healthy })
    } catch {
      set({ backendStatus: false })
    }
  },

  currentWorkspace: createDefaultProjectWorkspaceContext(),
  setCurrentWorkspace: (workspace) => {
    set((state) => ({
      currentWorkspace: mergeProjectWorkspaceContext(state.currentWorkspace, workspace),
    }))
  },
  syncConversationWorkspace: (conversationId, workspace) => {
    set((state) => {
      const conversation = state.conversationsById[conversationId]
      if (!conversation) return state
      const baseWorkspace = conversation.workspace
        ? conversation.workspace
        : state.currentConversationId === conversationId
          ? state.currentWorkspace
          : createSafeDefaultWorkspace()
      const nextWorkspace = mergeConversationWorkspace(baseWorkspace, workspace)
      return {
        currentWorkspace: state.currentConversationId === conversationId ? nextWorkspace : state.currentWorkspace,
        conversationsById: {
          ...state.conversationsById,
          [conversationId]: {
            ...conversation,
            workspace: nextWorkspace,
            updatedAt: new Date(),
          },
        },
      }
    })
  },

  conversationsById: {},
  allConversationIds: [],
  currentConversationId: null,

  createConversation: () => {
    const id = Date.now().toString()
    const seedWorkspace = createConversationWorkspaceSeed(get().currentWorkspace)
    const conversation: Conversation = {
      id,
      title: '新对话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: seedWorkspace,
    }
    set((state) => ({
      conversationsById: { ...state.conversationsById, [id]: conversation },
      allConversationIds: [id, ...state.allConversationIds],
      currentConversationId: id,
      currentWorkspace: seedWorkspace,
    }))
  },

  selectConversation: (id: string) => {
    const conversation = get().conversationsById[id]
    if (!conversation) return
    set({
      currentConversationId: id,
      currentWorkspace: resolveSelectedConversationWorkspace(conversation),
    })
  },

  addMessage: (role, content, skills, comparison, writerMetadata) => {
    const { currentConversationId, conversationsById, currentWorkspace } = get()
    if (!currentConversationId) {
      get().createConversation()
      return get().addMessage(role, content, skills, comparison, writerMetadata)
    }

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    const messageWorkspace = resolveWorkspaceFromWriterMetadata(writerMetadata)
    const nextWorkspace = messageWorkspace
      ? mergeConversationWorkspace(currentWorkspace, messageWorkspace)
      : currentWorkspace

    const message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      skills,
      comparison,
      writerMetadata,
      workspaceContext: messageWorkspace ?? undefined,
    }

    set({
      currentWorkspace: nextWorkspace,
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: {
          ...conversation,
          workspace: nextWorkspace,
          messages: [...conversation.messages, message],
          updatedAt: new Date(),
          title: conversation.messages.length === 0 && role === 'user'
            ? generateTitle(content)
            : conversation.title,
        },
      },
    })
  },

  deleteMessage: (messageId: string) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return
    const conversation = conversationsById[currentConversationId]
    if (!conversation) return
    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: {
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== messageId),
          updatedAt: new Date(),
        },
      },
    })
  },

  editMessage: (messageId: string, content: string) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return
    const conversation = conversationsById[currentConversationId]
    if (!conversation) return
    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: {
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === messageId ? { ...message, content, timestamp: new Date() } : message,
          ),
          updatedAt: new Date(),
        },
      },
    })
  },

  getConversationById: (id: string) => {
    return get().conversationsById[id]
  },

  availableSkills: [
    'character-forge',
    'suspense-craft',
    'dialogue-system',
    'tension-arc',
    'opening-craft',
    'ending-craft',
    'emotion-arc',
    'conflict-escalation',
  ],
  selectedSkills: [],
  toggleSkill: (skill: string) => {
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skill)
        ? state.selectedSkills.filter((selected) => selected !== skill)
        : [...state.selectedSkills, skill],
    }))
  },
  refreshAvailableSkills: async () => {
    try {
      const response = await listSkills()
      if (!response.success || !Array.isArray(response.data) || response.data.length === 0) {
        return
      }
      const nextSkills = response.data
        .map((skill) => (typeof skill?.id === 'string' && skill.id.trim() ? skill.id.trim() : ''))
        .filter(Boolean)
      if (nextSkills.length === 0) {
        return
      }
      set((state) => {
        const selectedSkills = state.selectedSkills.filter((skill) => nextSkills.includes(skill))
        return {
          availableSkills: nextSkills,
          selectedSkills,
        }
      })
    } catch {
      // Ignore dynamic fetch failures and keep the static fallback list.
    }
  },

  loadingMap: {},
  startLoading: (id: string) => {
    set((state) => ({ loadingMap: { ...state.loadingMap, [id]: true } }))
  },
  finishLoading: (id: string) => {
    set((state) => ({ loadingMap: { ...state.loadingMap, [id]: false } }))
  },
  isLoading: (id: string) => {
    return get().loadingMap[id] ?? false
  },
}))

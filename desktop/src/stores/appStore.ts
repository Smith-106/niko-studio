import { create } from 'zustand'
import { checkBackendHealth } from '@/api/client'
import { useSettingsStore } from './settingsStore'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  skills?: string[]
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

interface AppState {
  // Backend status
  backendStatus: boolean
  checkBackend: () => Promise<void>

  // Conversations - normalized structure
  conversationsById: Record<string, Conversation>
  allConversationIds: string[]
  currentConversationId: string | null

  // Actions
  createConversation: () => void
  selectConversation: (id: string) => void
  addMessage: (role: 'user' | 'assistant', content: string, skills?: string[]) => void
  getConversationById: (id: string) => Conversation | undefined

  // Skills
  availableSkills: string[]
  selectedSkills: string[]
  toggleSkill: (skill: string) => void

  // Workflow level
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  setWorkflowLevel: (level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5') => void

  // LLM fallback
  allowLlmFallback: boolean
  setAllowLlmFallback: (allow: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Backend status
  backendStatus: false,
  checkBackend: async () => {
    try {
      const healthy = await checkBackendHealth()
      set({ backendStatus: healthy })
    } catch {
      set({ backendStatus: false })
    }
  },

  // Conversations - normalized structure
  conversationsById: {},
  allConversationIds: [],
  currentConversationId: null,

  createConversation: () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    set((state) => ({
      conversationsById: {
        ...state.conversationsById,
        [newConversation.id]: newConversation,
      },
      allConversationIds: [newConversation.id, ...state.allConversationIds],
      currentConversationId: newConversation.id,
    }))
  },

  selectConversation: (id: string) => {
    set({ currentConversationId: id })
  },

  addMessage: (role, content, skills) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    const message: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      skills,
    }

    // Direct update to specific conversation - avoids re-rendering unrelated conversations
    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: {
          ...conversation,
          messages: [...conversation.messages, message],
          updatedAt: new Date(),
          title: conversation.messages.length === 0 && role === 'user'
            ? content.slice(0, 20) + '...'
            : conversation.title,
        },
      },
    })
  },

  getConversationById: (id: string) => {
    return get().conversationsById[id]
  },

  // Skills
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
        ? state.selectedSkills.filter((s) => s !== skill)
        : [...state.selectedSkills, skill],
    }))
  },

  // Workflow level
  workflowLevel: useSettingsStore.getState().settings.defaultWorkflowLevel,
  setWorkflowLevel: (level) => {
    set({ workflowLevel: level })
    useSettingsStore.getState().updateSettings({ defaultWorkflowLevel: level })
  },

  // LLM fallback
  allowLlmFallback: useSettingsStore.getState().settings.allowLlmFallback,
  setAllowLlmFallback: (allow) => {
    set({ allowLlmFallback: allow })
    useSettingsStore.getState().updateSettings({ allowLlmFallback: allow })
  },
}))

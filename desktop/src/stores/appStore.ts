import { create } from 'zustand'
import { checkBackendHealth, listSkills, type WriterMetadata } from '@/api/client'

export interface MessageComparisonItem {
  model: string
  content: string
}

export interface MessageComparison {
  enabled: boolean
  primary: MessageComparisonItem
  control: MessageComparisonItem
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  skills?: string[]
  comparison?: MessageComparison
  writerMetadata?: WriterMetadata
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
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    skills?: string[],
    comparison?: MessageComparison,
    writerMetadata?: WriterMetadata
  ) => void
  getConversationById: (id: string) => Conversation | undefined

  // Skills
  availableSkills: string[]
  selectedSkills: string[]
  toggleSkill: (skill: string) => void
  refreshAvailableSkills: () => Promise<void>
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

  addMessage: (role, content, skills, comparison, writerMetadata) => {
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
      comparison,
      writerMetadata,
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
      // 忽略动态拉取失败，保留静态兜底列表
    }
  },
}))

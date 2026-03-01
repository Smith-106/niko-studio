import { create } from 'zustand'
import { checkBackendHealth, listSkills } from '@/api/client'
import type { ChatResponse, StreamDonePayload, StreamTerminal } from '@/api/client'
import { useSettingsStore } from './settingsStore'

export interface MessageComparisonItem {
  model: string
  content: string
}

export interface MessageComparison {
  enabled: boolean
  primary: MessageComparisonItem
  control: MessageComparisonItem
}

export interface MessageDiagnostics {
  fallback_reason?: string | null
  failure_reason?: string | null
  error_type?: string | null
}

export interface MessageRuntimeMeta {
  terminal?: StreamTerminal
  decision?: StreamDonePayload['decision']
  diagnostics?: MessageDiagnostics
  latencyMs?: number
  routeModel?: string
  controlModel?: string
  degraded?: boolean
}

export interface MessageWorkflowMeta {
  level?: string
  levelSlug?: string
  stepsCompleted?: number
  totalSteps?: number
}

export interface MessageKnowledgeMeta {
  entitiesCount?: number
  relationsCount?: number
  memoriesCount?: number
}

export interface MessageMetadata {
  runtime?: MessageRuntimeMeta
  workflow?: MessageWorkflowMeta
  knowledge?: MessageKnowledgeMeta
  writerWarnings?: string[]
  evaluationScore?: number
  evaluationFeedback?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  skills?: string[]
  comparison?: MessageComparison
  metadata?: MessageMetadata
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
  addMessage: (role: 'user' | 'assistant', content: string, skills?: string[], comparison?: MessageComparison, metadata?: MessageMetadata) => void
  patchMessageMetadata: (messageId: string, metadataPatch: MessageMetadata) => void
  getConversationById: (id: string) => Conversation | undefined

  // Skills
  availableSkills: string[]
  selectedSkills: string[]
  toggleSkill: (skill: string) => void
  refreshAvailableSkills: () => Promise<void>

  // Workflow level
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  setWorkflowLevel: (level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5') => void

  // LLM fallback
  allowLlmFallback: boolean
  setAllowLlmFallback: (allow: boolean) => void
}

const mergeMessageMetadata = (prev: MessageMetadata | undefined, patch: MessageMetadata): MessageMetadata => {
  return {
    ...prev,
    ...patch,
    runtime: {
      ...prev?.runtime,
      ...patch.runtime,
      diagnostics: {
        ...prev?.runtime?.diagnostics,
        ...patch.runtime?.diagnostics,
      },
    },
    workflow: {
      ...prev?.workflow,
      ...patch.workflow,
    },
    knowledge: {
      ...prev?.knowledge,
      ...patch.knowledge,
    },
  }
}

export const extractMessageMetadata = (payload?: Partial<ChatResponse> | null): MessageMetadata | undefined => {
  if (!payload) return undefined

  const writerMetadata = payload.writer_metadata
  const knowledgeRetrieved = writerMetadata?.knowledge_retrieved as
    | { entities_count?: number; relations_count?: number; memories_count?: number }
    | undefined

  const metadata: MessageMetadata = {
    writerWarnings: Array.isArray(writerMetadata?.warnings)
      ? writerMetadata?.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
      : undefined,
    workflow: payload.workflow_info
      ? {
          level: payload.workflow_info.level,
          levelSlug: payload.workflow_info.level_slug,
          stepsCompleted: payload.workflow_info.steps_completed,
          totalSteps: payload.workflow_info.total_steps,
        }
      : undefined,
    evaluationScore: payload.evaluation?.score,
    evaluationFeedback: payload.evaluation?.feedback,
    knowledge: knowledgeRetrieved
      ? {
          entitiesCount: knowledgeRetrieved.entities_count,
          relationsCount: knowledgeRetrieved.relations_count,
          memoriesCount: knowledgeRetrieved.memories_count,
        }
      : undefined,
  }

  if (!metadata.writerWarnings?.length) {
    delete metadata.writerWarnings
  }

  if (!metadata.workflow || Object.values(metadata.workflow).every((value) => value == null)) {
    delete metadata.workflow
  }

  if (!metadata.knowledge || Object.values(metadata.knowledge).every((value) => value == null)) {
    delete metadata.knowledge
  }

  if (metadata.evaluationScore == null) {
    delete metadata.evaluationScore
  }

  if (!metadata.evaluationFeedback) {
    delete metadata.evaluationFeedback
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined
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

  addMessage: (role, content, skills, comparison, metadata) => {
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
      metadata,
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

  patchMessageMetadata: (messageId, metadataPatch) => {
    const { currentConversationId, conversationsById } = get()
    if (!currentConversationId) return

    const conversation = conversationsById[currentConversationId]
    if (!conversation) return

    const messageIndex = conversation.messages.findIndex((message) => message.id === messageId)
    if (messageIndex < 0) return

    const targetMessage = conversation.messages[messageIndex]
    const nextMessages = [...conversation.messages]
    nextMessages[messageIndex] = {
      ...targetMessage,
      metadata: mergeMessageMetadata(targetMessage.metadata, metadataPatch),
    }

    set({
      conversationsById: {
        ...conversationsById,
        [currentConversationId]: {
          ...conversation,
          messages: nextMessages,
          updatedAt: new Date(),
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


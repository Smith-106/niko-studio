import { useAppStore, Conversation, Message, type AppState } from './appStore'
import { useSettingsStore } from './settingsStore'
import { useShallow } from 'zustand/react/shallow'

export type EvaluationSourceKind = 'latestAssistantReply' | 'editorSelection' | 'currentDraft'

export interface EvaluationSourceDescriptor {
  kind: EvaluationSourceKind
  label: string
  content: string
}

/**
 * Selector for current conversation ID only
 * Re-renders only when currentConversationId changes
 */
export function useCurrentConversationId(): string | null {
  return useAppStore((state) => state.currentConversationId)
}

/**
 * Selector for current conversation object
 * Re-renders only when the current conversation changes
 */
export function useCurrentConversation(): Conversation | undefined {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return undefined
    return conversationsById[currentConversationId]
  })
}

/**
 * Selector for messages of current conversation
 * Re-renders only when messages array reference changes
 */
export function useMessages(): Message[] {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return []
    return conversationsById[currentConversationId]?.messages || []
  })
}

/**
 * Selector for latest assistant message content
 */
export function useLatestAssistantMessageContent(): string {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return ''

    const messages = conversationsById[currentConversationId]?.messages || []
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'assistant') {
        return messages[index]?.content || ''
      }
    }

    return ''
  })
}

/**
 * Selector for conversation list (for sidebar)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useConversationList(): Conversation[] {
  return useAppStore(
    useShallow(
      (state) => state.allConversationIds.map((id) => state.conversationsById[id]).filter(Boolean) as Conversation[]
    )
  )
}

/**
 * Selector for workflow level
 */
export function useWorkflowLevel(): 'L1' | 'L2' | 'L3' | 'L4' | 'L5' {
  return useSettingsStore((state) => state.settings.defaultWorkflowLevel)
}

/**
 * Selector for LLM fallback toggle
 */
export function useAllowLlmFallback(): boolean {
  return useSettingsStore((state) => state.settings.allowLlmFallback)
}

/**
 * Selector for quality goals
 */
export function useQualityGoals() {
  return useSettingsStore((state) => state.settings.qualityGoals)
}

/**
 * Selector for selected skills
 * Uses shallow comparison for array
 */
export function useSelectedSkills(): string[] {
  return useAppStore(useShallow((state) => state.selectedSkills))
}

export function useAvailableSkills(): string[] {
  return useAppStore(useShallow((state) => state.availableSkills))
}

export function useCreateConversation(): AppState['createConversation'] {
  return useAppStore((state) => state.createConversation)
}

export function useAddMessage(): AppState['addMessage'] {
  return useAppStore((state) => state.addMessage)
}

export function useSelectConversation(): AppState['selectConversation'] {
  return useAppStore((state) => state.selectConversation)
}

export function useCheckBackend(): AppState['checkBackend'] {
  return useAppStore((state) => state.checkBackend)
}

export function useBackendStatus(): AppState['backendStatus'] {
  return useAppStore((state) => state.backendStatus)
}

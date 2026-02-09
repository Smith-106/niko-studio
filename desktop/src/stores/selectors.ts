import { useAppStore, Conversation, Message } from './appStore'
import { shallow } from 'zustand/shallow'

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
 * Selector for conversation list (for sidebar)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useConversationList(): Conversation[] {
  return useAppStore(
    (state) => state.allConversationIds.map((id) => state.conversationsById[id]).filter(Boolean) as Conversation[],
    shallow
  )
}

/**
 * Selector for workflow level
 */
export function useWorkflowLevel(): 'L1' | 'L2' | 'L3' | 'L4' | 'L5' {
  return useAppStore((state) => state.workflowLevel)
}

/**
 * Selector for LLM fallback toggle
 */
export function useAllowLlmFallback(): boolean {
  return useAppStore((state) => state.allowLlmFallback)
}

/**
 * Selector for selected skills
 * Uses shallow comparison for array
 */
export function useSelectedSkills(): string[] {
  return useAppStore((state) => state.selectedSkills, shallow)
}

/**
 * Selector for backend status
 */
export function useBackendStatus(): boolean {
  return useAppStore((state) => state.backendStatus)
}

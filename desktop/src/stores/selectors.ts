import { useAppStore, Conversation, Message } from './appStore'
import { shallow } from 'zustand/shallow'

export interface ConversationHealthSummary {
  state: 'idle' | 'healthy' | 'degraded' | 'error'
  terminal?: 'done' | 'error' | 'interrupted' | 'recovered'
  decision?: 'go' | 'soft_go' | 'no_go'
  warningCount: number
  latestIssue?: string
}

export interface ConversationPerformanceSummary {
  assistantCount: number
  avgLatencyMs?: number
  lastLatencyMs?: number
  degradedCount: number
}

export interface ConversationSummary {
  latestAssistantDiagnostics?: {
    terminal?: 'done' | 'error' | 'interrupted' | 'recovered'
    decision?: 'go' | 'soft_go' | 'no_go'
    diagnostics?: {
      fallback_reason?: string | null
      failure_reason?: string | null
      error_type?: string | null
    }
  }
  health: ConversationHealthSummary
  performance: ConversationPerformanceSummary
}

export interface ConversationListItem {
  conversation: Conversation
  summary: ConversationSummary
}

const emptySummary: ConversationSummary = {
  health: {
    state: 'idle',
    warningCount: 0,
  },
  performance: {
    assistantCount: 0,
    degradedCount: 0,
  },
}

const normalizeLatency = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined
  return Math.round(value)
}

export function buildConversationSummary(conversation?: Conversation): ConversationSummary {
  if (!conversation || conversation.messages.length === 0) return emptySummary

  const assistantMessages = conversation.messages.filter((message) => message.role === 'assistant')
  if (assistantMessages.length === 0) {
    return {
      ...emptySummary,
      performance: {
        ...emptySummary.performance,
        assistantCount: 0,
      },
    }
  }

  const latestAssistant = assistantMessages[assistantMessages.length - 1]
  const latestRuntime = latestAssistant.metadata?.runtime
  const latestDiagnostics = {
    terminal: latestRuntime?.terminal,
    decision: latestRuntime?.decision,
    diagnostics: latestRuntime?.diagnostics,
  }

  const latencies = assistantMessages
    .map((message) => normalizeLatency(message.metadata?.runtime?.latencyMs))
    .filter((latency): latency is number => typeof latency === 'number')

  const avgLatencyMs = latencies.length > 0
    ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
    : undefined

  const degradedCount = assistantMessages.filter((message) => {
    const runtime = message.metadata?.runtime
    return runtime?.degraded || runtime?.decision === 'soft_go' || runtime?.decision === 'no_go'
  }).length

  const warningCount = assistantMessages.reduce(
    (sum, message) => sum + (message.metadata?.writerWarnings?.length ?? 0),
    0
  )

  const latestIssueValue = latestRuntime?.diagnostics?.failure_reason
    || latestRuntime?.diagnostics?.fallback_reason
    || latestRuntime?.diagnostics?.error_type
  const latestIssue = latestIssueValue ?? undefined

  const healthState: ConversationHealthSummary['state'] =
    latestRuntime?.terminal === 'error' || latestRuntime?.terminal === 'interrupted'
      ? 'error'
      : latestRuntime?.decision === 'no_go'
        ? 'error'
        : latestRuntime?.decision === 'soft_go' || degradedCount > 0
          ? 'degraded'
          : 'healthy'

  return {
    latestAssistantDiagnostics: latestDiagnostics,
    health: {
      state: healthState,
      terminal: latestRuntime?.terminal,
      decision: latestRuntime?.decision,
      warningCount,
      latestIssue,
    },
    performance: {
      assistantCount: assistantMessages.length,
      avgLatencyMs,
      lastLatencyMs: normalizeLatency(latestRuntime?.latencyMs),
      degradedCount,
    },
  }
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
 * Selector for conversation list (for sidebar)
 * Uses shallow comparison to prevent unnecessary re-renders
 */
export function useConversationList(): Conversation[] {
  return useAppStore(
    (state) => state.allConversationIds.map((id) => state.conversationsById[id]).filter(Boolean) as Conversation[],
    shallow
  )
}

export function useConversationListItems(): ConversationListItem[] {
  return useAppStore(
    (state) => state.allConversationIds
      .map((id) => state.conversationsById[id])
      .filter(Boolean)
      .map((conversation) => ({
        conversation,
        summary: buildConversationSummary(conversation),
      })) as ConversationListItem[],
    shallow
  )
}

export function useCurrentConversationSummary(): ConversationSummary {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return emptySummary
    return buildConversationSummary(conversationsById[currentConversationId])
  }, shallow)
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

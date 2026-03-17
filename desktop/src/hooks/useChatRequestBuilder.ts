import { useCallback } from 'react'
import type { ChatRequest } from '../api/client'
import type { QualityGoalsSettings, RetrievalSettings } from '../stores/settingsStore'

const DEFAULT_HISTORY_BUDGET_CHARS = 96_000
const DEFAULT_MAX_MESSAGE_CHARS = 24_000

const approxTokensFromChars = (chars: number): number => Math.ceil(chars / 4)

type ChatMessage = NonNullable<ChatRequest['messages']>[number]

interface BudgetResult {
  messages: ChatMessage[]
  meta: {
    usedChars: number
    usedTokensApprox: number
    droppedCount: number
    clippedCount: number
    totalOriginalMessages: number
  }
}

const clipMessageContent = (content: string, maxChars: number): { content: string; clipped: boolean } => {
  if (content.length <= maxChars) return { content, clipped: false }

  const headChars = Math.max(0, Math.floor(maxChars * 0.7))
  const tailChars = Math.max(0, maxChars - headChars)

  const head = content.slice(0, headChars).trimEnd()
  const tail = tailChars > 0 ? content.slice(-tailChars).trimStart() : ''

  return {
    content: `${head}\n\n[...truncated by client to fit context budget...]\n\n${tail}`.trim(),
    clipped: true,
  }
}

const applyHistoryBudget = (
  baseMessages: ChatMessage[],
  nextUserMessage: ChatMessage,
  config?: {
    maxTotalChars?: number
    maxMessageChars?: number
    keepRecentMessages?: number
  }
): BudgetResult => {
  const maxTotalChars = config?.maxTotalChars ?? DEFAULT_HISTORY_BUDGET_CHARS
  const maxMessageChars = config?.maxMessageChars ?? DEFAULT_MAX_MESSAGE_CHARS
  const keepRecentMessages = config?.keepRecentMessages ?? 16

  const originalMessages = [...baseMessages, nextUserMessage]

  let droppedCount = 0
  let clippedCount = 0

  const clipped = originalMessages.map((msg) => {
    const { content, clipped } = clipMessageContent(msg.content, maxMessageChars)
    if (clipped) clippedCount += 1
    return { ...msg, content }
  })

  const systemMessages = clipped.filter((m) => m.role === 'system')
  const nonSystem = clipped.filter((m) => m.role !== 'system')
  const recentNonSystem = nonSystem.slice(-keepRecentMessages)

  const selected: ChatMessage[] = [...systemMessages, ...recentNonSystem]

  const countChars = (messages: ChatMessage[]) => messages.reduce((sum, m) => sum + m.content.length, 0)

  let usedChars = countChars(selected)

  while (selected.length > 1 && usedChars > maxTotalChars) {
    const firstNonSystemIdx = selected.findIndex((m) => m.role !== 'system')
    if (firstNonSystemIdx === -1) break
    selected.splice(firstNonSystemIdx, 1)
    droppedCount += 1
    usedChars = countChars(selected)
  }

  return {
    messages: selected,
    meta: {
      usedChars,
      usedTokensApprox: approxTokensFromChars(usedChars),
      droppedCount,
      clippedCount,
      totalOriginalMessages: originalMessages.length,
    },
  }
}

interface UseChatRequestBuilderOptions {
  allowLlmFallback: boolean
  qualityGoals: QualityGoalsSettings
  retrieval: RetrievalSettings
}

interface BuildChatRequestInput {
  userMessage: string
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  selectedSkills: string[]
  enableModelComparison: boolean
  comparisonModel: string
  messages?: ChatRequest['messages']
}

export function useChatRequestBuilder(options: UseChatRequestBuilderOptions) {
  const buildChatRequest = useCallback((input: BuildChatRequestInput): ChatRequest => {
    const baseMessages = input.messages ?? []
    const nextUserMessage = { role: 'user', content: input.userMessage } as const

    const budgeted = applyHistoryBudget(baseMessages, nextUserMessage)

    const request: ChatRequest = {
      messages: budgeted.messages,
      workflowLevel: input.workflowLevel,
      skills: input.selectedSkills,
      allowLlmFallback: options.allowLlmFallback,
      qualityGoals: {
        naturalness: options.qualityGoals.naturalness,
        readability: options.qualityGoals.readability,
        coherence: options.qualityGoals.coherence,
        style_consistency: options.qualityGoals.styleConsistency,
        humanization_preset: options.qualityGoals.humanizationPreset,
        custom_humanization_instruction: options.qualityGoals.customHumanizationInstruction,
        sentence_entropy_target: options.qualityGoals.sentenceEntropyTarget,
        rhythm_variability_target: options.qualityGoals.rhythmVariabilityTarget,
      },
      knowledge_retrieval: options.retrieval.enabled,
      search_mode: options.retrieval.searchMode,
      profile: options.retrieval.profile || undefined,
      min_score: options.retrieval.minScore,
      budget_tokens: options.retrieval.budgetTokens,
      rerank: options.retrieval.rerank,
      max_iterations: options.retrieval.maxIterations,
      confidence_threshold: options.retrieval.confidenceThreshold,
    }

    if (input.enableModelComparison && input.comparisonModel) {
      request.comparison = {
        enabled: true,
        controlModel: input.comparisonModel,
      }
    }

    return request
  }, [options.allowLlmFallback, options.qualityGoals, options.retrieval])

  return { buildChatRequest }
}

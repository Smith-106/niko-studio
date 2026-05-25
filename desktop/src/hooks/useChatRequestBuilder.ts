import { useCallback } from 'react'

import type { ChatRequest } from '../api/client'
import type { ProjectWorkspaceContext } from '@/types/workspace'
import type { QualityGoalsSettings, RetrievalSettings } from '../stores/settingsStore'

const DEFAULT_HISTORY_BUDGET_CHARS = 96_000
const DEFAULT_MAX_MESSAGE_CHARS = 24_000

// 旧消息截断：超过此距离的消息只保留前 TRUNCATED_CONTENT_CHARS 字符
const TRUNCATION_THRESHOLD = 10
const TRUNCATED_CONTENT_CHARS = 200

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

// 旧消息截断：距离末尾超过阈值的消息，内容截断到 TRUNCATED_CONTENT_CHARS 字符
// 服务端仍持有完整历史，截断仅减少网络传输量
const truncateOldMessages = (messages: ChatMessage[]): ChatMessage[] => {
  if (messages.length <= TRUNCATION_THRESHOLD) return messages

  return messages.map((msg, i) => {
    const distanceFromEnd = messages.length - 1 - i
    if (distanceFromEnd >= TRUNCATION_THRESHOLD && msg.content.length > TRUNCATED_CONTENT_CHARS) {
      return { ...msg, content: msg.content.slice(0, TRUNCATED_CONTENT_CHARS) + '...' }
    }
    return msg
  })
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

  // 先截断旧消息，减少后续处理和传输量
  const truncated = truncateOldMessages(originalMessages)

  let droppedCount = 0
  let clippedCount = 0

  const clipped = truncated.map((msg) => {
    const { content, clipped } = clipMessageContent(msg.content, maxMessageChars)
    if (clipped) clippedCount += 1
    return { ...msg, content }
  })

  const recent = clipped.slice(-Math.max(1, keepRecentMessages))

  const selected: ChatMessage[] = [...recent]

  const countChars = (messages: ChatMessage[]) => messages.reduce((sum, m) => sum + m.content.length, 0)

  let usedChars = countChars(selected)

    while (selected.length > 1 && usedChars > maxTotalChars) {
      selected.shift()
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
  workspace?: ProjectWorkspaceContext | null
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

    if (options.workspace) {
      request.workspace = options.workspace
    }

    return request
  }, [options.allowLlmFallback, options.qualityGoals, options.retrieval, options.workspace])

  return { buildChatRequest }
}

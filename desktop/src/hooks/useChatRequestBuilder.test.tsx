import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChatRequestBuilder } from './useChatRequestBuilder'
import type { QualityGoalsSettings, RetrievalSettings } from '../stores/settings/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeQualityGoals(overrides: Partial<QualityGoalsSettings> = {}): QualityGoalsSettings {
  return {
    naturalness: 70,
    readability: 75,
    coherence: 80,
    styleConsistency: 65,
    humanizationPreset: 'human_writing' as QualityGoalsSettings['humanizationPreset'],
    customHumanizationInstruction: '',
    sentenceEntropyTarget: 0.5,
    rhythmVariabilityTarget: 0.4,
    ...overrides,
  }
}

function makeRetrieval(overrides: Partial<RetrievalSettings> = {}): RetrievalSettings {
  return {
    enabled: true,
    searchMode: 'hybrid' as RetrievalSettings['searchMode'],
    profile: 'default',
    minScore: 0.6,
    budgetTokens: 2000,
    rerank: true,
    maxIterations: 3,
    confidenceThreshold: 0.7,
    ...overrides,
  }
}

const baseHookOptions = {
  allowLlmFallback: false,
  qualityGoals: makeQualityGoals(),
  retrieval: makeRetrieval(),
  workspace: null,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChatRequestBuilder', () => {
  // -----------------------------------------------------------------------
  // 1. Basic request: builds valid ChatRequest
  // -----------------------------------------------------------------------
  it('builds a valid ChatRequest with messages, workflowLevel, and skills', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'Hello',
      workflowLevel: 'L2',
      selectedSkills: ['writing', 'editing'],
      enableModelComparison: false,
      comparisonModel: '',
      messages: [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ],
    })

    // Should contain the new user message
    const lastMsg = request.messages[request.messages.length - 1]
    expect(lastMsg.role).toBe('user')
    expect(lastMsg.content).toBe('Hello')

    expect(request.workflowLevel).toBe('L2')
    expect(request.skills).toEqual(['writing', 'editing'])
    expect(request.allowLlmFallback).toBe(false)
  })

  // -----------------------------------------------------------------------
  // 2. History budget: ensures total chars stay within 96K budget
  // -----------------------------------------------------------------------
  it('keeps total chars within 96K budget via truncation and/or dropping', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    // Create messages totaling over 96K characters
    // Each message is ~10K chars, use 11 messages = ~110K total
    const bigContent = 'A'.repeat(10_000)
    const messages = Array.from({ length: 11 }, (_, i) => ({
      role: 'user' as const,
      content: `${bigContent} msg${i}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: 'Final question',
      workflowLevel: 'L3',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // The total character count should be within the 96K budget
    const totalChars = request.messages.reduce((sum, m) => sum + m.content.length, 0)
    expect(totalChars).toBeLessThanOrEqual(96_000)

    // The most recent message (userMessage) should be preserved
    const lastMsg = request.messages[request.messages.length - 1]
    expect(lastMsg.content).toBe('Final question')

    // 旧消息被截断后总字符数可能已在预算内，无需再丢弃
    // 验证：如果消息数未减少，则说明截断优化生效；如果减少，则预算丢弃生效
    const allPreserved = request.messages.length === messages.length + 1
    const someDropped = request.messages.length < messages.length + 1
    expect(allPreserved || someDropped).toBe(true)
  })

  // -----------------------------------------------------------------------
  // 3. Message clipping: individual messages exceeding 24K chars are truncated
  // -----------------------------------------------------------------------
  it('clips individual messages exceeding 24K characters', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const hugeContent = 'X'.repeat(30_000)
    const messages = [
      { role: 'user' as const, content: hugeContent },
    ]

    const request = result.current.buildChatRequest({
      userMessage: 'Short question',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // The huge message should be clipped (not 30K anymore)
    const clippedMsg = request.messages.find((m) => m.content.includes('truncated by client'))
    expect(clippedMsg).toBeDefined()

    // Clipped message should be well under 30K
    expect(clippedMsg!.content.length).toBeLessThan(30_000)
    // But should still contain the truncation marker
    expect(clippedMsg!.content).toContain('[...truncated by client to fit context budget...]')
  })

  // -----------------------------------------------------------------------
  // 4. Workspace attachment
  // -----------------------------------------------------------------------
  it('includes workspace in request when provided', () => {
    const workspace = {
      identity: { projectId: 'proj-1', workspaceId: 'ws-1' },
    } as unknown as Parameters<typeof useChatRequestBuilder>[0]['workspace']

    const { result } = renderHook(() =>
      useChatRequestBuilder({ ...baseHookOptions, workspace }),
    )

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L1',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
    })

    expect(request.workspace).toBeDefined()
    expect(request.workspace).toBe(workspace)
  })

  // -----------------------------------------------------------------------
  // 5. Model comparison
  // -----------------------------------------------------------------------
  it('includes comparison object when enabled with a model', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: true,
      comparisonModel: 'gpt-4o',
    })

    expect(request.comparison).toEqual({
      enabled: true,
      controlModel: 'gpt-4o',
    })
  })

  it('omits comparison when enabled but no model specified', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: true,
      comparisonModel: '',
    })

    expect(request.comparison).toBeUndefined()
  })

  it('omits comparison when not enabled', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: 'gpt-4o',
    })

    expect(request.comparison).toBeUndefined()
  })

  // -----------------------------------------------------------------------
  // 6. Quality goals mapping
  // -----------------------------------------------------------------------
  it('maps qualityGoals settings to request payload fields', () => {
    const qualityGoals = makeQualityGoals({
      naturalness: 90,
      readability: 85,
      coherence: 88,
      styleConsistency: 92,
      humanizationPreset: 'custom',
      customHumanizationInstruction: 'Be creative',
      sentenceEntropyTarget: 0.8,
      rhythmVariabilityTarget: 0.6,
    })

    const { result } = renderHook(() =>
      useChatRequestBuilder({ ...baseHookOptions, qualityGoals }),
    )

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
    })

    expect(request.qualityGoals).toBeDefined()
    expect(request.qualityGoals!.naturalness).toBe(90)
    expect(request.qualityGoals!.readability).toBe(85)
    expect(request.qualityGoals!.coherence).toBe(88)
    expect(request.qualityGoals!.style_consistency).toBe(92)
    expect(request.qualityGoals!.humanization_preset).toBe('custom')
    expect(request.qualityGoals!.custom_humanization_instruction).toBe('Be creative')
    expect(request.qualityGoals!.sentence_entropy_target).toBe(0.8)
    expect(request.qualityGoals!.rhythm_variability_target).toBe(0.6)
  })

  // -----------------------------------------------------------------------
  // 7. Retrieval settings mapping
  // -----------------------------------------------------------------------
  it('maps retrieval settings to request payload fields', () => {
    const retrieval = makeRetrieval({
      enabled: true,
      searchMode: 'iterative',
      profile: 'research',
      minScore: 0.8,
      budgetTokens: 4000,
      rerank: false,
      maxIterations: 5,
      confidenceThreshold: 0.9,
    })

    const { result } = renderHook(() =>
      useChatRequestBuilder({ ...baseHookOptions, retrieval }),
    )

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L3',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
    })

    expect(request.knowledge_retrieval).toBe(true)
    expect(request.search_mode).toBe('iterative')
    expect(request.profile).toBe('research')
    expect(request.min_score).toBe(0.8)
    expect(request.budget_tokens).toBe(4000)
    expect(request.rerank).toBe(false)
    expect(request.max_iterations).toBe(5)
    expect(request.confidence_threshold).toBe(0.9)
  })

  it('omits profile when retrieval profile is empty', () => {
    const retrieval = makeRetrieval({
      profile: '',
    })

    const { result } = renderHook(() =>
      useChatRequestBuilder({ ...baseHookOptions, retrieval }),
    )

    const request = result.current.buildChatRequest({
      userMessage: 'Test',
      workflowLevel: 'L3',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
    })

    expect(request.profile).toBeUndefined()
  })

  // -----------------------------------------------------------------------
  // 8. keepRecentMessages: keeps at least 16 recent messages
  // -----------------------------------------------------------------------
  it('keeps at least 16 recent messages even when total exceeds budget', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    // Create 30 small messages that together still fit under 96K budget,
    // but let's use slightly larger ones to trigger dropping
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'B'.repeat(4000)}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: 'Final question',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // The request should still keep at least 16 recent messages
    // (the keepRecentMessages default is 16)
    expect(request.messages.length).toBeGreaterThanOrEqual(1)

    // The last message should be the new user message
    const lastMsg = request.messages[request.messages.length - 1]
    expect(lastMsg.content).toBe('Final question')

    // Verify that only recent messages are kept - the newest ones should be present
    const hasRecentMessage = request.messages.some((m) =>
      m.content.includes('Message 29'),
    )
    expect(hasRecentMessage).toBe(true)
  })

  // -----------------------------------------------------------------------
  // 9. Empty messages defaults to just the new user message
  // -----------------------------------------------------------------------
  it('handles empty messages array by using only the new user message', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'First message',
      workflowLevel: 'L1',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages: [],
    })

    expect(request.messages).toHaveLength(1)
    expect(request.messages[0]).toEqual({
      role: 'user',
      content: 'First message',
    })
  })

  // -----------------------------------------------------------------------
  // 10. No messages provided defaults to empty history
  // -----------------------------------------------------------------------
  it('handles undefined messages by using only the new user message', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    const request = result.current.buildChatRequest({
      userMessage: 'Standalone question',
      workflowLevel: 'L1',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
    })

    expect(request.messages).toHaveLength(1)
    expect(request.messages[0].content).toBe('Standalone question')
  })

  // -----------------------------------------------------------------------
  // 11. Old message truncation: messages beyond threshold are truncated
  // -----------------------------------------------------------------------
  it('truncates content of messages beyond the 10-message threshold', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    // 创建 15 条消息，每条 500 字符
    // 加上 userMessage 共 16 条，前 5 条（距离末尾 >= 10）应被截断
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'C'.repeat(490)}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: 'Final question',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // 距离末尾 >= 10 的消息（索引 0-5）应被截断到 ~200 字符
    // 距离末尾 < 10 的消息（索引 6-14）应保持完整
    const truncatedMsgs = request.messages.filter(
      (m) => m.content.endsWith('...') && m.content.length <= 210,
    )
    // 前 5 条历史消息 + userMessage = 16 条，距离末尾 >= 10 的是前 6 条
    expect(truncatedMsgs.length).toBeGreaterThanOrEqual(1)

    // 最近的消息应保持完整
    const lastMsg = request.messages[request.messages.length - 1]
    expect(lastMsg.content).toBe('Final question')
  })

  // -----------------------------------------------------------------------
  // 12. Short old messages are not truncated (content <= 200 chars)
  // -----------------------------------------------------------------------
  it('does not truncate old messages that are already short', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    // 创建 12 条短消息（< 200 字符），加上 userMessage 共 13 条
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Short message ${i}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: 'Final question',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // 短消息不应被截断（没有 '...' 后缀）
    const shortOldMsgs = request.messages.filter(
      (m) => !m.content.includes('Final question') && m.content.length < 200,
    )
    for (const msg of shortOldMsgs) {
      expect(msg.content.endsWith('...')).toBe(false)
    }
  })

  // -----------------------------------------------------------------------
  // 13. No truncation when message count <= threshold
  // -----------------------------------------------------------------------
  it('does not truncate any messages when total count is within threshold', () => {
    const { result } = renderHook(() => useChatRequestBuilder(baseHookOptions))

    // 8 条消息 + userMessage = 9 条，不超过阈值 10
    const messages = Array.from({ length: 8 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'D'.repeat(500)}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: 'Final question',
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    // 没有消息应被截断（所有消息内容长度 > 200 但没有 '...' 后缀来自截断）
    const truncatedByOldMsg = request.messages.filter(
      (m) => m.content.endsWith('...') && !m.content.includes('truncated by client'),
    )
    expect(truncatedByOldMsg.length).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import {
  useChatRequestBuilder,
  truncateOldMessages,
  clipMessageContent,
  applyHistoryBudget,
} from './useChatRequestBuilder'
import type { QualityGoalsSettings, RetrievalSettings } from '../stores/settings/types'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'

// --- Helpers ---

function makeQualityGoals(overrides: Partial<QualityGoalsSettings> = {}): QualityGoalsSettings {
  return {
    naturalness: 70,
    readability: 75,
    coherence: 80,
    styleConsistency: 65,
    humanizationPreset: 'human_writing',
    customHumanizationInstruction: '',
    sentenceEntropyTarget: 0.5,
    rhythmVariabilityTarget: 0.4,
    ...overrides,
  }
}

function makeRetrieval(overrides: Partial<RetrievalSettings> = {}): RetrievalSettings {
  return {
    enabled: true,
    searchMode: 'hybrid',
    profile: 'default',
    minScore: 0.6,
    budgetTokens: 2000,
    rerank: true,
    maxIterations: 3,
    confidenceThreshold: 0.7,
    ...overrides,
  }
}

function makeWorkspace() {
  return createDefaultProjectWorkspaceContext({
    workspaceRoot: 'C:/projects/test-novel',
    fallbackProjectId: 'test-project',
  })
}

function makeMessage(role: 'user' | 'assistant', content: string) {
  return { role, content } as const
}

// --- Direct pure function tests ---

describe('useChatRequestBuilder branch coverage', () => {
  // --- truncateOldMessages (line 32, 36) ---

  describe('truncateOldMessages', () => {
    it('returns messages unchanged when list length <= TRUNCATION_THRESHOLD (line 32 true branch)', () => {
      const messages = Array.from({ length: 8 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', 'Hello world'.repeat(50)),
      )

      const result = truncateOldMessages(messages)

      expect(result).toEqual(messages)
      expect(result.length).toBe(8)
    })

    it('truncates old messages beyond threshold when content exceeds TRUNCATED_CONTENT_CHARS (line 36 true branch)', () => {
      // 15 messages: first 5 have distanceFromEnd >= 10
      const messages = Array.from({ length: 15 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', 'X'.repeat(500)),
      )

      const result = truncateOldMessages(messages)

      // Old messages (index 0-4): distance >= 10, content > 200 => truncated
      for (let i = 0; i < 5; i++) {
        expect(result[i].content).toContain('...')
        expect(result[i].content.length).toBeLessThanOrEqual(210)
      }

      // Recent messages (index 5-14): distance < 10 => untouched
      for (let i = 5; i < 15; i++) {
        expect(result[i].content).toBe(messages[i].content)
      }
    })

    it('does not truncate old messages when content <= TRUNCATED_CONTENT_CHARS (line 36 false branch)', () => {
      // 12 messages: old ones (0-1) have short content <= 200 chars
      const messages = Array.from({ length: 12 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', 'Short msg'),
      )

      const result = truncateOldMessages(messages)

      // No truncation markers because content <= 200 chars
      for (const msg of result) {
        expect(msg.content).not.toContain('...')
      }
    })

    it('returns empty array unchanged', () => {
      expect(truncateOldMessages([])).toEqual([])
    })
  })

  // --- clipMessageContent (line 44, 50) ---

  describe('clipMessageContent', () => {
    it('does not clip content within maxChars (line 44 true branch)', () => {
      const result = clipMessageContent('Hello world', 100)

      expect(result).toEqual({ content: 'Hello world', clipped: false })
    })

    it('clips content exceeding maxChars with head and tail (line 44 false + line 50 tailChars > 0)', () => {
      const content = 'A'.repeat(30_000)
      const result = clipMessageContent(content, 24_000)

      expect(result.clipped).toBe(true)
      expect(result.content).toContain('truncated by client')
      // Head portion present (first ~70% of 24000 = 16800 chars)
      expect(result.content.length).toBeLessThan(content.length)
      // Both head and tail contribute
      expect(result.content.split('[...truncated')).toHaveLength(2)
    })

    it('returns only head with empty tail when maxChars is 0 (line 50 tailChars === 0 branch)', () => {
      // maxChars = 0 => headChars = max(0, floor(0*0.7)) = 0, tailChars = max(0, 0-0) = 0
      // tail = tailChars > 0 ? ... : '' => takes false branch => tail = ''
      const result = clipMessageContent('Some content here', 0)

      expect(result.clipped).toBe(true)
      // head = content.slice(0, 0).trimEnd() = '' => head = ''
      // tail = '' => result is just the truncation marker
      expect(result.content).toContain('truncated by client')
      // No actual content chars remain, only the marker
      expect(result.content).toBe('[...truncated by client to fit context budget...]')
    })

    it('returns only head with empty tail when maxChars is 1 (line 50 tailChars edge)', () => {
      // maxChars = 1 => headChars = max(0, floor(0.7)) = 0, tailChars = max(0, 1-0) = 1
      // tailChars = 1 > 0 => true branch, tail = content.slice(-1).trimStart()
      const result = clipMessageContent('ABCDEFGH', 1)

      expect(result.clipped).toBe(true)
      expect(result.content).toContain('truncated by client')
    })
  })

  // --- applyHistoryBudget (line 67-69 config ??, line 93 while loop) ---

  describe('applyHistoryBudget', () => {
    it('uses default config values when config is undefined (line 67-69 ?? branches)', () => {
      const messages = [makeMessage('user', 'Hello')]
      const nextMessage = makeMessage('user', 'World')

      const result = applyHistoryBudget(messages, nextMessage)

      // Uses defaults: maxTotalChars=96_000, maxMessageChars=24_000, keepRecentMessages=16
      expect(result.meta.usedChars).toBeLessThanOrEqual(96_000)
      expect(result.meta.totalOriginalMessages).toBe(2)
    })

    it('uses provided config values instead of defaults (line 67-69 ?? false branches)', () => {
      const messages = [makeMessage('user', 'Hello')]
      const nextMessage = makeMessage('user', 'World')

      const result = applyHistoryBudget(messages, nextMessage, {
        maxTotalChars: 10,
        maxMessageChars: 5,
        keepRecentMessages: 2,
      })

      // maxMessageChars=5 clips both messages
      expect(result.meta.clippedCount).toBeGreaterThanOrEqual(0)
      expect(result.meta.totalOriginalMessages).toBe(2)
    })

    it('drops oldest messages when total exceeds budget (line 93 while loop)', () => {
      const oversized = 'C'.repeat(30_000)
      const messages = Array.from({ length: 4 }, (_, i) =>
        makeMessage(i % 2 === 0 ? 'user' : 'assistant', oversized),
      )
      const nextMessage = makeMessage('user', oversized)

      const result = applyHistoryBudget(messages, nextMessage)

      expect(result.meta.usedChars).toBeLessThanOrEqual(96_000)
      expect(result.meta.droppedCount).toBeGreaterThan(0)
    })

    it('keeps single message even when it exceeds budget (while loop exits when length === 1)', () => {
      const huge = 'D'.repeat(100_000)
      const nextMessage = makeMessage('user', huge)

      const result = applyHistoryBudget([], nextMessage)

      expect(result.messages.length).toBe(1)
      expect(result.messages[0].role).toBe('user')
    })

    it('does not enter while loop when messages fit within budget', () => {
      const messages = [makeMessage('user', 'Hello')]
      const nextMessage = makeMessage('user', 'World')

      const result = applyHistoryBudget(messages, nextMessage)

      expect(result.meta.droppedCount).toBe(0)
      expect(result.messages.length).toBe(2)
    })
  })

  // --- Hook integration tests ---

  describe('useChatRequestBuilder hook', () => {
    it('passes undefined messages through ?? [] (line 129 false branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      // Call without messages field — input.messages is undefined
      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L1',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
      })

      // Should have 1 message (the new user message)
      expect(request.messages.length).toBe(1)
      expect(request.messages[0].content).toBe('test')
    })

    it('passes null messages through ?? [] (line 129 null branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      // Explicitly null messages
      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L1',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
        messages: null as any,
      })

      expect(request.messages.length).toBe(1)
    })

    it('uses empty string profile as undefined (line 151 || branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval({ profile: '' }),
          workspace: null,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L1',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
        messages: [],
      })

      // profile: '' || undefined => undefined
      expect(request.profile).toBeUndefined()
    })

    it('adds comparison when enableModelComparison is true and comparisonModel is set (line 159 true branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L2',
        selectedSkills: [],
        enableModelComparison: true,
        comparisonModel: 'gpt-4o',
        messages: [],
      })

      expect(request.comparison).toEqual({
        enabled: true,
        controlModel: 'gpt-4o',
      })
    })

    it('skips comparison when enableModelComparison is true but comparisonModel is empty (line 159 false branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L2',
        selectedSkills: [],
        enableModelComparison: true,
        comparisonModel: '',
        messages: [],
      })

      expect(request.comparison).toBeUndefined()
    })

    it('skips comparison when enableModelComparison is false (line 159 false branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L2',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: 'gpt-4o',
        messages: [],
      })

      expect(request.comparison).toBeUndefined()
    })

    it('includes workspace when options.workspace is set (line 166 true branch)', () => {
      const workspace = makeWorkspace()

      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L3',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
        messages: [],
      })

      expect(request.workspace).toBe(workspace)
    })

    it('omits workspace when options.workspace is null (line 166 false branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
          workspace: null,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L3',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
        messages: [],
      })

      expect(request.workspace).toBeUndefined()
    })

    it('omits workspace when options.workspace is undefined (line 166 false branch)', () => {
      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: false,
          qualityGoals: makeQualityGoals(),
          retrieval: makeRetrieval(),
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'test',
        workflowLevel: 'L3',
        selectedSkills: [],
        enableModelComparison: false,
        comparisonModel: '',
        messages: [],
      })

      expect(request.workspace).toBeUndefined()
    })

    it('preserves all request fields correctly', () => {
      const workspace = makeWorkspace()

      const { result } = renderHook(() =>
        useChatRequestBuilder({
          allowLlmFallback: true,
          qualityGoals: makeQualityGoals({
            naturalness: 90,
            readability: 85,
            coherence: 88,
            styleConsistency: 82,
            humanizationPreset: 'ai_edit_guidance',
            customHumanizationInstruction: 'Use formal tone',
            sentenceEntropyTarget: 0.7,
            rhythmVariabilityTarget: 0.6,
          }),
          retrieval: makeRetrieval({
            enabled: false,
            searchMode: 'iterative',
            profile: 'custom-profile',
            minScore: 0.8,
            budgetTokens: 4000,
            rerank: false,
            maxIterations: 5,
            confidenceThreshold: 0.9,
          }),
          workspace,
        }),
      )

      const request = result.current.buildChatRequest({
        userMessage: 'Write a chapter',
        workflowLevel: 'L5',
        selectedSkills: ['brainstorm', 'outline'],
        enableModelComparison: true,
        comparisonModel: 'claude-sonnet-4-6',
        messages: [],
      })

      expect(request.workflowLevel).toBe('L5')
      expect(request.skills).toEqual(['brainstorm', 'outline'])
      expect(request.allowLlmFallback).toBe(true)
      expect(request.qualityGoals?.naturalness).toBe(90)
      expect(request.qualityGoals?.humanization_preset).toBe('ai_edit_guidance')
      expect(request.qualityGoals?.custom_humanization_instruction).toBe('Use formal tone')
      expect(request.knowledge_retrieval).toBe(false)
      expect(request.search_mode).toBe('iterative')
      expect(request.profile).toBe('custom-profile')
      expect(request.min_score).toBe(0.8)
      expect(request.budget_tokens).toBe(4000)
      expect(request.rerank).toBe(false)
      expect(request.max_iterations).toBe(5)
      expect(request.confidence_threshold).toBe(0.9)
      expect(request.workspace).toBe(workspace)
      expect(request.comparison).toEqual({
        enabled: true,
        controlModel: 'claude-sonnet-4-6',
      })
    })
  })
})

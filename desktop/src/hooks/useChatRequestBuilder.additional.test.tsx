import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useChatRequestBuilder } from './useChatRequestBuilder'
import type { QualityGoalsSettings, RetrievalSettings } from '../stores/settings/types'

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

describe('useChatRequestBuilder additional coverage', () => {
  it('drops oldest clipped messages when the recent window still exceeds the history budget', () => {
    const { result } = renderHook(() =>
      useChatRequestBuilder({
        allowLlmFallback: false,
        qualityGoals: makeQualityGoals(),
        retrieval: makeRetrieval(),
        workspace: null,
      }),
    )

    const oversized = 'Z'.repeat(30_000)
    const messages = Array.from({ length: 4 }, (_, index) => ({
      role: (index % 2 === 0 ? 'user' : 'assistant') as const,
      content: `${oversized}${index}`,
    }))

    const request = result.current.buildChatRequest({
      userMessage: oversized,
      workflowLevel: 'L2',
      selectedSkills: [],
      enableModelComparison: false,
      comparisonModel: '',
      messages,
    })

    expect(request.messages.length).toBeLessThan(5)
    expect(request.messages.at(-1)?.role).toBe('user')
    expect(request.messages.at(-1)?.content).toContain('truncated by client')
    expect(
      request.messages.reduce((sum, message) => sum + message.content.length, 0),
    ).toBeLessThanOrEqual(96_000)
  })
})

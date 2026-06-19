import { describe, expect, it, vi } from 'vitest'

import {
  PromptAssembler,
  createPromptAssembler,
  createDefaultCreativityConfig,
  resolveCreativityConfig,
} from './PromptAssembler'
import type { ScrapedContext } from './PromptAssembler'

// ============================================================
// Minimal context factory for branch coverage
// ============================================================

function createMinimalContext(overrides?: Partial<ScrapedContext>): ScrapedContext {
  return {
    storyBible: {
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [],
      completeness: {
        overallScore: 0.8,
        level: 'good',
        entityScores: new Map(),
        missingFields: [],
        recommendations: [],
        timestamp: '2026-06-17T00:00:00.000Z',
      },
    },
    sessionContext: {
      recentEdits: [],
      writingStyle: '',
      currentChapter: 'CH01',
      cursorPosition: 0,
    },
    chapterContext: {
      precedingText: '',
      succeedingText: '',
      chapterSummary: '',
    },
    totalTokenEstimate: 0,
    ...overrides,
  }
}

// ============================================================
// Tests
// ============================================================

describe('PromptAssembler branch coverage', () => {
  it('omits high/low creativity notes when value is mid-range (balanced preset)', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
      creativityConfig: resolveCreativityConfig('balanced', 'auto'),
    })

    expect(prompt.systemPrompt).not.toContain('High creativity setting')
    expect(prompt.systemPrompt).not.toContain('Conservative creativity setting')
    expect(prompt.systemPrompt).toContain('Creativity level: 0.50')
  })

  it('uses default creativity config when none provided (nullish coalescing branch)', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'guided',
    })

    // guided mode default is 0.6
    expect(prompt.creativityConfig.preset).toBe('balanced')
    expect(prompt.creativityConfig.modeDefault).toBe(0.6)
    expect(prompt.creativityConfig.value).toBe(0.6)
  })

  it('assembles guided-mode prompt with 3-option instruction', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'guided',
      creativityConfig: resolveCreativityConfig('creative', 'guided'),
    })

    expect(prompt.mode).toBe('guided')
    expect(prompt.systemPrompt).toContain('creative writing consultant')
    expect(prompt.userPrompt).toContain('Generate 3 distinct continuation options')
    expect(prompt.userPrompt).toContain('Option 1:')
    expect(prompt.userPrompt).toContain('Option 2:')
    expect(prompt.userPrompt).toContain('Option 3:')
    // creative preset value = 0.7, not > 0.7, so no high creativity note
    expect(prompt.systemPrompt).not.toContain('High creativity setting')
  })

  it('omits story bible section when all arrays are empty', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
    })

    expect(prompt.userPrompt).not.toContain('## Story Bible Context')
    expect(prompt.userPrompt).not.toContain('Characters:')
    expect(prompt.userPrompt).not.toContain('World Rules:')
    expect(prompt.userPrompt).not.toContain('Plot Threads:')
    expect(prompt.userPrompt).not.toContain('Timeline Events:')
  })

  it('omits writing style section when session writingStyle is empty', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        sessionContext: {
          recentEdits: [],
          writingStyle: '',
          currentChapter: 'CH02',
          cursorPosition: 10,
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).not.toContain('## Writing Style')
  })

  it('omits recent edits section when edits array is empty', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
    })

    expect(prompt.userPrompt).not.toContain('## Recent Edits')
  })

  it('omits chapter context section when all chapter fields are empty', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
    })

    expect(prompt.userPrompt).not.toContain('## Chapter Context')
  })

  it('includes completeness note when overallScore is below 0.5', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.35,
            level: 'incomplete',
            entityScores: new Map(),
            missingFields: ['characters'],
            recommendations: ['Add character profiles'],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('Story Bible completeness is low (35%)')
  })

  it('omits completeness note when overallScore is 0.5 or above', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.5,
            level: 'adequate',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).not.toContain('Story Bible completeness is low')
  })

  it('renders nonlinear structure and unreliable narrator as "not allowed" for conservative config', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'directed',
      creativityConfig: resolveCreativityConfig('conservative', 'directed'),
    })

    expect(prompt.systemPrompt).toContain('Nonlinear structure: not allowed')
    expect(prompt.systemPrompt).toContain('Unreliable narrator: not allowed')
  })

  it('renders nonlinear structure as "allowed" for creative config', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
      creativityConfig: resolveCreativityConfig('creative', 'auto'),
    })

    expect(prompt.systemPrompt).toContain('Nonlinear structure: allowed')
    expect(prompt.systemPrompt).toContain('Unreliable narrator: not allowed')
  })

  it('renders both nonlinear structure and unreliable narrator as "allowed" for experimental config', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
      creativityConfig: resolveCreativityConfig('experimental', 'auto'),
    })

    expect(prompt.systemPrompt).toContain('Nonlinear structure: allowed')
    expect(prompt.systemPrompt).toContain('Unreliable narrator: allowed')
    expect(prompt.systemPrompt).toContain('High creativity setting')
  })

  it('warns and falls back when directed mode has no user instruction', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'directed',
    })

    expect(prompt.userPrompt).toContain(
      'No specific instruction provided. Continue naturally as in auto mode.',
    )
    expect(prompt.userPrompt).not.toContain('User Instruction:')
    expect(warnSpy).toHaveBeenCalledWith(
      'Directed mode without user instruction — falling back to auto behavior',
    )

    warnSpy.mockRestore()
  })

  it('includes user instruction in directed mode when provided', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'directed',
      userInstruction: 'Rewrite the opening in first person',
    })

    expect(prompt.userPrompt).toContain(
      'User Instruction: Rewrite the opening in first person',
    )
    expect(prompt.userPrompt).not.toContain(
      'No specific instruction provided',
    )
  })

  it('does not append user instruction section for auto or guided modes', () => {
    const assembler = new PromptAssembler()

    const autoPrompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
      userInstruction: 'Should be ignored',
    })

    expect(autoPrompt.userPrompt).not.toContain('User Instruction:')

    const guidedPrompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'guided',
      userInstruction: 'Should also be ignored',
    })

    expect(guidedPrompt.userPrompt).not.toContain('User Instruction:')
  })

  it('renders characters with populated traits and motivations', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [
            {
              id: 'char-1',
              novelId: 'novel-1',
              name: 'Lin',
              type: 'character' as const,
              archetype: 'protagonist',
              traits: [
                { trait: 'stubborn', intensity: 0.9, evidence: 'Refuses to retreat' },
                { trait: 'observant', intensity: 0.8, evidence: 'Notices the seal' },
              ],
              motivations: ['Protect her brother', 'Find the truth'],
              backstory: 'Survived the archive fire',
              relationships: [],
              speechPatterns: [],
              arcStage: 'rising',
              povAffinity: 0.7,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.9,
              source: 'manual' as const,
              metadata: {},
            },
          ],
          worldRules: [],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.9,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('Characters:')
    expect(prompt.userPrompt).toContain('Lin')
    expect(prompt.userPrompt).toContain('stubborn, observant')
    expect(prompt.userPrompt).toContain('Protect her brother; Find the truth')
  })

  it('renders characters with empty traits and motivations falling back to "none specified"', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [
            {
              id: 'char-2',
              novelId: 'novel-1',
              name: 'Shen',
              type: 'character' as const,
              archetype: 'antagonist',
              traits: [],
              motivations: [],
              backstory: '',
              relationships: [],
              speechPatterns: [],
              arcStage: 'uncertain',
              povAffinity: 0.3,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.4,
              source: 'manual' as const,
              metadata: {},
            },
          ],
          worldRules: [],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.9,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('Characters:')
    expect(prompt.userPrompt).toContain('Shen')
    expect(prompt.userPrompt).toContain('Traits: none specified')
    expect(prompt.userPrompt).toContain('Motivations: none specified')
  })

  it('renders world rules with populated constraints', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [
            {
              id: 'rule-1',
              novelId: 'novel-1',
              name: 'Sealbound Doors',
              type: 'world-rule' as const,
              category: 'magic',
              description: 'Every gate responds only to a spoken seal phrase.',
              constraints: ['Requires blood relative voiceprint', 'Leaves frost trace'],
              exceptions: [],
              impactScope: 'regional',
              relatedEntities: [],
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.8,
              source: 'manual' as const,
              metadata: {},
            },
          ],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.9,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('World Rules:')
    expect(prompt.userPrompt).toContain('Sealbound Doors')
    expect(prompt.userPrompt).toContain('Requires blood relative voiceprint; Leaves frost trace')
  })

  it('renders world rules with empty constraints falling back to "none"', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [
            {
              id: 'rule-2',
              novelId: 'novel-1',
              name: 'Silent Oath',
              type: 'world-rule' as const,
              category: 'magic',
              description: 'The oath silences liars.',
              constraints: [],
              exceptions: [],
              impactScope: 'personal',
              relatedEntities: [],
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.6,
              source: 'manual' as const,
              metadata: {},
            },
          ],
          plotThreads: [],
          timelineEvents: [],
          completeness: {
            overallScore: 0.9,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('World Rules:')
    expect(prompt.userPrompt).toContain('Silent Oath')
    expect(prompt.userPrompt).toContain('Constraints: none')
  })

  it('renders plot threads with status, premise, and stakes', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [],
          plotThreads: [
            {
              id: 'pt-1',
              novelId: 'novel-1',
              name: 'Missing Ledger',
              type: 'plot-thread' as const,
              status: 'developing',
              premise: 'A ledger vanished the night the archive burned.',
              goal: 'Recover the ledger',
              stakes: 'Expose the conspiracy',
              involvedCharacters: [],
              keyEvents: [],
              foreshadowingRefs: [],
              resolution: null,
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.8,
              source: 'manual' as const,
              metadata: {},
            },
          ],
          timelineEvents: [],
          completeness: {
            overallScore: 0.8,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('## Story Bible Context')
    expect(prompt.userPrompt).toContain('Plot Threads:')
    expect(prompt.userPrompt).toContain('Missing Ledger')
    expect(prompt.userPrompt).toContain('developing')
    expect(prompt.userPrompt).toContain('A ledger vanished')
    expect(prompt.userPrompt).toContain('Expose the conspiracy')
  })

  it('renders timeline events with eventType, emotionalImpact, and description', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        storyBible: {
          characters: [],
          worldRules: [],
          plotThreads: [],
          timelineEvents: [
            {
              id: 'te-1',
              novelId: 'novel-1',
              name: 'Archive Fire',
              type: 'timeline-event' as const,
              eventType: 'incident',
              timestamp: 'Night 1',
              chapterRef: 'CH01',
              description: 'The lower archive burned overnight.',
              participants: [],
              consequences: [],
              plotThreadRefs: [],
              emotionalImpact: 'high',
              createdAt: '2026-01-01',
              updatedAt: '2026-01-01',
              completenessScore: 0.9,
              source: 'auto-extract' as const,
              metadata: {},
            },
          ],
          completeness: {
            overallScore: 0.9,
            level: 'good',
            entityScores: new Map(),
            missingFields: [],
            recommendations: [],
            timestamp: '2026-06-17T00:00:00.000Z',
          },
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('## Story Bible Context')
    expect(prompt.userPrompt).toContain('Timeline Events:')
    expect(prompt.userPrompt).toContain('Archive Fire')
    expect(prompt.userPrompt).toContain('incident')
    expect(prompt.userPrompt).toContain('high')
    expect(prompt.userPrompt).toContain('The lower archive burned overnight.')
  })

  it('includes all four quality constraint dimensions in system prompt', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
    })

    expect(prompt.systemPrompt).toContain('Plot Coherence')
    expect(prompt.systemPrompt).toContain('Character Consistency')
    expect(prompt.systemPrompt).toContain('Style Consistency')
    expect(prompt.systemPrompt).toContain('Pacing & Tension')
  })

  it('estimates tokens correctly for assembled prompt', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext(),
      mode: 'auto',
    })

    expect(prompt.estimatedTokens).toBeGreaterThan(0)
  })

  it('includes writing style and recent edits when present', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        sessionContext: {
          recentEdits: ['Fixed dialogue tags', 'Added scene break'],
          writingStyle: 'Sparse Hemingway-esque prose',
          currentChapter: 'CH03',
          cursorPosition: 50,
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('## Writing Style')
    expect(prompt.userPrompt).toContain('Sparse Hemingway-esque prose')
    expect(prompt.userPrompt).toContain('## Recent Edits')
    expect(prompt.userPrompt).toContain('- Fixed dialogue tags')
  })

  it('includes chapter context sections when present', () => {
    const assembler = new PromptAssembler()

    const prompt = assembler.assemblePrompt({
      context: createMinimalContext({
        chapterContext: {
          precedingText: 'She opened the door slowly.',
          succeedingText: 'The hallway stretched ahead.',
          chapterSummary: 'Protagonist enters the abandoned building.',
        },
      }),
      mode: 'auto',
    })

    expect(prompt.userPrompt).toContain('## Chapter Context')
    expect(prompt.userPrompt).toContain('Chapter Summary:')
    expect(prompt.userPrompt).toContain('Preceding Text:')
    expect(prompt.userPrompt).toContain('Succeeding Text (for reference')
  })
})

describe('createDefaultCreativityConfig', () => {
  it('returns balanced preset with mode-calibrated defaults', () => {
    const config = createDefaultCreativityConfig('auto')
    expect(config.preset).toBe('balanced')
    expect(config.value).toBe(0.5)
    expect(config.modeDefault).toBe(0.5)
  })

  it('returns guided mode default of 0.6', () => {
    const config = createDefaultCreativityConfig('guided')
    expect(config.value).toBe(0.6)
  })

  it('returns directed mode default of 0.4', () => {
    const config = createDefaultCreativityConfig('directed')
    expect(config.value).toBe(0.4)
  })

  it('falls back to 0.5 for unknown mode', () => {
    const config = createDefaultCreativityConfig('unknown-mode')
    expect(config.value).toBe(0.5)
    expect(config.modeDefault).toBe(0.5)
  })
})

describe('resolveCreativityConfig', () => {
  it('resolves balanced preset to mode default', () => {
    const config = resolveCreativityConfig('balanced', 'guided')
    expect(config.value).toBe(0.6)
    expect(config.preset).toBe('balanced')
  })

  it('resolves conservative preset to fixed value 0.2', () => {
    const config = resolveCreativityConfig('conservative', 'auto')
    expect(config.value).toBe(0.2)
    expect(config.preset).toBe('conservative')
  })

  it('resolves experimental preset to fixed value 0.9', () => {
    const config = resolveCreativityConfig('experimental', 'auto')
    expect(config.value).toBe(0.9)
    expect(config.preset).toBe('experimental')
  })

  it('uses custom value when provided', () => {
    const config = resolveCreativityConfig('creative', 'auto', 0.45)
    expect(config.value).toBe(0.45)
    expect(config.preset).toBe('creative')
  })
})

describe('estimateTokens', () => {
  it('returns 0 for empty string', async () => {
    const { estimateTokens } = await import('./PromptAssembler')
    expect(estimateTokens('')).toBe(0)
  })

  it('counts CJK characters with different token ratio', async () => {
    const { estimateTokens } = await import('./PromptAssembler')
    // CJK characters: each ~2 chars per token
    const cjkText = '林岚把手按在冰冷的门缝上'
    const tokens = estimateTokens(cjkText)
    expect(tokens).toBeGreaterThan(0)
    // 11 CJK characters -> ceil(11/2) = 6 tokens
    expect(tokens).toBe(6)
  })

  it('counts mixed CJK and Latin text', async () => {
    const { estimateTokens } = await import('./PromptAssembler')
    const mixedText = 'Hello 林岚 world'
    const tokens = estimateTokens(mixedText)
    expect(tokens).toBeGreaterThan(0)
    // CJK and non-CJK characters both contribute to token count
    expect(tokens).toBeGreaterThanOrEqual(4)
  })
})

describe('createPromptAssembler factory', () => {
  it('returns a PromptAssembler instance', () => {
    const assembler = createPromptAssembler()
    expect(assembler).toBeInstanceOf(PromptAssembler)
  })
})

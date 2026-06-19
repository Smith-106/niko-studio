/**
 * Prompt Assembler — builds mode-specific prompts for the Co-Writing Engine
 *
 * Constructs LLM-ready prompts from three context sources:
 * 1. ScrapedContext (Story Bible + session + chapter context)
 * 2. Co-writing mode (auto / guided / directed)
 * 3. Creativity spectrum configuration
 *
 * Each mode produces a distinct system prompt and user prompt:
 * - Auto: seamless continuation maintaining established tone
 * - Guided: 3 divergent options scored on coherence, creativity, style
 * - Directed: follow explicit user instruction within quality guardrails
 *
 * Quality constraint instructions are always injected across 4 dimensions:
 * plot coherence, character consistency, style consistency, pacing.
 *
 * @module services/PromptAssembler
 */

import type {
  CharacterProfile,
  WorldRule,
  PlotThread,
  TimelineEvent,
  CreativitySpectrumConfig,
  CreativityPreset,
} from '../api/story-bible'

// ============================================================
// Token Estimation
// ============================================================

export function estimateTokens(text: string): number {
  if (!text) return 0

  let cjkCount = 0
  let otherCount = 0

  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjkCount++
    } else {
      otherCount++
    }
  }

  return Math.ceil(cjkCount / 2) + Math.ceil(otherCount / 4)
}

// ============================================================
// AssembledPrompt Interface
// ============================================================

export type CowritingMode = 'auto' | 'guided' | 'directed'

export interface AssembledPrompt {
  systemPrompt: string
  userPrompt: string
  mode: CowritingMode
  creativityConfig: CreativitySpectrumConfig
  estimatedTokens: number
}

// ============================================================
// Input Interfaces
// ============================================================

export interface StoryBibleContext {
  characters: CharacterProfile[]
  worldRules: WorldRule[]
  plotThreads: PlotThread[]
  timelineEvents: TimelineEvent[]
  completeness: {
    overallScore: number
    level: string
    entityScores: Map<string, number>
    missingFields: string[]
    recommendations: string[]
    timestamp: string
  }
}

export interface SessionContext {
  recentEdits: string[]
  writingStyle: string
  currentChapter: string
  cursorPosition: number
}

export interface ChapterContext {
  precedingText: string
  succeedingText: string
  chapterSummary: string
}

export interface ScrapedContext {
  storyBible: StoryBibleContext
  sessionContext: SessionContext
  chapterContext: ChapterContext
  totalTokenEstimate: number
}

export interface PromptAssemblerInput {
  context: ScrapedContext
  mode: CowritingMode
  /** User instruction — required for directed mode, ignored for auto/guided */
  userInstruction?: string
  /** Override creativity config; defaults to mode-calibrated balanced preset */
  creativityConfig?: CreativitySpectrumConfig
}

// ============================================================
// Default Creativity Config
// ============================================================

const MODE_BALANCED_DEFAULTS: Record<string, number> = {
  auto: 0.5,
  guided: 0.6,
  directed: 0.4,
}

const CREATIVITY_PRESET_VALUES: Record<string, number> = {
  conservative: 0.2,
  balanced: 0.5,
  creative: 0.7,
  experimental: 0.9,
}

export function createDefaultCreativityConfig(
  cowritingMode: string,
): CreativitySpectrumConfig {
  const modeDefault = MODE_BALANCED_DEFAULTS[cowritingMode] ?? 0.5
  return {
    value: modeDefault,
    preset: 'balanced',
    modeDefault,
    constraints: {
      maxSentenceLength: 40,
      minVocabularyDiversity: 0.3,
      maxMetaphorDensity: 0.15,
      allowNonlinearStructure: modeDefault > 0.5,
      allowUnreliableNarrator: modeDefault > 0.7,
    },
  }
}

export function resolveCreativityConfig(
  preset: CreativityPreset,
  cowritingMode: string,
  customValue?: number,
): CreativitySpectrumConfig {
  const modeDefault = MODE_BALANCED_DEFAULTS[cowritingMode] ?? 0.5
  const value =
    customValue ??
    (preset === 'balanced' ? modeDefault : CREATIVITY_PRESET_VALUES[preset])
  return {
    value,
    preset,
    modeDefault,
    constraints: {
      maxSentenceLength: Math.round(20 + value * 40),
      minVocabularyDiversity: 0.2 + value * 0.3,
      maxMetaphorDensity: 0.05 + value * 0.2,
      allowNonlinearStructure: value > 0.5,
      allowUnreliableNarrator: value > 0.7,
    },
  }
}

// ============================================================
// Quality Constraint Templates
// ============================================================

const QUALITY_CONSTRAINT_INSTRUCTIONS: Record<string, string> = {
  'plot-coherence':
    'Plot Coherence: Maintain logical consistency with established plot threads. Do not contradict prior events, foreshadowing, or unresolved stakes. New developments must feel earned, not arbitrary.',
  'character-consistency':
    "Character Consistency: Preserve each character's established personality, speech patterns, motivations, and relationship dynamics. Characters must act within their defined traits — no unexplained behavioral shifts.",
  'style-consistency':
    'Style Consistency: Match the existing narrative voice, prose register, and stylistic conventions. Preserve the established rhythm — sentence length, descriptive density, dialogue formatting.',
  'pacing-tension':
    "Pacing & Tension: Respect the current scene's dramatic arc. Maintain or escalate tension where appropriate. Avoid rushing climactic moments or dragging transitional passages.",
}

// ============================================================
// Mode-Specific Instruction Templates
// ============================================================

const MODE_INSTRUCTIONS: Record<CowritingMode, string> = {
  auto: [
    'Continue the story naturally from where it left off. Maintain the established tone and style.',
    'Do not introduce major plot twists or new characters without foreshadowing.',
    'Produce a single continuation that feels like the author never stopped writing.',
  ].join('\n'),

  guided: [
    'Generate 3 distinct continuation options. Each must differ in direction or tone.',
    'For each option, provide:',
    '- The continuation text',
    '- A score (0-100) on each dimension: coherence, creativity, style match',
    '- A brief rationale for the scores',
    'Option 1: The most natural, expected continuation.',
    'Option 2: A bolder direction that still respects established story logic.',
    'Option 3: An unexpected but compelling twist that opens new possibilities.',
  ].join('\n'),

  directed: [
    "Follow the user's explicit instruction precisely, but remain constrained by quality rules.",
    'The instruction takes priority over default continuation behavior, but must not violate:',
    '- Character consistency (no out-of-character actions)',
    '- Plot coherence (no logical contradictions)',
    '- Established world rules',
    'If the instruction conflicts with quality constraints, produce the closest valid interpretation and note the adaptation.',
  ].join('\n'),
}

// ============================================================
// Mode-Specific Role Definitions
// ============================================================

const MODE_ROLES: Record<CowritingMode, string> = {
  auto: "You are a seamless co-writer who continues the author's work as if the pen never left the page. Your writing is indistinguishable from the author's own voice.",
  guided: 'You are a creative writing consultant who offers multiple divergent paths. Each option must be fully realized and scored objectively. You help the author see possibilities they might have missed.',
  directed: 'You are a precision writing assistant who follows instructions exactly while guarding narrative integrity. You execute the author\'s intent without introducing uninvited creative flourishes.',
}

// ============================================================
// Creativity Constraint Renderer
// ============================================================

function renderCreativityConstraints(config: CreativitySpectrumConfig): string {
  const lines: string[] = [
    'Creativity Spectrum Constraints:',
    `- Creativity level: ${config.value.toFixed(2)} (preset: ${config.preset})`,
    `- Maximum sentence length: ${config.constraints.maxSentenceLength} words`,
    `- Minimum vocabulary diversity: ${(config.constraints.minVocabularyDiversity * 100).toFixed(0)}%`,
    `- Maximum metaphor density: ${(config.constraints.maxMetaphorDensity * 100).toFixed(0)}%`,
    `- Nonlinear structure: ${config.constraints.allowNonlinearStructure ? 'allowed' : 'not allowed'}`,
    `- Unreliable narrator: ${config.constraints.allowUnreliableNarrator ? 'allowed' : 'not allowed'}`,
  ]

  if (config.value > 0.7) {
    lines.push('Note: High creativity setting — prioritize originality and surprise, but stay within quality guardrails.')
  } else if (config.value < 0.3) {
    lines.push('Note: Conservative creativity setting — prioritize predictability and established patterns.')
  }

  return lines.join('\n')
}

// ============================================================
// Story Bible Context Renderer
// ============================================================

function renderStoryBibleContext(context: ScrapedContext): string {
  const sections: string[] = []

  // Characters
  if (context.storyBible.characters.length > 0) {
    const charLines = context.storyBible.characters.map((char) => {
      const traits =
        char.traits.length > 0
          ? char.traits.map((t) => t.trait).join(', ')
          : 'none specified'
      const motivations =
        char.motivations.length > 0
          ? char.motivations.join('; ')
          : 'none specified'
      return `  - ${char.name} (${char.archetype}, arc: ${char.arcStage}) | Traits: ${traits} | Motivations: ${motivations}`
    })
    sections.push('Characters:\n' + charLines.join('\n'))
  }

  // World Rules
  if (context.storyBible.worldRules.length > 0) {
    const ruleLines = context.storyBible.worldRules.map((rule) => {
      const constraints =
        rule.constraints.length > 0
          ? rule.constraints.join('; ')
          : 'none'
      return `  - ${rule.name} (${rule.category}, ${rule.impactScope} scope) | ${rule.description} | Constraints: ${constraints}`
    })
    sections.push('World Rules:\n' + ruleLines.join('\n'))
  }

  // Plot Threads
  if (context.storyBible.plotThreads.length > 0) {
    const threadLines = context.storyBible.plotThreads.map(
      (thread) =>
        `  - ${thread.name} (${thread.status}) | Premise: ${thread.premise} | Stakes: ${thread.stakes}`,
    )
    sections.push('Plot Threads:\n' + threadLines.join('\n'))
  }

  // Timeline Events
  if (context.storyBible.timelineEvents.length > 0) {
    const eventLines = context.storyBible.timelineEvents.map(
      (event) =>
        `  - ${event.name} (${event.eventType}, impact: ${event.emotionalImpact}) | ${event.description}`,
    )
    sections.push('Timeline Events:\n' + eventLines.join('\n'))
  }

  // Completeness note
  const completeness = context.storyBible.completeness
  if (completeness.overallScore < 0.5) {
    sections.push(
      `Note: Story Bible completeness is low (${(completeness.overallScore * 100).toFixed(0)}%). Some context may be missing. Prioritize established facts over assumptions.`,
    )
  }

  return sections.join('\n\n')
}

// ============================================================
// Chapter Context Renderer
// ============================================================

function renderChapterContext(context: ScrapedContext): string {
  const sections: string[] = []

  if (context.chapterContext.chapterSummary) {
    sections.push(`Chapter Summary: ${context.chapterContext.chapterSummary}`)
  }

  if (context.chapterContext.precedingText) {
    sections.push(`Preceding Text:\n${context.chapterContext.precedingText}`)
  }

  if (context.chapterContext.succeedingText) {
    sections.push(
      `Succeeding Text (for reference — do not rewrite):\n${context.chapterContext.succeedingText}`,
    )
  }

  return sections.join('\n\n')
}

// ============================================================
// PromptAssembler Class
// ============================================================

export class PromptAssembler {
  /**
   * Build a mode-specific prompt from scraped context and co-writing configuration.
   */
  assemblePrompt(input: PromptAssemblerInput): AssembledPrompt {
    const { context, mode, userInstruction } = input
    const creativityConfig =
      input.creativityConfig ?? createDefaultCreativityConfig(mode)

    // --- System Prompt ---
    const systemParts: string[] = [
      MODE_ROLES[mode],
      '',
      '## Quality Constraints',
      ...Object.values(QUALITY_CONSTRAINT_INSTRUCTIONS).map(
        (instruction, i) => `${i + 1}. ${instruction}`,
      ),
      '',
      '## ' + renderCreativityConstraints(creativityConfig),
    ]

    // --- User Prompt ---
    const userParts: string[] = []

    // Story Bible context
    const sbContext = renderStoryBibleContext(context)
    if (sbContext) {
      userParts.push('## Story Bible Context\n' + sbContext)
    }

    // Writing style
    if (context.sessionContext.writingStyle) {
      userParts.push(
        `## Writing Style\n${context.sessionContext.writingStyle}`,
      )
    }

    // Recent edits
    if (context.sessionContext.recentEdits.length > 0) {
      userParts.push(
        '## Recent Edits\n' +
          context.sessionContext.recentEdits.map((e) => `- ${e}`).join('\n'),
      )
    }

    // Chapter context
    const chapterCtx = renderChapterContext(context)
    if (chapterCtx) {
      userParts.push('## Chapter Context\n' + chapterCtx)
    }

    // Mode-specific instructions
    userParts.push('## Instructions\n' + MODE_INSTRUCTIONS[mode])

    // Directed mode: append user instruction
    if (mode === 'directed') {
      if (userInstruction) {
        userParts.push(`\nUser Instruction: ${userInstruction}`)
      } else {
        console.warn(
          'Directed mode without user instruction — falling back to auto behavior',
        )
        userParts.push(
          '\nNo specific instruction provided. Continue naturally as in auto mode.',
        )
      }
    }

    const systemPrompt = systemParts.join('\n')
    const userPrompt = userParts.join('\n\n')

    const estimatedTokens =
      estimateTokens(systemPrompt) + estimateTokens(userPrompt)

    return {
      systemPrompt,
      userPrompt,
      mode,
      creativityConfig,
      estimatedTokens,
    }
  }
}

// ============================================================
// Factory
// ============================================================

export function createPromptAssembler(): PromptAssembler {
  return new PromptAssembler()
}

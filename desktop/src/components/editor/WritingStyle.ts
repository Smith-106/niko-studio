/**
 * Writing Style Types — Full 8-Dimensional PromptStyle System
 *
 * Upgraded from simplified 8D to complete PromptStyle with sub-properties.
 * Aligned with writing-helper's lib/types.ts for consistent prompt generation.
 */

import type { Language } from '../../i18n'

// ── Option types for UI selects ─────────────────────────────────

export type ToneOption = 'warm' | 'formal' | 'casual' | 'humorous' | 'serious' | 'melancholic'
export type PerspectiveOption = 'first' | 'third' | 'second' | 'omniscient'
export type SentenceStyleOption = 'concise' | 'flowing' | 'varied' | 'complex'
export type RhythmOption = 'brisk' | 'moderate' | 'leisurely'

export const TONE_OPTIONS: ToneOption[] = ['warm', 'formal', 'casual', 'humorous', 'serious', 'melancholic']
export const PERSPECTIVE_OPTIONS: PerspectiveOption[] = ['first', 'third', 'second', 'omniscient']
export const SENTENCE_STYLE_OPTIONS: SentenceStyleOption[] = ['concise', 'flowing', 'varied', 'complex']
export const RHYTHM_OPTIONS: RhythmOption[] = ['brisk', 'moderate', 'leisurely']

// ── Dimension sub-types ────────────────────────────────────────

export interface LanguageStyle {
  sentencePatterns: string[]      // 多选标签: '短句为主', '长句为主', '长短交错', '排比', '反问'
  vocabulary: {
    formality: number             // 1-5 slider
    preferred: string[]           // 偏好词汇 tags
    avoid: string[]               // 避免词汇 tags
  }
  rhetoric: string[]              // 修辞手法: '比喻', '拟人', '排比', '对偶', '夸张'
}

export interface StructureStyle {
  paragraphLength: 'short' | 'medium' | 'long' | 'varied'
  transitionStyle: 'smooth' | 'direct' | 'dramatic' | 'subtle'
  hierarchyPattern: 'flat' | 'nested' | 'parallel' | 'progressive'
}

export interface NarrativeStyle {
  perspective: 'first' | 'third' | 'second' | 'omniscient'
  timeSequence: 'linear' | 'flashback' | 'interleaved' | 'circular'
  narratorAttitude: 'objective' | 'sympathetic' | 'critical' | 'detached'
}

export interface EmotionStyle {
  intensity: number               // 1-5
  expressionStyle: 'implicit' | 'explicit' | 'restrained' | 'passionate'
  tone: 'warm' | 'formal' | 'casual' | 'humorous' | 'serious' | 'melancholic'
}

export interface ThinkingStyle {
  logicPattern: 'deductive' | 'inductive' | 'analogical' | 'dialectical'
  depth: number                   // 1-5
  rhythm: 'methodical' | 'exploratory' | 'rapid' | 'contemplative'
}

export interface UniquenessStyle {
  signaturePhrases: string[]      // 标志性短语 tags
  imagerySystem: string[]         // 意象系统 tags
}

export interface CulturalStyle {
  allusions: string[]             // 典故 tags
  knowledgeDomains: string[]      // 知识领域 tags
}

export interface RhythmStyle {
  syllablePattern: 'dense' | 'balanced' | 'sparse' | 'free'
  pausePattern: 'frequent' | 'moderate' | 'minimal'
  tempo: 'fast' | 'moderate' | 'slow' | 'varied'
}

// ── Full PromptStyle ────────────────────────────────────────────

export interface WritingStyle {
  // Legacy 8D fields (kept for backward compatibility)
  tone: EmotionStyle['tone']
  formality: number
  emotionIntensity: number
  creativity: number
  perspective: NarrativeStyle['perspective']
  sentenceStyle: 'concise' | 'flowing' | 'varied' | 'complex'
  rhythm: 'brisk' | 'moderate' | 'leisurely'
  narrativeDistance: number

  // Full sub-properties
  language: LanguageStyle
  structure: StructureStyle
  narrative: NarrativeStyle
  emotion: EmotionStyle
  thinking: ThinkingStyle
  uniqueness: UniquenessStyle
  cultural: CulturalStyle
  rhythmFull: RhythmStyle
}

// ── Defaults ────────────────────────────────────────────────────

export const DEFAULT_WRITING_STYLE: WritingStyle = {
  tone: 'warm',
  formality: 3,
  emotionIntensity: 3,
  creativity: 3,
  perspective: 'first',
  sentenceStyle: 'flowing',
  rhythm: 'moderate',
  narrativeDistance: 3,

  language: {
    sentencePatterns: [],
    vocabulary: { formality: 3, preferred: [], avoid: [] },
    rhetoric: [],
  },
  structure: {
    paragraphLength: 'varied',
    transitionStyle: 'smooth',
    hierarchyPattern: 'progressive',
  },
  narrative: {
    perspective: 'first',
    timeSequence: 'linear',
    narratorAttitude: 'objective',
  },
  emotion: {
    intensity: 3,
    expressionStyle: 'implicit',
    tone: 'warm',
  },
  thinking: {
    logicPattern: 'inductive',
    depth: 3,
    rhythm: 'methodical',
  },
  uniqueness: {
    signaturePhrases: [],
    imagerySystem: [],
  },
  cultural: {
    allusions: [],
    knowledgeDomains: [],
  },
  rhythmFull: {
    syllablePattern: 'balanced',
    pausePattern: 'moderate',
    tempo: 'moderate',
  },
}

// ── Storage ─────────────────────────────────────────────────────

const STYLE_STORAGE_KEY = 'niko.writing-helper-style-v1'
const STYLE_INSTRUCTION_HEADER: Record<Language, string> = {
  zh: '写作风格要求：',
  en: 'Writing style requirements:',
}

function readPersistedStyle(): Partial<WritingStyle> | null {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as Partial<WritingStyle>
  } catch {
    return null
  }
}

export function loadStyle(): WritingStyle {
  const persistedStyle = readPersistedStyle()
  if (persistedStyle) {
    return migrateStyle(persistedStyle)
  }

  return { ...DEFAULT_WRITING_STYLE }
}

export function saveStyle(style: WritingStyle) {
  try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style)) } catch { /* ignore */ }
}

function stripStyleInstructionHeader(instruction: string, language: Language): string {
  const header = STYLE_INSTRUCTION_HEADER[language]
  if (instruction === header) {
    return ''
  }
  if (instruction.startsWith(`${header}；`)) {
    return instruction.slice(`${header}；`.length).trim()
  }
  if (instruction.startsWith(header)) {
    return instruction.slice(header.length).replace(/^；\s*/, '').trim()
  }
  return instruction.trim()
}

export function getPersistedStyleInstruction(language: Language): string {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY)?.trim() ?? ''
    if (!raw) {
      return ''
    }
    if (!readPersistedStyle()) {
      return raw
    }

    return buildStyleInstruction(loadStyle(), language === 'zh')
  } catch {
    return ''
  }
}

export function getPersistedStyleRequirements(language: Language): string {
  return stripStyleInstructionHeader(getPersistedStyleInstruction(language), language)
}

/** Migrate old format to new format with sub-properties */
function migrateStyle(old: Partial<WritingStyle>): WritingStyle {
  const base = { ...DEFAULT_WRITING_STYLE }

  // Merge legacy flat fields
  if (old.tone !== undefined) base.tone = old.tone
  if (old.formality !== undefined) base.formality = old.formality
  if (old.emotionIntensity !== undefined) base.emotionIntensity = old.emotionIntensity
  if (old.creativity !== undefined) base.creativity = old.creativity
  if (old.perspective !== undefined) base.perspective = old.perspective
  if (old.sentenceStyle !== undefined) base.sentenceStyle = old.sentenceStyle
  if (old.rhythm !== undefined) base.rhythm = old.rhythm
  if (old.narrativeDistance !== undefined) base.narrativeDistance = old.narrativeDistance

  // Merge new sub-properties (deep merge)
  if (old.language) base.language = { ...base.language, ...old.language }
  if (old.structure) base.structure = { ...base.structure, ...old.structure }
  if (old.narrative) base.narrative = { ...base.narrative, ...old.narrative }
  if (old.emotion) base.emotion = { ...base.emotion, ...old.emotion }
  if (old.thinking) base.thinking = { ...base.thinking, ...old.thinking }
  if (old.uniqueness) base.uniqueness = { ...base.uniqueness, ...old.uniqueness }
  if (old.cultural) base.cultural = { ...base.cultural, ...old.cultural }
  if (old.rhythmFull) base.rhythmFull = { ...base.rhythmFull, ...old.rhythmFull }

  return base
}

// ── Instruction Builder ─────────────────────────────────────────

export function buildStyleInstruction(style: WritingStyle, isZh: boolean): string {
  const lines: string[] = []

  if (isZh) {
    lines.push('写作风格要求：')

    // Emotion
    const toneMap: Record<string, string> = {
      warm: '温暖', formal: '正式', casual: '随性',
      humorous: '幽默', serious: '严肃', melancholic: '忧郁',
    }
    lines.push(`情感基调：${toneMap[style.tone] ?? style.tone}`)
    lines.push(`正式程度：${style.formality}/5`)
    lines.push(`情感强度：${style.emotionIntensity}/5`)
    lines.push(`创意度：${style.creativity}/5`)

    // Narrative
    const perspMap: Record<string, string> = {
      first: '第一人称', third: '第三人称', second: '第二人称', omniscient: '全知视角',
    }
    lines.push(`叙事视角：${perspMap[style.perspective] ?? style.perspective}`)

    // Language
    if (style.language.sentencePatterns.length > 0) {
      lines.push(`句式偏好：${style.language.sentencePatterns.join('、')}`)
    }
    if (style.language.rhetoric.length > 0) {
      lines.push(`修辞手法：${style.language.rhetoric.join('、')}`)
    }
    if (style.language.vocabulary.preferred.length > 0) {
      lines.push(`偏好词汇：${style.language.vocabulary.preferred.join('、')}`)
    }
    if (style.language.vocabulary.avoid.length > 0) {
      lines.push(`避免词汇：${style.language.vocabulary.avoid.join('、')}`)
    }

    // Structure
    const paraLenMap: Record<string, string> = {
      short: '短段落', medium: '中等段落', long: '长段落', varied: '多变长度',
    }
    lines.push(`段落长度：${paraLenMap[style.structure.paragraphLength] ?? style.structure.paragraphLength}`)

    // Thinking
    lines.push(`思维深度：${style.thinking.depth}/5`)

    // Uniqueness
    if (style.uniqueness.signaturePhrases.length > 0) {
      lines.push(`标志性短语：${style.uniqueness.signaturePhrases.join('、')}`)
    }
    if (style.uniqueness.imagerySystem.length > 0) {
      lines.push(`意象系统：${style.uniqueness.imagerySystem.join('、')}`)
    }

    // Rhythm
    lines.push(`文章节奏：${style.rhythm === 'brisk' ? '明快' : style.rhythm === 'leisurely' ? '舒缓' : '适中'}`)
    lines.push(`叙事距离：${style.narrativeDistance}/5`)
  } else {
    lines.push('Writing style requirements:')
    lines.push(`Tone: ${style.tone}`)
    lines.push(`Formality: ${style.formality}/5`)
    lines.push(`Emotion intensity: ${style.emotionIntensity}/5`)
    lines.push(`Creativity: ${style.creativity}/5`)
    lines.push(`Perspective: ${style.perspective}`)
    lines.push(`Paragraph length: ${style.structure.paragraphLength}`)
    lines.push(`Thinking depth: ${style.thinking.depth}/5`)
    lines.push(`Rhythm: ${style.rhythm}`)
    lines.push(`Narrative distance: ${style.narrativeDistance}/5`)

    if (style.language.sentencePatterns.length > 0) {
      lines.push(`Sentence patterns: ${style.language.sentencePatterns.join(', ')}`)
    }
    if (style.language.rhetoric.length > 0) {
      lines.push(`Rhetoric: ${style.language.rhetoric.join(', ')}`)
    }
    if (style.uniqueness.signaturePhrases.length > 0) {
      lines.push(`Signature phrases: ${style.uniqueness.signaturePhrases.join(', ')}`)
    }
  }

  return lines.join('；')
}

// ── Structured Style Export ─────────────────────────────────────

export interface StructuredStyle {
  tone: string
  perspective: string
  sentenceStyle: string
  rhythm: string
  languageStyle: LanguageStyle
  narrativeDistance: number
  emotionalResonance: EmotionStyle
  thematicDepth: number
}

export function buildStructuredStyle(style: WritingStyle): StructuredStyle {
  return {
    tone: style.tone,
    perspective: style.perspective,
    sentenceStyle: style.sentenceStyle,
    rhythm: style.rhythm,
    languageStyle: style.language,
    narrativeDistance: style.narrativeDistance,
    emotionalResonance: style.emotion,
    thematicDepth: style.thinking.depth,
  }
}

// ── Tag input helper ────────────────────────────────────────────

export function addTag(tags: string[], tag: string): string[] {
  const trimmed = tag.trim()
  if (!trimmed || tags.includes(trimmed)) return tags
  return [...tags, trimmed]
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag)
}

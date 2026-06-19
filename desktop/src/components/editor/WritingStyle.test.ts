import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_WRITING_STYLE,
  addTag,
  buildStructuredStyle,
  buildStyleInstruction,
  getPersistedStyleInstruction,
  getPersistedStyleRequirements,
  loadStyle,
  removeTag,
  saveStyle,
  type WritingStyle,
} from './WritingStyle'

const STYLE_STORAGE_KEY = 'niko.writing-helper-style-v1'

function makeStyle(overrides: Partial<WritingStyle> = {}): WritingStyle {
  const base = JSON.parse(JSON.stringify(DEFAULT_WRITING_STYLE)) as WritingStyle

  return {
    ...base,
    ...overrides,
    language: {
      ...base.language,
      ...overrides.language,
      vocabulary: {
        ...base.language.vocabulary,
        ...overrides.language?.vocabulary,
      },
    },
    structure: {
      ...base.structure,
      ...overrides.structure,
    },
    narrative: {
      ...base.narrative,
      ...overrides.narrative,
    },
    emotion: {
      ...base.emotion,
      ...overrides.emotion,
    },
    thinking: {
      ...base.thinking,
      ...overrides.thinking,
    },
    uniqueness: {
      ...base.uniqueness,
      ...overrides.uniqueness,
    },
    cultural: {
      ...base.cultural,
      ...overrides.cultural,
    },
    rhythmFull: {
      ...base.rhythmFull,
      ...overrides.rhythmFull,
    },
  }
}

describe('WritingStyle helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('loads defaults, migrates partial persisted styles, and ignores persistence errors', () => {
    expect(loadStyle()).toMatchObject(DEFAULT_WRITING_STYLE)

    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify({
        tone: 'formal',
        formality: 5,
        emotionIntensity: 4,
        creativity: 2,
        perspective: 'third',
        sentenceStyle: 'complex',
        rhythm: 'brisk',
        narrativeDistance: 1,
        language: {
          sentencePatterns: ['fragment'],
          vocabulary: { preferred: ['ember'] },
          rhetoric: ['contrast'],
        },
        structure: { paragraphLength: 'long' },
        narrative: { timeSequence: 'flashback' },
        emotion: { expressionStyle: 'passionate' },
        thinking: { logicPattern: 'deductive', depth: 5 },
        uniqueness: { signaturePhrases: ['red door'] },
        cultural: { allusions: ['myth'] },
        rhythmFull: { tempo: 'fast' },
      }),
    )

    expect(loadStyle()).toMatchObject({
      tone: 'formal',
      formality: 5,
      emotionIntensity: 4,
      creativity: 2,
      perspective: 'third',
      sentenceStyle: 'complex',
      rhythm: 'brisk',
      narrativeDistance: 1,
      language: expect.objectContaining({
        sentencePatterns: ['fragment'],
        vocabulary: expect.objectContaining({ preferred: ['ember'] }),
        rhetoric: ['contrast'],
      }),
      structure: expect.objectContaining({ paragraphLength: 'long' }),
      narrative: expect.objectContaining({ timeSequence: 'flashback' }),
      emotion: expect.objectContaining({ expressionStyle: 'passionate' }),
      thinking: expect.objectContaining({ logicPattern: 'deductive', depth: 5 }),
      uniqueness: expect.objectContaining({ signaturePhrases: ['red door'] }),
      cultural: expect.objectContaining({ allusions: ['myth'] }),
      rhythmFull: expect.objectContaining({ tempo: 'fast' }),
    })

    localStorage.setItem(STYLE_STORAGE_KEY, '{not-json')
    expect(loadStyle()).toMatchObject(DEFAULT_WRITING_STYLE)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is full')
    })
    expect(() => saveStyle(makeStyle({ tone: 'serious' }))).not.toThrow()
  })

  it('returns persisted instructions and strips raw or generated headers', () => {
    expect(getPersistedStyleInstruction('en')).toBe('')

    localStorage.setItem(STYLE_STORAGE_KEY, 'plain style note')
    expect(getPersistedStyleInstruction('en')).toBe('plain style note')
    expect(getPersistedStyleRequirements('en')).toBe('plain style note')

    localStorage.setItem(STYLE_STORAGE_KEY, 'Writing style requirements:')
    expect(getPersistedStyleRequirements('en')).toBe('')

    localStorage.setItem(STYLE_STORAGE_KEY, 'Writing style requirements: keep paragraphs short')
    expect(getPersistedStyleRequirements('en')).toBe('keep paragraphs short')

    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify(makeStyle({
        language: {
          sentencePatterns: ['short fragments'],
          vocabulary: { formality: 4, preferred: [], avoid: [] },
          rhetoric: ['motif'],
        },
        uniqueness: { signaturePhrases: ['blue hour'], imagerySystem: [] },
      })),
    )

    const instruction = getPersistedStyleInstruction('en')
    expect(instruction).toContain('Writing style requirements:')
    expect(instruction).toContain('Sentence patterns: short fragments')
    expect(getPersistedStyleRequirements('en')).not.toMatch(/^Writing style requirements:/)

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })
    expect(getPersistedStyleInstruction('en')).toBe('')
  })

  it('builds English, Chinese, fallback, and structured style outputs', () => {
    const decorated = makeStyle({
      tone: 'casual',
      perspective: 'omniscient',
      rhythm: 'leisurely',
      narrativeDistance: 5,
      language: {
        sentencePatterns: ['staccato'],
        vocabulary: { formality: 2, preferred: ['ember'], avoid: ['fog'] },
        rhetoric: ['contrast'],
      },
      structure: { paragraphLength: 'short', transitionStyle: 'direct', hierarchyPattern: 'flat' },
      emotion: { intensity: 4, expressionStyle: 'explicit', tone: 'casual' },
      thinking: { logicPattern: 'analogical', depth: 4, rhythm: 'exploratory' },
      uniqueness: { signaturePhrases: ['blue hour'], imagerySystem: ['glass'] },
    })

    const english = buildStyleInstruction(decorated, false)
    expect(english).toContain('Tone: casual')
    expect(english).toContain('Sentence patterns: staccato')
    expect(english).toContain('Rhetoric: contrast')
    expect(english).toContain('Signature phrases: blue hour')

    expect(buildStyleInstruction(makeStyle(), false)).toContain('Rhythm: moderate')
    expect(buildStyleInstruction(makeStyle({ rhythm: 'brisk' }), true)).toContain('/5')
    expect(buildStyleInstruction(makeStyle({ rhythm: 'leisurely' }), true)).toContain('/5')
    expect(buildStyleInstruction(makeStyle({ rhythm: 'moderate' }), true)).toContain('/5')

    const fallback = makeStyle({
      tone: 'custom-tone' as WritingStyle['tone'],
      perspective: 'close-third' as WritingStyle['perspective'],
      structure: {
        paragraphLength: 'micro' as WritingStyle['structure']['paragraphLength'],
        transitionStyle: 'smooth',
        hierarchyPattern: 'parallel',
      },
      language: {
        sentencePatterns: ['pulse'],
        vocabulary: { formality: 3, preferred: ['ash'], avoid: ['mist'] },
        rhetoric: ['echo'],
      },
      uniqueness: { signaturePhrases: ['iron rain'], imagerySystem: ['mirror'] },
    })

    const zh = buildStyleInstruction(fallback, true)
    expect(zh).toContain('custom-tone')
    expect(zh).toContain('close-third')
    expect(zh).toContain('micro')
    expect(zh).toContain('pulse')
    expect(zh).toContain('ash')
    expect(zh).toContain('mist')
    expect(zh).toContain('iron rain')
    expect(zh).toContain('mirror')

    expect(buildStructuredStyle(decorated)).toEqual({
      tone: 'casual',
      perspective: 'omniscient',
      sentenceStyle: 'flowing',
      rhythm: 'leisurely',
      languageStyle: decorated.language,
      narrativeDistance: 5,
      emotionalResonance: decorated.emotion,
      thematicDepth: 4,
    })
  })

  it('adds and removes tags without introducing blanks or duplicates', () => {
    const existing = ['ember']

    expect(addTag(existing, '   ')).toBe(existing)
    expect(addTag(existing, 'ember')).toBe(existing)
    expect(addTag(existing, '  ash  ')).toEqual(['ember', 'ash'])
    expect(removeTag(['ember', 'ash', 'ember'], 'ember')).toEqual(['ash'])
  })
})

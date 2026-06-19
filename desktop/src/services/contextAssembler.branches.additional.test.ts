import { describe, it, expect } from 'vitest'
import { assembleContext } from './contextAssembler'
import type { StyleProfile, buildStyleGuidance } from './styleProfile'

describe('assembleContext — branch coverage', () => {
  // Branch: options.storyBible is truthy but trim() is empty (line 27 falsy branch)
  it('skips story bible section when storyBible is only whitespace', () => {
    const result = assembleContext('张三说了什么。', { storyBible: '   \n\t  ' })
    expect(result).not.toContain('Story Bible')
  })

  // Branch: options.storyBible is undefined (line 27 falsy branch)
  it('skips story bible section when storyBible is undefined', () => {
    const result = assembleContext('张三说了什么。', {})
    expect(result).not.toContain('Story Bible')
  })

  // Branch: relevantExcerpts.length === 0 (line 29 falsy branch)
  // mentions exist but none match any story bible line
  it('skips story bible section when no mentions match any story bible line', () => {
    const result = assembleContext('张三说了什么。', {
      storyBible: '天空之城是故事的主要场景。\n海洋之心是另一条线索。',
    })
    expect(result).not.toContain('Story Bible')
  })

  // Branch: options.memoryEntries is truthy but empty array (line 37 falsy branch)
  it('skips memory section when memoryEntries is an empty array', () => {
    const result = assembleContext('张三说了什么。', { memoryEntries: [] })
    expect(result).not.toContain('Relevant Memories')
  })

  // Branch: options.memoryEntries is undefined (line 37 falsy branch)
  it('skips memory section when memoryEntries is undefined', () => {
    const result = assembleContext('张三说了什么。', {})
    expect(result).not.toContain('Relevant Memories')
  })

  // Branch: styleProfile provided without styleGuidanceBuilder (line 45 false)
  it('skips style section when styleProfile is provided but styleGuidanceBuilder is missing', () => {
    const profile: StyleProfile = {
      avgSentenceLength: 15,
      vocabRichness: 0.6,
      dialogueRatio: 0.3,
      tensePreference: 'past',
      avgParagraphLength: 50,
      sentenceLengthDistribution: [],
      dominantPOV: 'third',
      sampleHash: 'abc',
      extractedAt: '2025-01-01',
    }
    const result = assembleContext('张三说了什么。', { styleProfile: profile })
    expect(result).not.toContain('Target style')
  })

  // Branch: styleGuidanceBuilder provided without styleProfile (line 45 false)
  it('skips style section when styleGuidanceBuilder is provided but styleProfile is missing', () => {
    const mockBuilder: typeof buildStyleGuidance = (p) =>
      `## Style Guidance\nAvg sentence: ${p.avgSentenceLength}`
    const result = assembleContext('张三说了什么。', { styleGuidanceBuilder: mockBuilder })
    expect(result).not.toContain('Style Guidance')
  })

  // Branch: both styleProfile and styleGuidanceBuilder provided (line 45 true)
  it('includes style section when both styleProfile and styleGuidanceBuilder are provided', () => {
    const profile: StyleProfile = {
      avgSentenceLength: 15,
      vocabRichness: 0.6,
      dialogueRatio: 0.3,
      tensePreference: 'past',
      avgParagraphLength: 50,
      sentenceLengthDistribution: [],
      dominantPOV: 'third',
      sampleHash: 'abc',
      extractedAt: '2025-01-01',
    }
    const mockBuilder: typeof buildStyleGuidance = (p) =>
      `## Style Guidance\nAvg sentence: ${p.avgSentenceLength}`
    const result = assembleContext('张三说了什么。', {
      styleProfile: profile,
      styleGuidanceBuilder: mockBuilder,
    })
    expect(result).toContain('Style Guidance')
    expect(result).toContain('Avg sentence: 15')
  })

  // Branch: cjkNames is null — no CJK pattern match (line 56 falsy)
  it('extracts no CJK mentions from text without CJK name patterns', () => {
    const profiles = [{ name: '张三', description: '主角' }]
    const result = assembleContext('这是普通文本。', { characterProfiles: profiles })
    // No CJK name matched via the regex, so falls back to first 3 profiles
    expect(result).toContain('张三')
  })

  // Branch: engNames is null — no English capitalized names (line 63 falsy)
  it('extracts no English mentions from text without capitalized English words', () => {
    const result = assembleContext('lowercase text only here.', {
      storyBible: 'Alice met Bob at the castle.\nThey discussed the plan.',
    })
    // No English name matches, so extractRelevantExcerpts returns empty, no Story Bible section
    expect(result).not.toContain('Story Bible')
  })

  // Branch: English name matches but is a common word filtered out (line 66 truthy)
  it('filters out common English words from entity mentions', () => {
    const result = assembleContext('The cat sat on the mat. Then it left.', {
      storyBible: 'The is a special keyword here.\nThen the story continues.\nAlice went home.',
    })
    // "The" and "Then" are filtered as common words,
    // so no mentions match any story bible line → no Story Bible section
    expect(result).not.toContain('Story Bible')
  })

  // Branch: name.length >= 2 filter in CJK mention extraction (line 58)
  // The regex [一-鿿]{2,4} already only captures 2-4 char names, so the
  // name.length >= 2 guard is defensive. Verify that single-char results
  // would be filtered out: a 2-char CJK match should pass the filter.
  it('includes 2-char CJK names that pass the length >= 2 filter', () => {
    // "张三说" produces the CJK match "张三" (2 chars, passes filter)
    const profiles = [
      { name: '张三', description: '主角' },
      { name: '李四', description: '配角' },
      { name: '王五', description: '反派' },
    ]
    const result = assembleContext('张三说了一些话。', { characterProfiles: profiles })
    expect(result).toContain('张三')
    expect(result).toContain('Character Context')
  })

  // Branch: mentions.length === 0 in extractRelevantExcerpts (line 74 true)
  // When no mentions extracted, the function returns [] early
  it('extractRelevantExcerpts returns empty when no entity mentions exist', () => {
    const result = assembleContext('plain text without any names.', {
      storyBible: 'Alice and Bob went to the castle.',
    })
    // No entity mentions extracted → extractRelevantExcerpts short-circuits → no section
    expect(result).not.toContain('Story Bible')
  })

  // Branch: options.characterProfiles is truthy but empty array (line 16 falsy branch)
  it('skips character profiles section when characterProfiles is an empty array', () => {
    const result = assembleContext('张三说了什么。', { characterProfiles: [] })
    expect(result).not.toContain('Character Context')
  })

  // Combined: storyBible empty string (falsy) + memoryEntries empty + profiles empty
  it('returns empty string when all options are provided but empty', () => {
    const result = assembleContext('张三说了什么。', {
      storyBible: '',
      memoryEntries: [],
      characterProfiles: [],
    })
    expect(result).toBe('')
  })
})

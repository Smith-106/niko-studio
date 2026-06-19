import { describe, it, expect } from 'vitest'
import { extractStyleProfile, compareStyleProfiles, buildStyleGuidance } from './styleProfile'

describe('extractStyleProfile', () => {
  it('computes metrics for English text', () => {
    const text = 'The quick brown fox jumps over the lazy dog. She said hello to him. They went to the park together. The weather was nice that day.'
    const profile = extractStyleProfile(text)

    expect(profile.avgSentenceLength).toBeGreaterThan(0)
    expect(profile.vocabRichness).toBeGreaterThan(0)
    expect(profile.vocabRichness).toBeLessThanOrEqual(1)
    expect(profile.dialogueRatio).toBeGreaterThanOrEqual(0)
    expect(profile.tensePreference).toBeOneOf(['past', 'present', 'mixed'])
    expect(profile.dominantPOV).toBeOneOf(['first', 'third', 'mixed'])
    expect(profile.sampleHash).toBeTruthy()
  })

  it('computes metrics for Chinese text', () => {
    const text = '他说：「你好啊。」她笑了笑，然后回答说：「我很好，谢谢。」天气很热，大家都想回家。'
    const profile = extractStyleProfile(text)

    expect(profile.avgSentenceLength).toBeGreaterThan(0)
    expect(profile.dialogueRatio).toBeGreaterThan(0)
    expect(profile.sentenceLengthDistribution.length).toBe(5)
  })

  it('handles empty text', () => {
    const profile = extractStyleProfile('')
    expect(profile.avgSentenceLength).toBe(0)
    expect(profile.vocabRichness).toBe(0)
  })

  it('detects high dialogue ratio', () => {
    const text = '"Hello!" she said. "How are you?" he asked. "Fine," she replied. "Good," he nodded.'
    const profile = extractStyleProfile(text)
    expect(profile.dialogueRatio).toBeGreaterThan(0.5)
  })

  it('produces consistent hashes for same content', () => {
    const text = 'Some test content here.'
    const p1 = extractStyleProfile(text)
    const p2 = extractStyleProfile(text)
    expect(p1.sampleHash).toBe(p2.sampleHash)
  })

  it('produces different hashes for different content', () => {
    const p1 = extractStyleProfile('Content A.')
    const p2 = extractStyleProfile('Content B.')
    expect(p1.sampleHash).not.toBe(p2.sampleHash)
  })

  it('detects dominant first-person POV when first-person references clearly dominate', () => {
    const profile = extractStyleProfile(
      'I keep my notes close. We tell ourselves this is our road. My hands remember every turn.',
    )

    expect(profile.dominantPOV).toBe('first')
  })
})

describe('buildStyleGuidance', () => {
  it('produces readable guidance string', () => {
    const profile = extractStyleProfile('The cat sat on the mat. It was happy.')
    const guidance = buildStyleGuidance(profile)
    expect(guidance).toContain('Average sentence length')
    expect(guidance).toContain('Vocabulary richness')
    expect(guidance).toContain('Dialogue ratio')
  })
})

describe('compareStyleProfiles', () => {
  it('returns high similarity for identical profiles', () => {
    const profile = extractStyleProfile('The cat sat on the mat. It was happy.')
    const result = compareStyleProfiles(profile, profile)
    expect(result.overallSimilarity).toBe(1)
  })

  it('returns lower similarity for different texts', () => {
    const p1 = extractStyleProfile('Short sentence. Very brief. Terse.')
    const p2 = extractStyleProfile('This is a much longer sentence with significantly more words and vocabulary diversity than the first example provided above.')
    const result = compareStyleProfiles(p1, p2)
    expect(result.overallSimilarity).toBeLessThan(1)
    expect(result.differences.length).toBeGreaterThan(0)
  })

  it('clamps similarity using the fallback max scale for unknown metrics', () => {
    const profile = extractStyleProfile('The cat sat on the mat. It was happy.')
    const result = compareStyleProfiles(profile, {
      ...profile,
      avgSentenceLength: profile.avgSentenceLength + 5,
      // Force the reducer fallback path for unknown metric keys.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      differences: undefined as any,
    } as typeof profile)

    expect(result.overallSimilarity).toBeLessThan(1)
  })
})

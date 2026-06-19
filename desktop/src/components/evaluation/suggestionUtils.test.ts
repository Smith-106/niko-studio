import { describe, expect, it, vi } from 'vitest'

import type { Translations } from '../../i18n'
import {
  buildDimensions,
  buildSuggestionActionTemplate,
  buildWritingHelperPreset,
  detectSuggestionFocus,
  normalizeSuggestionPayloads,
} from './suggestionUtils'

const t = {
  evaluationDimensionLock: 'Lock',
  evaluationDimensionStyle: 'Style',
  evaluationDimensionLogic: 'Logic',
} as unknown as Translations

const translate = vi.fn((key: keyof Translations, params?: Record<string, string | number>) => {
  if (key === 'evaluationRecommendationFallback') {
    return `Recommendation ${params?.index}`
  }
  return String(key)
})

describe('suggestionUtils', () => {
  it('builds rounded core dimensions and module rows with fallback feedback', () => {
    const result = buildDimensions(
      {
        lock_score: 14,
        style_score: 17,
        logic_score: 19,
        actionable_feedback: '',
        module_scores: {
          pacing: 82.36,
          voice: 91.04,
        },
      },
      'Use the fallback note',
      t,
    )

    expect(result.core).toEqual([
      { name: 'Lock', score: 3.5, feedback: 'Use the fallback note' },
      { name: 'Style', score: 4.3, feedback: 'Use the fallback note' },
      { name: 'Logic', score: 4.8, feedback: 'Use the fallback note' },
    ])
    expect(result.modules).toEqual([
      { name: 'pacing', score: 82.4, feedback: '' },
      { name: 'voice', score: 91.0, feedback: '' },
    ])
  })

  it('normalizes string, invalid, and object suggestion payloads', () => {
    const payloads = normalizeSuggestionPayloads(
      [
        ' Tighten the stakes ',
        null,
        {
          id: ' rec-custom ',
          name: 'Sharpen pacing',
          feedback: 'Trim the setup',
          action: 'rewrite',
        },
        {
          recommendation: 'Clarify scene logic',
          reason: 'Keep the cause-effect chain visible',
        },
      ],
      translate,
    )

    expect(payloads).toEqual([
      {
        id: 'rec-01',
        title: 'Tighten the stakes',
        reason: 'Tighten the stakes',
        action: 'apply',
      },
      {
        id: 'rec-02',
        title: 'Recommendation 2',
        reason: 'Recommendation 2',
        action: 'apply',
      },
      {
        id: 'rec-custom',
        title: 'Sharpen pacing',
        reason: 'Sharpen pacing',
        action: 'rewrite',
      },
      {
        id: 'rec-04',
        title: 'Clarify scene logic',
        reason: 'Keep the cause-effect chain visible',
        action: 'apply',
      },
    ])
  })

  it('returns no suggestions when the payload is not an array', () => {
    expect(normalizeSuggestionPayloads(undefined, translate)).toEqual([])
    expect(normalizeSuggestionPayloads({ title: 'not an array' }, translate)).toEqual([])
  })

  it('detects every supported suggestion focus bucket', () => {
    expect(detectSuggestionFocus({ id: '1', title: 'Raise the conflict stakes', reason: 'More pressure', action: 'apply' })).toBe('conflict')
    expect(detectSuggestionFocus({ id: '2', title: 'Improve pacing rhythm', reason: 'Fix the tempo', action: 'apply' })).toBe('pacing')
    expect(detectSuggestionFocus({ id: '3', title: 'Reshape the structure', reason: 'Cleaner outline', action: 'apply' })).toBe('structure')
    expect(detectSuggestionFocus({ id: '4', title: 'Repair logic continuity', reason: 'Causal gap', action: 'apply' })).toBe('logic')
    expect(detectSuggestionFocus({ id: '5', title: 'Deepen the character arc', reason: 'Clearer motivation', action: 'apply' })).toBe('character')
    expect(detectSuggestionFocus({ id: '6', title: 'Sharpen dialogue voice', reason: 'Distinct cadence', action: 'apply' })).toBe('dialogue')
    expect(detectSuggestionFocus({ id: '7', title: 'Add concrete scene detail', reason: 'Stronger imagery', action: 'apply' })).toBe('detail')
    expect(detectSuggestionFocus({ id: '8', title: 'Refine style clarity', reason: 'More precise tone', action: 'apply' })).toBe('style')
    expect(detectSuggestionFocus({ id: '9', title: 'General improvement', reason: 'No keyword match', action: 'apply' })).toBe('generic')
  })

  it('maps suggestion focus to the expected writing helper presets', () => {
    expect(buildWritingHelperPreset('detail')).toEqual({ mode: 'expand', maxSentences: 5, maxItems: 6 })
    expect(buildWritingHelperPreset('style')).toEqual({ mode: 'polish', maxSentences: 3, maxItems: 6 })
    expect(buildWritingHelperPreset('structure')).toEqual({ mode: 'outline', maxSentences: 3, maxItems: 5 })
    expect(buildWritingHelperPreset('conflict')).toEqual({ mode: 'rewrite', maxSentences: 4, maxItems: 6 })
    expect(buildWritingHelperPreset('generic')).toEqual({ mode: 'rewrite', maxSentences: 3, maxItems: 6 })
  })

  it('builds localized action templates for zh and en paths', () => {
    const zhConflict = buildSuggestionActionTemplate('conflict', true)
    const zhPacing = buildSuggestionActionTemplate('pacing', true)
    const zhLogic = buildSuggestionActionTemplate('logic', true)
    const zhGeneric = buildSuggestionActionTemplate('generic', true)
    const enStyle = buildSuggestionActionTemplate('style', false)
    const enGeneric = buildSuggestionActionTemplate('generic', false)

    expect(zhConflict).toContain('1.')
    expect(zhConflict).toContain('3.')
    expect(zhPacing).toContain('有效动作')
    expect(zhLogic).toContain('因果链')
    expect(zhGeneric).toContain('完整改写版本')
    expect(enStyle).toContain('tone consistent')
    expect(enGeneric).toContain('single highest-value issue')
  })
})

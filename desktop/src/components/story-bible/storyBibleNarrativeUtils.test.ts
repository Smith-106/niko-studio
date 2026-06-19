import { describe, expect, it } from 'vitest'

import {
  buildNarrativeItemKind,
  buildNarrativeRecordId,
  parseOptionalNumber,
  slugifyRecordSegment,
} from './storyBibleNarrativeUtils'

describe('storyBibleNarrativeUtils', () => {
  it('parses optional numbers with empty and invalid fallbacks', () => {
    expect(parseOptionalNumber('')).toBeNull()
    expect(parseOptionalNumber('  12.5  ')).toBe(12.5)
    expect(parseOptionalNumber('not-a-number')).toBeNull()
  })

  it('slugifies record segments and falls back for punctuation-only titles', () => {
    expect(slugifyRecordSegment('  Chapter 01: A Door Opens!  ')).toBe('chapter-01-a-door-opens')
    expect(slugifyRecordSegment('  !!!  ')).toBe('record')
  })

  it('builds narrative item kinds and deterministic record ids', () => {
    expect(buildNarrativeItemKind('scene')).toBe('narrative-scene')
    expect(buildNarrativeRecordId('event', 'workspace-1', 'A Sudden Turn')).toBe('event-workspace-1-a-sudden-turn')
  })
})

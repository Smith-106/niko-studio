import { describe, expect, it } from 'vitest'

import { readString, readText } from './storyBibleTextUtils'

describe('storyBibleTextUtils', () => {
  it('reads finite numbers and strings as text', () => {
    expect(readText(42)).toBe('42')
    expect(readText('chapter synopsis')).toBe('chapter synopsis')
  })

  it('returns empty text for unsupported or non-finite values', () => {
    expect(readText(Number.POSITIVE_INFINITY)).toBe('')
    expect(readText({ title: 'Atlas' })).toBe('')
    expect(readText(null)).toBe('')
  })

  it('only returns direct strings from readString', () => {
    expect(readString('canon page')).toBe('canon page')
    expect(readString(42)).toBe('')
    expect(readString(undefined)).toBe('')
  })
})

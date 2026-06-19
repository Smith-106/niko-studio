import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildDraftPayload,
  clearLegacyStoryBibleDraft,
  isStyleId,
  loadFromStorage,
  parseGenres,
  removeFromStorage,
  STORY_BIBLE_DRAFT_VERSION,
  STORY_BIBLE_STORAGE_KEYS,
} from './storyBibleDraftUtils'

describe('storyBibleDraftUtils', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T13:15:00.000Z'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('loads stored values, falls back to empty strings, and swallows storage read errors', () => {
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.braindump, 'draft text')

    expect(loadFromStorage(STORY_BIBLE_STORAGE_KEYS.braindump)).toBe('draft text')
    expect(loadFromStorage(STORY_BIBLE_STORAGE_KEYS.synopsis)).toBe('')

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(loadFromStorage(STORY_BIBLE_STORAGE_KEYS.outline)).toBe('')

    getItemSpy.mockRestore()
  })

  it('removes individual keys, clears the full legacy draft set, and ignores storage remove failures', () => {
    Object.values(STORY_BIBLE_STORAGE_KEYS).forEach((key) => {
      localStorage.setItem(key, `${key}-value`)
    })

    removeFromStorage(STORY_BIBLE_STORAGE_KEYS.style)
    expect(localStorage.getItem(STORY_BIBLE_STORAGE_KEYS.style)).toBeNull()

    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.style, 'custom')
    clearLegacyStoryBibleDraft()

    Object.values(STORY_BIBLE_STORAGE_KEYS).forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull()
    })

    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(() => removeFromStorage(STORY_BIBLE_STORAGE_KEYS.synopsis)).not.toThrow()

    removeItemSpy.mockRestore()
  })

  it('recognizes valid style ids and rejects unsupported ones', () => {
    expect(isStyleId('tried')).toBe(true)
    expect(isStyleId('matchMy')).toBe(true)
    expect(isStyleId('soundsLike')).toBe(true)
    expect(isStyleId('custom')).toBe(true)
    expect(isStyleId('other')).toBe(false)
    expect(isStyleId('')).toBe(false)
  })

  it('parses genre arrays, JSON strings, comma-separated fallbacks, and invalid values', () => {
    expect(parseGenres([' fantasy ', 'mystery', '', 42, '   '])).toEqual([' fantasy ', 'mystery'])
    expect(parseGenres('["fantasy","mystery","",7]')).toEqual(['fantasy', 'mystery'])
    expect(parseGenres('fantasy, mystery , , thriller')).toEqual(['fantasy', 'mystery', 'thriller'])
    expect(parseGenres('   ')).toEqual([])
    expect(parseGenres({ genres: ['fantasy'] })).toEqual([])
  })

  it('builds a normalized export payload with a stable version and timestamp', () => {
    const draft = {
      braindump: 'brainstorm',
      genres: ['fantasy', 'thriller'],
      synopsis: 'Short synopsis',
      outline: 'Outline beats',
      style: 'custom',
    }

    expect(buildDraftPayload(draft)).toEqual({
      version: STORY_BIBLE_DRAFT_VERSION,
      kind: 'story-bible-local-draft',
      exportedAt: '2026-06-05T13:15:00.000Z',
      draft,
    })
  })
})

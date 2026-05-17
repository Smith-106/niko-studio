export const STORY_BIBLE_DRAFT_VERSION = '1.0'

export const STORY_BIBLE_STORAGE_KEYS = {
  braindump: 'niko.sb-braindump-v1',
  genres: 'niko.sb-genres-v1',
  synopsis: 'niko.sb-synopsis-v1',
  outline: 'niko.sb-outline-v1',
  style: 'niko.sb-style-v1',
} as const

export type StoryBibleDraftPayload = {
  version: string
  kind: 'story-bible-local-draft'
  exportedAt: string
  draft: {
    braindump: string
    genres: string[]
    synopsis: string
    outline: string
    style: string
  }
}

export function loadFromStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

export function removeFromStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function clearLegacyStoryBibleDraft() {
  Object.values(STORY_BIBLE_STORAGE_KEYS).forEach(removeFromStorage)
}

export function isStyleId(value: string): value is 'tried' | 'matchMy' | 'soundsLike' | 'custom' {
  return ['tried', 'matchMy', 'soundsLike', 'custom'].includes(value)
}

export function parseGenres(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      }
    } catch {
      return value.split(',').map((entry) => entry.trim()).filter(Boolean)
    }
  }
  return []
}

export function buildDraftPayload(draft: StoryBibleDraftPayload['draft']): StoryBibleDraftPayload {
  return {
    version: STORY_BIBLE_DRAFT_VERSION,
    kind: 'story-bible-local-draft',
    exportedAt: new Date().toISOString(),
    draft,
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildLegacyDraftPayload,
  GENRE_PRESETS_ZH,
  readCanonCopy,
  readNarrativeAuthoringCopy,
  readSyncCopy,
} from './storyBiblePanelUtils'
import {
  STORY_BIBLE_DRAFT_VERSION,
  STORY_BIBLE_STORAGE_KEYS,
} from './storyBibleDraftUtils'

describe('storyBiblePanelUtils', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns localized narrative authoring copy', () => {
    const zh = readNarrativeAuthoringCopy('zh')
    const en = readNarrativeAuthoringCopy('en')

    expect(GENRE_PRESETS_ZH).toContain('奇幻')
    expect(zh.scene.sectionTitle).toBe('场景')
    expect(zh.timeline.modeNarrative).toBe('叙事时间')
    expect(en.scene.sectionTitle).toBe('Scenes')
    expect(en.event.summaryPlaceholder).toContain('participants')
    expect(en.timeline.modeStory).toBe('Story time')
  })

  it('returns null when no legacy draft exists in storage', () => {
    expect(buildLegacyDraftPayload()).toBeNull()
  })

  it('builds a normalized legacy draft payload from storage', () => {
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.braindump, '世界观草稿')
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.genres, '奇幻, 悬疑 , , ')
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.synopsis, '一段概要')
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.outline, '第一幕\n第二幕')
    localStorage.setItem(STORY_BIBLE_STORAGE_KEYS.style, 'unsupported-style')

    expect(buildLegacyDraftPayload()).toEqual({
      version: STORY_BIBLE_DRAFT_VERSION,
      kind: 'story-bible-local-draft',
      exportedAt: '2026-06-03T12:00:00.000Z',
      draft: {
        braindump: '世界观草稿',
        genres: ['奇幻', '悬疑'],
        synopsis: '一段概要',
        outline: '第一幕\n第二幕',
        style: 'tried',
      },
    })
  })

  it('maps sync-state and canon copy for both languages', () => {
    expect(readSyncCopy('zh', 'loading')).toBe('正在加载工作区 Story Bible...')
    expect(readSyncCopy('zh', 'saving')).toBe('正在同步到当前工作区...')
    expect(readSyncCopy('zh', 'saved')).toBe('已同步到当前工作区')
    expect(readSyncCopy('zh', 'error')).toBe('同步失败，请稍后重试')
    expect(readSyncCopy('zh', 'idle')).toBe('等待新的工作区改动')

    expect(readSyncCopy('en', 'loading')).toBe('Loading workspace Story Bible...')
    expect(readSyncCopy('en', 'saving')).toBe('Syncing to the active workspace...')
    expect(readSyncCopy('en', 'saved')).toBe('Synced to the active workspace')
    expect(readSyncCopy('en', 'error')).toBe('Sync failed. Please try again.')
    expect(readSyncCopy('en', 'idle')).toBe('Waiting for workspace edits')

    const zhCanon = readCanonCopy('zh')
    const enCanon = readCanonCopy('en')

    expect(zhCanon.promoteSynopsis).toBe('提升概要到 Canon')
    expect(zhCanon.reviewLoadFailed).toBe('刷新 canon 列表失败。')
    expect(enCanon.promoteSynopsis).toBe('Promote Synopsis to Canon')
    expect(enCanon.reviewHint).toContain('read-only view')
    expect(enCanon.reviewSelectHint).toContain('Select a canon page')
  })
})

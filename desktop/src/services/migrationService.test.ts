import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./projectFileService', () => ({
  writeProjectMeta: vi.fn(),
  writeChapterContent: vi.fn(),
  readChapterContent: vi.fn(),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}))

import {
  isMigrated,
  backupLocalStorage,
  restoreFromBackup,
  plainTextToTipTap,
  migrateFromLocalStorage,
} from './migrationService'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('migrationService', () => {
  describe('isMigrated', () => {
    it('returns false when flag not set', () => {
      expect(isMigrated()).toBe(false)
    })

    it('returns true when flag is set', () => {
      localStorage.setItem('niko.migrated', 'true')
      expect(isMigrated()).toBe(true)
    })
  })

  describe('backupLocalStorage', () => {
    it('backs up draft keys', () => {
      localStorage.setItem('niko.draft:conv1', '{"text":"hello"}')
      const count = backupLocalStorage()
      expect(count).toBe(1)
      expect(localStorage.getItem('niko.draft.backup:conv1')).toBe('{"text":"hello"}')
    })
  })

  describe('restoreFromBackup', () => {
    it('restores backup keys and clears flag', () => {
      localStorage.setItem('niko.draft.backup:conv1', '{"text":"restored"}')
      localStorage.setItem('niko.migrated', 'true')

      const result = restoreFromBackup()
      expect(result).toBe(true)
      expect(localStorage.getItem('niko.draft:conv1')).toBe('{"text":"restored"}')
      expect(localStorage.getItem('niko.migrated')).toBeNull()
    })
  })

  describe('plainTextToTipTap', () => {
    it('converts empty text to empty doc', () => {
      const result = plainTextToTipTap('')
      const parsed = JSON.parse(result)
      expect(parsed.type).toBe('doc')
      expect(parsed.content).toEqual([])
    })

    it('converts single line to paragraph', () => {
      const result = plainTextToTipTap('hello')
      const parsed = JSON.parse(result)
      expect(parsed.content).toHaveLength(1)
      expect(parsed.content[0].type).toBe('paragraph')
      expect(parsed.content[0].content[0].text).toBe('hello')
    })

    it('converts multi-line text to multiple paragraphs', () => {
      const result = plainTextToTipTap('line1\nline2')
      const parsed = JSON.parse(result)
      expect(parsed.content).toHaveLength(2)
    })

    it('handles blank lines', () => {
      const result = plainTextToTipTap('line1\n\nline3')
      const parsed = JSON.parse(result)
      expect(parsed.content).toHaveLength(3)
      expect(parsed.content[1].type).toBe('paragraph')
    })
  })

  describe('migrateFromLocalStorage', () => {
    it('returns early if already migrated', async () => {
      localStorage.setItem('niko.migrated', 'true')
      const result = await migrateFromLocalStorage()
      expect(result.success).toBe(true)
      expect(result.chaptersMigrated).toBe(0)
    })

    it('returns early when no drafts exist', async () => {
      const result = await migrateFromLocalStorage()
      expect(result.success).toBe(true)
      expect(result.chaptersMigrated).toBe(0)
    })

    it('migrates drafts to project structure', async () => {
      localStorage.setItem('niko.draft:conv1', '{"text":"hello","timestamp":1}')
      localStorage.setItem('niko.draft:conv2', '{"text":"world","timestamp":2}')

      const { writeProjectMeta, writeChapterContent, readChapterContent } =
        await import('./projectFileService')
      vi.mocked(readChapterContent).mockResolvedValue('content')

      const { useAppStore } = await import('../stores/appStore')
      const mockLoadProjectMeta = vi.fn()
      const mockSelectProject = vi.fn()
      const mockSelectChapter = vi.fn()
      vi.mocked(useAppStore.getState).mockReturnValue({
        loadProjectMeta: mockLoadProjectMeta,
        selectProject: mockSelectProject,
        selectChapter: mockSelectChapter,
      } as never)

      const result = await migrateFromLocalStorage()

      expect(result.success).toBe(true)
      expect(result.chaptersMigrated).toBe(2)
      expect(vi.mocked(writeProjectMeta)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(writeChapterContent)).toHaveBeenCalledTimes(2)
      expect(mockLoadProjectMeta).toHaveBeenCalled()
      expect(localStorage.getItem('niko.migrated')).toBe('true')
    })

    it('returns failure on error', async () => {
      localStorage.setItem('niko.draft:conv1', '{"text":"hello"}')

      const { writeProjectMeta } = await import('./projectFileService')
      vi.mocked(writeProjectMeta).mockRejectedValue(new Error('write failed'))

      const result = await migrateFromLocalStorage()
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })
})

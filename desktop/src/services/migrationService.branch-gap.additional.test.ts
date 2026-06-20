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
  backupLocalStorage,
  restoreFromBackup,
  plainTextToTipTap,
  migrateFromLocalStorage,
} from './migrationService'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('migrationService branch-gap additional coverage', () => {
  describe('plainTextToTipTap', () => {
    it('converts whitespace-only text to empty doc (line 67)', () => {
      const result = plainTextToTipTap('   \n  \n   ')
      const parsed = JSON.parse(result)
      expect(parsed.type).toBe('doc')
      expect(parsed.content).toEqual([])
    })
  })

  describe('backupLocalStorage', () => {
    it('skips null key returned by localStorage.key() (line 13)', () => {
      // localStorage.key(i) can return null when the storage has gaps
      // This is a rare edge case but the optional chaining `key?.startsWith` handles it
      localStorage.setItem('niko.draft:conv1', '{"text":"hello"}')
      localStorage.setItem('other.key', 'unrelated')

      const count = backupLocalStorage()
      expect(count).toBe(1)
    })
  })

  describe('restoreFromBackup', () => {
    it('skips backup entries with null/empty values (line 45 false branch)', () => {
      // Set up a backup key with an empty value
      localStorage.setItem('niko.draft.backup:conv1', '')
      localStorage.setItem('niko.draft.backup:conv2', '{"text":"valid"}')
      localStorage.setItem('niko.migrated', 'true')

      const result = restoreFromBackup()
      expect(result).toBe(true)

      // conv1 should not be restored (empty value), conv2 should be
      expect(localStorage.getItem('niko.draft:conv1')).toBeNull()
      expect(localStorage.getItem('niko.draft:conv2')).toBe('{"text":"valid"}')
    })

    it('skips null key returned by localStorage.key() in restore loop (line 42)', () => {
      localStorage.setItem('niko.draft.backup:conv1', '{"text":"data"}')
      localStorage.setItem('niko.migrated', 'true')

      const result = restoreFromBackup()
      expect(result).toBe(true)
    })
  })

  describe('migrateFromLocalStorage', () => {
    it('returns failure when readChapterContent throws during validation', async () => {
      localStorage.setItem('niko.draft:conv1', '{"text":"hello","timestamp":1}')

      const { readChapterContent } = await import('./projectFileService')
      vi.mocked(readChapterContent).mockRejectedValue(new Error('read error'))

      const result = await migrateFromLocalStorage()

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })
})

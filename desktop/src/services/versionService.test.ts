import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./projectFileService', () => ({
  getSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  shouldAutoSave: vi.fn(),
  readChapterContent: vi.fn(),
  createSnapshot: vi.fn(),
  enforceRetentionPolicy: vi.fn(),
}))

vi.mock('diff', () => ({
  diffLines: vi.fn(),
}))

import { diffSnapshots, autoSaveSnapshot } from './versionService'
import * as fs from './projectFileService'
import * as Diff from 'diff'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('versionService', () => {
  describe('diffSnapshots', () => {
    it('returns empty when snapshot not found', async () => {
      vi.mocked(fs.getSnapshot).mockResolvedValue(null)
      const result = await diffSnapshots('p1', 'c1', 'v1', 'v2')
      expect(result).toEqual([])
    })

    it('computes line diff between snapshots', async () => {
      vi.mocked(fs.getSnapshot)
        .mockResolvedValueOnce({ id: 'v1', textContent: 'line1\nline2' })
        .mockResolvedValueOnce({ id: 'v2', textContent: 'line1\nline3' })

      vi.mocked(Diff.diffLines).mockReturnValue([
        { value: 'line1\n', added: false, removed: false, count: 1 },
        { value: 'line2\n', added: false, removed: true, count: 1 },
        { value: 'line3', added: true, removed: false, count: 1 },
      ])

      const result = await diffSnapshots('p1', 'c1', 'v1', 'v2')
      expect(result.length).toBeGreaterThan(0)
      expect(result.some((r) => r.type === 'removed')).toBe(true)
      expect(result.some((r) => r.type === 'added')).toBe(true)
    })
  })

  describe('autoSaveSnapshot', () => {
    it('skips when auto-save not needed', async () => {
      vi.mocked(fs.listSnapshots).mockResolvedValue({
        snapshots: [{ id: 's1', chapterId: 'c1', contentHash: 'h1', content: '', textContent: '', timestamp: new Date().toISOString() }],
      } as any)
      vi.mocked(fs.shouldAutoSave).mockResolvedValue(false)

      const result = await autoSaveSnapshot('p1', 'c1')
      expect(result).toBeNull()
    })

    it('skips when content is empty', async () => {
      vi.mocked(fs.listSnapshots).mockResolvedValue({ snapshots: [] })
      vi.mocked(fs.shouldAutoSave).mockResolvedValue(true)
      vi.mocked(fs.readChapterContent).mockResolvedValue('')

      const result = await autoSaveSnapshot('p1', 'c1')
      expect(result).toBeNull()
    })

    it('creates snapshot and enforces retention', async () => {
      vi.mocked(fs.listSnapshots).mockResolvedValue({ snapshots: [] })
      vi.mocked(fs.shouldAutoSave).mockResolvedValue(true)
      vi.mocked(fs.readChapterContent).mockResolvedValue('content')
      vi.mocked(fs.createSnapshot).mockResolvedValue('snap-1')
      vi.mocked(fs.enforceRetentionPolicy).mockResolvedValue(0)

      const result = await autoSaveSnapshot('p1', 'c1')
      expect(result).toBe('snap-1')
      expect(fs.enforceRetentionPolicy).toHaveBeenCalledWith('p1', 'c1')
    })
  })
})

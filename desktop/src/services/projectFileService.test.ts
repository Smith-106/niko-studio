import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

import {
  projectExists,
  readProjectMeta,
  writeProjectMeta,
  listProjectIds,
  readChapterContent,
  writeChapterContent,
  deleteChapterDir,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  restoreSnapshot,
  shouldAutoSave,
  enforceRetentionPolicy,
} from './projectFileService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('projectFileService', () => {
  describe('projectExists', () => {
    it('returns true when meta.json exists', async () => {
      mockFs.exists.mockResolvedValue(true)
      await expect(projectExists('p1')).resolves.toBe(true)
    })

    it('returns false when meta.json missing', async () => {
      mockFs.exists.mockResolvedValue(false)
      await expect(projectExists('missing')).resolves.toBe(false)
    })
  })

  describe('readProjectMeta', () => {
    it('reads and parses meta.json', async () => {
      const meta = { project: { id: 'p1', name: 'Test' }, volumes: [], chapters: [] }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(meta))
      const result = await readProjectMeta('p1')
      expect(result?.project.name).toBe('Test')
    })

    it('returns null on read failure', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))
      await expect(readProjectMeta('bad')).resolves.toBeNull()
    })
  })

  describe('writeProjectMeta', () => {
    it('creates directory and writes file', async () => {
      mockFs.exists.mockResolvedValue(false)
      const meta = { project: { id: 'p1', name: 'Test', createdAt: '', updatedAt: '' }, volumes: [], chapters: [] }
      await writeProjectMeta(meta)
      expect(mockFs.mkdir).toHaveBeenCalled()
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })
  })

  describe('listProjectIds', () => {
    it('lists project directories', async () => {
      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([
        { name: 'proj1', isDirectory: true },
        { name: 'proj2', isDirectory: true },
        { name: '.hidden', isDirectory: true },
        { name: 'file.txt', isDirectory: false },
      ])
      const ids = await listProjectIds()
      expect(ids).toEqual(['proj1', 'proj2'])
    })

    it('returns empty when projects root missing', async () => {
      mockFs.exists.mockResolvedValue(false)
      const ids = await listProjectIds()
      expect(ids).toEqual([])
    })
  })

  describe('chapter content', () => {
    it('reads chapter content', async () => {
      mockFs.readTextFile.mockResolvedValue('hello')
      await expect(readChapterContent('p1', 'c1')).resolves.toBe('hello')
    })

    it('returns empty string on failure', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('fail'))
      await expect(readChapterContent('p1', 'c1')).resolves.toBe('')
    })

    it('writes chapter content with dir creation', async () => {
      mockFs.exists.mockResolvedValue(false)
      await writeChapterContent('p1', 'c1', 'data')
      expect(mockFs.mkdir).toHaveBeenCalled()
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })
  })

  describe('deleteChapterDir', () => {
    it('removes directory when exists', async () => {
      mockFs.exists.mockResolvedValue(true)
      await deleteChapterDir('p1', 'c1')
      expect(mockFs.remove).toHaveBeenCalled()
    })

    it('no-ops when directory missing', async () => {
      mockFs.exists.mockResolvedValue(false)
      await deleteChapterDir('p1', 'c1')
      expect(mockFs.remove).not.toHaveBeenCalled()
    })
  })

  describe('snapshot operations', () => {
    it('creates snapshot and updates index', async () => {
      mockFs.exists.mockResolvedValue(true)
      mockFs.readTextFile.mockRejectedValue(new Error('no index'))

      const id = await createSnapshot('p1', 'c1', 'content')
      expect(id).toBeTruthy()
      expect(mockFs.writeTextFile).toHaveBeenCalledTimes(2)
    })

    it('lists snapshots from index', async () => {
      const index = { snapshots: [{ id: 'v1' }] }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(index))
      const result = await listSnapshots('p1', 'c1')
      expect(result.snapshots).toHaveLength(1)
    })

    it('returns empty index on failure', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('fail'))
      const result = await listSnapshots('p1', 'c1')
      expect(result.snapshots).toHaveLength(0)
    })

    it('gets snapshot by id', async () => {
      const snap = { id: 'v1', content: 'data' }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(snap))
      const result = await getSnapshot('p1', 'c1', 'v1')
      expect(result?.id).toBe('v1')
    })

    it('returns null for missing snapshot', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('fail'))
      await expect(getSnapshot('p1', 'c1', 'v1')).resolves.toBeNull()
    })

    it('restores snapshot content', async () => {
      const snap = { id: 'v1', content: 'restored content' }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(snap))
      mockFs.exists.mockResolvedValue(true)

      const content = await restoreSnapshot('p1', 'c1', 'v1')
      expect(content).toBe('restored content')
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })

    it('returns null when snapshot not found', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('fail'))
      await expect(restoreSnapshot('p1', 'c1', 'v1')).resolves.toBeNull()
    })
  })

  describe('auto-save and retention', () => {
    it('should auto-save when no last snapshot', async () => {
      await expect(shouldAutoSave(null)).resolves.toBe(true)
    })

    it('should not auto-save within 5 minutes', async () => {
      const recent = new Date().toISOString()
      await expect(shouldAutoSave(recent)).resolves.toBe(false)
    })

    it('should auto-save after 5 minutes', async () => {
      const old = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      await expect(shouldAutoSave(old)).resolves.toBe(true)
    })

    it('enforceRetentionPolicy removes excess unnamed snapshots', async () => {
      const snapshots = Array.from({ length: 55 }, (_, i) => ({
        id: `v${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        label: i < 10 ? `named-${i}` : undefined,
      }))
      mockFs.readTextFile.mockResolvedValue(JSON.stringify({ snapshots }))
      mockFs.exists.mockResolvedValue(true)

      const removed = await enforceRetentionPolicy('p1', 'c1', 50)
      expect(removed).toBeGreaterThan(0)
      expect(mockFs.remove).toHaveBeenCalled()
    })

    it('no-ops when within limit', async () => {
      const snapshots = [{ id: 'v1', timestamp: new Date().toISOString() }]
      mockFs.readTextFile.mockResolvedValue(JSON.stringify({ snapshots }))

      const removed = await enforceRetentionPolicy('p1', 'c1', 50)
      expect(removed).toBe(0)
    })
  })
})

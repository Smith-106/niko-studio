import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
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
  clearChapterContentCache,
  getChapterContentCacheSize,
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
      mockFs.stat.mockResolvedValue({ mtime: new Date(1000) })
      mockFs.readTextFile.mockResolvedValue('hello')
      await expect(readChapterContent('p1', 'c1')).resolves.toBe('hello')
    })

    it('returns empty string on failure', async () => {
      mockFs.stat.mockRejectedValue(new Error('fail'))
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

  describe('章节内容缓存', () => {
    // 每个测试前清空缓存
    beforeEach(() => {
      clearChapterContentCache()
    })

    it('首次读取后应缓存内容，第二次读取不调用 readTextFile', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile.mockResolvedValue('缓存测试内容')

      // 首次读取 — 缓存未命中
      const content1 = await readChapterContent('proj1', 'ch1')
      expect(content1).toBe('缓存测试内容')
      expect(mockFs.readTextFile).toHaveBeenCalledTimes(1)

      // 第二次读取 — 缓存命中（mtime 相同）
      mockFs.readTextFile.mockClear()
      const content2 = await readChapterContent('proj1', 'ch1')
      expect(content2).toBe('缓存测试内容')
      expect(mockFs.readTextFile).toHaveBeenCalledTimes(0) // 不再读文件
    })

    it('mtime 变化后缓存应失效', async () => {
      const mtime1 = new Date(1000)
      const mtime2 = new Date(2000)
      mockFs.stat.mockResolvedValue({ mtime: mtime1 })
      mockFs.readTextFile.mockResolvedValue('原始内容')

      // 首次读取并缓存
      await readChapterContent('proj1', 'ch1')

      // mtime 变化 → 缓存失效
      mockFs.stat.mockResolvedValue({ mtime: mtime2 })
      mockFs.readTextFile.mockResolvedValue('更新后内容')

      const content = await readChapterContent('proj1', 'ch1')
      expect(content).toBe('更新后内容')
      expect(mockFs.readTextFile).toHaveBeenCalledTimes(2) // 重新读取文件
    })

    it('writeChapterContent 后缓存应失效', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile.mockResolvedValue('旧内容')

      // 首次读取并缓存
      await readChapterContent('proj1', 'ch1')
      expect(getChapterContentCacheSize()).toBe(1)

      // 写入后缓存失效
      await writeChapterContent('proj1', 'ch1', '新内容')

      // 缓存已被 invalidate 清除，下次读取需重新从文件加载
      mockFs.readTextFile.mockClear()
      await readChapterContent('proj1', 'ch1')
      expect(mockFs.readTextFile).toHaveBeenCalledTimes(1)
    })

    it('deleteChapterDir 后缓存应失效', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile.mockResolvedValue('待删除内容')
      mockFs.exists.mockResolvedValue(false)

      // 首次读取并缓存
      await readChapterContent('proj1', 'ch1')
      expect(getChapterContentCacheSize()).toBe(1)

      // 删除章节目录
      await deleteChapterDir('proj1', 'ch1')

      // 缓存已被清除
      expect(getChapterContentCacheSize()).toBe(0)
    })

    it('不同 projectId/chapterId 应独立缓存', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile
        .mockResolvedValueOnce('项目1内容')
        .mockResolvedValueOnce('项目2内容')

      await readChapterContent('proj1', 'ch1')
      await readChapterContent('proj2', 'ch1')

      expect(getChapterContentCacheSize()).toBe(2)
    })

    it('clearChapterContentCache 应清空全部缓存', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile.mockResolvedValue('内容')

      await readChapterContent('proj1', 'ch1')
      await readChapterContent('proj1', 'ch2')
      expect(getChapterContentCacheSize()).toBe(2)

      clearChapterContentCache()
      expect(getChapterContentCacheSize()).toBe(0)
    })

    it('文件不存在时应返回空字符串且不缓存', async () => {
      mockFs.stat.mockRejectedValue(new Error('file not found'))

      const content = await readChapterContent('proj1', 'missing')
      expect(content).toBe('')
      expect(getChapterContentCacheSize()).toBe(0)
    })

    it('LRU 淘汰：超过上限时淘汰最久未使用的条目', async () => {
      const mtime = new Date(1000)
      mockFs.stat.mockResolvedValue({ mtime })
      mockFs.readTextFile.mockResolvedValue('内容')

      // 填充缓存到 500 条
      for (let i = 0; i < 500; i++) {
        await readChapterContent('proj1', `ch${i}`)
      }
      expect(getChapterContentCacheSize()).toBe(500)

      // 再添加一条，应淘汰 ch0（最久未使用）
      await readChapterContent('proj1', 'ch500')
      expect(getChapterContentCacheSize()).toBe(500)

      // ch0 应已被淘汰 — 需要重新读取
      mockFs.readTextFile.mockClear()
      await readChapterContent('proj1', 'ch0')
      expect(mockFs.readTextFile).toHaveBeenCalledTimes(1) // 缓存未命中
    })
  })
})

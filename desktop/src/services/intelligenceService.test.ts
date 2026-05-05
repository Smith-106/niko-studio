import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

const mockReadChapterContent = vi.fn()
vi.mock('./projectFileService', () => ({
  readChapterContent: (...args: unknown[]) => mockReadChapterContent(...args),
}))

const mockCallAnalysisAgent = vi.fn()
vi.mock('../api/intelligence', () => ({
  callAnalysisAgent: (...args: unknown[]) => mockCallAnalysisAgent(...args),
}))

import { analyzeProject, getCachedAnalysis, invalidateAnalysis } from './intelligenceService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intelligenceService', () => {
  describe('getCachedAnalysis', () => {
    it('returns parsed cache entry', async () => {
      const entry = { module: 'pacing', result: { module: 'pacing' }, contentHashes: {}, updatedAt: '' }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(entry))
      const result = await getCachedAnalysis('p1', 'pacing')
      expect(result).toEqual(entry)
    })

    it('returns null on read failure', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))
      const result = await getCachedAnalysis('p1', 'pacing')
      expect(result).toBeNull()
    })
  })

  describe('invalidateAnalysis', () => {
    it('removes analysis directory when it exists', async () => {
      mockFs.exists.mockResolvedValue(true)
      await invalidateAnalysis('p1')
      expect(mockFs.remove).toHaveBeenCalledWith('projects/p1/analysis', { recursive: true })
    })

    it('does nothing when directory does not exist', async () => {
      mockFs.exists.mockResolvedValue(false)
      await invalidateAnalysis('p1')
      expect(mockFs.remove).not.toHaveBeenCalled()
    })
  })

  describe('analyzeProject', () => {
    const projectId = 'p1'
    const module = 'character_arc'
    const chapterIds = ['ch1', 'ch2']

    beforeEach(() => {
      mockReadChapterContent.mockImplementation(async (_pid: string, chId: string) =>
        `Content of ${chId}`)
      mockFs.readTextFile.mockRejectedValue(new Error('no cache'))
      mockFs.exists.mockResolvedValue(false)
      mockCallAnalysisAgent.mockResolvedValue({ success: true, data: { score: 80 } })
    })

    it('analyzes all chapters and writes cache', async () => {
      const result = await analyzeProject(projectId, module, chapterIds)

      expect(mockReadChapterContent).toHaveBeenCalledTimes(2)
      expect(mockCallAnalysisAgent).toHaveBeenCalledTimes(2)
      expect(result.module).toBe(module)
      expect(result.projectId).toBe(projectId)
      expect(result.chaptersAnalyzed).toEqual(chapterIds)
      expect(result.result.totalAnalyzed).toBe(2)
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })

    it('calls onProgress per chapter', async () => {
      const onProgress = vi.fn()
      await analyzeProject(projectId, module, chapterIds, false, onProgress)
      expect(onProgress).toHaveBeenCalledTimes(2)
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
    })

    it('returns cached result when all hashes match', async () => {
      // Run once to populate hashes, then mock cache for second run
      const firstResult = await analyzeProject(projectId, module, chapterIds)
      const writeCall = mockFs.writeTextFile.mock.calls[0]
      const cacheEntry = JSON.parse(writeCall[1])

      mockFs.readTextFile.mockResolvedValue(JSON.stringify(cacheEntry))
      mockFs.exists.mockResolvedValue(true)

      const secondResult = await analyzeProject(projectId, module, chapterIds)
      expect(secondResult.createdAt).toBe(firstResult.createdAt)
      expect(mockCallAnalysisAgent).toHaveBeenCalledTimes(2) // only from first run
    })

    it('skips unchanged chapters on incremental re-analysis', async () => {
      await analyzeProject(projectId, module, chapterIds)
      const writeCall = mockFs.writeTextFile.mock.calls[0]
      const cacheEntry = JSON.parse(writeCall[1])

      // Change ch1 content but keep ch2 the same
      mockReadChapterContent.mockImplementation(async (_pid: string, chId: string) =>
        chId === 'ch1' ? 'NEW CONTENT' : `Content of ${chId}`)
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(cacheEntry))
      mockFs.exists.mockResolvedValue(true)
      mockCallAnalysisAgent.mockClear()

      await analyzeProject(projectId, module, chapterIds)
      expect(mockCallAnalysisAgent).toHaveBeenCalledTimes(1) // only ch1 re-analyzed
    })

    it('forceRefresh ignores cache', async () => {
      await analyzeProject(projectId, module, chapterIds)
      const writeCall = mockFs.writeTextFile.mock.calls[0]
      const cacheEntry = JSON.parse(writeCall[1])

      mockFs.readTextFile.mockResolvedValue(JSON.stringify(cacheEntry))
      mockCallAnalysisAgent.mockClear()

      await analyzeProject(projectId, module, chapterIds, true)
      expect(mockCallAnalysisAgent).toHaveBeenCalledTimes(2) // all chapters re-analyzed
    })
  })
})

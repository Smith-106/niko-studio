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

import { analyzeProject } from './intelligenceService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intelligenceService branch-gap additional coverage', () => {
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

    it('covers ensureDir when directory already exists (line 36 false branch)', async () => {
      mockFs.exists.mockResolvedValue(true)

      await analyzeProject(projectId, module, chapterIds)

      expect(mockFs.exists).toHaveBeenCalled()
      expect(mockFs.mkdir).not.toHaveBeenCalled()
    })

    it('covers agent response failure branch (line 100 else)', async () => {
      mockCallAnalysisAgent.mockResolvedValue({ success: false, error: 'Agent unavailable' })

      const result = await analyzeProject(projectId, module, chapterIds)

      // Per-chapter results should be empty since success is false
      expect(result.result.totalAnalyzed).toBe(0)
      expect(mockFs.writeTextFile).toHaveBeenCalled()
    })

    it('covers agent response with null data (line 100 false branch)', async () => {
      mockCallAnalysisAgent.mockResolvedValue({ success: true, data: null })

      const result = await analyzeProject(projectId, module, chapterIds)

      expect(result.result.totalAnalyzed).toBe(0)
    })

    it('covers onProgress not provided (line 104 optional chaining false branch)', async () => {
      // Call without onProgress callback - the ?.() false branch
      const result = await analyzeProject(projectId, module, chapterIds, false)

      expect(result.module).toBe(module)
      expect(result.result.totalAnalyzed).toBe(2)
    })
  })
})

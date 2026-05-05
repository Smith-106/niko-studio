import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AnalysisResult } from '../../services/intelligenceService'
import { createIntelligenceSlice, type IntelligenceSlice } from './intelligenceSlice'

type SetFn = Parameters<typeof createIntelligenceSlice>[0]

function createStore(): IntelligenceSlice {
  const initialState: IntelligenceSlice = {
    analysisResults: {},
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0 },
    analysisError: null,
    startAnalysis: async () => {},
    loadCachedResult: async () => {},
    clearAnalysis: () => {},
  }

  const state = { ...initialState }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as any) : partial
    Object.assign(state, next)
  }
  const get = () => state

  const slice = createIntelligenceSlice(set as any, get as any, {} as any)
  Object.assign(state, slice)
  return state
}

const mockAnalyzeProject = vi.fn()
const mockGetCachedAnalysis = vi.fn()

vi.mock('../../services/intelligenceService', () => ({
  analyzeProject: (...args: unknown[]) => mockAnalyzeProject(...args),
  getCachedAnalysis: (...args: unknown[]) => mockGetCachedAnalysis(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intelligenceSlice', () => {
  const mockResult: AnalysisResult = {
    module: 'pacing',
    projectId: 'p1',
    chaptersAnalyzed: ['ch1'],
    result: { score: 85 },
    createdAt: '2026-01-01T00:00:00Z',
    contentHashes: { ch1: 'abc123' },
  }

  describe('startAnalysis', () => {
    it('sets isAnalyzing and stores result on success', async () => {
      mockAnalyzeProject.mockResolvedValue(mockResult)
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisResults.pacing).toEqual(mockResult)
      expect(store.analysisError).toBeNull()
    })

    it('sets analysisError on failure', async () => {
      mockAnalyzeProject.mockRejectedValue(new Error('API failed'))
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisError).toBe('API failed')
    })

    it('calls analyzeProject with progress callback', async () => {
      mockAnalyzeProject.mockImplementation(
        async (_pid: string, _mod: string, _chapters: string[], _force: boolean, onProgress?: (p: number, t: number) => void) => {
          onProgress?.(1, 2)
          return mockResult
        },
      )
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1', 'ch2'])

      expect(mockAnalyzeProject).toHaveBeenCalledWith(
        'p1', 'pacing', ['ch1', 'ch2'], false, expect.any(Function),
      )
    })
  })

  describe('loadCachedResult', () => {
    it('loads cached result into state', async () => {
      mockGetCachedAnalysis.mockResolvedValue({ result: mockResult })
      const store = createStore()

      await store.loadCachedResult('p1', 'pacing')

      expect(store.analysisResults.pacing).toEqual(mockResult)
    })

    it('does nothing when no cache', async () => {
      mockGetCachedAnalysis.mockResolvedValue(null)
      const store = createStore()

      await store.loadCachedResult('p1', 'pacing')

      expect(store.analysisResults.pacing).toBeUndefined()
    })
  })

  describe('clearAnalysis', () => {
    it('resets all state to initial values', async () => {
      mockAnalyzeProject.mockResolvedValue(mockResult)
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])
      expect(store.analysisResults.pacing).toBeDefined()

      store.clearAnalysis()
      expect(store.analysisResults).toEqual({})
      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisProgress).toEqual({ processed: 0, total: 0 })
      expect(store.analysisError).toBeNull()
    })
  })
})

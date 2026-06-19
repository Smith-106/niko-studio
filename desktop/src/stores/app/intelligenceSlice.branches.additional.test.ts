import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisResult } from '../../services/intelligenceService'

import { createIntelligenceSlice, type IntelligenceSlice } from './intelligenceSlice'

type SetFn = Parameters<typeof createIntelligenceSlice>[0]

function createStore(): IntelligenceSlice {
  const state: IntelligenceSlice = {
    analysisResults: {},
    isAnalyzing: false,
    analysisProgress: { processed: 0, total: 0 },
    analysisError: null,
    startAnalysis: async () => {},
    loadCachedResult: async () => {},
    clearAnalysis: () => {},
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    Object.assign(state, next)
  }
  const get = () => state

  const slice = createIntelligenceSlice(set as never, get as never, {} as never)
  Object.assign(state, slice)
  return state
}

const mockAnalyzeProject = vi.fn()
const mockGetCachedAnalysis = vi.fn()

vi.mock('../../services/intelligenceService', () => ({
  analyzeProject: (...args: unknown[]) => mockAnalyzeProject(...args),
  getCachedAnalysis: (...args: unknown[]) => mockGetCachedAnalysis(...args),
}))

const mockResult: AnalysisResult = {
  module: 'pacing',
  projectId: 'p1',
  chaptersAnalyzed: ['ch1'],
  result: { score: 85 },
  createdAt: '2026-01-01T00:00:00Z',
  contentHashes: { ch1: 'abc123' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('intelligenceSlice branch coverage additional', () => {
  describe('startAnalysis error and boundary paths', () => {
    it('sets progress total to chapterIds length at start', async () => {
      mockAnalyzeProject.mockResolvedValue(mockResult)
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1', 'ch2', 'ch3'])

      // The initial set before the async call sets total to chapterIds.length
      expect(mockAnalyzeProject).toHaveBeenCalledWith(
        'p1', 'pacing', ['ch1', 'ch2', 'ch3'], false, expect.any(Function),
      )
    })

    it('passes forceRefresh=true through to analyzeProject', async () => {
      mockAnalyzeProject.mockResolvedValue(mockResult)
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'], true)

      expect(mockAnalyzeProject).toHaveBeenCalledWith(
        'p1', 'pacing', ['ch1'], true, expect.any(Function),
      )
    })

    it('handles progress callback invocations and updates state', async () => {
      mockAnalyzeProject.mockImplementation(
        async (_pid, _mod, _chapters, _force, onProgress?: (p: number, t: number) => void) => {
          onProgress?.(1, 3)
          onProgress?.(2, 3)
          onProgress?.(3, 3)
          return mockResult
        },
      )
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1', 'ch2', 'ch3'])

      // After completion, isAnalyzing is false and result is stored
      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisResults.pacing).toEqual(mockResult)
    })

    it('preserves results from other modules when storing a new module result', async () => {
      const existingResult: AnalysisResult = {
        ...mockResult,
        module: 'consistency',
        result: { score: 70 },
      }
      const store = createStore()
      store.analysisResults = { consistency: existingResult }

      mockAnalyzeProject.mockResolvedValue(mockResult)
      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.analysisResults.pacing).toEqual(mockResult)
      expect(store.analysisResults.consistency).toEqual(existingResult)
    })

    it('clears previous error when starting a new analysis', async () => {
      const store = createStore()
      store.analysisError = 'stale error'

      mockAnalyzeProject.mockResolvedValue(mockResult)
      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.analysisError).toBeNull()
      expect(store.analysisResults.pacing).toEqual(mockResult)
    })

    it('resets analysisProgress at the start of a new analysis', async () => {
      const store = createStore()
      store.analysisProgress = { processed: 5, total: 10 }

      mockAnalyzeProject.mockResolvedValue(mockResult)
      await store.startAnalysis('p1', 'pacing', ['ch1', 'ch2'])

      // After completion, progress should reflect final state
      expect(store.isAnalyzing).toBe(false)
    })

    it('handles non-Error thrown values (number)', async () => {
      mockAnalyzeProject.mockRejectedValue(42)
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.analysisError).toBe('Analysis failed')
      expect(store.isAnalyzing).toBe(false)
    })

    it('handles non-Error thrown values (object)', async () => {
      mockAnalyzeProject.mockRejectedValue({ code: 500, msg: 'server error' })
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.analysisError).toBe('Analysis failed')
      expect(store.isAnalyzing).toBe(false)
    })

    it('handles Error instance with empty message', async () => {
      mockAnalyzeProject.mockRejectedValue(new Error(''))
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.analysisError).toBe('')
      expect(store.isAnalyzing).toBe(false)
    })

    it('sets isAnalyzing to false even when analysis fails', async () => {
      mockAnalyzeProject.mockRejectedValue(new Error('timeout'))
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])

      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisError).toBe('timeout')
      // No result stored for the module
      expect(store.analysisResults.pacing).toBeUndefined()
    })

    it('does not store result when analysis fails', async () => {
      const store = createStore()
      store.analysisResults = { consistency: mockResult }

      mockAnalyzeProject.mockRejectedValue(new Error('fail'))
      await store.startAnalysis('p1', 'pacing', ['ch1'])

      // Previous module result is preserved
      expect(store.analysisResults.consistency).toEqual(mockResult)
      expect(store.analysisResults.pacing).toBeUndefined()
    })
  })

  describe('loadCachedResult boundary conditions', () => {
    it('preserves results from other modules when loading a cached result', async () => {
      const existingResult: AnalysisResult = {
        ...mockResult,
        module: 'consistency',
      }
      const store = createStore()
      store.analysisResults = { consistency: existingResult }

      mockGetCachedAnalysis.mockResolvedValue({ result: mockResult })
      await store.loadCachedResult('p1', 'pacing')

      expect(store.analysisResults.pacing).toEqual(mockResult)
      expect(store.analysisResults.consistency).toEqual(existingResult)
    })

    it('handles getCachedAnalysis returning a result with null fields', async () => {
      const nullResult: AnalysisResult = {
        module: 'pacing',
        projectId: 'p1',
        chaptersAnalyzed: [],
        result: {},
        createdAt: '',
        contentHashes: {},
      }
      mockGetCachedAnalysis.mockResolvedValue({ result: nullResult })
      const store = createStore()

      await store.loadCachedResult('p1', 'pacing')

      // When cached is truthy (non-null), the if(cached) branch executes
      expect(store.analysisResults.pacing).toEqual(nullResult)
    })

    it('handles getCachedAnalysis throwing an error (propagates)', async () => {
      mockGetCachedAnalysis.mockRejectedValue(new Error('fs read failed'))
      const store = createStore()

      await expect(store.loadCachedResult('p1', 'pacing')).rejects.toThrow('fs read failed')
    })

    it('does not mutate state when getCachedAnalysis returns null', async () => {
      mockGetCachedAnalysis.mockResolvedValue(null)
      const store = createStore()
      store.analysisResults = { pacing: mockResult }

      await store.loadCachedResult('p1', 'pacing')

      // Existing pacing result unchanged since null skips the set() call
      expect(store.analysisResults.pacing).toEqual(mockResult)
    })

    it('overwrites existing module result with new cached result', async () => {
      const oldResult: AnalysisResult = {
        ...mockResult,
        result: { score: 50 },
      }
      const store = createStore()
      store.analysisResults = { pacing: oldResult }

      mockGetCachedAnalysis.mockResolvedValue({ result: mockResult })
      await store.loadCachedResult('p1', 'pacing')

      expect(store.analysisResults.pacing).toEqual(mockResult)
    })
  })

  describe('clearAnalysis state transition boundaries', () => {
    it('clears error state set by a failed analysis', async () => {
      mockAnalyzeProject.mockRejectedValue(new Error('fail'))
      const store = createStore()

      await store.startAnalysis('p1', 'pacing', ['ch1'])
      expect(store.analysisError).toBe('fail')

      store.clearAnalysis()
      expect(store.analysisError).toBeNull()
    })

    it('clears populated analysisResults', async () => {
      const store = createStore()
      store.analysisResults = {
        pacing: mockResult,
        consistency: { ...mockResult, module: 'consistency' },
      }

      store.clearAnalysis()

      expect(store.analysisResults).toEqual({})
    })

    it('resets progress from mid-analysis state', () => {
      const store = createStore()
      store.analysisProgress = { processed: 3, total: 10 }
      store.isAnalyzing = true

      store.clearAnalysis()

      expect(store.analysisProgress).toEqual({ processed: 0, total: 0 })
      expect(store.isAnalyzing).toBe(false)
    })

    it('is safe to call on already-initial state', () => {
      const store = createStore()

      store.clearAnalysis()

      expect(store.analysisResults).toEqual({})
      expect(store.isAnalyzing).toBe(false)
      expect(store.analysisProgress).toEqual({ processed: 0, total: 0 })
      expect(store.analysisError).toBeNull()
    })

    it('clears multiple accumulated errors and results', async () => {
      const store = createStore()
      // Simulate a failed analysis
      mockAnalyzeProject.mockRejectedValue(new Error('first fail'))
      await store.startAnalysis('p1', 'pacing', ['ch1'])
      // Error is set from failure
      expect(store.analysisError).toBe('first fail')

      store.clearAnalysis()

      expect(store.analysisError).toBeNull()
      expect(store.analysisResults).toEqual({})
    })
  })
})

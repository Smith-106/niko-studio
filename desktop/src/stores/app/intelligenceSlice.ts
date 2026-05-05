import type { AppSlice } from '../appStore'
import { analyzeProject, getCachedAnalysis, type AnalysisResult } from '../../services/intelligenceService'
import type { AnalysisModule } from '../../api/intelligence'

export interface IntelligenceSlice {
  analysisResults: Partial<Record<AnalysisModule, AnalysisResult | null>>
  isAnalyzing: boolean
  analysisProgress: { processed: number; total: number }
  analysisError: string | null

  startAnalysis: (projectId: string, module: AnalysisModule, chapterIds: string[], forceRefresh?: boolean) => Promise<void>
  loadCachedResult: (projectId: string, module: AnalysisModule) => Promise<void>
  clearAnalysis: () => void
}

export const createIntelligenceSlice: AppSlice<IntelligenceSlice> = (set) => ({
  analysisResults: {},
  isAnalyzing: false,
  analysisProgress: { processed: 0, total: 0 },
  analysisError: null,

  startAnalysis: async (projectId, module, chapterIds, forceRefresh = false) => {
    set({ isAnalyzing: true, analysisProgress: { processed: 0, total: chapterIds.length }, analysisError: null })
    try {
      const result = await analyzeProject(projectId, module, chapterIds, forceRefresh, (processed, total) => {
        set({ analysisProgress: { processed, total } })
      })
      set((state) => ({
        analysisResults: { ...state.analysisResults, [module]: result },
        isAnalyzing: false,
      }))
    } catch (err) {
      set({
        analysisError: err instanceof Error ? err.message : 'Analysis failed',
        isAnalyzing: false,
      })
    }
  },

  loadCachedResult: async (projectId, module) => {
    const cached = await getCachedAnalysis(projectId, module)
    if (cached) {
      set((state) => ({
        analysisResults: { ...state.analysisResults, [module]: cached.result },
      }))
    }
  },

  clearAnalysis: () => {
    set({
      analysisResults: {},
      isAnalyzing: false,
      analysisProgress: { processed: 0, total: 0 },
      analysisError: null,
    })
  },
})

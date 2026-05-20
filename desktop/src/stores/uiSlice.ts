import type { AppSlice } from './appStore'

export interface WordMetrics {
  wordCount: number
  charCount: number
  readingTime: number
}

export interface UiSlice {
  focusMode: boolean
  wordMetrics: WordMetrics
  sidebarExpanded: boolean
  historyPanelOpen: boolean
  sessionIntelligenceEnabled: boolean
  sessionIntelligenceSummary: string | null
  sessionIntelligenceInsights: string[]
  sessionIntelligenceSessionId: string | null
  personalizedCraftEnabled: boolean
  personalizedCraftSummary: string | null
  personalizedCraftTrajectory: string | null
  personalizedCraftRecommendations: string[]
  toggleFocusMode: () => void
  setFocusMode: (value: boolean) => void
  updateWordMetrics: (metrics: Partial<WordMetrics>) => void
  toggleSidebar: () => void
  setSidebarExpanded: (value: boolean) => void
  toggleHistoryPanel: () => void
  setHistoryPanelOpen: (value: boolean) => void
  setSessionIntelligenceEnabled: (value: boolean) => void
  setSessionIntelligenceSummary: (value: string | null) => void
  setSessionIntelligenceInsights: (value: string[]) => void
  setSessionIntelligenceSessionId: (value: string | null) => void
  setPersonalizedCraftEnabled: (value: boolean) => void
  setPersonalizedCraftSummary: (value: string | null) => void
  setPersonalizedCraftTrajectory: (value: string | null) => void
  setPersonalizedCraftRecommendations: (value: string[]) => void
}

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
  focusMode: false,
  wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 },
  sidebarExpanded: false,
  historyPanelOpen: false,
  sessionIntelligenceEnabled: false,
  sessionIntelligenceSummary: null,
  sessionIntelligenceInsights: [],
  sessionIntelligenceSessionId: null,
  personalizedCraftEnabled: false,
  personalizedCraftSummary: null,
  personalizedCraftTrajectory: null,
  personalizedCraftRecommendations: [],
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setFocusMode: (value) => set({ focusMode: value }),
  updateWordMetrics: (metrics) =>
    set((state) => ({
      wordMetrics: { ...state.wordMetrics, ...metrics },
    })),
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setSidebarExpanded: (value) => set({ sidebarExpanded: value }),
  toggleHistoryPanel: () => set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),
  setHistoryPanelOpen: (value) => set({ historyPanelOpen: value }),
  setSessionIntelligenceEnabled: (value) => set({ sessionIntelligenceEnabled: value }),
  setSessionIntelligenceSummary: (value) => set({ sessionIntelligenceSummary: value }),
  setSessionIntelligenceInsights: (value) => set({ sessionIntelligenceInsights: value }),
  setSessionIntelligenceSessionId: (value) => set({ sessionIntelligenceSessionId: value }),
  setPersonalizedCraftEnabled: (value) => set({ personalizedCraftEnabled: value }),
  setPersonalizedCraftSummary: (value) => set({ personalizedCraftSummary: value }),
  setPersonalizedCraftTrajectory: (value) => set({ personalizedCraftTrajectory: value }),
  setPersonalizedCraftRecommendations: (value) => set({ personalizedCraftRecommendations: value }),
})
